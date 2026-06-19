import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import * as XLSX from "xlsx";
import Account from "../src/models/Account";
import AuditLog from "../src/models/AuditLog";
import FeeType from "../src/models/FeeType";
import JournalEntry from "../src/models/JournalEntry";
import JournalLine from "../src/models/JournalLine";
import Payment from "../src/models/Payment";
import Student from "../src/models/Student";
import StudentBill from "../src/models/StudentBill";
import User from "../src/models/User";
import {
  calculateBillStatus,
  calculateRemainingAmount,
  createFinanceNumber,
} from "../src/lib/finance";

dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI;
const RUN_ID = `E2E-FINARA-${Date.now()}`;
const TEST_YEAR = 2099;
const TEST_PROGRAM = "E2E Akuntansi";
const TEST_SEMESTER = "E2E Ganjil";
const TEST_USER_EMAIL = "e2e.finara@stimi.test";
const TEST_CASH_ACCOUNT_CODE = "E2E1000";
const TEST_REVENUE_ACCOUNT_CODE = "E2E4000";

if (!MONGODB_URI) {
  console.error("MONGODB_URI tidak ditemukan di .env.local");
  process.exit(1);
}

async function ensureBaseData() {
  const password = await bcrypt.hash("e2e-only-password", 10);
  const user = await User.findOneAndUpdate(
    { email: TEST_USER_EMAIL },
    {
      name: "E2E FINARA User",
      email: TEST_USER_EMAIL,
      password,
      role: "super_admin",
      isActive: true,
    },
    { upsert: true, returnDocument: "after" }
  );
  const cashAccount = await Account.findOneAndUpdate(
    { code: TEST_CASH_ACCOUNT_CODE },
    {
      code: TEST_CASH_ACCOUNT_CODE,
      name: "E2E Kas",
      type: "asset",
      normalBalance: "debit",
      isActive: true,
    },
    { upsert: true, returnDocument: "after" }
  );
  const revenueAccount = await Account.findOneAndUpdate(
    { code: TEST_REVENUE_ACCOUNT_CODE },
    {
      code: TEST_REVENUE_ACCOUNT_CODE,
      name: "E2E Pendapatan",
      type: "revenue",
      normalBalance: "credit",
      isActive: true,
    },
    { upsert: true, returnDocument: "after" }
  );
  const student = await Student.create({
    nim: RUN_ID,
    name: "Mahasiswa E2E FINARA",
    gender: "L",
    programStudy: TEST_PROGRAM,
    className: "E2E",
    entryYear: TEST_YEAR,
    phone: "080000000000",
    address: "Data uji otomatis",
    status: "active",
  });
  const feeType = await FeeType.create({
    name: `${RUN_ID} Tagihan`,
    description: "Data uji otomatis",
    defaultAmount: 1000000,
    revenueAccountId: revenueAccount._id,
    isActive: true,
  });

  return { user, cashAccount, student, feeType };
}

async function createBill(studentId: mongoose.Types.ObjectId, feeTypeId: mongoose.Types.ObjectId) {
  return StudentBill.create({
    studentId,
    feeTypeId,
    academicYear: "2099/2100",
    semester: TEST_SEMESTER,
    amount: 1000000,
    discount: 100000,
    paidAmount: 0,
    remainingAmount: 900000,
    dueDate: new Date("2099-09-01"),
    status: "unpaid",
    notes: RUN_ID,
  });
}

async function payBill({
  billId,
  amount,
  cashAccountId,
  userId,
}: {
  billId: mongoose.Types.ObjectId;
  amount: number;
  cashAccountId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
}) {
  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(async () => {
      const bill = await StudentBill.findById(billId).session(session);
      if (!bill) {
        throw new Error("Tagihan tidak ditemukan saat simulasi.");
      }
      if (amount <= 0) {
        throw new Error("Nominal pembayaran harus lebih besar dari nol.");
      }
      if (amount > bill.remainingAmount) {
        throw new Error("Pembayaran melebihi sisa tagihan.");
      }

      const feeType = await FeeType.findById(bill.feeTypeId).session(session);
      if (!feeType) {
        throw new Error("Jenis tagihan tidak ditemukan saat simulasi.");
      }

      bill.paidAmount += amount;
      bill.remainingAmount = calculateRemainingAmount(bill.amount, bill.discount, bill.paidAmount);
      bill.status = calculateBillStatus(bill.remainingAmount, bill.amount - bill.discount);
      await bill.save({ session });

      const paymentNumber = createFinanceNumber("E2EPAY");
      const receiptNumber = createFinanceNumber("E2ERCPT");
      const [payment] = await Payment.create(
        [
          {
            paymentNumber,
            receiptNumber,
            studentId: bill.studentId,
            billId: bill._id,
            paymentDate: new Date(),
            amount,
            paymentMethod: "cash",
            cashOrBankAccountId: cashAccountId,
            notes: RUN_ID,
            createdBy: userId,
          },
        ],
        { session, ordered: true }
      );
      const [journalEntry] = await JournalEntry.create(
        [
          {
            entryNumber: createFinanceNumber("E2EJRN"),
            date: new Date(),
            description: `E2E pembayaran ${receiptNumber}`,
            sourceType: "payment",
            sourceId: payment._id,
            status: "draft",
            createdBy: userId,
          },
        ],
        { session, ordered: true }
      );

      await JournalLine.create(
        [
          {
            journalEntryId: journalEntry._id,
            accountId: cashAccountId,
            debit: amount,
            credit: 0,
            description: RUN_ID,
          },
          {
            journalEntryId: journalEntry._id,
            accountId: feeType.revenueAccountId,
            debit: 0,
            credit: amount,
            description: RUN_ID,
          },
        ],
        { session, ordered: true }
      );

      await JournalEntry.findByIdAndUpdate(
        journalEntry._id,
        { $set: { status: "posted" } },
        { session, runValidators: true }
      );

      payment.journalEntryId = journalEntry._id;
      await payment.save({ session });

      await AuditLog.create(
        [
          {
            userId,
            action: "create",
            module: "Payment",
            documentId: payment._id,
            before: null,
            after: { paymentNumber, receiptNumber, amount, journalEntryId: journalEntry._id },
          },
        ],
        { session, ordered: true }
      );

      return { payment, journalEntry, bill };
    });
  } finally {
    await session.endSession();
  }
}

async function assertJournalIsBalanced(journalEntryId: mongoose.Types.ObjectId) {
  const totals = await JournalLine.aggregate([
    { $match: { journalEntryId } },
    { $group: { _id: "$journalEntryId", debit: { $sum: "$debit" }, credit: { $sum: "$credit" } } },
  ]);
  const total = totals[0];

  if (!total || total.debit !== total.credit) {
    throw new Error("Jurnal otomatis tidak balance.");
  }
}

async function exportWorkbook() {
  const rows = await Payment.find({ notes: RUN_ID }).select("paymentNumber receiptNumber amount").lean();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "E2E Payments");
  const outputDir = path.join(process.cwd(), "tmp");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${RUN_ID}.xlsx`);
  XLSX.writeFile(workbook, outputPath);

  if (!fs.existsSync(outputPath)) {
    throw new Error("Export Excel gagal dibuat.");
  }

  return outputPath;
}

async function cleanup() {
  const payments = await Payment.find({ notes: RUN_ID }).select("_id journalEntryId");
  const journalEntryIds = payments
    .map((payment) => payment.journalEntryId)
    .filter(Boolean);

  await JournalLine.deleteMany({ journalEntryId: { $in: journalEntryIds } });
  await JournalEntry.deleteMany({ _id: { $in: journalEntryIds } });
  await Payment.deleteMany({ notes: RUN_ID });
  await StudentBill.deleteMany({ notes: RUN_ID });
  await FeeType.deleteMany({ name: `${RUN_ID} Tagihan` });
  await Student.deleteMany({ nim: RUN_ID });
  await AuditLog.deleteMany({ "after.receiptNumber": /^E2ERCPT-/ });
  await User.deleteOne({ email: TEST_USER_EMAIL });
  await Account.deleteMany({ code: { $in: [TEST_CASH_ACCOUNT_CODE, TEST_REVENUE_ACCOUNT_CODE] } });
}

async function main() {
  await mongoose.connect(MONGODB_URI as string);

  try {
    const { user, cashAccount, student, feeType } = await ensureBaseData();
    const bill = await createBill(student._id, feeType._id);

    if (bill.status !== "unpaid" || bill.remainingAmount !== 900000) {
      throw new Error("Status awal tagihan bukan unpaid dengan sisa yang benar.");
    }

    const partial = await payBill({
      billId: bill._id,
      amount: 400000,
      cashAccountId: cashAccount._id,
      userId: user._id,
    });
    await assertJournalIsBalanced(partial.journalEntry._id);

    const partialBill = await StudentBill.findById(bill._id).lean();
    if (partialBill?.status !== "partial" || partialBill.remainingAmount !== 500000) {
      throw new Error("Pembayaran sebagian tidak mengubah status menjadi partial.");
    }

    const finalPayment = await payBill({
      billId: bill._id,
      amount: 500000,
      cashAccountId: cashAccount._id,
      userId: user._id,
    });
    await assertJournalIsBalanced(finalPayment.journalEntry._id);

    const paidBill = await StudentBill.findById(bill._id).lean();
    if (paidBill?.status !== "paid" || paidBill.remainingAmount !== 0) {
      throw new Error("Pelunasan tidak mengubah status menjadi paid.");
    }

    const receivables = await StudentBill.find({
      studentId: student._id,
      status: { $in: ["unpaid", "partial"] },
    }).lean();
    if (receivables.length !== 0) {
      throw new Error("Laporan piutang masih menampilkan tagihan yang sudah lunas.");
    }

    const paymentCount = await Payment.countDocuments({ billId: bill._id });
    if (paymentCount !== 2) {
      throw new Error("Laporan pembayaran tidak menemukan dua transaksi.");
    }

    const workbookPath = await exportWorkbook();
    console.log(
      JSON.stringify(
        {
          runId: RUN_ID,
          billStatus: paidBill.status,
          paidAmount: paidBill.paidAmount,
          remainingAmount: paidBill.remainingAmount,
          paymentCount,
          workbookPath,
        },
        null,
        2
      )
    );
  } finally {
    await cleanup();
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => undefined);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
