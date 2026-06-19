import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { budgetManageRoles, budgetReadRoles, ensureDefaultBudgetData } from "@/lib/budget";
import { budgetWorkUnitInputSchema } from "@/lib/validation";
import BudgetWorkUnit from "@/models/BudgetWorkUnit";

export async function GET() {
  const auth = await requireApiRole(budgetReadRoles);
  if (auth.response) return auth.response;

  await dbConnect();
  await ensureDefaultBudgetData();

  const workUnits = await BudgetWorkUnit.find({}).sort({ isActive: -1, name: 1 }).lean();
  return NextResponse.json({ workUnits });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(budgetManageRoles);
  if (auth.response) return auth.response;

  const parsed = budgetWorkUnitInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data unit kerja tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();

  try {
    const workUnit = await BudgetWorkUnit.create(parsed.data);
    return NextResponse.json({ workUnit }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json({ error: "Kode unit sudah digunakan." }, { status: 409 });
    }

    console.error("Create budget work unit error:", error);
    return NextResponse.json({ error: "Unit kerja gagal disimpan." }, { status: 500 });
  }
}
