import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { financeReadRoles, masterDataWriteRoles, requireApiRole } from "@/lib/api-auth";
import { accountInputSchema } from "@/lib/validation";
import Account from "@/models/Account";
import CashTransaction from "@/models/CashTransaction";
import FeeType from "@/models/FeeType";
import JournalLine from "@/models/JournalLine";
import Payment from "@/models/Payment";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getUsedAccountIds() {
  const [journalAccounts, paymentAccounts, cashMainAccounts, cashBankAccounts, feeTypeAccounts] =
    await Promise.all([
      JournalLine.distinct("accountId"),
      Payment.distinct("cashOrBankAccountId"),
      CashTransaction.distinct("accountId"),
      CashTransaction.distinct("cashOrBankAccountId"),
      FeeType.distinct("revenueAccountId"),
    ]);

  return new Set(
    [
      ...journalAccounts,
      ...paymentAccounts,
      ...cashMainAccounts,
      ...cashBankAccounts,
      ...feeTypeAccounts,
    ].map((id) => id.toString())
  );
}

export async function GET(request: Request) {
  const auth = await requireApiRole(financeReadRoles);
  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type")?.trim();

  await dbConnect();

  const filters: Record<string, unknown> = {};
  if (type) {
    filters.type = type;
  }

  const [accounts, usedAccountIds] = await Promise.all([
    Account.find(filters).sort({ code: 1 }).populate("parentId", "code name").lean(),
    getUsedAccountIds(),
  ]);

  return NextResponse.json({
    accounts: accounts.map((account) => ({
      ...account,
      isUsed: usedAccountIds.has(account._id.toString()),
    })),
    options: {
      types: ["asset", "liability", "equity", "revenue", "expense"],
      normalBalances: ["debit", "credit"],
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(masterDataWriteRoles);
  if (auth.response) {
    return auth.response;
  }

  const parsed = accountInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data kode akun tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();

  const duplicateAccount = await Account.findOne({
    code: { $regex: `^${escapeRegex(parsed.data.code)}$`, $options: "i" },
  }).lean();

  if (duplicateAccount) {
    return NextResponse.json({ error: "Kode akun sudah digunakan." }, { status: 409 });
  }

  if (parsed.data.parentId) {
    const parentAccount = await Account.findById(parsed.data.parentId).select("_id type").lean();
    if (!parentAccount) {
      return NextResponse.json({ error: "Akun induk tidak ditemukan." }, { status: 404 });
    }
  }

  try {
    const account = await Account.create({
      ...parsed.data,
      parentId: parsed.data.parentId ? new mongoose.Types.ObjectId(parsed.data.parentId) : null,
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json({ error: "Kode akun sudah digunakan." }, { status: 409 });
    }

    console.error("Create account error:", error);
    return NextResponse.json({ error: "Kode akun gagal disimpan." }, { status: 500 });
  }
}
