"use client";

import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { Hourglass, ShieldCheck, UserPlus } from "lucide-react";
import { FormEvent, ReactNode, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/app/product/shared";

// /product 하위 전체를 감싸는 게이트.
// 승인된 직원(프로필 연결)만 children 렌더, 그 외에는 부트스트랩/가입요청/대기 화면.
export function AccessGate({ children }: { children: ReactNode }) {
  const access = useQuery(api.access.myAccess, {});

  if (access === undefined) {
    return <LoadingState />;
  }
  if (access.state === "approved") {
    return <>{children}</>;
  }
  if (access.bootstrapAvailable) {
    return <BootstrapScreen />;
  }
  if (access.state === "pending") {
    return (
      <GateShell
        icon={<Hourglass className="h-5 w-5" />}
        title="승인 대기 중"
        description={`관리자가 가입을 승인하면 자동으로 화면이 전환됩니다. (${access.email ?? ""})`}
      />
    );
  }
  return <RequestAccessScreen rejectionReason={access.rejectionReason} />;
}

function GateShell({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  const { signOut } = useAuthActions();
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <Card className="w-full max-w-[440px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            {icon}
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {children}
          <Button variant="outline" onClick={() => void signOut()}>
            로그아웃
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function BootstrapScreen() {
  const bootstrapWorkspace = useMutation(api.employees.bootstrapWorkspace);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [hireDate, setHireDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await bootstrapWorkspace({ name, department, hireDate });
      toast.success("관리자 계정으로 시작합니다.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "초기 설정에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <GateShell
      icon={<ShieldCheck className="h-5 w-5" />}
      title="조직 초기 설정"
      description="첫 사용자입니다. 아래 정보를 입력하면 관리자 계정으로 시작합니다."
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="text-sm font-medium" htmlFor="bootstrap-name">
          이름
        </label>
        <Input
          id="bootstrap-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="홍길동"
          required
        />
        <label className="text-sm font-medium" htmlFor="bootstrap-department">
          부서
        </label>
        <Input
          id="bootstrap-department"
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
          placeholder="총무"
          required
        />
        <label className="text-sm font-medium" htmlFor="bootstrap-hire-date">
          입사일
        </label>
        <Input
          id="bootstrap-hire-date"
          type="date"
          value={hireDate}
          onChange={(event) => setHireDate(event.target.value)}
          required
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "설정 중" : "관리자로 시작"}
        </Button>
      </form>
    </GateShell>
  );
}

function RequestAccessScreen({
  rejectionReason,
}: {
  rejectionReason: string | null;
}) {
  const requestAccess = useMutation(api.access.requestAccess);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await requestAccess({
        name,
        department,
        title: title.trim() || undefined,
      });
      toast.success("가입 요청을 보냈습니다. 관리자 승인을 기다려주세요.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "요청에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <GateShell
      icon={<UserPlus className="h-5 w-5" />}
      title="가입 요청"
      description={
        rejectionReason
          ? `이전 요청이 반려되었습니다: ${rejectionReason}. 정보를 수정해 다시 요청할 수 있습니다.`
          : "이름과 부서를 입력하면 관리자에게 가입 승인을 요청합니다."
      }
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="text-sm font-medium" htmlFor="request-name">
          이름
        </label>
        <Input
          id="request-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="홍길동"
          required
        />
        <label className="text-sm font-medium" htmlFor="request-department">
          부서
        </label>
        <Input
          id="request-department"
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
          placeholder="운영"
          required
        />
        <label className="text-sm font-medium" htmlFor="request-title">
          직책 (선택)
        </label>
        <Input
          id="request-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="매니저"
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "요청 중" : "가입 승인 요청"}
        </Button>
      </form>
    </GateShell>
  );
}
