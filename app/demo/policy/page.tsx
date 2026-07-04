import {
  DemoPolicyForm,
  DemoPolicyPanel,
  DemoShell,
  PolicyMetrics,
} from "@/app/demo/shared";

export default function DemoPolicyPage() {
  return (
    <DemoShell title="정책">
      <PolicyMetrics />
      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <DemoPolicyForm />
        <DemoPolicyPanel />
      </section>
    </DemoShell>
  );
}
