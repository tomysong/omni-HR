"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthActions } from "@convex-dev/auth/react";
import { Mail } from "lucide-react";
import Link from "next/link";
import { toast, Toaster } from "sonner";
import { useState } from "react";

export default function SignInPage() {
  const [step, setStep] = useState<"signIn" | "linkSent">("signIn");

  return (
    <div className="container mx-auto flex min-h-screen w-full items-center justify-center px-4">
      <Card className="w-full max-w-[420px]">
        {step === "signIn" ? (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">연차·휴가 관리</CardTitle>
              <CardDescription>
                이메일+비밀번호로 로그인하거나 매직링크를 받습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <PasswordAuth />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                또는
                <div className="h-px flex-1 bg-border" />
              </div>
              <SignInWithMagicLink handleLinkSent={() => setStep("linkSent")} />
              <Button variant="outline" asChild>
                <Link href="/demo">데모 보기</Link>
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">메일함 확인</CardTitle>
              <CardDescription>
                입력한 이메일 주소로 로그인 링크를 보냈습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="p-0"
                variant="link"
                onClick={() => setStep("signIn")}
              >
                다시 입력
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}

function PasswordAuth() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"credentials" | "verify">("credentials");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (step === "verify") {
    return (
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitting(true);
          const formData = new FormData(event.currentTarget);
          formData.set("email", email);
          formData.set("flow", "email-verification");
          signIn("password", formData)
            .catch((error) => {
              console.error(error);
              toast.error("인증 코드가 올바르지 않습니다");
            })
            .finally(() => setSubmitting(false));
        }}
      >
        <p className="text-sm text-muted-foreground">
          {email}로 발송된 6자리 인증 코드를 입력하세요.
        </p>
        <Input name="code" inputMode="numeric" placeholder="123456" required />
        <Button type="submit" disabled={submitting}>
          인증하고 가입 완료
        </Button>
        <Button
          className="p-0"
          type="button"
          variant="link"
          onClick={() => setStep("credentials")}
        >
          다시 입력
        </Button>
      </form>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitting(true);
        const formData = new FormData(event.currentTarget);
        const submitter = (event.nativeEvent as SubmitEvent)
          .submitter as HTMLButtonElement;
        const flow = submitter.value as "signUp" | "signIn";
        formData.set("flow", flow);
        formData.set("redirectTo", "/product");
        setEmail(formData.get("email") as string);
        signIn("password", formData)
          .then(() => {
            if (flow === "signUp") setStep("verify");
          })
          .catch((error) => {
            console.error(error);
            toast.error(
              flow === "signUp"
                ? "가입에 실패했습니다 (이미 등록된 이메일일 수 있습니다)"
                : "이메일 또는 비밀번호가 올바르지 않습니다",
            );
          })
          .finally(() => setSubmitting(false));
      }}
    >
      <label className="text-sm font-medium" htmlFor="password-email">
        이메일
      </label>
      <Input
        name="email"
        id="password-email"
        type="email"
        autoComplete="email"
        placeholder="name@company.com"
        required
      />
      <label className="text-sm font-medium" htmlFor="password">
        비밀번호
      </label>
      <Input
        name="password"
        id="password"
        type="password"
        autoComplete="current-password"
        placeholder="8자 이상"
        required
      />
      <div className="flex gap-2">
        <Button
          className="flex-1"
          type="submit"
          name="intent"
          value="signIn"
          disabled={submitting}
        >
          로그인
        </Button>
        <Button
          className="flex-1"
          type="submit"
          name="intent"
          value="signUp"
          variant="outline"
          disabled={submitting}
        >
          회원가입
        </Button>
      </div>
      <Toaster />
    </form>
  );
}

function SignInWithMagicLink({
  handleLinkSent,
}: {
  handleLinkSent: () => void;
}) {
  const { signIn } = useAuthActions();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set("redirectTo", "/product");
        signIn("resend", formData)
          .then(handleLinkSent)
          .catch((error) => {
            console.error(error);
            toast.error("Could not send sign-in link");
          });
      }}
    >
      <label className="text-sm font-medium" htmlFor="email">
        이메일
      </label>
      <Input
        name="email"
        id="email"
        type="email"
        autoComplete="email"
        placeholder="name@company.com"
      />
      <Button type="submit">
        <Mail className="h-4 w-4" />
        로그인 링크 받기
      </Button>
      <Toaster />
    </form>
  );
}
