import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { studentImportConfirmSchema } from "@/lib/validation";
import { calculateRemainingAmount } from "@/lib/finance";
import AcademicPeriod from "@/models/AcademicPeriod";
import FeeType from "@/models/FeeType";
import Student from "@/models/Student";
import StudentBill from "@/models/StudentBill";

const importRoles = ["super_admin", "admin_bauk"] as const;

type ExistingStudentSource = {
  _id: unknown;
  nim: string;
};

type SppFeeTypeSource = {
  _id: mongoose.Types.ObjectId;
};

type ActivePeriodSource = {
  academicYear: string;
  semester: string;
};

function normalizeNim(value: string) {
  return value.trim().toLowerCase();
}

export async function POST(request: Request) {
  const auth = await requireApiRole([...importRoles]);
  if (auth.response) {
    return auth.response;
  }

  const parsed = studentImportConfirmSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data import mahasiswa tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const nimCounts = new Map<string, number>();
  parsed.data.rows.forEach((row) => {
    const key = normalizeNim(row.nim);
    nimCounts.set(key, (nimCounts.get(key) ?? 0) + 1);
  });

  await dbConnect();

  const uniqueNims = [...nimCounts.keys()];
  const existingStudents = await Student.find({ nim: { $in: uniqueNims } })
    .collation({ locale: "en", strength: 2 })
    .select("nim")
    .lean<ExistingStudentSource[]>();
  const existingByNim = new Map(existingStudents.map((student) => [normalizeNim(student.nim), String(student._id)]));

  const created: { rowNumber: number; nim: string; name: string }[] = [];
  const updated: { rowNumber: number; nim: string; name: string }[] = [];
  const billsCreated: { rowNumber: number; nim: string; amount: number }[] = [];
  const billsSkipped: { rowNumber: number; nim: string; reason: string }[] = [];
  const skipped: { rowNumber: number; nim: string; name: string; reason: string }[] = [];
  const failed: { rowNumber: number; nim: string; name: string; reason: string }[] = [];
  const rowsWithSpp = parsed.data.rows.filter((row) => row.spp);
  const [sppFeeType, activePeriod] = rowsWithSpp.length
    ? await Promise.all([
        FeeType.findOne({ name: /^SPP$/i, isActive: true }).select("_id").lean<SppFeeTypeSource | null>(),
        AcademicPeriod.findOne({ isActive: true }).select("academicYear semester").lean<ActivePeriodSource | null>(),
      ])
    : [null, null];

  if (rowsWithSpp.length > 0 && !sppFeeType) {
    return NextResponse.json({ error: "Jenis tagihan SPP aktif tidak ditemukan." }, { status: 400 });
  }

  if (rowsWithSpp.length > 0 && !activePeriod) {
    return NextResponse.json({ error: "Periode akademik aktif belum diset." }, { status: 400 });
  }

  for (const row of parsed.data.rows) {
    const nimKey = normalizeNim(row.nim);

    if ((nimCounts.get(nimKey) ?? 0) > 1) {
      failed.push({
        rowNumber: row.rowNumber,
        nim: row.nim,
        name: row.name,
        reason: "NIM duplikat di data import.",
      });
      continue;
    }

    const existingStudentId = existingByNim.get(nimKey);

    if (existingStudentId && parsed.data.duplicateStrategy === "skip") {
      skipped.push({
        rowNumber: row.rowNumber,
        nim: row.nim,
        name: row.name,
        reason: "NIM sudah ada.",
      });
      continue;
    }

    try {
      let studentId = existingStudentId;

      if (existingStudentId && parsed.data.duplicateStrategy === "update") {
        const student = await Student.findByIdAndUpdate(
          existingStudentId,
          {
            $set: {
              nim: row.nim,
              name: row.name,
              gender: row.gender,
              programStudy: row.programStudy,
              className: row.className,
              entryYear: row.entryYear,
              phone: row.phone,
              address: row.address,
              status: row.status,
              biayaPendidikan: row.biayaPendidikan,
            },
          },
          { returnDocument: "after", runValidators: true }
        );
        studentId = student?._id?.toString() ?? existingStudentId;
        updated.push({ rowNumber: row.rowNumber, nim: row.nim, name: row.name });
      } else {
        const student = await Student.create({
          nim: row.nim,
          name: row.name,
          gender: row.gender,
          programStudy: row.programStudy,
          className: row.className,
          entryYear: row.entryYear,
          phone: row.phone,
          address: row.address,
          status: row.status,
          biayaPendidikan: row.biayaPendidikan,
        });
        studentId = student._id.toString();
        created.push({ rowNumber: row.rowNumber, nim: row.nim, name: row.name });
      }

      if (row.spp && studentId) {
        const existingBill = await StudentBill.findOne({
          studentId,
          feeTypeId: sppFeeType!._id,
          academicYear: activePeriod!.academicYear,
          semester: activePeriod!.semester,
        }).lean();

        if (existingBill) {
          billsSkipped.push({
            rowNumber: row.rowNumber,
            nim: row.nim,
            reason: "Tagihan SPP periode aktif sudah ada.",
          });
          continue;
        }

        const paidAmount = 0;
        const discount = 0;
        const remainingAmount = calculateRemainingAmount(row.spp, discount, paidAmount);

        await StudentBill.create({
          studentId: new mongoose.Types.ObjectId(studentId),
          feeTypeId: sppFeeType!._id,
          academicYear: activePeriod!.academicYear,
          semester: activePeriod!.semester,
          amount: row.spp,
          discount,
          paidAmount,
          remainingAmount,
          dueDate: new Date(),
          status: "unpaid",
          notes: "Tagihan SPP dari import mahasiswa",
        });

        billsCreated.push({ rowNumber: row.rowNumber, nim: row.nim, amount: row.spp });
      }
    } catch (error) {
      if (error instanceof mongoose.Error.ValidationError) {
        failed.push({ rowNumber: row.rowNumber, nim: row.nim, name: row.name, reason: error.message });
        continue;
      }

      if (error instanceof Error && error.message.includes("duplicate key")) {
        skipped.push({
          rowNumber: row.rowNumber,
          nim: row.nim,
          name: row.name,
          reason: "NIM sudah ada.",
        });
        continue;
      }

      failed.push({
        rowNumber: row.rowNumber,
        nim: row.nim,
        name: row.name,
        reason: "Mahasiswa gagal diimport.",
      });
    }
  }

  return NextResponse.json({
    summary: {
      created: created.length,
      updated: updated.length,
      billsCreated: billsCreated.length,
      billsSkipped: billsSkipped.length,
      skipped: skipped.length,
      failed: failed.length,
    },
    created,
    updated,
    billsCreated,
    billsSkipped,
    skipped,
    failed,
  });
}
