import WisudaFinanceClient from "./WisudaFinanceClient";
import { requireRole } from "@/lib/rbac";

export default async function WisudaFinancePage() {
  await requireRole(["keuangan", "admin_bauk", "staff_bauk", "super_admin"]);

  return <WisudaFinanceClient />;
}
