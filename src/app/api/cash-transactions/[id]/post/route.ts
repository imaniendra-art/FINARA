import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { financeWriteRoles, requireApiRole } from "@/lib/api-auth";
import { createFinanceNumber } from "@/lib/finance";
import { objectIdSchema } from "@/lib/validation";
import AuditLog from "@/models/AuditLog";
import CashTransaction from "@/models/CashTransaction";
import JournalEntry from "@/models/JournalEntry";
import JournalLine from "@/models/JournalLine";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CashTransactionSnapshot = {
  _id: mongoose.Types.ObjectId;
  transactionNumber: string;
  date: Date;
  type: "cash_in" | "cash_out";
  cashOrBankAccountId: mongoose.Types.ObjectId;
  accountId: mongoose.Types.ObjectId;
  amount: number;
  description: string;
  status: "draft" | "posted" | "cancelled";
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(financeWriteRoles);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json({ error: "ID transaksi kas tidak valid." }, { status: 400 });
  }

  await dbConnect();

  const dbSession = await mongoose.startSession();

  try {
    const result = await dbSession.withTransaction(async () => {
      const transaction = await CashTransaction.findById(parsedId.data)
        .session(dbSession)
        .lean<CashTransactionSnapshot | null>();

      if (!transaction) {
        throw new Error("Transaksi kas tidak ditemukan.");
      }

      if (transaction.status !== "draft") {
        throw new Error("Hanya transaksi draft yang bisa diposting.");
      }

      if (transaction.amount <= 0) {
        throw new Error("Nominal wajib lebih dari 0.");
      }

      const [journalEntry] = await JournalEntry.create(
        [
          {
            entryNumber: createFinanceNumber("JRN"),
            date: transaction.date,
            description: transaction.description,
            sourceType: "cash_transaction",
            sourceId: transaction._id,
            status: "draft",
            createdBy: auth.session.user.id,
          },
        ],
        { session: dbSession, ordered: true }
      );

      const debitAccountId =
        transaction.type === "cash_in" ? transaction.cashOrBankAccountId : transaction.accountId;
      const creditAccountId =
        transaction.type === "cash_in" ? transaction.accountId : transaction.cashOrBankAccountId;

      await JournalLine.create(
        [
          {
            journalEntryId: journalEntry._id,
            accountId: debitAccountId,
            debit: transaction.amount,
            credit: 0,
            description:
              transaction.type === "cash_in"
                ? `Debit kas/bank ${transaction.transactionNumber}`
                : `Debit akun lawan ${transaction.transactionNumber}`,
          },
          {
            journalEntryId: journalEntry._id,
            accountId: creditAccountId,
            debit: 0,
            credit: transaction.amount,
            description:
              transaction.type === "cash_in"
                ? `Kredit akun lawan ${transaction.transactionNumber}`
                : `Kredit kas/bank ${transaction.transactionNumber}`,
          },
        ],
        { session: dbSession, ordered: true }
      );

      await JournalEntry.findByIdAndUpdate(
        journalEntry._id,
        { $set: { status: "posted" } },
        { session: dbSession, runValidators: true }
      );

      const updatedTransaction = await CashTransaction.findByIdAndUpdate(
        transaction._id,
        {
          $set: {
            status: "posted",
            journalEntryId: journalEntry._id,
          },
        },
        { returnDocument: "after", session: dbSession, runValidators: true }
      );

      await AuditLog.create(
        [
          {
            userId: auth.session.user.id,
            action: "post",
            module: "CashTransaction",
            documentId: transaction._id,
            before: transaction,
            after: {
              status: "posted",
              journalEntryId: journalEntry._id,
            },
          },
        ],
        { session: dbSession, ordered: true }
      );

      return { transaction: updatedTransaction, journalEntryId: journalEntry._id };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Post cash transaction error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transaksi kas gagal diposting." },
      { status: 400 }
    );
  } finally {
    await dbSession.endSession();
  }
}
