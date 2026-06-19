import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { auditSettingsExport, createExcelResponse } from "@/lib/settings-export";
import CashTransaction from "@/models/CashTransaction";

const exportRoles = ["super_admin", "admin_bauk"] as const;

type PopulatedCashTransaction = {
  transactionNumber: string;
  date: Date;
  type: string;
  amount: number;
  description: string;
  notes?: string;
  status: string;
  accountId?: { code?: string; name?: string };
  cashOrBankAccountId?: { code?: string; name?: string };
};

export async function GET() {
  const auth = await requireApiRole([...exportRoles]);
  if (auth.response) {
    return auth.response;
  }

  await dbConnect();

  const transactions = await CashTransaction.find({})
    .sort({ date: -1, createdAt: -1 })
    .populate("accountId", "code name")
    .populate("cashOrBankAccountId", "code name")
    .lean<PopulatedCashTransaction[]>();
  const rows = transactions.map((transaction) => ({
    transactionNumber: transaction.transactionNumber,
    date: transaction.date,
    type: transaction.type,
    akunKasBank: transaction.cashOrBankAccountId
      ? `${transaction.cashOrBankAccountId.code} - ${transaction.cashOrBankAccountId.name}`
      : "",
    akunLawan: transaction.accountId
      ? `${transaction.accountId.code} - ${transaction.accountId.name}`
      : "",
    amount: transaction.amount,
    description: transaction.description,
    notes: transaction.notes ?? "",
    status: transaction.status,
  }));

  await auditSettingsExport(auth.session.user.id, "cash-transactions", rows.length);

  return createExcelResponse(rows, "finara-kas-transaksi.xlsx");
}
