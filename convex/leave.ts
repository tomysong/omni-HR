import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const ANNUAL_TYPES = ["annual", "halfAnnual", "quarterAnnual"] as const;

const leaveRequestType = v.union(
  v.literal("annual"),
  v.literal("halfAnnual"),
  v.literal("quarterAnnual"),
  v.literal("compensatory"),
  v.literal("bereavement"),
  v.literal("sick"),
  v.literal("official"),
  v.literal("unpaid"),
);

const employeeRole = v.union(
  v.literal("employee"),
  v.literal("approver"),
  v.literal("admin"),
  v.literal("systemAdmin"),
);

const employmentStatus = v.union(
  v.literal("active"),
  v.literal("leaveOfAbsence"),
  v.literal("resigned"),
);

const DEFAULT_POLICY = {
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

type AppCtx = QueryCtx | MutationCtx;
type ViewerProfile = Doc<"employeeProfiles">;

async function requireViewer(ctx: AppCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Not signed in");
  }
  const user = await ctx.db.get(userId);
  if (user === null) {
    throw new Error("User was deleted");
  }
  return { userId, user };
}

async function profileForUser(ctx: AppCtx, userId: Id<"users">) {
  return await ctx.db
    .query("employeeProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

async function activePolicy(ctx: AppCtx) {
  return await ctx.db
    .query("leavePolicies")
    .withIndex("by_active", (q) => q.eq("isActive", true))
    .first();
}

function yearFromDate(date: string) {
  return Number(date.slice(0, 4));
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isAnnualType(type: string) {
  return ANNUAL_TYPES.some((annualType) => annualType === type);
}

function canApprove(profile: ViewerProfile | null) {
  return (
    profile?.role === "approver" ||
    profile?.role === "admin" ||
    profile?.role === "systemAdmin"
  );
}

function canManage(profile: ViewerProfile | null) {
  return profile?.role === "admin" || profile?.role === "systemAdmin";
}

function annualGrantForHireDate(hireDate: string, referenceYear: number) {
  const hireYear = yearFromDate(hireDate);
  const tenureYears = Math.max(referenceYear - hireYear, 0);
  if (tenureYears === 0) {
    return 11;
  }
  return Math.min(15 + Math.floor(Math.max(tenureYears - 1, 0) / 2), 25);
}

async function annualBalance(
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

async function compensatoryBalance(
  ctx: AppCtx,
  employeeProfileId: Id<"employeeProfiles">,
) {
  const credits = await ctx.db
    .query("compensatoryCredits")
    .withIndex("by_employee", (q) =>
      q.eq("employeeProfileId", employeeProfileId),
    )
    .collect();

  const creditedHours = credits.reduce(
    (sum, credit) => sum + credit.creditedHours,
    0,
  );
  const usedHours = credits.reduce((sum, credit) => sum + credit.usedHours, 0);
  const nextExpiry =
    credits
      .map((credit) => credit.expiresOn)
      .filter((expiresOn): expiresOn is string => expiresOn !== null)
      .sort((a, b) => a.localeCompare(b))[0] ?? null;

  return {
    creditedHours: round2(creditedHours),
    usedHours: round2(usedHours),
    remainingHours: round2(creditedHours - usedHours),
    nextExpiry,
  };
}

async function enrichRequests(ctx: AppCtx, requests: Doc<"leaveRequests">[]) {
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

async function employeeSummary(
  ctx: AppCtx,
  employee: Doc<"employeeProfiles">,
  year: number,
) {
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
    employeeNo: employee.employeeNo,
    name: employee.name,
    email: employee.email ?? null,
    department: employee.department,
    title: employee.title ?? "",
    role: employee.role,
    hireDate: employee.hireDate,
    employmentStatus: employee.employmentStatus,
    annualRemainingDays: annual.remainingDays,
    compensatoryRemainingHours: compensatory.remainingHours,
    pendingRequests: requests.filter((request) => request.status === "pending")
      .length,
  };
}

async function buildWorkspaceData(ctx: AppCtx, today: string) {
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
  const [annual, compensatory, myRequests, approvalQueue, employees] =
    await Promise.all([
      annualBalance(ctx, profile._id, year),
      compensatoryBalance(ctx, profile._id),
      ctx.db
        .query("leaveRequests")
        .withIndex("by_employee", (q) => q.eq("employeeProfileId", profile._id))
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
      sortedEmployees.map((employee) => employeeSummary(ctx, employee, year)),
    ),
  };
}

async function logAudit(
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

export const dashboard = query({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    return await buildWorkspaceData(ctx, today);
  },
});

export const workspace = query({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    return await buildWorkspaceData(ctx, today);
  },
});

export const ensureDemoWorkspace = mutation({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    const { userId, user } = await requireViewer(ctx);
    const now = Date.now();
    const year = yearFromDate(today);

    let policy = await activePolicy(ctx);
    if (policy === null) {
      const policyId = await ctx.db.insert("leavePolicies", {
        ...DEFAULT_POLICY,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      policy = await ctx.db.get(policyId);
    }

    let viewerProfile = await profileForUser(ctx, userId);
    if (viewerProfile === null) {
      const viewerProfileId = await ctx.db.insert("employeeProfiles", {
        userId,
        employeeNo: "ADM-001",
        name: user.name ?? user.email ?? "관리자",
        email: user.email ?? undefined,
        department: "총무",
        title: "관리자",
        role: "admin",
        hireDate: `${year - 2}-01-02`,
        employmentStatus: "active",
        createdAt: now,
        updatedAt: now,
      });
      viewerProfile = await ctx.db.get(viewerProfileId);
    }

    if (viewerProfile === null) {
      throw new Error("Could not create viewer profile");
    }

    await ensureGrant(
      ctx,
      viewerProfile._id,
      year,
      annualGrantForHireDate(viewerProfile.hireDate, year),
      `${year}-12-31`,
      now,
    );
    await ensureCompCredit(
      ctx,
      viewerProfile._id,
      `${year}-06-08`,
      8,
      null,
      now,
    );

    const teammateA = await ensureEmployee(ctx, {
      employeeNo: "EMP-001",
      name: "김민지",
      department: "운영",
      title: "매니저",
      role: "employee",
      hireDate: `${year - 1}-03-04`,
      employmentStatus: "active",
      now,
    });
    const teammateB = await ensureEmployee(ctx, {
      employeeNo: "EMP-002",
      name: "박준호",
      department: "현장",
      title: "팀장",
      role: "approver",
      hireDate: `${year - 4}-09-15`,
      employmentStatus: "active",
      now,
    });

    await ensureGrant(
      ctx,
      teammateA._id,
      year,
      annualGrantForHireDate(teammateA.hireDate, year),
      `${year}-12-31`,
      now,
    );
    await ensureGrant(
      ctx,
      teammateB._id,
      year,
      annualGrantForHireDate(teammateB.hireDate, year),
      `${year}-12-31`,
      now,
    );
    await ensureCompCredit(ctx, teammateA._id, `${year}-05-18`, 8, null, now);
    await ensurePendingRequest(
      ctx,
      teammateA._id,
      viewerProfile._id,
      year,
      now,
    );

    await logAudit(
      ctx,
      viewerProfile._id,
      "workspace",
      "demo",
      "ensureDemoWorkspace",
      undefined,
      { policyId: policy?._id, year },
    );

    return { ok: true };
  },
});

const DEMO_EMPLOYEE_NOS = ["EMP-001", "EMP-002"] as const;

export const clearDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireViewer(ctx);
    const viewerProfile = await profileForUser(ctx, userId);
    if (!canManage(viewerProfile)) {
      throw new Error("관리자만 데모 데이터를 삭제할 수 있습니다.");
    }

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

    const demoAudits = await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "workspace").eq("entityId", "demo"),
      )
      .collect();
    for (const entry of demoAudits) {
      await ctx.db.delete(entry._id);
      removedRecords += 1;
    }

    await logAudit(
      ctx,
      viewerProfile!._id,
      "workspace",
      "demo",
      "clearDemoData",
      undefined,
      { removedEmployees, removedRecords },
    );

    return { removedEmployees, removedRecords };
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
    const { userId } = await requireViewer(ctx);
    const profile = await profileForUser(ctx, userId);
    if (profile === null) {
      throw new Error("Employee profile is required");
    }
    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    const year = yearFromDate(args.startDate);
    if (isAnnualType(args.type)) {
      const balance = await annualBalance(ctx, profile._id, year);
      if (args.amount > balance.remainingDays) {
        throw new Error("Insufficient annual leave balance");
      }
    }
    if (args.type === "compensatory") {
      const balance = await compensatoryBalance(ctx, profile._id);
      if (args.amount > balance.remainingHours) {
        throw new Error("Insufficient compensatory leave balance");
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
    const { userId } = await requireViewer(ctx);
    const viewerProfile = await profileForUser(ctx, userId);
    if (!canManage(viewerProfile)) {
      throw new Error("Admin role is required");
    }

    const existing = await ctx.db
      .query("employeeProfiles")
      .filter((q) => q.eq(q.field("employeeNo"), args.employeeNo))
      .first();
    if (existing !== null) {
      throw new Error("Employee number already exists");
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
      viewerProfile?._id,
      "employeeProfiles",
      employeeId,
      "createEmployeeProfile",
      undefined,
      args,
    );

    return { employeeId };
  },
});

export const updateActivePolicy = mutation({
  args: {
    name: v.string(),
    yearBasis: v.union(v.literal("hireDate"), v.literal("fiscalYear")),
    fiscalYearStartMonth: v.optional(v.number()),
    annualLeaveCapDays: v.number(),
    allowQuarterDay: v.boolean(),
    approvalSteps: v.union(v.literal(1), v.literal(2)),
    compensatoryExpiryDays: v.union(v.number(), v.null()),
    promotionFirstNoticeMonthsBeforeExpiry: v.number(),
    promotionSecondNoticeMonthsBeforeExpiry: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireViewer(ctx);
    const viewerProfile = await profileForUser(ctx, userId);
    if (!canManage(viewerProfile)) {
      throw new Error("Admin role is required");
    }

    const currentPolicy = await activePolicy(ctx);
    const now = Date.now();
    if (currentPolicy === null) {
      const policyId = await ctx.db.insert("leavePolicies", {
        ...args,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      await logAudit(
        ctx,
        viewerProfile?._id,
        "leavePolicies",
        policyId,
        "createPolicy",
        undefined,
        args,
      );
      return { policyId };
    }

    await ctx.db.patch(currentPolicy._id, {
      ...args,
      updatedAt: now,
    });

    await logAudit(
      ctx,
      viewerProfile?._id,
      "leavePolicies",
      currentPolicy._id,
      "updatePolicy",
      currentPolicy,
      args,
    );

    return { policyId: currentPolicy._id };
  },
});

export const decideRequest = mutation({
  args: {
    requestId: v.id("leaveRequests"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, { requestId, decision, rejectionReason }) => {
    const { userId } = await requireViewer(ctx);
    const approver = await profileForUser(ctx, userId);
    if (!canApprove(approver)) {
      throw new Error("Approver role is required");
    }

    const request = await ctx.db.get(requestId);
    if (request === null) {
      throw new Error("Request not found");
    }
    if (request.status !== "pending") {
      throw new Error("Request has already been decided");
    }

    if (decision === "approved" && request.type === "compensatory") {
      await consumeCompensatoryHours(
        ctx,
        request.employeeProfileId,
        request.amount,
      );
    }

    const now = Date.now();
    await ctx.db.patch(requestId, {
      approverProfileId: approver?._id,
      status: decision,
      rejectionReason: decision === "rejected" ? rejectionReason : undefined,
      decidedAt: now,
      updatedAt: now,
    });

    await logAudit(
      ctx,
      approver?._id,
      "leaveRequests",
      requestId,
      "decideRequest",
      request,
      { decision, rejectionReason },
    );
  },
});

async function ensureEmployee(
  ctx: MutationCtx,
  args: {
    employeeNo: string;
    name: string;
    department: string;
    title: string;
    role: Doc<"employeeProfiles">["role"];
    hireDate: string;
    employmentStatus: Doc<"employeeProfiles">["employmentStatus"];
    now: number;
  },
) {
  const existing = await ctx.db
    .query("employeeProfiles")
    .filter((q) => q.eq(q.field("employeeNo"), args.employeeNo))
    .first();

  if (existing !== null) {
    return existing;
  }

  const profileId = await ctx.db.insert("employeeProfiles", {
    employeeNo: args.employeeNo,
    name: args.name,
    department: args.department,
    title: args.title,
    role: args.role,
    hireDate: args.hireDate,
    employmentStatus: args.employmentStatus,
    createdAt: args.now,
    updatedAt: args.now,
  });
  const profile = await ctx.db.get(profileId);
  if (profile === null) {
    throw new Error("Could not create employee");
  }
  return profile;
}

async function ensureGrant(
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
    basisSnapshot: "입사일 기준 자동 산정 예정",
    expiresOn,
    createdAt: now,
    updatedAt: now,
  });
}

async function ensureCompCredit(
  ctx: MutationCtx,
  employeeProfileId: Id<"employeeProfiles">,
  sourceWorkDate: string,
  creditedHours: number,
  expiresOn: string | null,
  now: number,
) {
  const existing = await ctx.db
    .query("compensatoryCredits")
    .withIndex("by_employee", (q) =>
      q.eq("employeeProfileId", employeeProfileId),
    )
    .filter((q) => q.eq(q.field("sourceWorkDate"), sourceWorkDate))
    .first();
  if (existing !== null) {
    return;
  }
  await ctx.db.insert("compensatoryCredits", {
    employeeProfileId,
    sourceWorkDate,
    creditedHours,
    usedHours: 0,
    expiresOn,
    note: "주말/휴일 근무 1:1 적립",
    createdAt: now,
    updatedAt: now,
  });
}

async function ensurePendingRequest(
  ctx: MutationCtx,
  employeeProfileId: Id<"employeeProfiles">,
  approverProfileId: Id<"employeeProfiles">,
  year: number,
  now: number,
) {
  const existing = await ctx.db
    .query("leaveRequests")
    .withIndex("by_employee", (q) =>
      q.eq("employeeProfileId", employeeProfileId),
    )
    .filter((q) => q.eq(q.field("status"), "pending"))
    .first();
  if (existing !== null) {
    return;
  }
  await ctx.db.insert("leaveRequests", {
    employeeProfileId,
    approverProfileId,
    type: "annual",
    startDate: `${year}-07-22`,
    endDate: `${year}-07-22`,
    amount: 1,
    unit: "day",
    status: "pending",
    reason: "개인 일정",
    requestedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

async function consumeCompensatoryHours(
  ctx: MutationCtx,
  employeeProfileId: Id<"employeeProfiles">,
  hours: number,
) {
  let remaining = hours;
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
    const available = credit.creditedHours - credit.usedHours;
    if (available <= 0) {
      continue;
    }
    const toUse = Math.min(available, remaining);
    await ctx.db.patch(credit._id, {
      usedHours: round2(credit.usedHours + toUse),
      updatedAt: Date.now(),
    });
    remaining = round2(remaining - toUse);
  }

  if (remaining > 0) {
    throw new Error("Insufficient compensatory leave balance");
  }
}
