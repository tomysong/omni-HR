import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  DEFAULT_POLICY,
  MAX_REQUEST_AMOUNT_DAYS,
  activePolicy,
  annualBalance,
  canApprove,
  canManage,
  compensatoryBalance,
  consumeCompensatoryDays,
  employeeSummary,
  enrichRequests,
  isAnnualType,
  leaveRequestType,
  logAudit,
  profileForUser,
  requireEmployee,
  requireValidDate,
  requireViewer,
  round2,
  yearFromDate,
} from "./model";

export const workspace = query({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    const { userId, user } = await requireViewer(ctx);
    const profile = await profileForUser(ctx, userId);
    const policy = (await activePolicy(ctx)) ?? DEFAULT_POLICY;

    if (profile === null) {
      return {
        setupNeeded: true,
        viewer: {
          name: user.name ?? user.email ?? "사용자",
          email: user.email ?? null,
          role: "employee" as const,
          department: "",
        },
        policy,
        annual: null,
        compensatory: null,
        myRequests: [],
        approvalQueue: [],
        employees: [],
      };
    }

    const year = yearFromDate(today);
    const includeSensitive = canApprove(profile);
    const [annual, compensatory, myRequests, approvalQueue, employees] =
      await Promise.all([
        annualBalance(ctx, profile._id, year),
        compensatoryBalance(ctx, profile._id),
        ctx.db
          .query("leaveRequests")
          .withIndex("by_employee", (q) =>
            q.eq("employeeProfileId", profile._id),
          )
          .order("desc")
          .take(12),
        canApprove(profile)
          ? ctx.db
              .query("leaveRequests")
              .withIndex("by_status", (q) => q.eq("status", "pending"))
              .order("desc")
              .take(20)
          : Promise.resolve([]),
        ctx.db.query("employeeProfiles").collect(),
      ]);

    const sortedEmployees = employees.sort((a, b) => {
      if (a.employmentStatus !== b.employmentStatus) {
        return a.employmentStatus === "active" ? -1 : 1;
      }
      return a.name.localeCompare(b.name, "ko");
    });

    return {
      setupNeeded: false,
      viewer: {
        name: profile.name,
        email: profile.email ?? user.email ?? null,
        role: profile.role,
        department: profile.department,
      },
      policy,
      annual,
      compensatory,
      myRequests: await enrichRequests(ctx, myRequests),
      approvalQueue: await enrichRequests(ctx, approvalQueue),
      employees: await Promise.all(
        sortedEmployees.map((employee) =>
          employeeSummary(ctx, employee, year, includeSensitive),
        ),
      ),
    };
  },
});

export const createLeaveRequest = mutation({
  args: {
    type: leaveRequestType,
    startDate: v.string(),
    endDate: v.string(),
    amount: v.number(),
    unit: v.union(v.literal("day"), v.literal("hour")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireEmployee(ctx);

    requireValidDate(args.startDate, "시작일");
    requireValidDate(args.endDate, "종료일");
    if (args.startDate > args.endDate) {
      throw new Error("종료일은 시작일보다 빠를 수 없습니다.");
    }
    if (args.amount <= 0) {
      throw new Error("수량은 0보다 커야 합니다.");
    }
    if (args.amount > MAX_REQUEST_AMOUNT_DAYS) {
      throw new Error(
        `한 번에 ${MAX_REQUEST_AMOUNT_DAYS}일을 초과해 신청할 수 없습니다.`,
      );
    }
    if (args.reason !== undefined && args.reason.length > 500) {
      throw new Error("사유는 500자 이내로 입력해야 합니다.");
    }

    const year = yearFromDate(args.startDate);
    if (isAnnualType(args.type)) {
      const balance = await annualBalance(ctx, profile._id, year);
      if (args.amount > balance.remainingDays) {
        throw new Error("연차 잔여가 부족합니다.");
      }
    }
    if (args.type === "compensatory") {
      const balance = await compensatoryBalance(ctx, profile._id);
      if (args.amount > balance.remainingDays) {
        throw new Error("대체휴무 잔여가 부족합니다.");
      }
    }

    const now = Date.now();
    const requestId = await ctx.db.insert("leaveRequests", {
      employeeProfileId: profile._id,
      type: args.type,
      startDate: args.startDate,
      endDate: args.endDate,
      amount: round2(args.amount),
      unit: args.unit,
      status: "pending",
      reason: args.reason,
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await logAudit(
      ctx,
      profile._id,
      "leaveRequests",
      requestId,
      "createLeaveRequest",
      undefined,
      args,
    );
  },
});

export const decideRequest = mutation({
  args: {
    requestId: v.id("leaveRequests"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, { requestId, decision, rejectionReason }) => {
    const { profile: approver } = await requireEmployee(ctx);
    if (!canApprove(approver)) {
      throw new Error("승인 권한이 필요합니다.");
    }

    const request = await ctx.db.get(requestId);
    if (request === null) {
      throw new Error("신청을 찾을 수 없습니다.");
    }
    if (request.status !== "pending") {
      throw new Error("이미 처리된 신청입니다.");
    }
    // 자기 신청 자기 결재 금지
    if (request.employeeProfileId === approver._id && !canManage(approver)) {
      throw new Error("본인 신청은 본인이 결재할 수 없습니다.");
    }

    if (decision === "approved" && request.type === "compensatory") {
      await consumeCompensatoryDays(
        ctx,
        request.employeeProfileId,
        request.amount,
      );
    }

    const now = Date.now();
    await ctx.db.patch(requestId, {
      approverProfileId: approver._id,
      status: decision,
      rejectionReason: decision === "rejected" ? rejectionReason : undefined,
      decidedAt: now,
      updatedAt: now,
    });

    await logAudit(
      ctx,
      approver._id,
      "leaveRequests",
      requestId,
      "decideRequest",
      request,
      { decision, rejectionReason },
    );
  },
});
