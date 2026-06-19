import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { reportReadRoles, requireApiRole } from "@/lib/api-auth";
import FeeType from "@/models/FeeType";
import Student from "@/models/Student";
import StudentBill from "@/models/StudentBill";

type StudentSnapshot = {
  _id: string;
  nim: string;
  name: string;
  entryYear: number;
  programStudy: string;
};

type FeeTypeSnapshot = {
  _id: string;
  name: string;
};

type BillSnapshot = {
  _id: string;
  studentId: string;
  feeTypeId: string;
  academicYear: string;
  semester: string;
  amount: number;
  discount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: Date;
  status: string;
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
    .sort({ dueDate: 1 })
    .lean<BillSnapshot[]>();
  const feeTypes = await FeeType.find({
    _id: { $in: bills.map((bill) => bill.feeTypeId) },
  })
    .select("name")
    .lean<FeeTypeSnapshot[]>();
  const feeTypeMap = new Map(feeTypes.map((feeType) => [feeType._id.toString(), feeType]));

  const rows = bills.map((bill) => {
    const student = studentMap.get(bill.studentId.toString());
    const feeType = feeTypeMap.get(bill.feeTypeId.toString());
    const totalBill = bill.amount - bill.discount;

    return {
      id: bill._id.toString(),
      nim: student?.nim || "-",
      studentName: student?.name || "-",
      entryYear: student?.entryYear || null,
      programStudy: student?.programStudy || "-",
      feeTypeName: feeType?.name || "-",
      academicYear: bill.academicYear,
      semester: bill.semester,
      status: bill.status,
      dueDate: bill.dueDate,
      totalBill,
      paidAmount: bill.paidAmount,
      remainingAmount: bill.remainingAmount,
    };
  });

  const totals = rows.reduce(
    (acc, row) => ({
      totalBill: acc.totalBill + row.totalBill,
      paidAmount: acc.paidAmount + row.paidAmount,
      remainingAmount: acc.remainingAmount + row.remainingAmount,
    }),
    { totalBill: 0, paidAmount: 0, remainingAmount: 0 }
  );

  return NextResponse.json({ rows, totals });
}
