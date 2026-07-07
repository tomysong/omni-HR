"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarPlus,
  CalendarX2,
  Check,
  Clock3,
  Download,
  Hourglass,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useState } from "react";
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
  STATUS_LABELS,
  STATUS_VARIANTS,
  formatDate,
  selectClassName,
  todayString,
} from "@/app/product/shared";

export default function HolidayWorkPage() {
  const [today] = useState(todayString);
  const workspace = useQuery(api.leave.workspace, { today });
  const myRecords = useQuery(api.holidayWork.myHolidayWork, {});

  const canApprove =
    workspace?.viewer.role === "approver" ||
    workspace?.viewer.role === "admin" ||
    workspace?.viewer.role === "systemAdmin";
  const canManage =
    workspace?.viewer.role === "admin" ||
    workspace?.viewer.role === "systemAdmin";

  const pendingRecords = useQuery(
    api.holidayWork.pendingHolidayWork,
    canApprove ? {} : "skip",
  );

  if (workspace === undefined) {
    return <LoadingState />;
  }

  const myPending = (myRecords ?? []).filter(
    (record) => record.status === "pending",
  ).length;

  return (
    <ProductPage
      eyebrow="연차·대체휴무 관리"
      title="휴일근무"
      viewer={workspace.viewer}
    >
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={Clock3}
          title="대체휴무 잔여"
          value={
            workspace.compensatory
              ? `${workspace.compensatory.remainingDays.toFixed(2)}일`
              : "-"
          }
          detail="승인된 휴일근무만 적립됩니다"
        />
        <MetricCard
          icon={Hourglass}
          title="내 보고 대기"
          value={`${myPending}건`}
          detail="승인 시 자동 적립"
        />
        <MetricCard
          icon={CalendarPlus}
          title="적립 기준"
          value="근무일 = 대체휴무"
          detail="종일 1일 · 반일 0.5일"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <ReportCard />
        <MyRecordsCard records={myRecords} />
      </section>

      {canApprove ? <PendingCard records={pendingRecords} /> : null}
      {canManage ? (
        <AdminRecordCard employees={workspace.employees} today={today} />
      ) : null}
      {canManage ? <HolidayAdminCard /> : null}
    </ProductPage>
  );
}

function HolidayHint({ date }: { date: string }) {
  const check = useQuery(
    api.holidays.checkDate,
    date ? { date } : "skip",
  );
  if (!date || check === undefined) {
    return null;
  }
  return check.isHoliday ? (
    <p className="text-xs text-emerald-600">
      휴일 확인: {check.name}
      {check.kind === "public" ? " (공휴일)" : ""}
    </p>
  ) : (
    <p className="text-xs text-destructive">
      휴일이 아닙니다. 평일 근무는 대체휴무 적립 대상이 아닙니다.
    </p>
  );
}

function ReportCard() {
  const reportHolidayWork = useMutation(api.holidayWork.reportHolidayWork);
  const [workDate, setWorkDate] = useState("");
  const [amount, setAmount] = useState<"1" | "0.5">("1");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await reportHolidayWork({
        workDate,
        amountDays: Number(amount),
        note: note.trim() || undefined,
      });
      toast.success("휴일근무를 보고했습니다. 승인 후 적립됩니다.");
      setWorkDate("");
      setNote("");
      setAmount("1");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "보고에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>휴일근무 보고</CardTitle>
        <CardDescription>
          토·일 또는 공휴일에 근무한 날짜를 보고하면 승인 후 해당 일수만큼
          대체휴무가 적립됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field label="근무일">
            <Input
              type="date"
              value={workDate}
              onChange={(event) => setWorkDate(event.target.value)}
              required
            />
          </Field>
          <HolidayHint date={workDate} />
          <Field label="적립량">
            <select
              className={selectClassName}
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value as "1" | "0.5")
              }
            >
              <option value="1">종일 (1일)</option>
              <option value="0.5">반일 (0.5일)</option>
            </select>
          </Field>
          <Field label="비고 (선택)">
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="현장 지원 등"
            />
          </Field>
          <Button type="submit" disabled={isSubmitting}>
            <CalendarPlus className="h-4 w-4" />
            {isSubmitting ? "보고 중" : "휴일근무 보고"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

type EnrichedRecord = {
  _id: Id<"holidayWorkRecords">;
  workDate: string;
  amountDays: number;
  note?: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  employeeName: string;
  department: string;
  approverName: string | null;
};

function MyRecordsCard({
  records,
}: {
  records: EnrichedRecord[] | undefined;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>내 보고 목록</CardTitle>
        <CardDescription>최근 12건 기준입니다.</CardDescription>
      </CardHeader>
      <CardContent>
        {records === undefined ? (
          <EmptyState text="불러오는 중입니다." />
        ) : records.length === 0 ? (
          <EmptyState text="보고한 휴일근무가 없습니다." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">근무일</th>
                  <th className="py-2 font-medium">적립량</th>
                  <th className="py-2 font-medium">비고</th>
                  <th className="py-2 font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record._id} className="border-b last:border-0">
                    <td className="py-3">{formatDate(record.workDate)}</td>
                    <td className="py-3">{record.amountDays}일</td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {record.status === "rejected" && record.rejectionReason
                        ? `반려: ${record.rejectionReason}`
                        : (record.note ?? "-")}
                    </td>
                    <td className="py-3">
                      <Badge variant={STATUS_VARIANTS[record.status]}>
                        {STATUS_LABELS[record.status]}
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
  );
}

function PendingCard({
  records,
}: {
  records: EnrichedRecord[] | undefined;
}) {
  const decideHolidayWork = useMutation(api.holidayWork.decideHolidayWork);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const handleDecide = async (
    recordId: Id<"holidayWorkRecords">,
    decision: "approved" | "rejected",
  ) => {
    setDecidingId(recordId);
    try {
      await decideHolidayWork({
        recordId,
        decision,
        rejectionReason:
          decision === "rejected"
            ? reasons[recordId]?.trim() || undefined
            : undefined,
      });
      toast.success(
        decision === "approved"
          ? "승인했습니다. 대체휴무가 적립됩니다."
          : "반려했습니다.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "처리에 실패했습니다.",
      );
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>휴일근무 승인 대기</CardTitle>
        <CardDescription>
          승인하면 해당 직원에게 대체휴무가 즉시 적립됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {records === undefined ? (
          <EmptyState text="불러오는 중입니다." />
        ) : records.length === 0 ? (
          <EmptyState text="대기 중인 보고가 없습니다." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">직원</th>
                  <th className="py-2 font-medium">근무일</th>
                  <th className="py-2 font-medium">적립량</th>
                  <th className="py-2 font-medium">비고</th>
                  <th className="py-2 font-medium">반려 사유</th>
                  <th className="py-2 text-right font-medium">처리</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record._id} className="border-b last:border-0">
                    <td className="py-3">
                      <div className="font-medium">{record.employeeName}</div>
                      <div className="text-xs text-muted-foreground">
                        {record.department}
                      </div>
                    </td>
                    <td className="py-3">{formatDate(record.workDate)}</td>
                    <td className="py-3">{record.amountDays}일</td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {record.note ?? "-"}
                    </td>
                    <td className="py-3">
                      <Input
                        value={reasons[record._id] ?? ""}
                        onChange={(event) =>
                          setReasons((current) => ({
                            ...current,
                            [record._id]: event.target.value,
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
                          disabled={decidingId === record._id}
                          onClick={() => handleDecide(record._id, "approved")}
                        >
                          <Check className="h-4 w-4" />
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={decidingId === record._id}
                          onClick={() => handleDecide(record._id, "rejected")}
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
  );
}

type EmployeeOption = {
  _id: Id<"employeeProfiles">;
  name: string;
  department: string;
};

function AdminRecordCard({
  employees,
  today,
}: {
  employees: EmployeeOption[];
  today: string;
}) {
  const adminRecordHolidayWork = useMutation(
    api.holidayWork.adminRecordHolidayWork,
  );
  const [employeeId, setEmployeeId] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [amount, setAmount] = useState<"1" | "0.5">("1");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!employeeId) {
      toast.error("직원을 선택하세요.");
      return;
    }
    setIsSubmitting(true);
    try {
      await adminRecordHolidayWork({
        employeeProfileId: employeeId as Id<"employeeProfiles">,
        workDate,
        amountDays: Number(amount),
        note: note.trim() || undefined,
      });
      toast.success("휴일근무를 기록하고 대체휴무를 적립했습니다.");
      setWorkDate("");
      setNote("");
      setAmount("1");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "기록에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>휴일근무 직접 기록 (관리자)</CardTitle>
        <CardDescription>
          보고 없이 관리자가 일괄 입력합니다. 즉시 승인·적립됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={handleSubmit}
        >
          <Field label="직원">
            <select
              className={selectClassName + " w-44"}
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              required
            >
              <option value="">선택</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.name} ({employee.department})
                </option>
              ))}
            </select>
          </Field>
          <Field label="근무일">
            <Input
              type="date"
              className="w-40"
              max={today}
              value={workDate}
              onChange={(event) => setWorkDate(event.target.value)}
              required
            />
          </Field>
          <Field label="적립량">
            <select
              className={selectClassName + " w-32"}
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value as "1" | "0.5")
              }
            >
              <option value="1">종일 (1일)</option>
              <option value="0.5">반일 (0.5일)</option>
            </select>
          </Field>
          <Field label="비고 (선택)">
            <Input
              className="w-44"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="현장 지원 등"
            />
          </Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "기록 중" : "기록·적립"}
          </Button>
        </form>
        <div className="mt-3">
          <HolidayHint date={workDate} />
        </div>
      </CardContent>
    </Card>
  );
}

function HolidayAdminCard() {
  const holidays = useQuery(api.holidays.listHolidays, {});
  const addHoliday = useMutation(api.holidays.addHoliday);
  const removeHoliday = useMutation(api.holidays.removeHoliday);
  const seedDefaultHolidays = useMutation(api.holidays.seedDefaultHolidays);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  const currentYear = new Date().getFullYear();
  const visible = (holidays ?? []).filter(
    (holiday) => Number(holiday.date.slice(0, 4)) >= currentYear,
  );

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsWorking(true);
    try {
      await addHoliday({ date, name });
      toast.success("공휴일을 추가했습니다.");
      setDate("");
      setName("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "추가에 실패했습니다.",
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleSeed = async () => {
    setIsWorking(true);
    try {
      const result = await seedDefaultHolidays({});
      toast.success(
        result.added > 0
          ? `기본 공휴일 ${result.added}건을 등록했습니다.`
          : "이미 모두 등록되어 있습니다.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "등록에 실패했습니다.",
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleRemove = async (holidayId: Id<"holidays">) => {
    setIsWorking(true);
    try {
      await removeHoliday({ holidayId });
      toast.success("삭제했습니다.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "삭제에 실패했습니다.",
      );
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>공휴일 관리 (관리자)</CardTitle>
          <CardDescription>
            토·일은 자동 인식됩니다. 정부 지정 공휴일과 임시공휴일을 여기서
            관리하세요.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSeed}
          disabled={isWorking}
        >
          <Download className="h-4 w-4" />
          기본 공휴일 불러오기 (2026-2027)
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form className="flex flex-wrap items-end gap-3" onSubmit={handleAdd}>
          <Field label="날짜">
            <Input
              type="date"
              className="w-40"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </Field>
          <Field label="이름">
            <Input
              className="w-52"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="임시공휴일"
              required
            />
          </Field>
          <Button type="submit" variant="outline" disabled={isWorking}>
            추가
          </Button>
        </form>

        {holidays === undefined ? (
          <EmptyState text="불러오는 중입니다." />
        ) : visible.length === 0 ? (
          <EmptyState text="등록된 공휴일이 없습니다. 기본 공휴일을 불러오세요." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((holiday) => (
              <div
                key={holiday._id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {holiday.date}
                  </span>{" "}
                  {holiday.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={isWorking}
                  onClick={() => handleRemove(holiday._id)}
                >
                  {holiday.name.includes("대체") ? (
                    <CalendarX2 className="h-3.5 w-3.5" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  <span className="sr-only">삭제</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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
