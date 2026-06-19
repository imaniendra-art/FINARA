import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { masterDataWriteRoles, requireApiRole } from "@/lib/api-auth";
import { objectIdSchema } from "@/lib/validation";
import FeeType from "@/models/FeeType";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(masterDataWriteRoles);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "ID jenis tagihan tidak valid." }, { status: 400 });
  }

  await dbConnect();

  const feeType = await FeeType.findByIdAndUpdate(
    parsedId.data,
    { $set: { isActive: false } },
    { returnDocument: "after", runValidators: true }
  );

  if (!feeType) {
    return NextResponse.json({ error: "Jenis tagihan tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ feeType });
}
