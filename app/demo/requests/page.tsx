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
      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <DemoRequestForm />
        <DemoRequestTable />
      </section>
    </DemoShell>
  );
}
