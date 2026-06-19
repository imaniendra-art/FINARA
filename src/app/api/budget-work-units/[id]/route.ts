import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { budgetManageRoles } from "@/lib/budget";
import { budgetWorkUnitInputSchema, objectIdSchema } from "@/lib/validation";
import BudgetWorkUnit from "@/models/BudgetWorkUnit";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRole(budgetManageRoles);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "ID unit kerja tidak valid." }, { status: 400 });
  }

  const parsed = budgetWorkUnitInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data unit kerja tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();

  try {
    const workUnit = await BudgetWorkUnit.findByIdAndUpdate(
      parsedId.data,
      { $set: parsed.data },
      { returnDocument: "after", runValidators: true }
    );

    if (!workUnit) {
      return NextResponse.json({ error: "Unit kerja tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ workUnit });
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json({ error: "Kode unit sudah digunakan." }, { status: 409 });
    }

    console.error("Update budget work unit error:", error);
    return NextResponse.json({ error: "Unit kerja gagal diperbarui." }, { status: 500 });
  }
}
