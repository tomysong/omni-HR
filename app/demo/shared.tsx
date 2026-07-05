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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Building2,
  CalendarDays,
  Check,
  Clock3,
  FileText,
  Hourglass,
  Settings,
  ShieldCheck,
  TimerReset,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { DemoMenu } from "@/app/demo/DemoMenu";

export const demoRequests = [
  {
    id: "REQ-1024",
    type: "연차",
    period: "7월 22일 - 7월 22일",
    amount: "1일",
    status: "승인대기",
    variant: "warning" as const,
    approver: "-",
  },
  {
    id: "REQ-1019",
    type: "대체휴무",
    period: "7월 18일 - 7월 18일",
    amount: "4시간",
    status: "승인",
    variant: "success" as const,
    approver: "박준호",
  },
  {
    id: "REQ-1008",
    type: "반차",
    period: "6월 28일 - 6월 28일",
    amount: "0.5일",
    status: "승인",
    variant: "success" as const,
    approver: "박준호",
  },
];

export const demoApprovalQueue = [
  {
    id: "APR-203",
    employeeName: "김민지",
    department: "운영",
    type: "연차",
    period: "7월 22일 - 7월 22일",
    amount: "1일",
  },
  {
    id: "APR-204",
    employeeName: "이서연",
    department: "현장",
    type: "대체휴무",
    period: "7월 24일 - 7월 24일",
    amount: "8시간",
  },
];

export const demoEmployees = [
  {
    employeeNo: "ADM-001",
    name: "관리자",
    title: "관리자",
    department: "총무",
    role: "admin",
    annual: "9.50일",
    compensatory: "12.0시간",
    status: "active",
  },
  {
    employeeNo: "EMP-001",
    name: "김민지",
    title: "매니저",
    department: "운영",
    role: "employee",
    annual: "14.00일",
    compensatory: "8.0시간",
    status: "active",
  },
  {
    employeeNo: "EMP-002",
    name: "박준호",
    title: "팀장",
    department: "현장",
    role: "approver",
    annual: "16.00일",
    compensatory: "0.0시간",
    status: "active",
  },
];

export const policyRows = [
  ["산정 기준", "입사일 기준"],
  ["연차 상한", "25일"],
  ["반반차", "운영"],
  ["결재 단계", "1단계"],
  ["대체휴무 소멸", "미정"],
  ["1차 통보", "6개월 전"],
  ["2차 통보", "2개월 전"],
];

export const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function DemoShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <DemoMenu />
      <main className="flex min-h-screen min-w-0 flex-col bg-background">
        <header className="flex flex-col gap-4 border-b px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-sm text-muted-foreground">연차·대체휴무 관리</p>
            <h1 className="text-2xl font-semibold">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">UI 미리보기</Badge>
            <Badge variant="success">정적 데모</Badge>
          </div>
        </header>
        <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
          {children}
        </div>
      </main>
    </div>
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

export function DemoRequestTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>내 신청 목록</CardTitle>
        <CardDescription>최근 신청 내역</CardDescription>
      </CardHeader>
      <CardContent>
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
              {demoRequests.map((request) => (
                <tr key={request.id} className="border-b last:border-0">
                  <td className="py-3">{request.type}</td>
                  <td className="py-3">{request.period}</td>
                  <td className="py-3">{request.amount}</td>
                  <td className="py-3">
                    <Badge variant={request.variant}>{request.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function DemoPolicyPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>정책값</CardTitle>
        <CardDescription>노사합의 전 값은 비워 둡니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-sm">
          {policyRows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
            >
              <span className="text-muted-foreground">{label}</span>
              <span
                className={cn(
                  "font-medium",
                  value === "미정" && "text-amber-600 dark:text-amber-300",
                )}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
          <TimerReset className="mt-0.5 h-4 w-4 shrink-0" />
          <span>대체휴무 소멸기한은 합의 후 정책값으로만 적용됩니다.</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function DemoApprovalTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>승인 대기 목록</CardTitle>
        <CardDescription>대기 중인 휴가 신청</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
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
              {demoApprovalQueue.map((request) => (
                <tr key={request.id} className="border-b last:border-0">
                  <td className="py-3">
                    <div className="font-medium">{request.employeeName}</div>
                    <div className="text-xs text-muted-foreground">
                      {request.department}
                    </div>
                  </td>
                  <td className="py-3">{request.type}</td>
                  <td className="py-3">{request.period}</td>
                  <td className="py-3">{request.amount}</td>
                  <td className="py-3">
                    <Input placeholder="반려 시 입력" />
                  </td>
                  <td className="py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline">
                        <Check className="h-4 w-4" />
                        승인
                      </Button>
                      <Button size="sm" variant="outline">
                        <TimerReset className="h-4 w-4" />
                        반려
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function DemoRequestForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>휴가 신청</CardTitle>
        <CardDescription>
          잔여 검증과 상태 확인 흐름을 보여주는 정적 데모입니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4">
          <Field label="유형">
            <select className={selectClassName} defaultValue="annual">
              <option value="annual">연차</option>
              <option value="halfAnnual">반차</option>
              <option value="quarterAnnual">반반차</option>
              <option value="compensatory">대체휴무</option>
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="시작일">
              <Input type="date" defaultValue="2026-07-22" />
            </Field>
            <Field label="종료일">
              <Input type="date" defaultValue="2026-07-22" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="수량">
              <Input type="number" defaultValue="1" />
            </Field>
            <Field label="단위">
              <select className={selectClassName} defaultValue="day">
                <option value="day">일</option>
                <option value="hour">시간</option>
              </select>
            </Field>
          </div>
          <Field label="사유">
            <Textarea defaultValue="개인 일정" />
          </Field>
          <Button type="button">
            <FileText className="h-4 w-4" />
            신청 등록
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function DemoEmployeeForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>직원 등록</CardTitle>
        <CardDescription>
          관리자 등록 흐름을 보여주는 정적 데모입니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="사번">
              <Input defaultValue="EMP-003" />
            </Field>
            <Field label="이름">
              <Input defaultValue="최윤서" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="이메일">
              <Input defaultValue="choi@company.com" />
            </Field>
            <Field label="부서">
              <Input defaultValue="디자인" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="직책">
              <Input defaultValue="사원" />
            </Field>
            <Field label="입사일">
              <Input type="date" defaultValue="2026-04-01" />
            </Field>
          </div>
          <Button type="button">
            <UserPlus className="h-4 w-4" />
            직원 등록
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function DemoEmployeeTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>직원 목록</CardTitle>
        <CardDescription>
          잔여 연차와 대체휴무를 함께 확인하는 표입니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
              </tr>
            </thead>
            <tbody>
              {demoEmployees.map((employee) => (
                <tr
                  key={employee.employeeNo}
                  className="border-b last:border-0"
                >
                  <td className="py-3 font-mono text-xs">
                    {employee.employeeNo}
                  </td>
                  <td className="py-3">
                    <div className="font-medium">{employee.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {employee.title}
                    </div>
                  </td>
                  <td className="py-3">{employee.department}</td>
                  <td className="py-3">{employee.role}</td>
                  <td className="py-3">{employee.annual}</td>
                  <td className="py-3">{employee.compensatory}</td>
                  <td className="py-3">{employee.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function DemoPolicyForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>정책 수정</CardTitle>
        <CardDescription>
          미정 값은 빈칸으로 두는 흐름을 보여줍니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4">
          <Field label="정책명">
            <Input defaultValue="기본 연차 정책" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="산정 기준">
              <select className={selectClassName} defaultValue="hireDate">
                <option value="hireDate">입사일 기준</option>
                <option value="fiscalYear">회계연도 기준</option>
              </select>
            </Field>
            <Field label="결재 단계">
              <select className={selectClassName} defaultValue="1">
                <option value="1">1단계</option>
                <option value="2">2단계</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="연차 상한">
              <Input type="number" defaultValue="25" />
            </Field>
            <Field label="대체휴무 소멸기한(일)">
              <Input placeholder="미정이면 비워둠" />
            </Field>
          </div>
          <Button type="button">
            <Settings className="h-4 w-4" />
            정책 저장
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function DashboardMetrics() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        icon={CalendarDays}
        title="연차 잔여"
        value="9.50일"
        detail="부여 15일 · 사용 4.5일 · 대기 1일"
      />
      <MetricCard
        icon={Clock3}
        title="대체휴무 잔여"
        value="12.0시간"
        detail="적립 20시간 · 사용 8시간"
      />
      <MetricCard
        icon={Hourglass}
        title="내 승인대기"
        value="1건"
        detail="최근 신청 기준"
      />
      <MetricCard
        icon={ShieldCheck}
        title="결재 대기"
        value="2건"
        detail="승인자·관리자 권한"
      />
    </section>
  );
}

export function RequestMetrics() {
  return (
    <section className="grid gap-4 sm:grid-cols-3">
      <MetricCard
        icon={CalendarDays}
        title="연차 잔여"
        value="9.50일"
        detail="대기 1일 포함"
      />
      <MetricCard
        icon={Clock3}
        title="대체휴무 잔여"
        value="12.0시간"
        detail="적립분 우선 소진 권장"
      />
      <MetricCard
        icon={Hourglass}
        title="최근 승인대기"
        value="1건"
        detail="목록 pull 방식 확인"
      />
    </section>
  );
}

export function EmployeeMetrics() {
  return (
    <section className="grid gap-4 sm:grid-cols-3">
      <MetricCard
        icon={Users}
        title="전체 인원"
        value="3명"
        detail="재직 3명"
      />
      <MetricCard
        icon={ShieldCheck}
        title="승인 권한"
        value="2명"
        detail="approver/admin"
      />
      <MetricCard
        icon={Building2}
        title="부서 수"
        value="3개"
        detail="현재 등록 기준"
      />
    </section>
  );
}

export function PolicyMetrics() {
  return (
    <section className="grid gap-4 sm:grid-cols-3">
      <MetricCard
        icon={Settings}
        title="산정 기준"
        value="입사일"
        detail="회사 운영 기준"
      />
      <MetricCard
        icon={TimerReset}
        title="대체휴무 소멸"
        value="미정"
        detail="합의 전 null 유지 가능"
      />
      <MetricCard
        icon={ShieldCheck}
        title="결재 단계"
        value="1단계"
        detail="현재 활성 정책"
      />
    </section>
  );
}

export function ApprovalMetrics() {
  return (
    <section className="grid gap-4 sm:grid-cols-3">
      <MetricCard
        icon={Check}
        title="승인 대기"
        value="2건"
        detail="현재 pending 기준"
      />
      <MetricCard
        icon={ShieldCheck}
        title="내 권한"
        value="admin"
        detail="approver/admin 가능"
      />
      <MetricCard
        icon={Hourglass}
        title="연차 신청"
        value="1건"
        detail="pending 목록 중"
      />
    </section>
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
