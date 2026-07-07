import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { activePolicy, logAudit, requireAdmin } from "./model";

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
    const { profile: adminProfile } = await requireAdmin(ctx);

    if (args.annualLeaveCapDays < 1 || args.annualLeaveCapDays > 50) {
      throw new Error("연차 상한은 1~50일 사이여야 합니다.");
    }
    if (
      args.fiscalYearStartMonth !== undefined &&
      (args.fiscalYearStartMonth < 1 || args.fiscalYearStartMonth > 12)
    ) {
      throw new Error("회계연도 시작월은 1~12 사이여야 합니다.");
    }
    if (
      args.compensatoryExpiryDays !== null &&
      (args.compensatoryExpiryDays < 1 || args.compensatoryExpiryDays > 730)
    ) {
      throw new Error("대체휴무 소멸기한은 1~730일 사이여야 합니다.");
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
        adminProfile._id,
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
      adminProfile._id,
      "leavePolicies",
      currentPolicy._id,
      "updatePolicy",
      currentPolicy,
      args,
    );

    return { policyId: currentPolicy._id };
  },
});
