import {
  ApprovalMetrics,
  DemoApprovalTable,
  DemoShell,
} from "@/app/demo/shared";

export default function DemoApprovalsPage() {
  return (
    <DemoShell title="승인">
      <ApprovalMetrics />
      <DemoApprovalTable />
    </DemoShell>
  );
}
