import { v } from "convex/values";
import { internalAction } from "./_generated/server";

const FROM = "연차·휴가 관리 <onboarding@resend.dev>";

async function sendEmail(to: string, subject: string, text: string) {
  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey) {
    console.error("AUTH_RESEND_KEY 미설정: 이메일 발송을 건너뜁니다.");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, text }),
  });
  if (!res.ok) {
    // 스케줄된 액션이므로 throw 해도 결재 트랜잭션에는 영향 없음. 로그로 남긴다.
    console.error(`Resend 발송 실패 (${res.status}): ${await res.text()}`);
  }
}

// 휴가 결재 결과 통지 (decideRequest에서 스케줄).
export const sendLeaveDecision = internalAction({
  args: {
    to: v.string(),
    employeeName: v.string(),
    typeLabel: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    amount: v.number(),
    unit: v.string(),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    rejectionReason: v.optional(v.string()),
    approverName: v.string(),
  },
  handler: async (ctx, args) => {
    const decided = args.decision === "approved" ? "승인" : "반려";
    const unitLabel = args.unit === "day" ? "일" : "시간";
    const period =
      args.startDate === args.endDate
        ? args.startDate
        : `${args.startDate} ~ ${args.endDate}`;

    const lines = [
      `${args.employeeName}님,`,
      "",
      `신청하신 휴가가 ${decided}되었습니다.`,
      "",
      `- 유형: ${args.typeLabel}`,
      `- 기간: ${period}`,
      `- 수량: ${args.amount}${unitLabel}`,
      `- 처리자: ${args.approverName}`,
      `- 결과: ${decided}`,
    ];
    if (args.decision === "rejected" && args.rejectionReason) {
      lines.push(`- 반려 사유: ${args.rejectionReason}`);
    }
    lines.push("", "본 메일은 발신 전용입니다.");

    await sendEmail(
      args.to,
      `[연차·휴가] ${args.typeLabel} 신청이 ${decided}되었습니다`,
      lines.join("\n"),
    );
  },
});
