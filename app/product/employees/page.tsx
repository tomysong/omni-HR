"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  ShieldCheck,
  Settings2,
  Trash2,
  UserPlus,
  Users,
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
  SetupCard,
  todayString,
} from "@/app/product/shared";

export default function EmployeesPage() {
  const [today] = useState(todayString);
  const [employeeNo, setEmployeeNo] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState<
    "employee" | "approver" | "admin" | "systemAdmin"
  >("employee");
  const [hireDate, setHireDate] = useState(today);
  const [employmentStatus, setEmploymentStatus] = useState<
    "active" | "leaveOfAbsence" | "resigned"
  >("active");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isClearingDemo, setIsClearingDemo] = useState(false);
  const [balanceEditId, setBalanceEditId] =
    useState<Id<"employeeProfiles"> | null>(null);
  const [annualInput, setAnnualInput] = useState("");
  const [compInput, setCompInput] = useState("");
  const [isSavingBalance, setIsSavingBalance] = useState(false);

  const workspace = useQuery(api.leave.workspace, { today });
  const createEmployeeProfile = useMutation(api.leave.createEmployeeProfile);
  const ensureDemoWorkspace = useMutation(api.leave.ensureDemoWorkspace);
  const clearDemoData = useMutation(api.leave.clearDemoData);
  const setInitialBalance = useMutation(api.leave.setInitialBalance);

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

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await ensureDemoWorkspace({ today });
    } finally {
      setIsSeeding(false);
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
        error instanceof Error ? error.message : "데모 데이터 삭제에 실패했습니다.",
      );
    } finally {
      setIsClearingDemo(false);
    }
  };

  const canManage =
    workspace?.viewer.role === "admin" ||
    workspace?.viewer.role === "systemAdmin";

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

  const hasDemoData = workspace.employees.some((employee) =>
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
      setupNeeded={workspace.setupNeeded}
    >
      {workspace.setupNeeded ? (
        <SetupCard isSeeding={isSeeding} onSeed={handleSeed} />
      ) : null}

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

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Card>
          <CardHeader>
            <CardTitle>직원 등록</CardTitle>
            <CardDescription>
              관리자만 등록 가능합니다. 등록 시 기본 연차 부여 레코드도 함께
              만듭니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {workspace.setupNeeded ? (
              <EmptyState text="데모 데이터를 먼저 생성하면 등록 폼이 활성화됩니다." />
            ) : !canManage ? (
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
                        setRole(
                          event.target.value as
                            | "employee"
                            | "approver"
                            | "admin"
                            | "systemAdmin",
                        )
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
                            {employee.employeeNo}
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
                            {employee.annualRemainingDays.toFixed(2)}일
                          </td>
                          <td className="py-3">
                            {employee.compensatoryRemainingDays.toFixed(2)}일
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
                                    placeholder={employee.annualRemainingDays.toFixed(
                                      2,
                                    )}
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
                                    placeholder={employee.compensatoryRemainingDays.toFixed(
                                      2,
                                    )}
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
