import { receiptRoles, requireRole } from "@/lib/rbac";
import { ReceiptClient } from "./ReceiptClient";

export default async function PaymentReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(receiptRoles);

  const { id } = await params;

  return <ReceiptClient paymentId={id} />;
}
