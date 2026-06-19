import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { financeWriteRoles, requireApiRole } from "@/lib/api-auth";
import { objectIdSchema } from "@/lib/validation";
import Student from "@/models/Student";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(financeWriteRoles);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "ID mahasiswa tidak valid." }, { status: 400 });
  }

  await dbConnect();

  const student = await Student.findByIdAndUpdate(
    parsedId.data,
    { $set: { status: "inactive" } },
    { returnDocument: "after", runValidators: true }
  );

  if (!student) {
    return NextResponse.json({ error: "Mahasiswa tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ student });
}
