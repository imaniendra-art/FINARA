import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { financeReadRoles, financeWriteRoles, requireApiRole } from "@/lib/api-auth";
import { objectIdSchema, studentInputSchema } from "@/lib/validation";
import Student from "@/models/Student";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(financeReadRoles);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "ID mahasiswa tidak valid." }, { status: 400 });
  }

  await dbConnect();

  const student = await Student.findById(parsedId.data).lean();
  if (!student) {
    return NextResponse.json({ error: "Mahasiswa tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ student });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRole(financeWriteRoles);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "ID mahasiswa tidak valid." }, { status: 400 });
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
    _id: { $ne: parsedId.data },
    nim: { $regex: `^${escapeRegex(parsed.data.nim)}$`, $options: "i" },
  }).lean();

  if (duplicateStudent) {
    return NextResponse.json({ error: "NIM sudah digunakan." }, { status: 409 });
  }

  try {
    const student = await Student.findByIdAndUpdate(
      parsedId.data,
      { $set: parsed.data },
      { returnDocument: "after", runValidators: true }
    );

    if (!student) {
      return NextResponse.json({ error: "Mahasiswa tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ student });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json({ error: "NIM sudah digunakan." }, { status: 409 });
    }

    console.error("Update student error:", error);
    return NextResponse.json({ error: "Mahasiswa gagal diperbarui." }, { status: 500 });
  }
}
