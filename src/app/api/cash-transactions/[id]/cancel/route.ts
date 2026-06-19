import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { financeWriteRoles, requireApiRole } from "@/lib/api-auth";
import { objectIdSchema } from "@/lib/validation";
import AuditLog from "@/models/AuditLog";
import CashTransaction from "@/models/CashTransaction";
import JournalEntry from "@/models/JournalEntry";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CashTransactionSnapshot = {
  _id: mongoose.Types.ObjectId;
  status: "draft" | "posted" | "cancelled";
  journalEntryId?: mongoose.Types.ObjectId;
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

      if (transaction.status === "cancelled") {
        throw new Error("Transaksi kas sudah cancelled.");
      }

      if (transaction.journalEntryId) {
        await JournalEntry.findByIdAndUpdate(
          transaction.journalEntryId,
          { $set: { status: "cancelled" } },
          { session: dbSession, runValidators: true }
        );
      }

      const updatedTransaction = await CashTransaction.findByIdAndUpdate(
        transaction._id,
        { $set: { status: "cancelled" } },
        { returnDocument: "after", session: dbSession, runValidators: true }
      );

      await AuditLog.create(
        [
          {
            userId: auth.session.user.id,
            action: "cancel",
            module: "CashTransaction",
            documentId: transaction._id,
            before: transaction,
            after: { status: "cancelled" },
          },
        ],
        { session: dbSession, ordered: true }
      );

      return { transaction: updatedTransaction };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Cancel cash transaction error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transaksi kas gagal dibatalkan." },
      { status: 400 }
    );
  } finally {
    await dbSession.endSession();
  }
}
