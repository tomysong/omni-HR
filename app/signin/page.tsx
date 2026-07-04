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
                이메일로 로그인 링크를 받습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SignInWithMagicLink handleLinkSent={() => setStep("linkSent")} />
              <Button className="mt-3 w-full" variant="outline" asChild>
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
