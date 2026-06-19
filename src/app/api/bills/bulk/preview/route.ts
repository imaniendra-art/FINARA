import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { financeWriteRoles, requireApiRole } from "@/lib/api-auth";
import { bulkBillPreviewSchema } from "@/lib/validation";
import FeeType from "@/models/FeeType";
import Student from "@/models/Student";
import StudentBill from "@/models/StudentBill";

type StudentPreviewSource = {
  _id: unknown;
  nim: string;
  name: string;
  entryYear: number;
  programStudy: string;
  className: string;
  status: string;
};

type ExistingBillSource = {
  studentId: unknown;
};

export async function GET(request: Request) {
  const auth = await requireApiRole(financeWriteRoles);
  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const parsed = bulkBillPreviewSchema.safeParse(Object.fromEntries(searchParams.entries()));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Filter generate tagihan tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();

  const feeType = await FeeType.findOne({ _id: parsed.data.feeTypeId, isActive: true })
    .select("name defaultAmount")
    .lean();

  if (!feeType) {
    return NextResponse.json({ error: "Jenis tagihan tidak ditemukan atau tidak aktif." }, { status: 404 });
  }

  const studentFilter: Record<string, unknown> = { status: "active" };

  if (parsed.data.entryYear) {
    studentFilter.entryYear = parsed.data.entryYear;
  }

  if (parsed.data.programStudy) {
    studentFilter.programStudy = parsed.data.programStudy;
  }

  if (parsed.data.className) {
    studentFilter.className = parsed.data.className;
  }

  if (parsed.data.biayaPendidikan) {
    studentFilter.biayaPendidikan = parsed.data.biayaPendidikan;
  }

  const students = await Student.find(studentFilter)
    .sort({ entryYear: -1, programStudy: 1, className: 1, name: 1 })
    .select("nim name entryYear programStudy className status")
    .lean<StudentPreviewSource[]>();

  const studentIds = students.map((student) => student._id);
  const existingBills = await StudentBill.find({
    studentId: { $in: studentIds },
    feeTypeId: parsed.data.feeTypeId,
    academicYear: parsed.data.academicYear,
    semester: parsed.data.semester,
  })
    .select("studentId")
    .lean<ExistingBillSource[]>();

  const duplicateStudentIds = new Set(existingBills.map((bill) => String(bill.studentId)));
  const preview = students.map((student) => {
    const hasExistingBill = duplicateStudentIds.has(String(student._id));

    return {
      _id: String(student._id),
      nim: student.nim,
      name: student.name,
      entryYear: student.entryYear,
      programStudy: student.programStudy,
      className: student.className,
      status: student.status,
      canGenerate: !hasExistingBill,
      reason: hasExistingBill ? "Duplikat: tagihan periode ini sudah ada" : null,
    };
  });

  return NextResponse.json({
    feeType: {
      _id: String(feeType._id),
      name: feeType.name,
      defaultAmount: feeType.defaultAmount,
    },
    students: preview,
    summary: {
      total: preview.length,
      available: preview.filter((student) => student.canGenerate).length,
      duplicate: preview.filter((student) => !student.canGenerate).length,
    },
  });
}
