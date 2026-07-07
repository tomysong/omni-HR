import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  annualGrantForHireDate,
  employeeRole,
  ensureGrant,
  logAudit,
  profileForUser,
  requireAdmin,
  requireValidDate,
  requireViewer,
} from "./model";

// 로그인한 사용자의 접근 상태.
// approved: 직원 프로필 연결됨 / pending, rejected: 가입 승인 대기·반려 /
// none: 아직 요청 전 / bootstrapAvailable: 조직에 프로필이 하나도 없어 첫 관리자 생성 가능
export const myAccess = query({
  args: {},
  handler: async (ctx) => {
    const { userId, user } = await requireViewer(ctx);
    const profile = await profileForUser(ctx, userId);
    if (profile !== null) {
      return {
        state: "approved" as const,
        bootstrapAvailable: false,
        rejectionReason: null,
        email: user.email ?? null,
      };
    }

    const anyProfile = await ctx.db.query("employeeProfiles").first();
    const request = await ctx.db
      .query("accessRequests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return {
      state:
        request === null
          ? ("none" as const)
          : request.status === "pending"
            ? ("pending" as const)
            : request.status === "rejected"
              ? ("rejected" as const)
              : ("none" as const),
      bootstrapAvailable: anyProfile === null,
      rejectionReason: request?.rejectionReason ?? null,
      email: user.email ?? null,
    };
  },
});

// 가입 후 접근 요청 (반려된 경우 재요청으로 pending 복귀)
export const requestAccess = mutation({
  args: {
    name: v.string(),
    department: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireViewer(ctx);
    const profile = await profileForUser(ctx, userId);
    if (profile !== null) {
      throw new Error("이미 승인된 계정입니다.");
    }

    const name = args.name.trim();
    const department = args.department.trim();
    if (name.length === 0 || department.length === 0) {
      throw new Error("이름과 부서를 입력해야 합니다.");
    }
    if (name.length > 50 || department.length > 50) {
      throw new Error("이름/부서는 50자 이내로 입력해야 합니다.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("accessRequests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing !== null) {
      if (existing.status === "pending") {
        throw new Error("이미 승인 대기 중입니다.");
      }
      await ctx.db.patch(existing._id, {
        name,
        department,
        title: args.title?.trim() || undefined,
        status: "pending",
        rejectionReason: undefined,
        decidedByProfileId: undefined,
        decidedAt: undefined,
        updatedAt: now,
      });
      return { ok: true };
    }

    await ctx.db.insert("accessRequests", {
      userId,
      name,
      department,
      title: args.title?.trim() || undefined,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true };
  },
});

// 관리자용: 승인 대기 목록
export const listAccessRequests = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const pending = await ctx.db
      .query("accessRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    return await Promise.all(
      pending.map(async (request) => {
        const user = await ctx.db.get(request.userId);
        return {
          _id: request._id,
          name: request.name,
          department: request.department,
          title: request.title ?? "",
          email: user?.email ?? null,
          createdAt: request.createdAt,
        };
      }),
    );
  },
});

// 관리자용: 가입 승인/반려. 승인 시 직원 프로필 생성 + 당해년도 연차 자동 부여.
export const decideAccess = mutation({
  args: {
    requestId: v.id("accessRequests"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    rejectionReason: v.optional(v.string()),
    employeeNo: v.optional(v.string()),
    hireDate: v.optional(v.string()),
    role: v.optional(employeeRole),
  },
  handler: async (ctx, args) => {
    const { profile: adminProfile } = await requireAdmin(ctx);

    const request = await ctx.db.get(args.requestId);
    if (request === null) {
      throw new Error("요청을 찾을 수 없습니다.");
    }
    if (request.status !== "pending") {
      throw new Error("이미 처리된 요청입니다.");
    }

    const now = Date.now();

    if (args.decision === "rejected") {
      await ctx.db.patch(request._id, {
        status: "rejected",
        rejectionReason: args.rejectionReason?.trim() || undefined,
        decidedByProfileId: adminProfile._id,
        decidedAt: now,
        updatedAt: now,
      });
      await logAudit(
        ctx,
        adminProfile._id,
        "accessRequests",
        request._id,
        "rejectAccess",
        request,
        { rejectionReason: args.rejectionReason },
      );
      return { ok: true };
    }

    const employeeNo = args.employeeNo?.trim();
    const hireDate = args.hireDate?.trim();
    if (!employeeNo || !hireDate) {
      throw new Error("승인 시 사번과 입사일을 입력해야 합니다.");
    }
    requireValidDate(hireDate, "입사일");

    const duplicateNo = await ctx.db
      .query("employeeProfiles")
      .filter((q) => q.eq(q.field("employeeNo"), employeeNo))
      .first();
    if (duplicateNo !== null) {
      throw new Error("이미 사용 중인 사번입니다.");
    }

    const existingProfile = await profileForUser(ctx, request.userId);
    if (existingProfile !== null) {
      throw new Error("이미 프로필이 연결된 사용자입니다.");
    }

    const user = await ctx.db.get(request.userId);
    const year = new Date(now).getUTCFullYear();
    const profileId = await ctx.db.insert("employeeProfiles", {
      userId: request.userId,
      employeeNo,
      name: request.name,
      email: user?.email ?? undefined,
      department: request.department,
      title: request.title,
      role: args.role ?? "employee",
      hireDate,
      employmentStatus: "active",
      createdAt: now,
      updatedAt: now,
    });

    await ensureGrant(
      ctx,
      profileId,
      year,
      annualGrantForHireDate(hireDate, year),
      `${year}-12-31`,
      now,
    );

    await ctx.db.patch(request._id, {
      status: "approved",
      decidedByProfileId: adminProfile._id,
      decidedAt: now,
      updatedAt: now,
    });

    await logAudit(
      ctx,
      adminProfile._id,
      "accessRequests",
      request._id,
      "approveAccess",
      request,
      { profileId, employeeNo, role: args.role ?? "employee" },
    );

    return { ok: true, profileId };
  },
});
