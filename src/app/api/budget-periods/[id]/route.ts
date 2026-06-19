import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { budgetManageRoles } from "@/lib/budget";
import { budgetPeriodInputSchema, objectIdSchema } from "@/lib/validation";
import BudgetPeriod from "@/models/BudgetPeriod";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRole(budgetManageRoles);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "ID periode anggaran tidak valid." }, { status: 400 });
  }

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
        await BudgetPeriod.updateMany({ _id: { $ne: parsedId.data } }, { $set: { isActive: false } }).session(session);
      }

      const period = await BudgetPeriod.findByIdAndUpdate(
        parsedId.data,
        { $set: parsed.data },
        { returnDocument: "after", runValidators: true, session }
      );

      if (!period) {
        throw new Error("Periode anggaran tidak ditemukan.");
      }

      return { period };
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Periode anggaran gagal diperbarui." },
      { status: 400 }
    );
  } finally {
    await session.endSession();
  }
}
