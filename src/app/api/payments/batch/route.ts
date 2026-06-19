import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { financeWriteRoles, requireApiRole } from "@/lib/api-auth";
import {
  createFinanceNumber,
} from "@/lib/finance";
import Account from "@/models/Account";
import AuditLog from "@/models/AuditLog";
import FeeType from "@/models/FeeType";
import JournalEntry from "@/models/JournalEntry";
import JournalLine from "@/models/JournalLine";
import Payment from "@/models/Payment";
import StudentBill from "@/models/StudentBill";

type BillSnapshot = {
  _id: mongoose.Types.ObjectId;
  feeTypeId: mongoose.Types.ObjectId;
  amount: number;
  discount: number;
  paidAmount: number;
  remainingAmount: number;
  studentId: mongoose.Types.ObjectId;
};

type FeeTypeSnapshot = {
  _id: mongoose.Types.ObjectId;
  revenueAccountId: mongoose.Types.ObjectId;
};

export async function POST(request: Request) {
  const auth = await requireApiRole(financeWriteRoles);
  if (auth.response) {
    return auth.response;
  }

  const body = await request.json();
  const { billIds, paymentDate, paymentMethod, cashOrBankAccountId, notes } = body;

  if (!Array.isArray(billIds) || billIds.length === 0) {
    return NextResponse.json(
      { error: "Pilih minimal satu tagihan untuk dibayar." },
      { status: 400 }
    );
  }

  if (!paymentDate) {
    return NextResponse.json(
      { error: "Tanggal pembayaran wajib diisi." },
      { status: 400 }
    );
  }

  if (!cashOrBankAccountId) {
    return NextResponse.json(
      { error: "Akun Kas/Bank wajib dipilih." },
      { status: 400 }
    );
  }

  await dbConnect();

  const dbSession = await mongoose.startSession();

  try {
    const result = await dbSession.withTransaction(async () => {
      // 1. Validate cash/bank account first
      const cashOrBankAccount = await Account.findById(cashOrBankAccountId)
        .session(dbSession)
        .select("_id type isActive")
        .lean();

      if (!cashOrBankAccount || cashOrBankAccount.type !== "asset" || !cashOrBankAccount.isActive) {
        throw new Error("Akun kas/bank tidak valid atau tidak aktif.");
      }

      const paymentsCreated = [];
      let totalAmountPaid = 0;

      // 2. Iterate through each bill in the batch
      for (const billId of billIds) {
        const bill = await StudentBill.findById(billId)
          .session(dbSession)
          .lean<BillSnapshot | null>();

        if (!bill) {
          throw new Error(`Tagihan dengan ID ${billId} tidak ditemukan.`);
        }

        if (bill.remainingAmount <= 0) {
          continue; // Skip silently if already paid
        }

        const feeType = await FeeType.findById(bill.feeTypeId)
          .session(dbSession)
          .lean<FeeTypeSnapshot | null>();

        if (!feeType?.revenueAccountId) {
          throw new Error(`Akun pendapatan untuk jenis tagihan tidak ditemukan.`);
        }

        const payAmount = bill.remainingAmount; // Always pay full remaining amount in batch KIP
        const nextPaidAmount = bill.paidAmount + payAmount;
        const nextRemainingAmount = 0;
        const nextStatus = "paid";

        const updatedBill = await StudentBill.findOneAndUpdate(
          {
            _id: bill._id,
            remainingAmount: bill.remainingAmount,
          },
          {
            $set: {
              paidAmount: nextPaidAmount,
              remainingAmount: nextRemainingAmount,
              status: nextStatus,
            },
          },
          { returnDocument: "after", session: dbSession, runValidators: true }
        );

        if (!updatedBill) {
          throw new Error("Data tagihan berubah saat memproses transaksi batch. Silakan coba lagi.");
        }

        const paymentNumber = createFinanceNumber("PAY");
        const receiptNumber = createFinanceNumber("RCPT");

        const [payment] = await Payment.create(
          [
            {
              paymentNumber,
              receiptNumber,
              studentId: bill.studentId,
              billId: bill._id,
              paymentDate: paymentDate,
              amount: payAmount,
              paymentMethod: paymentMethod || "bank_transfer",
              cashOrBankAccountId: cashOrBankAccountId,
              notes: notes || "Pembayaran Massal KIP",
              createdBy: auth.session.user.id,
            },
          ],
          { session: dbSession, ordered: true }
        );

        const [journalEntry] = await JournalEntry.create(
          [
            {
              entryNumber: createFinanceNumber("JRN"),
              date: paymentDate,
              description: `Pembayaran KIP batch ${receiptNumber}`,
              sourceType: "payment",
              sourceId: payment._id,
              status: "draft",
              createdBy: auth.session.user.id,
            },
          ],
          { session: dbSession, ordered: true }
        );

        await JournalLine.create(
          [
            {
              journalEntryId: journalEntry._id,
              accountId: cashOrBankAccountId,
              debit: payAmount,
              credit: 0,
              description: `Debit pembayaran ${receiptNumber}`,
            },
            {
              journalEntryId: journalEntry._id,
              accountId: feeType.revenueAccountId,
              debit: 0,
              credit: payAmount,
              description: `Kredit pendapatan ${receiptNumber}`,
            },
          ],
          { session: dbSession, ordered: true }
        );

        await JournalEntry.findByIdAndUpdate(
          journalEntry._id,
          { $set: { status: "posted" } },
          { session: dbSession, runValidators: true }
        );

        payment.journalEntryId = journalEntry._id;
        await payment.save({ session: dbSession });

        await AuditLog.create(
          [
            {
              userId: auth.session.user.id,
              action: "create",
              module: "Payment",
              documentId: payment._id,
              before: null,
              after: {
                paymentNumber,
                receiptNumber,
                billId: bill._id,
                amount: payAmount,
                journalEntryId: journalEntry._id,
              },
            },
          ],
          { session: dbSession, ordered: true }
        );

        paymentsCreated.push({
          billId: bill._id,
          paymentNumber,
          amount: payAmount,
        });

        totalAmountPaid += payAmount;
      }

      return {
        message: `Sukses memproses ${paymentsCreated.length} pembayaran batch KIP.`,
        count: paymentsCreated.length,
        totalAmountPaid,
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Batch payment error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memproses pembayaran batch KIP." },
      { status: 400 }
    );
  } finally {
    await dbSession.endSession();
  }
}
