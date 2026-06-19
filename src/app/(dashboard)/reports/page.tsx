import { reportRoles, requireRole } from "@/lib/rbac";
import { ReportsClient } from "./ReportsClient";

export default async function ReportsPage() {
  await requireRole(reportRoles);

  return <ReportsClient />;
}
