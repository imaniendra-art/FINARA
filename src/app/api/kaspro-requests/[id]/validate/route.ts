import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import KasproRequest from "@/models/KasproRequest";
import CashTransaction from "@/models/CashTransaction";
import JournalEntry from "@/models/JournalEntry";
import JournalLine from "@/models/JournalLine";
import { createFinanceNumber } from "@/lib/finance";
import mongoose from "mongoose";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action, reason } = body;

    await dbConnect();
    const kasproRequest = await KasproRequest.findById(id);

    if (!kasproRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (action === "approve") {
      const dbSession = await mongoose.startSession();
      try {
        await dbSession.withTransaction(async () => {
          const transaction = await CashTransaction.findById(kasproRequest.cashTransactionId).session(dbSession);
          if (!transaction) throw new Error("Cash transaction not found");

          // Post logic
          const [journalEntry] = await JournalEntry.create(
            [
              {
                entryNumber: createFinanceNumber("JRN"),
                date: transaction.date,
                description: transaction.description,
                sourceType: "cash_transaction",
                sourceId: transaction._id,
                status: "draft",
                createdBy: session.user.id,
              },
            ],
            { session: dbSession, ordered: true }
          );

          await JournalLine.create(
            [
              {
                journalEntryId: journalEntry._id,
                accountId: transaction.accountId,
                debit: transaction.amount,
                credit: 0,
                description: `Debit akun lawan ${transaction.transactionNumber}`,
              },
              {
                journalEntryId: journalEntry._id,
                accountId: transaction.cashOrBankAccountId,
                debit: 0,
                credit: transaction.amount,
                description: `Kredit kas/bank ${transaction.transactionNumber}`,
              },
            ],
            { session: dbSession, ordered: true }
          );

          await JournalEntry.findByIdAndUpdate(
            journalEntry._id,
            { $set: { status: "posted" } },
            { session: dbSession, runValidators: true }
          );

          transaction.status = "posted";
          transaction.journalEntryId = journalEntry._id;
          transaction.attachmentUrl = kasproRequest.buktiUrl;
          await transaction.save({ session: dbSession });

          kasproRequest.status = "selesai";
          await kasproRequest.save({ session: dbSession });

          // Send approval to KASPRO
          const kasproUrl = process.env.KASPRO_URL || "http://localhost:3001";
          await fetch(`${kasproUrl}/api/integrations/finara`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.KASPRO_API_SECRET}`
            },
            body: JSON.stringify({ action: "approve_lpj", kasproId: kasproRequest.kasproId })
          });
        });
        dbSession.endSession();
        return NextResponse.json({ message: "LPJ Validated and Posted" }, { status: 200 });
      } catch (err: any) {
        dbSession.endSession();
        throw err;
      }
    } else if (action === "reject") {
      kasproRequest.status = "ditolak";
      kasproRequest.rejectionReason = reason;
      await kasproRequest.save();

      // Send rejection to KASPRO
      const kasproUrl = process.env.KASPRO_URL || "http://localhost:3001";
      await fetch(`${kasproUrl}/api/integrations/finara`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.KASPRO_API_SECRET}`
        },
        body: JSON.stringify({ action: "reject_lpj", kasproId: kasproRequest.kasproId, reason })
      });

      return NextResponse.json({ message: "LPJ Rejected" }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Kaspro validate error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
