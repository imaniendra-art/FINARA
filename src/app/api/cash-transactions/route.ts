import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { financeReadRoles, financeWriteRoles, requireApiRole } from "@/lib/api-auth";
import { createFinanceNumber } from "@/lib/finance";
import { cashTransactionInputSchema } from "@/lib/validation";
import Account from "@/models/Account";
import AuditLog from "@/models/AuditLog";
import CashTransaction from "@/models/CashTransaction";
import { generatePresignedUrl } from "@/lib/s3";

export const dynamic = "force-dynamic";

type AccountSnapshot = {
  _id: mongoose.Types.ObjectId;
  type: string;
  isActive: boolean;
};

async function validateAccounts(cashOrBankAccountId: string, accountId: string) {
  const [cashOrBankAccount, counterAccount] = await Promise.all([
    Account.findById(cashOrBankAccountId).select("_id type isActive").lean<AccountSnapshot | null>(),
    Account.findById(accountId).select("_id type isActive").lean<AccountSnapshot | null>(),
  ]);

  if (!cashOrBankAccount || cashOrBankAccount.type !== "asset" || !cashOrBankAccount.isActive) {
    throw new Error("Akun kas/bank tidak valid.");
  }

  if (!counterAccount || !counterAccount.isActive) {
    throw new Error("Akun lawan transaksi tidak valid.");
  }
}

export async function GET(request: Request) {
  const auth = await requireApiRole(financeReadRoles);
  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("dateFrom")?.trim();
  const dateTo = searchParams.get("dateTo")?.trim();
  const type = searchParams.get("type")?.trim();
  const status = searchParams.get("status")?.trim();

  await dbConnect();

  const filters: Record<string, unknown> = {};

  if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {};

    if (dateFrom) {
      dateFilter.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }

    if (dateTo) {
      dateFilter.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }

    filters.date = dateFilter;
  }

  if (type) {
    filters.type = type;
  }

  if (status) {
    filters.status = status;
  }

  const [transactions, cashAccounts, counterAccounts] = await Promise.all([
    CashTransaction.find(filters)
      .sort({ date: -1, createdAt: -1 })
      .populate("cashOrBankAccountId", "code name type")
      .populate("accountId", "code name type")
      .populate("createdBy", "name")
      .lean(),
    Account.find({ type: "asset", isActive: true }).sort({ code: 1 }).select("code name type").lean(),
    Account.find({ isActive: true }).sort({ code: 1 }).select("code name type").lean(),
  ]);

  // Generate presigned URLs for transactions
  const transactionsWithUrls = await Promise.all(
    transactions.map(async (t) => {
      if (t.attachmentUrl) {
        return {
          ...t,
          attachmentUrl: (await generatePresignedUrl(t.attachmentUrl)) ?? undefined,
        };
      }
      return t;
    })
  );

  return NextResponse.json({
    transactions: transactionsWithUrls,
    cashAccounts,
    counterAccounts,
    options: {
      types: ["cash_in", "cash_out"],
      statuses: ["draft", "posted", "cancelled"],
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(financeWriteRoles);
  if (auth.response) {
    return auth.response;
  }

  const parsed = cashTransactionInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data transaksi kas tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();

  try {
    await validateAccounts(parsed.data.cashOrBankAccountId, parsed.data.accountId);

    const transaction = await CashTransaction.create({
      transactionNumber: createFinanceNumber(parsed.data.type === "cash_in" ? "KIN" : "KOUT"),
      date: parsed.data.date,
      type: parsed.data.type,
      cashOrBankAccountId: new mongoose.Types.ObjectId(parsed.data.cashOrBankAccountId),
      accountId: new mongoose.Types.ObjectId(parsed.data.accountId),
      amount: parsed.data.amount,
      description: parsed.data.description,
      notes: parsed.data.notes,
      status: "draft",
      createdBy: auth.session.user.id,
    });

    await AuditLog.create({
      userId: auth.session.user.id,
      action: "create",
      module: "CashTransaction",
      documentId: transaction._id,
      before: null,
      after: {
        transactionNumber: transaction.transactionNumber,
        type: transaction.type,
        amount: transaction.amount,
      },
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("Create cash transaction error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transaksi kas gagal disimpan." },
      { status: 400 }
    );
  }
}
