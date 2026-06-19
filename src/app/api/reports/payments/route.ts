import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { reportReadRoles, requireApiRole } from "@/lib/api-auth";
import Payment from "@/models/Payment";
import Student from "@/models/Student";
import StudentBill from "@/models/StudentBill";

type StudentSnapshot = {
  _id: string;
  nim: string;
  name: string;
  entryYear: number;
  programStudy: string;
};

type BillSnapshot = {
  _id: string;
  semester: string;
  status: string;
  academicYear: string;
};

type PaymentSnapshot = {
  _id: string;
  paymentNumber: string;
  receiptNumber?: string;
  studentId: string;
  billId: string;
  paymentDate: Date;
  amount: number;
  paymentMethod: string;
};

function getFilterValues(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  return {
    entryYear: searchParams.get("entryYear") || "",
    programStudy: searchParams.get("programStudy") || "",
    semester: searchParams.get("semester") || "",
    status: searchParams.get("status") || "",
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(reportReadRoles);
  if (auth.response) {
    return auth.response;
  }

  await dbConnect();

  const filters = getFilterValues(request);
  const studentFilter: Record<string, string | number> = {};
  if (filters.entryYear) {
    studentFilter.entryYear = Number(filters.entryYear);
  }
  if (filters.programStudy) {
    studentFilter.programStudy = filters.programStudy;
  }

  const students = await Student.find(studentFilter)
    .select("nim name entryYear programStudy")
    .lean<StudentSnapshot[]>();
  const studentMap = new Map(students.map((student) => [student._id.toString(), student]));
  const billFilter: Record<string, unknown> = {
    studentId: { $in: students.map((student) => student._id) },
  };

  if (filters.semester) {
    billFilter.semester = filters.semester;
  }
  if (filters.status) {
    if (filters.status === "belum_lunas") {
      billFilter.status = { $in: ["unpaid", "partial"] };
    } else {
      billFilter.status = filters.status;
    }
  }

  const bills = await StudentBill.find(billFilter)
    .select("semester status academicYear")
    .lean<BillSnapshot[]>();
  const billMap = new Map(bills.map((bill) => [bill._id.toString(), bill]));

  const payments = await Payment.find({
    billId: { $in: bills.map((bill) => bill._id) },
  })
    .sort({ paymentDate: -1, createdAt: -1 })
    .lean<PaymentSnapshot[]>();

  const rows = payments.map((payment) => {
    const student = studentMap.get(payment.studentId.toString());
    const bill = billMap.get(payment.billId.toString());

    return {
      id: payment._id.toString(),
      paymentNumber: payment.paymentNumber,
      receiptNumber: payment.receiptNumber || "-",
      nim: student?.nim || "-",
      studentName: student?.name || "-",
      entryYear: student?.entryYear || null,
      programStudy: student?.programStudy || "-",
      academicYear: bill?.academicYear || "-",
      semester: bill?.semester || "-",
      billStatus: bill?.status || "-",
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      amount: payment.amount,
    };
  });

  const totals = rows.reduce(
    (acc, row) => ({
      totalPayment: acc.totalPayment + row.amount,
    }),
    { totalPayment: 0 }
  );

  return NextResponse.json({ rows, totals });
}
