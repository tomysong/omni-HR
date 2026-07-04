"use client";

import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarDays,
  CheckCheck,
  Clock3,
  Hourglass,
  ShieldCheck,
  TimerReset,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  EmptyState,
  LoadingState,
  MetricCard,
  ProductPage,
  SetupCard,
  STATUS_LABELS,
  STATUS_VARIANTS,
  TYPE_LABELS,
  formatDate,
  todayString,
} from "@/app/product/shared";

export function LeaveDashboard() {
  const [today] = useState(todayString);
  const [isSeeding, setIsSeeding] = useState(false);
  const workspace = useQuery(api.leave.workspace, { today });
  const ensureDemoWorkspace = useMutation(api.leave.ensureDemoWorkspace);

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await ensureDemoWorkspace({ today });
    } finally {
      setIsSeeding(false);
    }
  };

  if (workspace === undefined) {
    return <LoadingState />;
  }

  return (
    <ProductPage
      eyebrow="연차·대체휴무 관리"
      title="내 대시보드"
      viewer={workspace.viewer}
      setupNeeded={workspace.setupNeeded}
    >
      {workspace.setupNeeded ? (
        <SetupCard isSeeding={isSeeding} onSeed={handleSeed} />
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={CalendarDays}
          title="연차 잔여"
          value={
            workspace.annual
              ? `${workspace.annual.remainingDays.toFixed(2)}일`
              : "-"
          }
          detail={
            workspace.annual
              ? `부여 ${workspace.annual.grantedDays}일 · 사용 ${workspace.annual.usedDays}일`
              : "프로필 생성 후 표시"
          }
        />
        <MetricCard
          icon={Clock3}
          title="대체휴무 잔여"
          value={
            workspace.compensatory
              ? `${workspace.compensatory.remainingHours.toFixed(1)}시간`
              : "-"
          }
          detail={
            workspace.compensatory
              ? `적립 ${workspace.compensatory.creditedHours}시간 · 사용 ${workspace.compensatory.usedHours}시간`
              : "프로필 생성 후 표시"
          }
        />
        <MetricCard
          icon={Hourglass}
          title="내 승인대기"
          value={`${workspace.myRequests.filter((request) => request.status === "pending").length}건`}
          detail="최근 신청 기준"
        />
        <MetricCard
          icon={ShieldCheck}
          title="결재 대기"
          value={`${workspace.approvalQueue.length}건`}
          detail="승인자·관리자 권한"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>빠른 이동</CardTitle>
            <CardDescription>
              업무 흐름을 탭별로 바로 이어서 처리합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <QuickLink
              href="/product/requests"
              icon={CalendarDays}
              title="신청"
              description="휴가 신청과 내 신청 목록"
            />
            <QuickLink
              href="/product/employees"
              icon={Users}
              title="직원"
              description="직원 목록과 프로필 등록"
            />
            <QuickLink
              href="/product/policy"
              icon={TimerReset}
              title="정책"
              description="연차/대체휴무 기준값 관리"
            />
            <QuickLink
              href="/product/approvals"
              icon={CheckCheck}
              title="승인"
              description="승인대기 목록과 즉시 처리"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>정책 요약</CardTitle>
            <CardDescription>현재 적용 중인 운영 기준입니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <PolicyRow
              label="산정 기준"
              value={
                workspace.policy.yearBasis === "hireDate"
                  ? "입사일 기준"
                  : "회계연도 기준"
              }
            />
            <PolicyRow
              label="대체휴무 소멸"
              value={
                workspace.policy.compensatoryExpiryDays === null
                  ? "미정"
                  : `${workspace.policy.compensatoryExpiryDays}일`
              }
              warning={workspace.policy.compensatoryExpiryDays === null}
            />
            <PolicyRow
              label="결재 단계"
              value={`${workspace.policy.approvalSteps}단계`}
            />
            <PolicyRow
              label="반반차"
              value={workspace.policy.allowQuarterDay ? "운영" : "미운영"}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>내 신청 목록</CardTitle>
              <CardDescription>최근 신청 내역</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/product/requests">신청 화면</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {workspace.myRequests.length === 0 ? (
              <EmptyState text="아직 신청 내역이 없습니다." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="border-b text-left text-muted-foreground">
                    <tr>
                      <th className="py-2 font-medium">유형</th>
                      <th className="py-2 font-medium">기간</th>
                      <th className="py-2 font-medium">수량</th>
                      <th className="py-2 font-medium">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspace.myRequests.slice(0, 6).map((request) => (
                      <tr key={request._id} className="border-b last:border-0">
                        <td className="py-3">{TYPE_LABELS[request.type]}</td>
                        <td className="py-3">
                          {formatDate(request.startDate)} -{" "}
                          {formatDate(request.endDate)}
                        </td>
                        <td className="py-3">
                          {request.amount}
                          {request.unit === "day" ? "일" : "시간"}
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              STATUS_VARIANTS[request.status] ?? "secondary"
                            }
                          >
                            {STATUS_LABELS[request.status] ?? request.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>승인 대기 미리보기</CardTitle>
              <CardDescription>
                대기 중인 요청 일부만 보여줍니다.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/product/approvals">전체 보기</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {workspace.approvalQueue.length === 0 ? (
              <EmptyState text="처리할 신청이 없습니다." />
            ) : (
              <div className="space-y-3">
                {workspace.approvalQueue.slice(0, 4).map((request) => (
                  <div
                    key={request._id}
                    className="rounded-lg border p-3 text-sm shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">
                          {request.employeeName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {request.department}
                        </div>
                      </div>
                      <Badge variant="warning">승인대기</Badge>
                    </div>
                    <div className="mt-2 text-muted-foreground">
                      {TYPE_LABELS[request.type]} ·{" "}
                      {formatDate(request.startDate)} -{" "}
                      {formatDate(request.endDate)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </ProductPage>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof CalendarDays;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border bg-card p-4 shadow-sm transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-muted p-2">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="font-medium">{title}</div>
          <div className="text-sm text-muted-foreground">{description}</div>
        </div>
      </div>
    </Link>
  );
}

function PolicyRow({
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
      <span className={warning ? "font-medium text-amber-600" : "font-medium"}>
        {value}
      </span>
    </div>
  );
}
