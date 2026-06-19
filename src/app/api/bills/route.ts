import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { financeReadRoles, financeWriteRoles, requireApiRole } from "@/lib/api-auth";
import { calculateRemainingAmount } from "@/lib/finance";
import { studentBillInputSchema } from "@/lib/validation";
import StudentBill from "@/models/StudentBill";
import Student from "@/models/Student";
import FeeType from "@/models/FeeType";

export async function GET() {
  const auth = await requireApiRole(financeReadRoles);
  if (auth.response) {
    return auth.response;
  }

  await dbConnect();

  const [bills, students, feeTypes, entryYears, programStudies, classNames] = await Promise.all([
    StudentBill.find({})
      .sort({ dueDate: 1, createdAt: -1 })
      .populate("studentId", "nim name")
      .populate("feeTypeId", "name defaultAmount")
      .lean(),
    Student.find({ status: "active" }).sort({ name: 1 }).select("nim name").lean(),
    FeeType.find({ isActive: true }).sort({ name: 1 }).select("name defaultAmount revenueAccountId").lean(),
    Student.distinct("entryYear", { status: "active" }),
    Student.distinct("programStudy", { status: "active" }),
    Student.distinct("className", { status: "active" }),
  ]);

  return NextResponse.json({
    bills,
    students,
    feeTypes,
    options: {
      entryYears: entryYears.sort((a, b) => Number(b) - Number(a)),
      programStudies: programStudies.filter(Boolean).sort(),
      classNames: classNames.filter(Boolean).sort(),
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(financeWriteRoles);
  if (auth.response) {
    return auth.response;
  }

  const parsed = studentBillInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data tagihan tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();

  const existingBill = await StudentBill.findOne({
    studentId: parsed.data.studentId,
    feeTypeId: parsed.data.feeTypeId,
    academicYear: parsed.data.academicYear,
    semester: parsed.data.semester,
  }).lean();

  if (existingBill) {
    return NextResponse.json(
      { error: "Tagihan untuk mahasiswa, jenis tagihan, tahun akademik, dan semester tersebut sudah ada." },
      { status: 409 }
    );
  }

  const student = await Student.findById(parsed.data.studentId).select("_id").lean();
  if (!student) {
    return NextResponse.json({ error: "Mahasiswa tidak ditemukan." }, { status: 404 });
  }

  const feeType = await FeeType.findById(parsed.data.feeTypeId).select("_id").lean();
  if (!feeType) {
    return NextResponse.json({ error: "Jenis tagihan tidak ditemukan." }, { status: 404 });
  }

  const paidAmount = 0;
  const remainingAmount = calculateRemainingAmount(
    parsed.data.amount,
    parsed.data.discount,
    paidAmount
  );

  try {
    const bill = await StudentBill.create({
      ...parsed.data,
      paidAmount,
      remainingAmount,
      status: remainingAmount === 0 ? "paid" : "unpaid",
      studentId: new mongoose.Types.ObjectId(parsed.data.studentId),
      feeTypeId: new mongoose.Types.ObjectId(parsed.data.feeTypeId),
    });

    return NextResponse.json({ bill }, { status: 201 });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json(
        { error: "Tagihan ganda tidak diperbolehkan." },
        { status: 409 }
      );
    }

    console.error("Create bill error:", error);
    return NextResponse.json({ error: "Tagihan gagal disimpan." }, { status: 500 });
  }
}
