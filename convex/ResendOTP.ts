import { Email } from "@convex-dev/auth/providers/Email";

export const ResendOTP = Email({
  id: "resend-otp",
  maxAge: 60 * 20,
  async generateVerificationToken() {
    const array = new Uint32Array(1);
    globalThis.crypto.getRandomValues(array);
    return (array[0] % 1_000_000).toString().padStart(6, "0");
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const apiKey = process.env.AUTH_RESEND_KEY;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "연차·휴가 관리 <onboarding@resend.dev>",
        to: [email],
        subject: "가입 인증 코드",
        text: `인증 코드: ${token} (20분 이내 입력)`,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend error: ${await res.text()}`);
    }
  },
});
