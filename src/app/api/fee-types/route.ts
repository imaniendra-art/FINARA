import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { financeReadRoles, masterDataWriteRoles, requireApiRole } from "@/lib/api-auth";
import { feeTypeInputSchema } from "@/lib/validation";
import Account from "@/models/Account";
import FeeType from "@/models/FeeType";
import StudentBill from "@/models/StudentBill";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET() {
  const auth = await requireApiRole(financeReadRoles);
  if (auth.response) {
    return auth.response;
  }

  await dbConnect();

  const [feeTypes, revenueAccounts, usedFeeTypeIds] = await Promise.all([
    FeeType.find({})
      .sort({ isActive: -1, name: 1 })
      .populate("revenueAccountId", "code name")
      .lean(),
    Account.find({ type: "revenue", isActive: true })
      .sort({ code: 1 })
      .select("code name")
      .lean(),
    StudentBill.distinct("feeTypeId"),
  ]);

  const usedFeeTypeSet = new Set(usedFeeTypeIds.map((id) => id.toString()));

  return NextResponse.json({
    feeTypes: feeTypes.map((feeType) => ({
      ...feeType,
      isUsed: usedFeeTypeSet.has(feeType._id.toString()),
    })),
    revenueAccounts,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(masterDataWriteRoles);
  if (auth.response) {
    return auth.response;
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

  const existingFeeType = await FeeType.findOne({
    name: { $regex: `^${escapeRegex(parsed.data.name)}$`, $options: "i" },
  }).lean();

  if (existingFeeType) {
    return NextResponse.json(
      { error: "Nama jenis tagihan sudah digunakan." },
      { status: 409 }
    );
  }

  try {
    const feeType = await FeeType.create({
      ...parsed.data,
      revenueAccountId: new mongoose.Types.ObjectId(parsed.data.revenueAccountId),
    });

    return NextResponse.json({ feeType }, { status: 201 });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Create fee type error:", error);
    return NextResponse.json({ error: "Jenis tagihan gagal disimpan." }, { status: 500 });
  }
}
