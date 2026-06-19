import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { masterDataWriteRoles, requireApiRole } from "@/lib/api-auth";
import { feeTypeInputSchema, objectIdSchema } from "@/lib/validation";
import Account from "@/models/Account";
import FeeType from "@/models/FeeType";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRole(masterDataWriteRoles);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "ID jenis tagihan tidak valid." }, { status: 400 });
  }

  const parsed = feeTypeInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data jenis tagihan tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();

  const revenueAccount = await Account.findById(parsed.data.revenueAccountId)
    .select("_id type isActive")
    .lean();

  if (!revenueAccount || revenueAccount.type !== "revenue" || !revenueAccount.isActive) {
    return NextResponse.json(
      { error: "Akun pendapatan tidak valid atau tidak aktif." },
      { status: 400 }
    );
  }

  const duplicateFeeType = await FeeType.findOne({
    _id: { $ne: parsedId.data },
    name: { $regex: `^${escapeRegex(parsed.data.name)}$`, $options: "i" },
  }).lean();

  if (duplicateFeeType) {
    return NextResponse.json(
      { error: "Nama jenis tagihan sudah digunakan." },
      { status: 409 }
    );
  }

  try {
    const feeType = await FeeType.findByIdAndUpdate(
      parsedId.data,
      {
        $set: {
          ...parsed.data,
          revenueAccountId: new mongoose.Types.ObjectId(parsed.data.revenueAccountId),
        },
      },
      { returnDocument: "after", runValidators: true }
    );

    if (!feeType) {
      return NextResponse.json({ error: "Jenis tagihan tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ feeType });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Update fee type error:", error);
    return NextResponse.json({ error: "Jenis tagihan gagal diperbarui." }, { status: 500 });
  }
}
