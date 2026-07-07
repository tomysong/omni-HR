import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  holidayInfo,
  logAudit,
  requireAdmin,
  requireValidDate,
  requireViewer,
} from "./model";

// 대한민국 정부 지정 공휴일 + 근로자의 날(법정 유급휴일).
// 2026: 월력요항 + 제헌절 재지정(2026-01-29 국회 통과, 05-11 시행) 반영.
// 2027: 월력요항 기준. 이후 연도는 관리자가 [휴일근무] 탭에서 직접 추가.
const DEFAULT_KR_HOLIDAYS: ReadonlyArray<{ date: string; name: string }> = [
  // 2026
  { date: "2026-01-01", name: "신정" },
  { date: "2026-02-16", name: "설날 연휴" },
  { date: "2026-02-17", name: "설날" },
  { date: "2026-02-18", name: "설날 연휴" },
  { date: "2026-03-01", name: "삼일절" },
  { date: "2026-03-02", name: "대체공휴일(삼일절)" },
  { date: "2026-05-01", name: "근로자의 날" },
  { date: "2026-05-05", name: "어린이날" },
  { date: "2026-05-24", name: "부처님오신날" },
  { date: "2026-05-25", name: "대체공휴일(부처님오신날)" },
  { date: "2026-06-03", name: "전국동시지방선거일" },
  { date: "2026-06-06", name: "현충일" },
  { date: "2026-07-17", name: "제헌절" },
  { date: "2026-08-15", name: "광복절" },
  { date: "2026-08-17", name: "대체공휴일(광복절)" },
  { date: "2026-09-24", name: "추석 연휴" },
  { date: "2026-09-25", name: "추석" },
  { date: "2026-09-26", name: "추석 연휴" },
  { date: "2026-10-03", name: "개천절" },
  { date: "2026-10-05", name: "대체공휴일(개천절)" },
  { date: "2026-10-09", name: "한글날" },
  { date: "2026-12-25", name: "성탄절" },
  // 2027
  { date: "2027-01-01", name: "신정" },
  { date: "2027-02-06", name: "설날 연휴" },
  { date: "2027-02-07", name: "설날" },
  { date: "2027-02-08", name: "설날 연휴" },
  { date: "2027-02-09", name: "대체공휴일(설날)" },
  { date: "2027-03-01", name: "삼일절" },
  { date: "2027-05-01", name: "근로자의 날" },
  { date: "2027-05-05", name: "어린이날" },
  { date: "2027-05-13", name: "부처님오신날" },
  { date: "2027-06-06", name: "현충일" },
  { date: "2027-07-17", name: "제헌절" },
  { date: "2027-08-15", name: "광복절" },
  { date: "2027-08-16", name: "대체공휴일(광복절)" },
  { date: "2027-09-14", name: "추석 연휴" },
  { date: "2027-09-15", name: "추석" },
  { date: "2027-09-16", name: "추석 연휴" },
  { date: "2027-10-03", name: "개천절" },
  { date: "2027-10-04", name: "대체공휴일(개천절)" },
  { date: "2027-10-09", name: "한글날" },
  { date: "2027-10-11", name: "대체공휴일(한글날)" },
  { date: "2027-12-25", name: "성탄절" },
  { date: "2027-12-27", name: "대체공휴일(성탄절)" },
];

// 특정 날짜가 휴일인지 (모든 로그인 사용자)
export const checkDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    await requireViewer(ctx);
    requireValidDate(date, "날짜");
    return await holidayInfo(ctx, date);
  },
});

// 등록된 공휴일 목록 (모든 로그인 사용자 — 달력 안내용)
export const listHolidays = query({
  args: {},
  handler: async (ctx) => {
    await requireViewer(ctx);
    const rows = await ctx.db.query("holidays").collect();
    return rows
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => ({ _id: row._id, date: row.date, name: row.name }));
  },
});

// 관리자: 공휴일 추가 (임시공휴일, 선거일, 이후 연도 등)
export const addHoliday = mutation({
  args: { date: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const { profile: adminProfile } = await requireAdmin(ctx);
    requireValidDate(args.date, "날짜");
    const name = args.name.trim();
    if (name.length === 0 || name.length > 50) {
      throw new Error("공휴일 이름은 1~50자로 입력해야 합니다.");
    }

    const existing = await ctx.db
      .query("holidays")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();
    if (existing !== null) {
      throw new Error("이미 등록된 날짜입니다.");
    }

    const holidayId = await ctx.db.insert("holidays", {
      date: args.date,
      name,
      createdByProfileId: adminProfile._id,
      createdAt: Date.now(),
    });

    await logAudit(
      ctx,
      adminProfile._id,
      "holidays",
      holidayId,
      "addHoliday",
      undefined,
      args,
    );
    return { ok: true };
  },
});

// 관리자: 공휴일 삭제
export const removeHoliday = mutation({
  args: { holidayId: v.id("holidays") },
  handler: async (ctx, { holidayId }) => {
    const { profile: adminProfile } = await requireAdmin(ctx);
    const holiday = await ctx.db.get(holidayId);
    if (holiday === null) {
      throw new Error("공휴일을 찾을 수 없습니다.");
    }
    await ctx.db.delete(holidayId);
    await logAudit(
      ctx,
      adminProfile._id,
      "holidays",
      holidayId,
      "removeHoliday",
      holiday,
      undefined,
    );
    return { ok: true };
  },
});

// 관리자: 기본 공휴일(2026-2027) 일괄 등록. 이미 있는 날짜는 건너뜀 (멱등).
export const seedDefaultHolidays = mutation({
  args: {},
  handler: async (ctx) => {
    const { profile: adminProfile } = await requireAdmin(ctx);
    const now = Date.now();
    let added = 0;

    for (const holiday of DEFAULT_KR_HOLIDAYS) {
      const existing = await ctx.db
        .query("holidays")
        .withIndex("by_date", (q) => q.eq("date", holiday.date))
        .first();
      if (existing !== null) {
        continue;
      }
      await ctx.db.insert("holidays", {
        date: holiday.date,
        name: holiday.name,
        createdByProfileId: adminProfile._id,
        createdAt: now,
      });
      added += 1;
    }

    await logAudit(
      ctx,
      adminProfile._id,
      "holidays",
      "seed",
      "seedDefaultHolidays",
      undefined,
      { added },
    );
    return { added };
  },
});
