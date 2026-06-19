import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { budgetManageRoles } from "@/lib/budget";
import { objectIdSchema } from "@/lib/validation";
import BudgetPeriod from "@/models/BudgetPeriod";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(budgetManageRoles);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "ID periode anggaran tidak valid." }, { status: 400 });
  }

  await dbConnect();
  const session = await mongoose.startSession();

  try {
    const result = await session.withTransaction(async () => {
      const period = await BudgetPeriod.findById(parsedId.data).session(session);
      if (!period) {
        throw new Error("Periode anggaran tidak ditemukan.");
      }

      await BudgetPeriod.updateMany({}, { $set: { isActive: false } }).session(session);
      period.isActive = true;
      await period.save({ session });

      return { period };
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Periode aktif gagal diperbarui." },
      { status: 400 }
    );
  } finally {
    await session.endSession();
  }
}
