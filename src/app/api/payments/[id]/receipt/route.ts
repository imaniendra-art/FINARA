import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { receiptPrintRoles, requireApiRole } from "@/lib/api-auth";
import { objectIdSchema } from "@/lib/validation";
import Account from "@/models/Account";
import FeeType from "@/models/FeeType";
import Payment from "@/models/Payment";
import Student from "@/models/Student";
import StudentBill from "@/models/StudentBill";
import User from "@/models/User";

type PaymentReceiptSource = {
  _id: string;
  receiptNumber?: string;
  paymentNumber: string;
  paymentDate: Date;
  amount: number;
  paymentMethod: string;
  notes?: string;
  studentId: string;
  billId: string;
  cashOrBankAccountId: string;
  createdBy: string;
};

type StudentReceiptSource = {
  nim: string;
  name: string;
  programStudy: string;
};

type BillReceiptSource = {
  feeTypeId: string;
  academicYear: string;
  semester: string;
};

type FeeTypeReceiptSource = {
  name: string;
};

type AccountReceiptSource = {
  code: string;
  name: string;
};

type UserReceiptSource = {
  name: string;
};

function formatPaymentMethod(method: string) {
  return method.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole(receiptPrintRoles);
  if (auth.response) {
    return auth.response;
  }

  const params = await context.params;
  const parsedId = objectIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "ID pembayaran tidak valid." }, { status: 400 });
  }

  await dbConnect();

  const payment = await Payment.findById(parsedId.data)
    .select(
      "receiptNumber paymentNumber paymentDate amount paymentMethod notes studentId billId cashOrBankAccountId createdBy"
    )
    .lean<PaymentReceiptSource | null>();

  if (!payment) {
    return NextResponse.json({ error: "Pembayaran tidak ditemukan." }, { status: 404 });
  }

  const [student, bill, account, officer] = await Promise.all([
    Student.findById(payment.studentId).select("nim name programStudy").lean<StudentReceiptSource | null>(),
    StudentBill.findById(payment.billId).select("feeTypeId academicYear semester").lean<BillReceiptSource | null>(),
    Account.findById(payment.cashOrBankAccountId).select("code name").lean<AccountReceiptSource | null>(),
    User.findById(payment.createdBy).select("name").lean<UserReceiptSource | null>(),
  ]);

  if (!student || !bill) {
    return NextResponse.json(
      { error: "Data mahasiswa atau tagihan untuk kwitansi tidak lengkap." },
      { status: 404 }
    );
  }

  const feeType = await FeeType.findById(bill.feeTypeId)
    .select("name")
    .lean<FeeTypeReceiptSource | null>();

  return NextResponse.json({
    receipt: {
      id: payment._id.toString(),
      receiptNumber: payment.receiptNumber || "-",
      paymentNumber: payment.paymentNumber,
      paymentDate: payment.paymentDate,
      studentName: student.name,
      nim: student.nim,
      programStudy: student.programStudy,
      feeTypeName: feeType?.name || "-",
      academicYear: bill.academicYear,
      semester: bill.semester,
      amount: payment.amount,
      paymentMethod: formatPaymentMethod(payment.paymentMethod),
      cashOrBankAccount: account ? `${account.code} - ${account.name}` : "-",
      officerName: officer?.name || "-",
      notes: payment.notes || "-",
    },
  });
}
