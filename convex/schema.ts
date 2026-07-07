import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  employeeProfiles: defineTable({
    userId: v.optional(v.id("users")),
    employeeNo: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    department: v.string(),
    title: v.optional(v.string()),
    role: v.union(
      v.literal("employee"),
      v.literal("approver"),
      v.literal("admin"),
      v.literal("systemAdmin"),
    ),
    hireDate: v.string(),
    employmentStatus: v.union(
      v.literal("active"),
      v.literal("leaveOfAbsence"),
      v.literal("resigned"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status_role", ["employmentStatus", "role"]),
  leavePolicies: defineTable({
    name: v.string(),
    isActive: v.boolean(),
    yearBasis: v.union(v.literal("hireDate"), v.literal("fiscalYear")),
    fiscalYearStartMonth: v.optional(v.number()),
    annualLeaveCapDays: v.number(),
    allowQuarterDay: v.boolean(),
    approvalSteps: v.union(v.literal(1), v.literal(2)),
    compensatoryExpiryDays: v.union(v.number(), v.null()),
    promotionFirstNoticeMonthsBeforeExpiry: v.number(),
    promotionSecondNoticeMonthsBeforeExpiry: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_active", ["isActive"]),
  leaveGrants: defineTable({
    employeeProfileId: v.id("employeeProfiles"),
    year: v.number(),
    grantedDays: v.number(),
    reason: v.string(),
    basisSnapshot: v.string(),
    expiresOn: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_employee", ["employeeProfileId"])
    .index("by_employee_year", ["employeeProfileId", "year"]),
  compensatoryCredits: defineTable({
    employeeProfileId: v.id("employeeProfiles"),
    sourceWorkDate: v.string(),
    creditedDays: v.number(),
    usedDays: v.number(),
    expiresOn: v.union(v.string(), v.null()),
    note: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_employee", ["employeeProfileId"]),
  leaveRequests: defineTable({
    employeeProfileId: v.id("employeeProfiles"),
    approverProfileId: v.optional(v.id("employeeProfiles")),
    type: v.union(
      v.literal("annual"),
      v.literal("halfAnnual"),
      v.literal("quarterAnnual"),
      v.literal("compensatory"),
      v.literal("bereavement"),
      v.literal("sick"),
      v.literal("official"),
      v.literal("unpaid"),
    ),
    startDate: v.string(),
    endDate: v.string(),
    amount: v.number(),
    unit: v.union(v.literal("day"), v.literal("hour")),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("cancelled"),
    ),
    reason: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    requestedAt: v.number(),
    decidedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_employee", ["employeeProfileId"])
    .index("by_status", ["status"])
    .index("by_approver_status", ["approverProfileId", "status"]),
  absenceRecords: defineTable({
    employeeProfileId: v.id("employeeProfiles"),
    date: v.string(),
    reason: v.string(),
    createdByProfileId: v.id("employeeProfiles"),
    createdAt: v.number(),
  }).index("by_employee_date", ["employeeProfileId", "date"]),
  promotionLogs: defineTable({
    employeeProfileId: v.id("employeeProfiles"),
    leaveGrantId: v.id("leaveGrants"),
    noticeRound: v.union(v.literal(1), v.literal(2)),
    sentAt: v.number(),
    responseText: v.optional(v.string()),
    designatedDates: v.optional(v.array(v.string())),
    createdByProfileId: v.id("employeeProfiles"),
    createdAt: v.number(),
  }).index("by_employee", ["employeeProfileId"]),
  holidays: defineTable({
    date: v.string(),
    name: v.string(),
    createdByProfileId: v.optional(v.id("employeeProfiles")),
    createdAt: v.number(),
  }).index("by_date", ["date"]),
  holidayWorkRecords: defineTable({
    employeeProfileId: v.id("employeeProfiles"),
    workDate: v.string(),
    amountDays: v.number(),
    note: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    rejectionReason: v.optional(v.string()),
    reportedByProfileId: v.id("employeeProfiles"),
    approverProfileId: v.optional(v.id("employeeProfiles")),
    decidedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_employee", ["employeeProfileId"])
    .index("by_status", ["status"])
    .index("by_employee_date", ["employeeProfileId", "workDate"]),
  accessRequests: defineTable({
    userId: v.id("users"),
    name: v.string(),
    department: v.string(),
    title: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    rejectionReason: v.optional(v.string()),
    decidedByProfileId: v.optional(v.id("employeeProfiles")),
    decidedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),
  auditLogs: defineTable({
    actorProfileId: v.optional(v.id("employeeProfiles")),
    entityTable: v.string(),
    entityId: v.string(),
    action: v.string(),
    before: v.optional(v.any()),
    after: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_actor", ["actorProfileId"])
    .index("by_entity", ["entityTable", "entityId"]),
});
