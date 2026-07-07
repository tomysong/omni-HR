"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  Check,
  ShieldCheck,
  Settings2,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Fragment, FormEvent, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
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
  todayString,
} from "@/app/product/shared";

type RoleValue = "employee" | "approver" | "admin" | "systemAdmin";

export default function EmployeesPage() {
  const [today] = useState(todayString);
  const [employeeNo, setEmployeeNo] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState<RoleValue>("employee");
  const [hireDate, setHireDate] = useState(today);
  const [employmentStatus, setEmploymentStatus] = useState<
    "active" | "leaveOfAbsence" | "resigned"
  >("active");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearingDemo, setIsClearingDemo] = useState(false);
  const [balanceEditId, setBalanceEditId] =
    useState<Id<"employeeProfiles"> | null>(null);
  const [annualInput, setAnnualInput] = useState("");
  const [compInput, setCompInput] = useState("");
  const [isSavingBalance, setIsSavingBalance] = useState(false);

  const workspace = useQuery(api.leave.workspace, { today });
  const createEmployeeProfile = useMutation(
    api.employees.createEmployeeProfile,
  );
  const clearDemoData = useMutation(api.employees.clearDemoData);
  const setInitialBalance = useMutation(api.employees.setInitialBalance);

  const canManage =
    workspace?.viewer.role === "admin" ||
    workspace?.viewer.role === "systemAdmin";

  const accessRequests = useQuery(
    api.access.listAccessRequests,
    canManage ? {} : "skip",
  );

  const openBalanceEdit = (employeeId: Id<"employeeProfiles">) => {
    setBalanceEditId(employeeId);
    setAnnualInput("");
    setCompInput("");
  };

  const closeBalanceEdit = () => {
    setBalanceEditId(null);
    setAnnualInput("");
    setCompInput("");
  };

  const handleSaveBalance = async () => {
    if (balanceEditId === null) return;
    if (annualInput.trim() === "" && compInput.trim() === "") {
      toast.error("연차 또는 대체휴무 중 하나는 입력해야 합니다.");
      return;
    }
    setIsSavingBalance(true);
    try {
      await setInitialBalance({
        employeeProfileId: balanceEditId,
        annualDays: annualInput.trim() === "" ? undefined : Number(annualInput),
        compensatoryDays:
          compInput.trim() === "" ? undefined : Number(compInput),
      });
      toast.success("초기 잔여를 설정했습니다.");
      closeBalanceEdit();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "초기값 설정에 실패했습니다.",
      );
    } finally {
      setIsSavingBalance(false);
    }
  };

  const handleClearDemoData = async () => {
    if (
      !window.confirm(
        "데모/테스트 직원(김민지, 박준호)과 관련 연차·대체휴무·신청 기록을 삭제합니다. 계속할까요?",
      )
    ) {
      return;
    }
    setIsClearingDemo(true);
    try {
      const result = await clearDemoData({});
      toast.success(
        `데모 데이터 삭제 완료 (직원 ${result.removedEmployees}명, 관련 기록 ${result.removedRecords}건)`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "데모 데이터 삭제에 실패했습니다.",
      );
    } finally {
      setIsClearingDemo(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await createEmployeeProfile({
        employeeNo,
        name,
        email: email.trim() || undefined,
        department,
        title: title.trim() || undefined,
        role,
        hireDate,
        employmentStatus,
      });
      toast.success("직원 프로필을 등록했습니다.");
      setEmployeeNo("");
      setName("");
      setEmail("");
      setDepartment("");
      setTitle("");
      setRole("employee");
      setEmploymentStatus("active");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "직원 등록에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (workspace === undefined) {
    return <LoadingState />;
  }

  const hasDemoData = workspace.employees.some(
    (employee) =>
      employee.employeeNo !== null &&
      ["EMP-001", "EMP-002"].includes(employee.employeeNo),
  );

  const activeEmployees = workspace.employees.filter(
    (employee) => employee.employmentStatus === "active",
  ).length;
  const approvers = workspace.employees.filter(
    (employee) =>
      employee.role === "approver" ||
      employee.role === "admin" ||
      employee.role === "systemAdmin",
  ).length;

  return (
    <ProductPage
      eyebrow="연차·대체휴무 관리"
      title="직원"
      viewer={workspace.viewer}
    >
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={Users}
          title="전체 인원"
          value={`${workspace.employees.length}명`}
          detail={`재직 ${activeEmployees}명`}
        />
        <MetricCard
          icon={ShieldCheck}
          title="승인 권한"
          value={`${approvers}명`}
          detail="approver/admin/systemAdmin"
        />
        <MetricCard
          icon={Building2}
          title="부서 수"
          value={`${new Set(workspace.employees.map((employee) => employee.department)).size}개`}
          detail="현재 등록 기준"
        />
      </section>

      {canManage ? (
        <AccessRequestsCard requests={accessRequests} today={today} />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Card>
          <CardHeader>
            <CardTitle>직원 등록</CardTitle>
            <CardDescription>
              계정 없이 직원 정보만 먼저 등록합니다. 계정 연결은 가입 승인으로
              처리하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!canManage ? (
              <EmptyState text="현재 계정은 직원 등록 권한이 없습니다." />
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="사번">
                    <Input
                      value={employeeNo}
                      onChange={(event) => setEmployeeNo(event.target.value)}
                      placeholder="EMP-003"
                      required
                    />
                  </Field>
                  <Field label="이름">
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="홍길동"
                      required
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="이메일">
                    <Input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="name@company.com"
                    />
                  </Field>
                  <Field label="부서">
                    <Input
                      value={department}
                      onChange={(event) => setDepartment(event.target.value)}
                      placeholder="운영"
                      required
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="직책">
                    <Input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="매니저"
                    />
                  </Field>
                  <Field label="입사일">
                    <Input
                      type="date"
                      value={hireDate}
                      onChange={(event) => setHireDate(event.target.value)}
                      required
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="권한">
                    <select
                      className={selectClassName}
                      value={role}
                      onChange={(event) =>
                        setRole(event.target.value as RoleValue)
                      }
                    >
                      <option value="employee">employee</option>
                      <option value="approver">approver</option>
                      <option value="admin">admin</option>
                      <option value="systemAdmin">systemAdmin</option>
                    </select>
                  </Field>
                  <Field label="재직 상태">
                    <select
                      className={selectClassName}
                      value={employmentStatus}
                      onChange={(event) =>
                        setEmploymentStatus(
                          event.target.value as
                            | "active"
                            | "leaveOfAbsence"
                            | "resigned",
                        )
                      }
                    >
                      <option value="active">active</option>
                      <option value="leaveOfAbsence">leaveOfAbsence</option>
                      <option value="resigned">resigned</option>
                    </select>
                  </Field>
                </div>
                <Button type="submit" disabled={isSubmitting}>
                  <UserPlus className="h-4 w-4" />
                  {isSubmitting ? "등록 중" : "직원 등록"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>직원 목록</CardTitle>
              <CardDescription>
                활성 직원이 먼저 보이고, 잔여 정보도 함께 확인합니다.
              </CardDescription>
            </div>
            {canManage && hasDemoData ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearDemoData}
                disabled={isClearingDemo}
              >
                <Trash2 className="h-4 w-4" />
                {isClearingDemo ? "삭제 중" : "데모/테스트 데이터 삭제"}
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {workspace.employees.length === 0 ? (
              <EmptyState text="등록된 직원이 없습니다." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="border-b text-left text-muted-foreground">
                    <tr>
                      <th className="py-2 font-medium">사번</th>
                      <th className="py-2 font-medium">이름</th>
                      <th className="py-2 font-medium">부서</th>
                      <th className="py-2 font-medium">권한</th>
                      <th className="py-2 font-medium">연차</th>
                      <th className="py-2 font-medium">대체휴무</th>
                      <th className="py-2 font-medium">상태</th>
                      {canManage ? (
                        <th className="py-2 text-right font-medium">관리</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {workspace.employees.map((employee) => (
                      <Fragment key={employee._id}>
                        <tr className="border-b last:border-0">
                          <td className="py-3 font-mono text-xs">
                            {employee.employeeNo ?? "-"}
                          </td>
                          <td className="py-3">
                            <div className="font-medium">{employee.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {employee.title || "-"}
                            </div>
                          </td>
                          <td className="py-3">{employee.department}</td>
                          <td className="py-3">{employee.role}</td>
                          <td className="py-3">
                            {employee.annualRemainingDays === null
                              ? "-"
                              : `${employee.annualRemainingDays.toFixed(2)}일`}
                          </td>
                          <td className="py-3">
                            {employee.compensatoryRemainingDays === null
                              ? "-"
                              : `${employee.compensatoryRemainingDays.toFixed(2)}일`}
                          </td>
                          <td className="py-3">{employee.employmentStatus}</td>
                          {canManage ? (
                            <td className="py-3 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  balanceEditId === employee._id
                                    ? closeBalanceEdit()
                                    : openBalanceEdit(employee._id)
                                }
                              >
                                <Settings2 className="h-4 w-4" />
                                초기값 설정
                              </Button>
                            </td>
                          ) : null}
                        </tr>
                        {canManage && balanceEditId === employee._id ? (
                          <tr className="border-b bg-muted/30 last:border-0">
                            <td colSpan={8} className="py-3">
                              <div className="flex flex-wrap items-end gap-3">
                                <Field label="연차 초기 일수">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    className="w-32"
                                    value={annualInput}
                                    onChange={(event) =>
                                      setAnnualInput(event.target.value)
                                    }
                                    placeholder={
                                      employee.annualRemainingDays?.toFixed(
                                        2,
                                      ) ?? "0"
                                    }
                                  />
                                </Field>
                                <Field label="대체휴무 초기 일수">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    className="w-32"
                                    value={compInput}
                                    onChange={(event) =>
                                      setCompInput(event.target.value)
                                    }
                                    placeholder={
                                      employee.compensatoryRemainingDays?.toFixed(
                                        2,
                                      ) ?? "0"
                                    }
                                  />
                                </Field>
                                <Button
                                  size="sm"
                                  onClick={handleSaveBalance}
                                  disabled={isSavingBalance}
                                >
                                  {isSavingBalance ? "저장 중" : "저장"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={closeBalanceEdit}
                                  disabled={isSavingBalance}
                                >
                                  취소
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
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

type AccessRequestItem = {
  _id: Id<"accessRequests">;
  name: string;
  department: string;
  title: string;
  email: string | null;
  createdAt: number;
};

function AccessRequestsCard({
  requests,
  today,
}: {
  requests: AccessRequestItem[] | undefined;
  today: string;
}) {
  const decideAccess = useMutation(api.access.decideAccess);
  const [forms, setForms] = useState<
    Record<
      string,
      { employeeNo: string; hireDate: string; role: RoleValue; reason: string }
    >
  >({});
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const formFor = (id: string) =>
    forms[id] ?? { employeeNo: "", hireDate: today, role: "employee" as const, reason: "" };

  const setForm = (
    id: string,
    patch: Partial<{
      employeeNo: string;
      hireDate: string;
      role: RoleValue;
      reason: string;
    }>,
  ) => {
    setForms((current) => ({
      ...current,
      [id]: { ...formFor(id), ...patch },
    }));
  };

  const handleDecide = async (
    requestId: Id<"accessRequests">,
    decision: "approved" | "rejected",
  ) => {
    const form = formFor(requestId);
    if (decision === "approved" && form.employeeNo.trim() === "") {
      toast.error("승인하려면 사번을 입력해야 합니다.");
      return;
    }
    setDecidingId(requestId);
    try {
      await decideAccess({
        requestId,
        decision,
        employeeNo:
          decision === "approved" ? form.employeeNo.trim() : undefined,
        hireDate: decision === "approved" ? form.hireDate : undefined,
        role: decision === "approved" ? form.role : undefined,
        rejectionReason:
          decision === "rejected" ? form.reason.trim() || undefined : undefined,
      });
      toast.success(
        decision === "approved"
          ? "가입을 승인했습니다."
          : "가입을 반려했습니다.",
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
        <CardTitle>가입 승인 대기</CardTitle>
        <CardDescription>
          회원가입 후 접근을 요청한 사용자입니다. 사번·입사일·권한을 지정해
          승인하세요.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {requests === undefined ? (
          <EmptyState text="불러오는 중입니다." />
        ) : requests.length === 0 ? (
          <EmptyState text="대기 중인 가입 요청이 없습니다." />
        ) : (
          <div className="flex flex-col gap-4">
            {requests.map((request) => {
              const form = formFor(request._id);
              return (
                <div
                  key={request._id}
                  className="rounded-md border p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{request.name}</span>
                    <span className="text-muted-foreground">
                      {request.department}
                      {request.title ? ` · ${request.title}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {request.email ?? "이메일 없음"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label="사번">
                      <Input
                        className="w-32"
                        value={form.employeeNo}
                        onChange={(event) =>
                          setForm(request._id, {
                            employeeNo: event.target.value,
                          })
                        }
                        placeholder="EMP-003"
                      />
                    </Field>
                    <Field label="입사일">
                      <Input
                        type="date"
                        className="w-40"
                        value={form.hireDate}
                        onChange={(event) =>
                          setForm(request._id, { hireDate: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="권한">
                      <select
                        className={selectClassName + " w-36"}
                        value={form.role}
                        onChange={(event) =>
                          setForm(request._id, {
                            role: event.target.value as RoleValue,
                          })
                        }
                      >
                        <option value="employee">employee</option>
                        <option value="approver">approver</option>
                        <option value="admin">admin</option>
                      </select>
                    </Field>
                    <Field label="반려 사유">
                      <Input
                        className="w-44"
                        value={form.reason}
                        onChange={(event) =>
                          setForm(request._id, { reason: event.target.value })
                        }
                        placeholder="반려 시 입력"
                      />
                    </Field>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={decidingId === request._id}
                        onClick={() => handleDecide(request._id, "approved")}
                      >
                        <Check className="h-4 w-4" />
                        승인
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={decidingId === request._id}
                        onClick={() => handleDecide(request._id, "rejected")}
                      >
                        <X className="h-4 w-4" />
                        반려
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
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
