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

// 서버 측 유형 라벨 (이메일 등 알림 본문용). 클라이언트 TYPE_LABELS와 동일하게 유지.
export const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "연차",
  halfAnnual: "반차",
  quarterAnnual: "반반차",
  compensatory: "대체휴무",
  bereavement: "경조사",
  sick: "병가",
  official: "공가",
  unpaid: "무급",
};

// 프로필 이메일이 없으면 연결된 로그인 계정 이메일로 폴백
export async function emailForProfile(
  ctx: AppCtx,
  profile: Doc<"employeeProfiles">,
): Promise<string | null> {
  if (profile.email) {
    return profile.email;
  }
  if (profile.userId) {
    const user = await ctx.db.get(profile.userId);
    return user?.email ?? null;
  }
  return null;
}

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
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function requireValidDate(value: string, label: string) {
  if (!DATE_PATTERN.test(value)) {
    throw new Error(`${label} 형식이 올바르지 않습니다. (YYYY-MM-DD)`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${label} 형식이 올바르지 않습니다. (YYYY-MM-DD)`);
  }
}

// 한국 시간(KST, UTC+9) 기준 오늘 날짜
export function kstToday() {
  return kstDateForTimestamp(Date.now());
}

export function kstDateForTimestamp(timestamp: number) {
  return new Date(timestamp + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function kstDateAfterDays(timestamp: number, days: number) {
  return kstDateForTimestamp(timestamp + days * DAY_MS);
}

export function weekendName(date: string): string | null {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (day === 6) return "토요일";
  if (day === 0) return "일요일";
  return null;
}

// 휴일 판정: 토/일 + holidays 테이블(정부 지정 공휴일, 관리자 추가분 포함)
export async function holidayInfo(ctx: AppCtx, date: string) {
  const weekend = weekendName(date);
  if (weekend !== null) {
    return { isHoliday: true, kind: "weekend" as const, name: weekend };
  }
  const row = await ctx.db
    .query("holidays")
    .withIndex("by_date", (q) => q.eq("date", date))
    .first();
  if (row !== null) {
    return { isHoliday: true, kind: "public" as const, name: row.name };
  }
  return { isHoliday: false, kind: null, name: null };
}

// ---------- leave calculation ----------

export function annualGrantForHireDate(
  hireDate: string,
  referenceYear: number,
  annualLeaveCapDays: number = DEFAULT_POLICY.annualLeaveCapDays,
) {
  const hireYear = yearFromDate(hireDate);
  const tenureYears = Math.max(referenceYear - hireYear, 0);
  const capped = (days: number) => Math.min(days, annualLeaveCapDays);
  if (tenureYears === 0) {
    return capped(11);
  }
  return capped(15 + Math.floor(Math.max(tenureYears - 1, 0) / 2));
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
  const [credits, requests] = await Promise.all([
    ctx.db
      .query("compensatoryCredits")
      .withIndex("by_employee", (q) =>
        q.eq("employeeProfileId", employeeProfileId),
      )
      .collect(),
    ctx.db
      .query("leaveRequests")
      .withIndex("by_employee", (q) =>
        q.eq("employeeProfileId", employeeProfileId),
      )
      .collect(),
  ]);

  const today = kstToday();
  const activeCredits = credits.filter(
    (credit) => credit.expiresOn === null || credit.expiresOn >= today,
  );

  const creditedDays = activeCredits.reduce(
    (sum, credit) => sum + credit.creditedDays,
    0,
  );
  const usedDays = activeCredits.reduce(
    (sum, credit) => sum + credit.usedDays,
    0,
  );
  const pendingDays = requests
    .filter(
      (request) =>
        request.status === "pending" && request.type === "compensatory",
    )
    .reduce((sum, request) => sum + request.amount, 0);
  const nextExpiry =
    activeCredits
      .filter((credit) => credit.creditedDays - credit.usedDays > 0)
      .map((credit) => credit.expiresOn)
      .filter((expiresOn): expiresOn is string => expiresOn !== null)
      .sort((a, b) => a.localeCompare(b))[0] ?? null;

  return {
    creditedDays: round2(creditedDays),
    usedDays: round2(usedDays),
    pendingDays: round2(pendingDays),
    remainingDays: round2(creditedDays - usedDays - pendingDays),
    nextExpiry,
  };
}

export async function consumeCompensatoryDays(
  ctx: MutationCtx,
  employeeProfileId: Id<"employeeProfiles">,
  days: number,
) {
  let remaining = days;
  const today = kstToday();
  const credits = await ctx.db
    .query("compensatoryCredits")
    .withIndex("by_employee", (q) =>
      q.eq("employeeProfileId", employeeProfileId),
    )
    .collect();

  const consumableCredits = credits
    .filter((credit) => credit.expiresOn === null || credit.expiresOn >= today)
    .sort((a, b) => {
      if (a.expiresOn === b.expiresOn) {
        return a.createdAt - b.createdAt;
      }
      if (a.expiresOn === null) return 1;
      if (b.expiresOn === null) return -1;
      return a.expiresOn.localeCompare(b.expiresOn);
    });

  for (const credit of consumableCredits) {
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
    pendingRequests: requests.filter((request) => request.status === "pending")
      .length as number | null,
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
