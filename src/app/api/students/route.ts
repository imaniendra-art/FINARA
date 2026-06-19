import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { financeReadRoles, financeWriteRoles, requireApiRole } from "@/lib/api-auth";
import { studentInputSchema } from "@/lib/validation";
import Student from "@/models/Student";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: Request) {
  const auth = await requireApiRole(financeReadRoles);
  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();
  const entryYear = searchParams.get("entryYear")?.trim();
  const programStudy = searchParams.get("programStudy")?.trim();
  const status = searchParams.get("status")?.trim();

  const filters: Record<string, unknown> = {};

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filters.$or = [{ nim: regex }, { name: regex }];
  }

  if (entryYear) {
    filters.entryYear = Number(entryYear);
  }

  if (programStudy) {
    filters.programStudy = programStudy;
  }

  if (status) {
    filters.status = status;
  }

  await dbConnect();

  const [students, entryYears, programStudies] = await Promise.all([
    Student.find(filters).sort({ entryYear: -1, name: 1 }).lean(),
    Student.distinct("entryYear"),
    Student.distinct("programStudy"),
  ]);

  return NextResponse.json({
    students,
    options: {
      entryYears: entryYears.sort((a, b) => Number(b) - Number(a)),
      programStudies: programStudies.filter(Boolean).sort(),
      statuses: ["active", "inactive", "graduated", "dropped_out"],
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(financeWriteRoles);
  if (auth.response) {
    return auth.response;
  }

  const parsed = studentInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data mahasiswa tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();

  const duplicateStudent = await Student.findOne({
    nim: { $regex: `^${escapeRegex(parsed.data.nim)}$`, $options: "i" },
  }).lean();

  if (duplicateStudent) {
    return NextResponse.json({ error: "NIM sudah digunakan." }, { status: 409 });
  }

  try {
    const student = await Student.create(parsed.data);
    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json({ error: "NIM sudah digunakan." }, { status: 409 });
    }

    console.error("Create student error:", error);
    return NextResponse.json({ error: "Mahasiswa gagal disimpan." }, { status: 500 });
  }
}
