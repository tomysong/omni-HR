"use client";

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { CalendarDays, Clock3, FileText, Hourglass } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  selectClassName,
  SetupCard,
  STATUS_LABELS,
  STATUS_VARIANTS,
  TYPE_LABELS,
  formatDate,
  todayString,
} from "@/app/product/shared";

const requestDefaults = {
  annual: { amount: "1", unit: "day" as const },
  halfAnnual: { amount: "0.5", unit: "day" as const },
  quarterAnnual: { amount: "0.25", unit: "day" as const },
  compensatory: { amount: "8", unit: "hour" as const },
  bereavement: { amount: "1", unit: "day" as const },
  sick: { amount: "1", unit: "day" as const },
  official: { amount: "1", unit: "day" as const },
  unpaid: { amount: "1", unit: "day" as const },
};

export default function RequestsPage() {
  const [today] = useState(todayString);
  const [type, setType] = useState<keyof typeof requestDefaults>("annual");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [amount, setAmount] = useState(requestDefaults.annual.amount);
  const [unit, setUnit] = useState<"day" | "hour">(requestDefaults.annual.unit);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const workspace = useQuery(api.leave.workspace, { today });
  const createLeaveRequest = useMutation(api.leave.createLeaveRequest);
  const ensureDemoWorkspace = useMutation(api.leave.ensureDemoWorkspace);

  const handleTypeChange = (nextType: keyof typeof requestDefaults) => {
    setType(nextType);
    setAmount(requestDefaults[nextType].amount);
    setUnit(requestDefaults[nextType].unit);
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await ensureDemoWorkspace({ today });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await createLeaveRequest({
        type,
        startDate,
        endDate,
        amount: Number(amount),
        unit,
        reason: reason.trim() || undefined,
      });
      toast.success("휴가 신청을 등록했습니다.");
      setReason("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "신청에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (workspace === undefined) {
    return <LoadingState />;
  }

  return (
    <ProductPage
      eyebrow="연차·대체휴무 관리"
      title="신청"
      viewer={workspace.viewer}
      setupNeeded={workspace.setupNeeded}
    >
      {workspace.setupNeeded ? (
        <SetupCard isSeeding={isSeeding} onSeed={handleSeed} />
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
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
              ? `대기 ${workspace.annual.pendingDays.toFixed(2)}일 포함`
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
          detail="적립분 우선 소진 권장"
        />
        <MetricCard
          icon={Hourglass}
          title="최근 승인대기"
          value={`${workspace.myRequests.filter((request) => request.status === "pending").length}건`}
          detail="목록 pull 방식 확인"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>휴가 신청</CardTitle>
            <CardDescription>
              유형과 기간을 입력하면 잔여 기준으로 검증합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {workspace.setupNeeded ? (
              <EmptyState text="데모 데이터를 먼저 생성하면 신청 폼이 활성화됩니다." />
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <Field label="유형">
                  <select
                    className={selectClassName}
                    value={type}
                    onChange={(event) =>
                      handleTypeChange(
                        event.target.value as keyof typeof requestDefaults,
                      )
                    }
                  >
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="시작일">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      required
                    />
                  </Field>
                  <Field label="종료일">
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      required
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="수량">
                    <Input
                      type="number"
                      step={unit === "day" ? "0.25" : "1"}
                      min="0.25"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      required
                    />
                  </Field>
                  <Field label="단위">
                    <select
                      className={selectClassName}
                      value={unit}
                      onChange={(event) =>
                        setUnit(event.target.value as "day" | "hour")
                      }
                    >
                      <option value="day">일</option>
                      <option value="hour">시간</option>
                    </select>
                  </Field>
                </div>
                <Field label="사유">
                  <Textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="사유를 입력하세요."
                  />
                </Field>
                <Button type="submit" disabled={isSubmitting}>
                  <FileText className="h-4 w-4" />
                  {isSubmitting ? "등록 중" : "신청 등록"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>내 신청 목록</CardTitle>
            <CardDescription>
              최근 12건 기준으로 상태를 계속 확인합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {workspace.myRequests.length === 0 ? (
              <EmptyState text="아직 신청 내역이 없습니다." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b text-left text-muted-foreground">
                    <tr>
                      <th className="py-2 font-medium">유형</th>
                      <th className="py-2 font-medium">기간</th>
                      <th className="py-2 font-medium">수량</th>
                      <th className="py-2 font-medium">상태</th>
                      <th className="py-2 font-medium">승인자</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspace.myRequests.map((request) => (
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
                        <td className="py-3 text-muted-foreground">
                          {request.approverName ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </ProductPage>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
