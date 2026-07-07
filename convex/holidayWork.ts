import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  activePolicy,
  canApprove,
  canManage,
  holidayInfo,
  kstToday,
  logAudit,
  requireAdmin,
  requireEmployee,
  requireValidDate,
} from "./model";

// 허용 적립량: 반일(0.5) 또는 종일(1)
function requireValidAmount(amountDays: number) {
  if (amountDays !== 0.5 && amountDays !== 1) {
    throw new Error("적립량은 0.5일 또는 1일만 가능합니다.");
  }
}

async function requireHolidayWorkDate(ctx: MutationCtx, workDate: string) {
  requireValidDate(workDate, "근무일");
  if (workDate > kstToday()) {
    throw new Error("미래 날짜는 보고할 수 없습니다.");
  }
  const info = await holidayInfo(ctx, workDate);
  if (!info.isHoliday) {
    throw new Error(
      "휴일(토·일·공휴일)이 아닌 날짜입니다. 공휴일 누락 시 관리자에게 등록을 요청하세요.",
    );
  }
  return info;
}

async function requireNoDuplicate(
  ctx: MutationCtx,
  employeeProfileId: Id<"employeeProfiles">,
  workDate: string,
) {
  const existing = await ctx.db
    .query("holidayWorkRecords")
    .withIndex("by_employee_date", (q) =>
      q.eq("employeeProfileId", employeeProfileId).eq("workDate", workDate),
    )
    .collect();
  if (existing.some((record) => record.status !== "rejected")) {
    throw new Error("해당 날짜에 이미 보고(대기/승인)가 있습니다.");
  }
}

async function insertCompCredit(
  ctx: MutationCtx,
  employeeProfileId: Id<"employeeProfiles">,
  workDate: string,
  creditedDays: number,
  holidayName: string,
  now: number,
) {
  const policy = await activePolicy(ctx);
  const expiresOn =
    policy?.compensatoryExpiryDays != null
      ? new Date(now + policy.compensatoryExpiryDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10)
      : null;
  await ctx.db.insert("compensatoryCredits", {
    employeeProfileId,
    sourceWorkDate: workDate,
    creditedDays,
    usedDays: 0,
    expiresOn,
    note: `휴일근무 적립 (${holidayName})`,
    createdAt: now,
    updatedAt: now,
  });
}

async function enrichRecords(
  ctx: Parameters<typeof holidayInfo>[0],
  records: Doc<"holidayWorkRecords">[],
) {
  return await Promise.all(
    records.map(async (record) => {
      const [employee, approver] = await Promise.all([
        ctx.db.get(record.employeeProfileId),
        record.approverProfileId ? ctx.db.get(record.approverProfileId) : null,
      ]);
      return {
        ...record,
        employeeName: employee?.name ?? "알 수 없음",
        department: employee?.department ?? "-",
        approverName: approver?.name ?? null,
      };
    }),
  );
}

// 직원: 휴일근무 보고 (승인 후 적립)
export const reportHolidayWork = mutation({
  args: {
    workDate: v.string(),
    amountDays: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireEmployee(ctx);
    requireValidAmount(args.amountDays);
    if (args.note !== undefined && args.note.length > 200) {
      throw new Error("비고는 200자 이내로 입력해야 합니다.");
    }
    await requireHolidayWorkDate(ctx, args.workDate);
    await requireNoDuplicate(ctx, profile._id, args.workDate);

    const now = Date.now();
    const recordId = await ctx.db.insert("holidayWorkRecords", {
      employeeProfileId: profile._id,
      workDate: args.workDate,
      amountDays: args.amountDays,
      note: args.note?.trim() || undefined,
      status: "pending",
      reportedByProfileId: profile._id,
      createdAt: now,
      updatedAt: now,
    });

    await logAudit(
      ctx,
      profile._id,
      "holidayWorkRecords",
      recordId,
      "reportHolidayWork",
      undefined,
      args,
    );
    return { ok: true };
  },
});

// 승인자: 휴일근무 보고 승인/반려. 승인 시 대체휴무 적립.
export const decideHolidayWork = mutation({
  args: {
    recordId: v.id("holidayWorkRecords"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, { recordId, decision, rejectionReason }) => {
    const { profile: approver } = await requireEmployee(ctx);
    if (!canApprove(approver)) {
      throw new Error("승인 권한이 필요합니다.");
    }

    const record = await ctx.db.get(recordId);
    if (record === null) {
      throw new Error("보고를 찾을 수 없습니다.");
    }
    if (record.status !== "pending") {
      throw new Error("이미 처리된 보고입니다.");
    }
    if (record.employeeProfileId === approver._id && !canManage(approver)) {
      throw new Error("본인 보고는 본인이 결재할 수 없습니다.");
    }

    const now = Date.now();
    if (decision === "approved") {
      const info = await holidayInfo(ctx, record.workDate);
      await insertCompCredit(
        ctx,
        record.employeeProfileId,
        record.workDate,
        record.amountDays,
        info.name ?? "휴일",
        now,
      );
    }

    await ctx.db.patch(recordId, {
      status: decision,
      rejectionReason: decision === "rejected" ? rejectionReason : undefined,
      approverProfileId: approver._id,
      decidedAt: now,
      updatedAt: now,
    });

    await logAudit(
      ctx,
      approver._id,
      "holidayWorkRecords",
      recordId,
      "decideHolidayWork",
      record,
      { decision, rejectionReason },
    );
    return { ok: true };
  },
});

// 관리자: 직원 휴일근무 직접 기록 (즉시 승인 + 적립)
export const adminRecordHolidayWork = mutation({
  args: {
    employeeProfileId: v.id("employeeProfiles"),
    workDate: v.string(),
    amountDays: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile: adminProfile } = await requireAdmin(ctx);
    requireValidAmount(args.amountDays);
    if (args.note !== undefined && args.note.length > 200) {
      throw new Error("비고는 200자 이내로 입력해야 합니다.");
    }

    const employee = await ctx.db.get(args.employeeProfileId);
    if (employee === null) {
      throw new Error("직원을 찾을 수 없습니다.");
    }

    const info = await requireHolidayWorkDate(ctx, args.workDate);
    await requireNoDuplicate(ctx, args.employeeProfileId, args.workDate);

    const now = Date.now();
    const recordId = await ctx.db.insert("holidayWorkRecords", {
      employeeProfileId: args.employeeProfileId,
      workDate: args.workDate,
      amountDays: args.amountDays,
      note: args.note?.trim() || undefined,
      status: "approved",
      reportedByProfileId: adminProfile._id,
      approverProfileId: adminProfile._id,
      decidedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await insertCompCredit(
      ctx,
      args.employeeProfileId,
      args.workDate,
      args.amountDays,
      info.name ?? "휴일",
      now,
    );

    await logAudit(
      ctx,
      adminProfile._id,
      "holidayWorkRecords",
      recordId,
      "adminRecordHolidayWork",
      undefined,
      args,
    );
    return { ok: true };
  },
});

// 내 휴일근무 보고 목록
export const myHolidayWork = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireEmployee(ctx);
    const records = await ctx.db
      .query("holidayWorkRecords")
      .withIndex("by_employee", (q) => q.eq("employeeProfileId", profile._id))
      .order("desc")
      .take(12);
    return await enrichRecords(ctx, records);
  },
});

// 승인자: 대기 중인 휴일근무 보고 목록
export const pendingHolidayWork = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireEmployee(ctx);
    if (!canApprove(profile)) {
      return [];
    }
    const records = await ctx.db
      .query("holidayWorkRecords")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(20);
    return await enrichRecords(ctx, records);
  },
});
