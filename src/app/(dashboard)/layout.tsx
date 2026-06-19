import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { dashboardRoles, requireRole } from "@/lib/rbac";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRole(dashboardRoles);

  return <DashboardLayout>{children}</DashboardLayout>;
}
