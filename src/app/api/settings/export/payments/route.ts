import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { auditSettingsExport, createExcelResponse } from "@/lib/settings-export";
import Payment from "@/models/Payment";

const exportRoles = ["super_admin", "admin_bauk"] as const;

type PopulatedPayment = {
  paymentNumber: string;
  receiptNumber?: string;
  paymentDate: Date;
  amount: number;
  paymentMethod: string;
  notes?: string;
  studentId?: { nim?: string; name?: string };
  cashOrBankAccountId?: { code?: string; name?: string };
};

export async function GET() {
  const auth = await requireApiRole([...exportRoles]);
  if (auth.response) {
    return auth.response;
  }

  await dbConnect();

  const payments = await Payment.find({})
    .sort({ paymentDate: -1, createdAt: -1 })
    .populate("studentId", "nim name")
    .populate("cashOrBankAccountId", "code name")
    .lean<PopulatedPayment[]>();
  const rows = payments.map((payment) => ({
    paymentNumber: payment.paymentNumber,
    receiptNumber: payment.receiptNumber ?? "",
    paymentDate: payment.paymentDate,
    nim: payment.studentId?.nim ?? "",
    mahasiswa: payment.studentId?.name ?? "",
    amount: payment.amount,
    paymentMethod: payment.paymentMethod,
    akunKasBank: payment.cashOrBankAccountId
      ? `${payment.cashOrBankAccountId.code} - ${payment.cashOrBankAccountId.name}`
      : "",
    notes: payment.notes ?? "",
  }));

  await auditSettingsExport(auth.session.user.id, "payments", rows.length);

  return createExcelResponse(rows, "finara-pembayaran.xlsx");
}
