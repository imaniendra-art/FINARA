import { requireRole } from "@/lib/rbac";
import { budgetReadRoles } from "@/lib/budget";
import { BudgetRequestsClient } from "./BudgetRequestsClient";

export default async function BudgetRequestsPage() {
  await requireRole(budgetReadRoles);

  return <BudgetRequestsClient />;
}
