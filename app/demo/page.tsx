import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DashboardMetrics,
  DemoApprovalTable,
  DemoPolicyPanel,
  DemoRequestTable,
  DemoShell,
} from "@/app/demo/shared";

export default function DemoDashboardPage() {
  return (
    <DemoShell title="내 대시보드">
      <DashboardMetrics />

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>빠른 이동</CardTitle>
            <CardDescription>
              로그인 없이 전체 탭 흐름을 확인할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button variant="outline" asChild>
              <Link href="/demo/requests">신청 데모</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/demo/employees">직원 데모</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/demo/policy">정책 데모</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/demo/approvals">승인 데모</Link>
            </Button>
          </CardContent>
        </Card>
        <DemoPolicyPanel />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <DemoRequestTable />
        <DemoApprovalTable />
      </section>
    </DemoShell>
  );
}
