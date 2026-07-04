"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Check, CheckCheck, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
  EmptyState,
  LoadingState,
  MetricCard,
  ProductPage,
  SetupCard,
  TYPE_LABELS,
  formatDate,
  todayString,
} from "@/app/product/shared";

export default function ApprovalsPage() {
  const [today] = useState(todayString);
  const [isSeeding, setIsSeeding] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<
    Record<string, string>
  >({});

  const workspace = useQuery(api.leave.workspace, { today });
  const ensureDemoWorkspace = useMutation(api.leave.ensureDemoWorkspace);
  const decideRequest = useMutation(api.leave.decideRequest);

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await ensureDemoWorkspace({ today });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleDecision = async (
    requestId: Id<"leaveRequests">,
    decision: "approved" | "rejected",
  ) => {
    setDecidingId(requestId);
    try {
      await decideRequest({
        requestId,
        decision,
        rejectionReason:
          decision === "rejected"
            ? rejectionReasons[requestId]?.trim() || undefined
            : undefined,
      });
      toast.success(
        decision === "approved" ? "승인 처리했습니다." : "반려 처리했습니다.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "처리에 실패했습니다.",
      );
    } finally {
      setDecidingId(null);
    }
  };

  if (workspace === undefined) {
    return <LoadingState />;
  }

  const canApprove =
    workspace.viewer.role === "approver" ||
    workspace.viewer.role === "admin" ||
    workspace.viewer.role === "systemAdmin";

  return (
    <ProductPage
      eyebrow="연차·대체휴무 관리"
      title="승인"
      viewer={workspace.viewer}
      setupNeeded={workspace.setupNeeded}
    >
      {workspace.setupNeeded ? (
        <SetupCard isSeeding={isSeeding} onSeed={handleSeed} />
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={CheckCheck}
          title="승인 대기"
          value={`${workspace.approvalQueue.length}건`}
          detail="현재 pending 기준"
        />
        <MetricCard
          icon={ShieldCheck}
          title="내 권한"
          value={workspace.viewer.role ?? "employee"}
          detail="approver/admin/systemAdmin 가능"
        />
        <MetricCard
          icon={Check}
          title="연차 신청"
          value={`${workspace.approvalQueue.filter((request) => request.type === "annual").length}건`}
          detail="pending 목록 중"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>승인 대기 목록</CardTitle>
          <CardDescription>
            승인자는 여기서 바로 승인 또는 반려할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workspace.setupNeeded ? (
            <EmptyState text="데모 데이터를 생성하면 승인 대기 목록이 채워집니다." />
          ) : !canApprove ? (
            <EmptyState text="현재 계정은 승인 처리 권한이 없습니다." />
          ) : workspace.approvalQueue.length === 0 ? (
            <EmptyState text="처리할 신청이 없습니다." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 font-medium">직원</th>
                    <th className="py-2 font-medium">유형</th>
                    <th className="py-2 font-medium">기간</th>
                    <th className="py-2 font-medium">수량</th>
                    <th className="py-2 font-medium">반려 사유</th>
                    <th className="py-2 text-right font-medium">처리</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.approvalQueue.map((request) => (
                    <tr key={request._id} className="border-b last:border-0">
                      <td className="py-3">
                        <div className="font-medium">
                          {request.employeeName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {request.department}
                        </div>
                      </td>
                      <td className="py-3">
                        <Badge variant="outline">
                          {TYPE_LABELS[request.type]}
                        </Badge>
                      </td>
                      <td className="py-3">
                        {formatDate(request.startDate)} -{" "}
                        {formatDate(request.endDate)}
                      </td>
                      <td className="py-3">
                        {request.amount}
                        {request.unit === "day" ? "일" : "시간"}
                      </td>
                      <td className="py-3">
                        <Input
                          value={rejectionReasons[request._id] ?? ""}
                          onChange={(event) =>
                            setRejectionReasons((current) => ({
                              ...current,
                              [request._id]: event.target.value,
                            }))
                          }
                          placeholder="반려 시 입력"
                        />
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={decidingId === request._id}
                            onClick={() =>
                              handleDecision(request._id, "approved")
                            }
                          >
                            <Check className="h-4 w-4" />
                            승인
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={decidingId === request._id}
                            onClick={() =>
                              handleDecision(request._id, "rejected")
                            }
                          >
                            <X className="h-4 w-4" />
                            반려
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </ProductPage>
  );
}
