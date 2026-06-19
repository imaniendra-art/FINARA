import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { budgetManageRoles, budgetReadRoles, ensureDefaultBudgetData } from "@/lib/budget";
import { budgetPeriodInputSchema } from "@/lib/validation";
import BudgetPeriod from "@/models/BudgetPeriod";

export async function GET() {
  const auth = await requireApiRole(budgetReadRoles);
  if (auth.response) return auth.response;

  await dbConnect();
  await ensureDefaultBudgetData();

  const periods = await BudgetPeriod.find({}).sort({ isActive: -1, startDate: -1 }).lean();
  return NextResponse.json({ periods });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(budgetManageRoles);
  if (auth.response) return auth.response;

  const parsed = budgetPeriodInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data periode anggaran tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();
  const session = await mongoose.startSession();

  try {
    const result = await session.withTransaction(async () => {
      if (parsed.data.isActive) {
        await BudgetPeriod.updateMany({}, { $set: { isActive: false } }).session(session);
      }

      const [period] = await BudgetPeriod.create([parsed.data], { session, ordered: true });
      return { period };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Create budget period error:", error);
    return NextResponse.json({ error: "Periode anggaran gagal disimpan." }, { status: 500 });
  } finally {
    await session.endSession();
  }
}
