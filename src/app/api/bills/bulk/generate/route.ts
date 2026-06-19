import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { financeWriteRoles, requireApiRole } from "@/lib/api-auth";
import { calculateRemainingAmount } from "@/lib/finance";
import { bulkBillGenerateSchema } from "@/lib/validation";
import FeeType from "@/models/FeeType";
import Student from "@/models/Student";
import StudentBill from "@/models/StudentBill";

type StudentGenerateSource = {
  _id: unknown;
  nim: string;
  name: string;
};

type ExistingBillSource = {
  studentId: unknown;
};

export async function POST(request: Request) {
  const auth = await requireApiRole(financeWriteRoles);
  if (auth.response) {
    return auth.response;
  }

  const parsed = bulkBillGenerateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data generate tagihan tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();

  const feeType = await FeeType.findOne({ _id: parsed.data.feeTypeId, isActive: true })
    .select("_id")
    .lean();

  if (!feeType) {
    return NextResponse.json({ error: "Jenis tagihan tidak ditemukan atau tidak aktif." }, { status: 404 });
  }

  const studentFilter: Record<string, unknown> = {
    _id: { $in: parsed.data.studentIds },
    status: "active",
  };

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
    .sort({ name: 1 })
    .select("nim name")
    .lean<StudentGenerateSource[]>();

  const studentMap = new Map(students.map((student) => [String(student._id), student]));
  const existingBills = await StudentBill.find({
    studentId: { $in: parsed.data.studentIds },
    feeTypeId: parsed.data.feeTypeId,
    academicYear: parsed.data.academicYear,
    semester: parsed.data.semester,
  })
    .select("studentId")
    .lean<ExistingBillSource[]>();
  const duplicateStudentIds = new Set(existingBills.map((bill) => String(bill.studentId)));
  const paidAmount = 0;
  const remainingAmount = calculateRemainingAmount(parsed.data.amount, parsed.data.discount, paidAmount);

  const created: { studentId: string; nim: string; name: string; billId: string }[] = [];
  const skipped: { studentId: string; nim?: string; name?: string; reason: string }[] = [];
  const failed: { studentId: string; nim?: string; name?: string; reason: string }[] = [];

  for (const studentId of parsed.data.studentIds) {
    const student = studentMap.get(studentId);

    if (!student) {
      failed.push({ studentId, reason: "Mahasiswa tidak ditemukan, tidak aktif, atau tidak sesuai filter." });
      continue;
    }

    if (duplicateStudentIds.has(studentId)) {
      skipped.push({
        studentId,
        nim: student.nim,
        name: student.name,
        reason: "Tagihan periode ini sudah ada.",
      });
      continue;
    }

    try {
      const bill = await StudentBill.create({
        studentId: new mongoose.Types.ObjectId(studentId),
        feeTypeId: new mongoose.Types.ObjectId(parsed.data.feeTypeId),
        academicYear: parsed.data.academicYear,
        semester: parsed.data.semester,
        amount: parsed.data.amount,
        discount: parsed.data.discount,
        paidAmount,
        remainingAmount,
        dueDate: parsed.data.dueDate,
        notes: parsed.data.notes,
        status: remainingAmount === 0 ? "paid" : "unpaid",
      });

      created.push({
        studentId,
        nim: student.nim,
        name: student.name,
        billId: String(bill._id),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("duplicate key")) {
        skipped.push({
          studentId,
          nim: student.nim,
          name: student.name,
          reason: "Tagihan periode ini sudah ada.",
        });
        continue;
      }

      failed.push({
        studentId,
        nim: student.nim,
        name: student.name,
        reason: error instanceof Error ? error.message : "Tagihan gagal dibuat.",
      });
    }
  }

  return NextResponse.json({
    summary: {
      created: created.length,
      skipped: skipped.length,
      failed: failed.length,
    },
    created,
    skipped,
    failed,
  });
}
