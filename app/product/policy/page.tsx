"use client";

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Settings, ShieldCheck, TimerReset } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
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
import {
  InfoPill,
  LoadingState,
  MetricCard,
  ProductPage,
  selectClassName,
  SetupCard,
  todayString,
} from "@/app/product/shared";

export default function PolicyPage() {
  const [today] = useState(todayString);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [yearBasis, setYearBasis] = useState<"hireDate" | "fiscalYear">(
    "hireDate",
  );
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState("1");
  const [annualLeaveCapDays, setAnnualLeaveCapDays] = useState("25");
  const [allowQuarterDay, setAllowQuarterDay] = useState(true);
  const [approvalSteps, setApprovalSteps] = useState<1 | 2>(1);
  const [compensatoryExpiryDays, setCompensatoryExpiryDays] = useState("");
  const [firstNotice, setFirstNotice] = useState("6");
  const [secondNotice, setSecondNotice] = useState("2");

  const workspace = useQuery(api.leave.workspace, { today });
  const ensureDemoWorkspace = useMutation(api.leave.ensureDemoWorkspace);
  const updateActivePolicy = useMutation(api.leave.updateActivePolicy);

  useEffect(() => {
    if (!workspace) {
      return;
    }
    setName(workspace.policy.name);
    setYearBasis(workspace.policy.yearBasis);
    setFiscalYearStartMonth(String(workspace.policy.fiscalYearStartMonth ?? 1));
    setAnnualLeaveCapDays(String(workspace.policy.annualLeaveCapDays));
    setAllowQuarterDay(workspace.policy.allowQuarterDay);
    setApprovalSteps(workspace.policy.approvalSteps);
    setCompensatoryExpiryDays(
      workspace.policy.compensatoryExpiryDays === null
        ? ""
        : String(workspace.policy.compensatoryExpiryDays),
    );
    setFirstNotice(
      String(workspace.policy.promotionFirstNoticeMonthsBeforeExpiry),
    );
    setSecondNotice(
      String(workspace.policy.promotionSecondNoticeMonthsBeforeExpiry),
    );
  }, [workspace]);

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
      await updateActivePolicy({
        name,
        yearBasis,
        fiscalYearStartMonth:
          yearBasis === "fiscalYear" ? Number(fiscalYearStartMonth) : undefined,
        annualLeaveCapDays: Number(annualLeaveCapDays),
        allowQuarterDay,
        approvalSteps,
        compensatoryExpiryDays:
          compensatoryExpiryDays.trim() === ""
            ? null
            : Number(compensatoryExpiryDays),
        promotionFirstNoticeMonthsBeforeExpiry: Number(firstNotice),
        promotionSecondNoticeMonthsBeforeExpiry: Number(secondNotice),
      });
      toast.success("정책을 저장했습니다.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "정책 저장에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (workspace === undefined) {
    return <LoadingState />;
  }

  const canManage =
    workspace.viewer.role === "admin" ||
    workspace.viewer.role === "systemAdmin";

  return (
    <ProductPage
      eyebrow="연차·대체휴무 관리"
      title="정책"
      viewer={workspace.viewer}
      setupNeeded={workspace.setupNeeded}
    >
      {workspace.setupNeeded ? (
        <SetupCard isSeeding={isSeeding} onSeed={handleSeed} />
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={Settings}
          title="산정 기준"
          value={
            workspace.policy.yearBasis === "hireDate" ? "입사일" : "회계연도"
          }
          detail="회사 운영 기준"
        />
        <MetricCard
          icon={TimerReset}
          title="대체휴무 소멸"
          value={
            workspace.policy.compensatoryExpiryDays === null
              ? "미정"
              : `${workspace.policy.compensatoryExpiryDays}일`
          }
          detail="합의 전 null 유지 가능"
        />
        <MetricCard
          icon={ShieldCheck}
          title="결재 단계"
          value={`${workspace.policy.approvalSteps}단계`}
          detail="현재 활성 정책"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>정책 수정</CardTitle>
            <CardDescription>
              관리자만 저장 가능합니다. 미정 값은 빈칸으로 두면 됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Field label="정책명">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={!canManage}
                  required
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="산정 기준">
                  <select
                    className={selectClassName}
                    value={yearBasis}
                    disabled={!canManage}
                    onChange={(event) =>
                      setYearBasis(
                        event.target.value as "hireDate" | "fiscalYear",
                      )
                    }
                  >
                    <option value="hireDate">입사일 기준</option>
                    <option value="fiscalYear">회계연도 기준</option>
                  </select>
                </Field>
                <Field label="회계연도 시작월">
                  <Input
                    type="number"
                    min="1"
                    max="12"
                    value={fiscalYearStartMonth}
                    disabled={!canManage || yearBasis !== "fiscalYear"}
                    onChange={(event) =>
                      setFiscalYearStartMonth(event.target.value)
                    }
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="연차 상한">
                  <Input
                    type="number"
                    min="1"
                    value={annualLeaveCapDays}
                    disabled={!canManage}
                    onChange={(event) =>
                      setAnnualLeaveCapDays(event.target.value)
                    }
                  />
                </Field>
                <Field label="결재 단계">
                  <select
                    className={selectClassName}
                    value={String(approvalSteps)}
                    disabled={!canManage}
                    onChange={(event) =>
                      setApprovalSteps(Number(event.target.value) as 1 | 2)
                    }
                  >
                    <option value="1">1단계</option>
                    <option value="2">2단계</option>
                  </select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="대체휴무 소멸기한(일)">
                  <Input
                    type="number"
                    min="1"
                    placeholder="미정이면 비워둠"
                    value={compensatoryExpiryDays}
                    disabled={!canManage}
                    onChange={(event) =>
                      setCompensatoryExpiryDays(event.target.value)
                    }
                  />
                </Field>
                <Field label="반반차 운영">
                  <label className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
                    <input
                      type="checkbox"
                      checked={allowQuarterDay}
                      disabled={!canManage}
                      onChange={(event) =>
                        setAllowQuarterDay(event.target.checked)
                      }
                    />
                    허용
                  </label>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="1차 통보 (개월 전)">
                  <Input
                    type="number"
                    min="1"
                    value={firstNotice}
                    disabled={!canManage}
                    onChange={(event) => setFirstNotice(event.target.value)}
                  />
                </Field>
                <Field label="2차 통보 (개월 전)">
                  <Input
                    type="number"
                    min="1"
                    value={secondNotice}
                    disabled={!canManage}
                    onChange={(event) => setSecondNotice(event.target.value)}
                  />
                </Field>
              </div>
              <Button type="submit" disabled={!canManage || isSubmitting}>
                {isSubmitting ? "저장 중" : "정책 저장"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>현재 정책 요약</CardTitle>
            <CardDescription>
              운영 중인 값이 오른쪽에서 바로 반영됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoPill label="정책명" value={workspace.policy.name} />
            <InfoPill
              label="산정 기준"
              value={
                workspace.policy.yearBasis === "hireDate"
                  ? "입사일 기준"
                  : "회계연도 기준"
              }
            />
            <InfoPill
              label="회계연도 시작월"
              value={`${workspace.policy.fiscalYearStartMonth ?? 1}월`}
            />
            <InfoPill
              label="연차 상한"
              value={`${workspace.policy.annualLeaveCapDays}일`}
            />
            <InfoPill
              label="대체휴무 소멸"
              value={
                workspace.policy.compensatoryExpiryDays === null
                  ? "미정"
                  : `${workspace.policy.compensatoryExpiryDays}일`
              }
              warning={workspace.policy.compensatoryExpiryDays === null}
            />
            <InfoPill
              label="1차 통보"
              value={`${workspace.policy.promotionFirstNoticeMonthsBeforeExpiry}개월 전`}
            />
            <InfoPill
              label="2차 통보"
              value={`${workspace.policy.promotionSecondNoticeMonthsBeforeExpiry}개월 전`}
            />
            <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
              노사합의 전 대체휴무 소멸기한은 공란으로 저장하면 `null` 상태를
              유지합니다.
            </div>
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
