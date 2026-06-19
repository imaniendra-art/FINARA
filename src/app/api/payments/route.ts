import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { financeReadRoles, financeWriteRoles, requireApiRole } from "@/lib/api-auth";
import {
  calculateBillStatus,
  calculateRemainingAmount,
  createFinanceNumber,
} from "@/lib/finance";
import { paymentInputSchema } from "@/lib/validation";
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

export async function GET() {
  const auth = await requireApiRole(financeReadRoles);
  if (auth.response) {
    return auth.response;
  }

  await dbConnect();

  const [payments, bills, accounts] = await Promise.all([
    Payment.find({})
      .sort({ paymentDate: -1, createdAt: -1 })
      .populate("studentId", "nim name")
      .populate("billId", "academicYear semester remainingAmount")
      .lean(),
    StudentBill.find({ status: { $in: ["unpaid", "partial"] } })
      .sort({ dueDate: 1 })
      .populate("studentId", "nim name")
      .populate("feeTypeId", "name")
      .lean(),
    Account.find({
      type: "asset",
      isActive: true,
      code: { $in: ["1000", "1010", "1-101", "1-102", "1-103", "1-104", "1-201", "1-202", "1-203"] },
    })
      .sort({ code: 1 })
      .select("code name")
      .lean(),
  ]);

  return NextResponse.json({ payments, bills, accounts });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(financeWriteRoles);
  if (auth.response) {
    return auth.response;
  }

  const parsed = paymentInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data pembayaran tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();

  const dbSession = await mongoose.startSession();

  try {
    const result = await dbSession.withTransaction(async () => {
      const bill = await StudentBill.findById(parsed.data.billId)
        .session(dbSession)
        .lean<BillSnapshot | null>();

      if (!bill) {
        throw new Error("Tagihan tidak ditemukan.");
      }

      if (bill.remainingAmount <= 0) {
        throw new Error("Tagihan sudah lunas.");
      }

      if (parsed.data.amount > bill.remainingAmount) {
        throw new Error("Pembayaran tidak boleh melebihi sisa tagihan.");
      }

      const feeType = await FeeType.findById(bill.feeTypeId)
        .session(dbSession)
        .lean<FeeTypeSnapshot | null>();

      if (!feeType?.revenueAccountId) {
        throw new Error("Akun pendapatan jenis tagihan tidak ditemukan.");
      }

      const cashOrBankAccount = await Account.findById(parsed.data.cashOrBankAccountId)
        .session(dbSession)
        .select("_id type isActive")
        .lean();

      if (!cashOrBankAccount || cashOrBankAccount.type !== "asset" || !cashOrBankAccount.isActive) {
        throw new Error("Akun kas/bank tidak valid.");
      }

      const nextPaidAmount = bill.paidAmount + parsed.data.amount;
      const nextRemainingAmount = calculateRemainingAmount(
        bill.amount,
        bill.discount,
        nextPaidAmount
      );
      const netAmount = bill.amount - bill.discount;
      const nextStatus = calculateBillStatus(nextRemainingAmount, netAmount);

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
        throw new Error("Tagihan berubah saat pembayaran diproses. Silakan muat ulang data.");
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
            paymentDate: parsed.data.paymentDate,
            amount: parsed.data.amount,
            paymentMethod: parsed.data.paymentMethod,
            cashOrBankAccountId: parsed.data.cashOrBankAccountId,
            notes: parsed.data.notes,
            createdBy: auth.session.user.id,
          },
        ],
        { session: dbSession, ordered: true }
      );

      const [journalEntry] = await JournalEntry.create(
        [
          {
            entryNumber: createFinanceNumber("JRN"),
            date: parsed.data.paymentDate,
            description: `Pembayaran tagihan ${receiptNumber}`,
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
            accountId: parsed.data.cashOrBankAccountId,
            debit: parsed.data.amount,
            credit: 0,
            description: `Debit pembayaran ${receiptNumber}`,
          },
          {
            journalEntryId: journalEntry._id,
            accountId: feeType.revenueAccountId,
            debit: 0,
            credit: parsed.data.amount,
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
              amount: parsed.data.amount,
              journalEntryId: journalEntry._id,
            },
          },
        ],
        { session: dbSession, ordered: true }
      );

      return { payment, updatedBill, journalEntryId: journalEntry._id };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Create payment error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pembayaran gagal diproses." },
      { status: 400 }
    );
  } finally {
    await dbSession.endSession();
  }
}
