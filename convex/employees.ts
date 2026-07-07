import { v } from "convex/values";
import { mutation } from "./_generated/server";
import {
  DEFAULT_POLICY,
  MAX_ANNUAL_DAYS,
  MAX_COMPENSATORY_DAYS,
  activePolicy,
  annualGrantForHireDate,
  employeeRole,
  employmentStatus,
  ensureGrant,
  logAudit,
  requireAdmin,
  requireValidDate,
  requireViewer,
} from "./model";

// 최초 1회: 조직에 프로필이 하나도 없을 때만 실행 가능.
// 실행한 사용자가 첫 관리자가 되고 기본 정책이 생성된다.
export const bootstrapWorkspace = mutation({
  args: {
    name: v.string(),
    department: v.string(),
    hireDate: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireViewer(ctx);

    const anyProfile = await ctx.db.query("employeeProfiles").first();
    if (anyProfile !== null) {
      throw new Error(
        "이미 조직이 설정되어 있습니다. 관리자에게 가입 승인을 요청하세요.",
      );
    }

    const name = args.name.trim();
    const department = args.department.trim();
    if (name.length === 0 || department.length === 0) {
      throw new Error("이름과 부서를 입력해야 합니다.");
    }
    requireValidDate(args.hireDate, "입사일");

    const now = Date.now();
    const year = new Date(now).getUTCFullYear();

    if ((await activePolicy(ctx)) === null) {
      await ctx.db.insert("leavePolicies", {
        ...DEFAULT_POLICY,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    const profileId = await ctx.db.insert("employeeProfiles", {
      userId,
      employeeNo: "ADM-001",
      name,
      email: user.email ?? undefined,
      department,
      title: "관리자",
      role: "admin",
      hireDate: args.hireDate,
      employmentStatus: "active",
      createdAt: now,
      updatedAt: now,
    });

    await ensureGrant(
      ctx,
      profileId,
      year,
      annualGrantForHireDate(args.hireDate, year),
      `${year}-12-31`,
      now,
    );

    await logAudit(
      ctx,
      profileId,
      "employeeProfiles",
      profileId,
      "bootstrapWorkspace",
      undefined,
      { name, department },
    );

    return { ok: true };
  },
});

// 계정 없이 직원 정보만 먼저 등록하는 관리자 기능 (추후 가입 승인 시 연결 안 함 — 별도 인력 대장용)
export const createEmployeeProfile = mutation({
  args: {
    employeeNo: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    department: v.string(),
    title: v.optional(v.string()),
    role: employeeRole,
    hireDate: v.string(),
    employmentStatus,
  },
  handler: async (ctx, args) => {
    const { profile: adminProfile } = await requireAdmin(ctx);

    requireValidDate(args.hireDate, "입사일");
    const existing = await ctx.db
      .query("employeeProfiles")
      .filter((q) => q.eq(q.field("employeeNo"), args.employeeNo))
      .first();
    if (existing !== null) {
      throw new Error("이미 사용 중인 사번입니다.");
    }

    const now = Date.now();
    const currentYear = new Date(now).getUTCFullYear();
    const employeeId = await ctx.db.insert("employeeProfiles", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });

    await ensureGrant(
      ctx,
      employeeId,
      currentYear,
      annualGrantForHireDate(args.hireDate, currentYear),
      `${currentYear}-12-31`,
      now,
    );

    await logAudit(
      ctx,
      adminProfile._id,
      "employeeProfiles",
      employeeId,
      "createEmployeeProfile",
      undefined,
      args,
    );

    return { employeeId };
  },
});

// 관리자: 이전 시스템 이월분 등 초기 잔여 수동 설정
export const setInitialBalance = mutation({
  args: {
    employeeProfileId: v.id("employeeProfiles"),
    annualDays: v.optional(v.number()),
    compensatoryDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { profile: adminProfile } = await requireAdmin(ctx);

    if (args.annualDays === undefined && args.compensatoryDays === undefined) {
      throw new Error("연차 또는 대체휴무 중 하나는 입력해야 합니다.");
    }
    if (
      args.annualDays !== undefined &&
      (args.annualDays < 0 || args.annualDays > MAX_ANNUAL_DAYS)
    ) {
      throw new Error(`연차 일수는 0~${MAX_ANNUAL_DAYS} 사이여야 합니다.`);
    }
    if (
      args.compensatoryDays !== undefined &&
      (args.compensatoryDays < 0 ||
        args.compensatoryDays > MAX_COMPENSATORY_DAYS)
    ) {
      throw new Error(
        `대체휴무 일수는 0~${MAX_COMPENSATORY_DAYS} 사이여야 합니다.`,
      );
    }

    const employee = await ctx.db.get(args.employeeProfileId);
    if (employee === null) {
      throw new Error("직원을 찾을 수 없습니다.");
    }

    const now = Date.now();
    const year = new Date(now).getUTCFullYear();

    if (args.annualDays !== undefined) {
      const existingGrant = await ctx.db
        .query("leaveGrants")
        .withIndex("by_employee_year", (q) =>
          q.eq("employeeProfileId", args.employeeProfileId).eq("year", year),
        )
        .first();
      if (existingGrant !== null) {
        await ctx.db.patch(existingGrant._id, {
          grantedDays: args.annualDays,
          reason: "관리자 초기값 설정",
          basisSnapshot: "관리자 수동 설정 (이전 시스템 이월분 포함 가능)",
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("leaveGrants", {
          employeeProfileId: args.employeeProfileId,
          year,
          grantedDays: args.annualDays,
          reason: "관리자 초기값 설정",
          basisSnapshot: "관리자 수동 설정 (이전 시스템 이월분 포함 가능)",
          expiresOn: `${year}-12-31`,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    if (args.compensatoryDays !== undefined && args.compensatoryDays > 0) {
      const policy = await activePolicy(ctx);
      const expiresOn =
        policy?.compensatoryExpiryDays != null
          ? new Date(now + policy.compensatoryExpiryDays * 24 * 60 * 60 * 1000)
              .toISOString()
              .slice(0, 10)
          : null;
      await ctx.db.insert("compensatoryCredits", {
        employeeProfileId: args.employeeProfileId,
        sourceWorkDate: new Date(now).toISOString().slice(0, 10),
        creditedDays: args.compensatoryDays,
        usedDays: 0,
        expiresOn,
        note: "관리자 초기값 설정 (이전 시스템 이월분)",
        createdAt: now,
        updatedAt: now,
      });
    }

    await logAudit(
      ctx,
      adminProfile._id,
      "employeeProfiles",
      args.employeeProfileId,
      "setInitialBalance",
      undefined,
      args,
    );

    return { ok: true };
  },
});

// 하위호환: 과거 데모 시딩(EMP-001/002)이 남아있는 배포용 정리 도구
const DEMO_EMPLOYEE_NOS = ["EMP-001", "EMP-002"] as const;

export const clearDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const { profile: adminProfile } = await requireAdmin(ctx);

    let removedEmployees = 0;
    let removedRecords = 0;

    for (const employeeNo of DEMO_EMPLOYEE_NOS) {
      const employee = await ctx.db
        .query("employeeProfiles")
        .filter((q) => q.eq(q.field("employeeNo"), employeeNo))
        .first();
      if (employee === null) {
        continue;
      }
      // 실제 계정이 연결된 프로필은 데모가 아니므로 건드리지 않음
      if (employee.userId !== undefined) {
        continue;
      }

      const [grants, credits, requests] = await Promise.all([
        ctx.db
          .query("leaveGrants")
          .withIndex("by_employee", (q) =>
            q.eq("employeeProfileId", employee._id),
          )
          .collect(),
        ctx.db
          .query("compensatoryCredits")
          .withIndex("by_employee", (q) =>
            q.eq("employeeProfileId", employee._id),
          )
          .collect(),
        ctx.db
          .query("leaveRequests")
          .withIndex("by_employee", (q) =>
            q.eq("employeeProfileId", employee._id),
          )
          .collect(),
      ]);

      for (const record of [...grants, ...credits, ...requests]) {
        await ctx.db.delete(record._id);
        removedRecords += 1;
      }

      await ctx.db.delete(employee._id);
      removedEmployees += 1;
    }

    await logAudit(
      ctx,
      adminProfile._id,
      "workspace",
      "demo",
      "clearDemoData",
      undefined,
      { removedEmployees, removedRecords },
    );

    return { removedEmployees, removedRecords };
  },
});
