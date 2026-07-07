"use client";

import { UserMenu } from "@/components/UserMenu";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FileCheck2, type LucideIcon } from "lucide-react";

export const TYPE_LABELS: Record<string, string> = {
  annual: "연차",
  halfAnnual: "반차",
  quarterAnnual: "반반차",
  compensatory: "대체휴무",
  bereavement: "경조사",
  sick: "병가",
  official: "공가",
  unpaid: "무급",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "승인대기",
  approved: "승인",
  rejected: "반려",
  cancelled: "취소",
};

export const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "success" | "warning" | "destructive"
> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "secondary",
};

export const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function ProductPage({
  eyebrow,
  title,
  viewer,
  children,
}: {
  eyebrow: string;
  title: string;
  viewer: { name: string; role?: string };
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen grow flex-col bg-background">
      <header className="flex flex-col gap-4 border-b px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <div>
          <p className="text-sm text-muted-foreground">{eyebrow}</p>
          <h1 className="text-2xl font-semibold">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="success">실시간 동기화</Badge>
          <UserMenu>{viewer.name}</UserMenu>
        </div>
      </header>
      <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">{children}</div>
    </main>
  );
}

export function MetricCard({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      <FileCheck2 className="mr-2 h-4 w-4" />
      {text}
    </div>
  );
}

export function LoadingState() {
  return (
    <main className="flex min-h-screen grow flex-col p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>불러오는 중</CardTitle>
          <CardDescription>
            실시간 연차 데이터를 준비하고 있습니다.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}

export function InfoPill({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-medium",
          warning && "text-amber-600 dark:text-amber-300",
        )}
      >
        {value}
      </span>
    </div>
  );
}
