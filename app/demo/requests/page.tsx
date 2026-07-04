import {
  DemoRequestForm,
  DemoRequestTable,
  DemoShell,
  RequestMetrics,
} from "@/app/demo/shared";

export default function DemoRequestsPage() {
  return (
    <DemoShell title="신청">
      <RequestMetrics />
      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <DemoRequestForm />
        <DemoRequestTable />
      </section>
    </DemoShell>
  );
}
