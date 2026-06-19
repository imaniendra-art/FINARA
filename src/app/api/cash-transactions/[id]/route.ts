import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { financeReadRoles, financeWriteRoles, requireApiRole } from "@/lib/api-auth";
import { cashTransactionInputSchema, objectIdSchema } from "@/lib/validation";
import Account from "@/models/Account";
import AuditLog from "@/models/AuditLog";
import CashTransaction from "@/models/CashTransaction";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(financeReadRoles);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json({ error: "ID transaksi kas tidak valid." }, { status: 400 });
  }

  await dbConnect();

  const transaction = await CashTransaction.findById(parsedId.data)
    .populate("cashOrBankAccountId", "code name type")
    .populate("accountId", "code name type")
    .populate("journalEntryId", "entryNumber status")
    .populate("createdBy", "name")
    .lean();

  if (!transaction) {
    return NextResponse.json({ error: "Transaksi kas tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ transaction });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRole(financeWriteRoles);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json({ error: "ID transaksi kas tidak valid." }, { status: 400 });
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

    const before = await CashTransaction.findById(parsedId.data).lean();
    if (!before) {
      return NextResponse.json({ error: "Transaksi kas tidak ditemukan." }, { status: 404 });
    }

    if (before.status !== "draft") {
      return NextResponse.json(
        { error: "Transaksi yang sudah posted atau cancelled tidak boleh diedit." },
        { status: 409 }
      );
    }

    const transaction = await CashTransaction.findByIdAndUpdate(
      parsedId.data,
      {
        $set: {
          date: parsed.data.date,
          type: parsed.data.type,
          cashOrBankAccountId: new mongoose.Types.ObjectId(parsed.data.cashOrBankAccountId),
          accountId: new mongoose.Types.ObjectId(parsed.data.accountId),
          amount: parsed.data.amount,
          description: parsed.data.description,
          notes: parsed.data.notes,
        },
      },
      { returnDocument: "after", runValidators: true }
    );

    await AuditLog.create({
      userId: auth.session.user.id,
      action: "update",
      module: "CashTransaction",
      documentId: parsedId.data,
      before,
      after: transaction,
    });

    return NextResponse.json({ transaction });
  } catch (error) {
    console.error("Update cash transaction error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transaksi kas gagal diperbarui." },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(["super_admin"]);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json({ error: "ID transaksi kas tidak valid." }, { status: 400 });
  }

  await dbConnect();

  try {
    const transaction = await CashTransaction.findById(parsedId.data);
    if (!transaction) {
      return NextResponse.json({ error: "Transaksi kas tidak ditemukan." }, { status: 404 });
    }

    if (transaction.status !== "cancelled") {
      return NextResponse.json(
        { error: "Hanya transaksi dengan status cancelled yang dapat dihapus." },
        { status: 400 }
      );
    }

    await CashTransaction.findByIdAndDelete(parsedId.data);

    await AuditLog.create({
      userId: auth.session.user.id,
      action: "delete",
      module: "CashTransaction",
      documentId: parsedId.data,
      before: transaction,
      after: null,
    });

    return NextResponse.json({ success: true, message: "Transaksi kas berhasil dihapus." });
  } catch (error) {
    console.error("Delete cash transaction error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transaksi kas gagal dihapus." },
      { status: 400 }
    );
  }
}
