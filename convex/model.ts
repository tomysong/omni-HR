import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// ---------- shared validators ----------

export const leaveRequestType = v.union(
  v.literal("annual"),
  v.literal("halfAnnual"),
  v.literal("quarterAnnual"),
  v.literal("compensatory"),
  v.literal("bereavement"),
  v.literal("sick"),
  v.literal("official"),
  v.literal("unpaid"),
);

export const employeeRole = v.union(
  v.literal("employee"),
  v.literal("approver"),
  v.literal("admin"),
  v.literal("systemAdmin"),
);

export const employmentStatus = v.union(
  v.literal("active"),
  v.literal("leaveOfAbsence"),
  v.literal("resigned"),
);

// ---------- constants ----------

const ANNUAL_TYPES = ["annual", "halfAnnual", "quarterAnnual"] as const;

// 관리자 수동 입력값 상한 (오입력 방어)
export const MAX_ANNUAL_DAYS = 50;
export const MAX_COMPENSATORY_DAYS = 30;
export const MAX_REQUEST_AMOUNT_DAYS = 30;

export const DEFAULT_POLICY = {
  name: "기본 연차 정책",
  yearBasis: "hireDate",
  fiscalYearStartMonth: 1,
  annualLeaveCapDays: 25,
  allowQuarterDay: true,
  approvalSteps: 1,
  compensatoryExpiryDays: null,
  promotionFirstNoticeMonthsBeforeExpiry: 6,
  promotionSecondNoticeMonthsBeforeExpiry: 2,
} as const;

export type AppCtx = QueryCtx | MutationCtx;
export type ViewerProfile = Doc<"employeeProfiles">;

// ---------- auth guards ----------

export async function requireViewer(ctx: AppCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("로그인이 필요합니다.");
  }
  const user = await ctx.db.get(userId);
  if (user === null) {
    throw new Error("사용자를 찾을 수 없습니다.");
  }
  return { userId, user };
}

export async function profileForUser(ctx: AppCtx, userId: Id<"users">) {
  return await ctx.db
    .query("employeeProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export function canApprove(profile: ViewerProfile | null) {
  return (
    profile?.role === "approver" ||
    profile?.role === "admin" ||
    profile?.role === "systemAdmin"
  );
}

export function canManage(profile: ViewerProfile | null) {
  return profile?.role === "admin" || profile?.role === "systemAdmin";
}

// 프로필이 연결된(승인된) 재직자만 통과
export async function requireEmployee(ctx: AppCtx) {
  const { userId, user } = await requireViewer(ctx);
  const profile = await profileForUser(ctx, userId);
  if (profile === null) {
    throw new Error("승인된 직원 계정이 아닙니다.");
  }
  if (profile.employmentStatus !== "active") {
    throw new Error("재직 상태가 아닌 계정입니다.");
  }
  return { userId, user, profile };
}

export async function requireAdmin(ctx: AppCtx) {
  const { userId, user } = await requireViewer(ctx);
  const profile = await profileForUser(ctx, userId);
  if (!canManage(profile)) {
    throw new Error("관리자 권한이 필요합니다.");
  }
  return { userId, user, profile: profile! };
}

// ---------- policy ----------

export async function activePolicy(ctx: AppCtx) {
  return await ctx.db
    .query("leavePolicies")
    .withIndex("by_active", (q) => q.eq("isActive", true))
    .first();
}

// ---------- date/number helpers ----------

export function yearFromDate(date: string) {
  return Number(date.slice(0, 4));
}

export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isAnnualType(type: string) {
  return ANNUAL_TYPES.some((annualType) => annualType === type);
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function requireValidDate(value: string, label: string) {
  if (!DATE_PATTERN.test(value) || Number.isNaN(new Date(value).getTime())) {
    throw new Error(`${label} 형식이 올바르지 않습니다. (YYYY-MM-DD)`);
  }
}

// ---------- leave calculation ----------

export function annualGrantForHireDate(hireDate: string, referenceYear: number) {
  const hireYear = yearFromDate(hireDate);
  const tenureYears = Math.max(referenceYear - hireYear, 0);
  if (tenureYears === 0) {
    return 11;
  }
  return Math.min(15 + Math.floor(Math.max(tenureYears - 1, 0) / 2), 25);
}

export async function annualBalance(
  ctx: AppCtx,
  employeeProfileId: Id<"employeeProfiles">,
  year: number,
) {
  const [grants, requests] = await Promise.all([
    ctx.db
      .query("leaveGrants")
      .withIndex("by_employee_year", (q) =>
        q.eq("employeeProfileId", employeeProfileId).eq("year", year),
      )
      .collect(),
    ctx.db
      .query("leaveRequests")
      .withIndex("by_employee", (q) =>
        q.eq("employeeProfileId", employeeProfileId),
      )
      .collect(),
  ]);

  const grantedDays = grants.reduce((sum, grant) => sum + grant.grantedDays, 0);
  const usedDays = requests
    .filter(
      (request) => request.status === "approved" && isAnnualType(request.type),
    )
    .reduce((sum, request) => sum + request.amount, 0);
  const pendingDays = requests
    .filter(
      (request) => request.status === "pending" && isAnnualType(request.type),
    )
    .reduce((sum, request) => sum + request.amount, 0);

  return {
    grantedDays: round2(grantedDays),
    usedDays: round2(usedDays),
    pendingDays: round2(pendingDays),
    remainingDays: round2(grantedDays - usedDays - pendingDays),
    nextExpiry:
      grants
        .map((grant) => grant.expiresOn)
        .sort((a, b) => a.localeCompare(b))[0] ?? null,
  };
}

export async function compensatoryBalance(
  ctx: AppCtx,
  employeeProfileId: Id<"employeeProfiles">,
) {
  const credits = await ctx.db
    .query("compensatoryCredits")
    .withIndex("by_employee", (q) =>
      q.eq("employeeProfileId", employeeProfileId),
    )
    .collect();

  const creditedDays = credits.reduce(
    (sum, credit) => sum + credit.creditedDays,
    0,
  );
  const usedDays = credits.reduce((sum, credit) => sum + credit.usedDays, 0);
  const nextExpiry =
    credits
      .map((credit) => credit.expiresOn)
      .filter((expiresOn): expiresOn is string => expiresOn !== null)
      .sort((a, b) => a.localeCompare(b))[0] ?? null;

  return {
    creditedDays: round2(creditedDays),
    usedDays: round2(usedDays),
    remainingDays: round2(creditedDays - usedDays),
    nextExpiry,
  };
}

export async function consumeCompensatoryDays(
  ctx: MutationCtx,
  employeeProfileId: Id<"employeeProfiles">,
  days: number,
) {
  let remaining = days;
  const credits = await ctx.db
    .query("compensatoryCredits")
    .withIndex("by_employee", (q) =>
      q.eq("employeeProfileId", employeeProfileId),
    )
    .collect();

  for (const credit of credits) {
    if (remaining <= 0) {
      break;
    }
    const available = credit.creditedDays - credit.usedDays;
    if (available <= 0) {
      continue;
    }
    const toUse = Math.min(available, remaining);
    await ctx.db.patch(credit._id, {
      usedDays: round2(credit.usedDays + toUse),
      updatedAt: Date.now(),
    });
    remaining = round2(remaining - toUse);
  }

  if (remaining > 0) {
    throw new Error("대체휴무 잔여가 부족합니다.");
  }
}

export async function ensureGrant(
  ctx: MutationCtx,
  employeeProfileId: Id<"employeeProfiles">,
  year: number,
  grantedDays: number,
  expiresOn: string,
  now: number,
) {
  const existing = await ctx.db
    .query("leaveGrants")
    .withIndex("by_employee_year", (q) =>
      q.eq("employeeProfileId", employeeProfileId).eq("year", year),
    )
    .first();
  if (existing !== null) {
    return;
  }
  await ctx.db.insert("leaveGrants", {
    employeeProfileId,
    year,
    grantedDays,
    reason: "initial-seed",
    basisSnapshot: "입사일 기준 자동 산정",
    expiresOn,
    createdAt: now,
    updatedAt: now,
  });
}

// ---------- read models ----------

export async function enrichRequests(
  ctx: AppCtx,
  requests: Doc<"leaveRequests">[],
) {
  return await Promise.all(
    requests.map(async (request) => {
      const [employee, approver] = await Promise.all([
        ctx.db.get(request.employeeProfileId),
        request.approverProfileId
          ? ctx.db.get(request.approverProfileId)
          : null,
      ]);
      return {
        ...request,
        employeeName: employee?.name ?? "알 수 없음",
        department: employee?.department ?? "-",
        approverName: approver?.name ?? null,
      };
    }),
  );
}

// includeSensitive=false 면 잔여/이메일/사번 등 민감 필드는 null 로 마스킹
export async function employeeSummary(
  ctx: AppCtx,
  employee: Doc<"employeeProfiles">,
  year: number,
  includeSensitive: boolean,
) {
  if (!includeSensitive) {
    return {
      _id: employee._id,
      employeeNo: null as string | null,
      name: employee.name,
      email: null as string | null,
      department: employee.department,
      title: employee.title ?? "",
      role: employee.role,
      hireDate: null as string | null,
      employmentStatus: employee.employmentStatus,
      annualRemainingDays: null as number | null,
      compensatoryRemainingDays: null as number | null,
      pendingRequests: null as number | null,
    };
  }

  const [annual, compensatory, requests] = await Promise.all([
    annualBalance(ctx, employee._id, year),
    compensatoryBalance(ctx, employee._id),
    ctx.db
      .query("leaveRequests")
      .withIndex("by_employee", (q) => q.eq("employeeProfileId", employee._id))
      .collect(),
  ]);

  return {
    _id: employee._id,
    employeeNo: employee.employeeNo as string | null,
    name: employee.name,
    email: (employee.email ?? null) as string | null,
    department: employee.department,
    title: employee.title ?? "",
    role: employee.role,
    hireDate: employee.hireDate as string | null,
    employmentStatus: employee.employmentStatus,
    annualRemainingDays: annual.remainingDays as number | null,
    compensatoryRemainingDays: compensatory.remainingDays as number | null,
    pendingRequests: requests.filter(
      (request) => request.status === "pending",
    ).length as number | null,
  };
}

// ---------- audit ----------

export async function logAudit(
  ctx: MutationCtx,
  actorProfileId: Id<"employeeProfiles"> | undefined,
  entityTable: string,
  entityId: string,
  action: string,
  before?: unknown,
  after?: unknown,
) {
  await ctx.db.insert("auditLogs", {
    actorProfileId,
    entityTable,
    entityId,
    action,
    before,
    after,
    createdAt: Date.now(),
  });
}
