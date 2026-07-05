import {
  DemoEmployeeForm,
  DemoEmployeeTable,
  DemoShell,
  EmployeeMetrics,
} from "@/app/demo/shared";

export default function DemoEmployeesPage() {
  return (
    <DemoShell title="직원">
      <EmployeeMetrics />
      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <DemoEmployeeForm />
        <DemoEmployeeTable />
      </section>
    </DemoShell>
  );
}
