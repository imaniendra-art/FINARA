import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import {
  budgetReadRoles,
  calculateBudgetItemsTotal,
  canAccessBudgetRequest,
  canEditBudgetDraft,
  createBudgetAuditLog,
  findBudgetRequestForAction,
  replaceBudgetItems,
} from "@/lib/budget";
import { budgetRequestInputSchema, objectIdSchema } from "@/lib/validation";
import BudgetRequest from "@/models/BudgetRequest";
import BudgetRequestItem from "@/models/BudgetRequestItem";
import "@/models/BudgetWorkUnit";
import "@/models/BudgetPeriod";
import "@/models/User";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(budgetReadRoles);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "ID permintaan anggaran tidak valid." }, { status: 400 });
  }

  await dbConnect();
  const [budgetRequest, items] = await Promise.all([
    BudgetRequest.findById(parsedId.data)
      .populate("unitId", "name code")
      .populate("periodId", "name")
      .populate("createdBy", "name")
      .populate("verifiedBy", "name")
      .populate("approvedBy", "name")
      .populate("rejectedBy", "name")
      .populate("disbursedBy", "name")
      .lean(),
    BudgetRequestItem.find({ budgetRequestId: parsedId.data }).sort({ createdAt: 1 }).lean(),
  ]);

  if (!budgetRequest) {
    return NextResponse.json({ error: "Permintaan anggaran tidak ditemukan." }, { status: 404 });
  }

  if (!canAccessBudgetRequest(auth.session, budgetRequest)) {
    return NextResponse.json({ error: "Anda tidak memiliki akses ke permintaan ini." }, { status: 403 });
  }

  return NextResponse.json({ budgetRequest, items });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRole(budgetReadRoles);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "ID permintaan anggaran tidak valid." }, { status: 400 });
  }

  const parsed = budgetRequestInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data permintaan anggaran tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();
  const session = await mongoose.startSession();

  try {
    const result = await session.withTransaction(async () => {
      const before = await findBudgetRequestForAction(parsedId.data, session);
      if (!before) {
        throw new Error("Permintaan anggaran tidak ditemukan.");
      }

      if (!canEditBudgetDraft(auth.session, before)) {
        throw new Error("Hanya draft yang boleh diedit oleh pembuat atau admin BAUK.");
      }

      const totalRequestedAmount = calculateBudgetItemsTotal(parsed.data.items);
      const budgetRequest = await BudgetRequest.findByIdAndUpdate(
        parsedId.data,
        {
          $set: {
            requestDate: parsed.data.requestDate,
            requesterName: parsed.data.requesterName,
            unitId: parsed.data.unitId,
            periodId: parsed.data.periodId || undefined,
            requestType: parsed.data.requestType,
            activityName: parsed.data.activityName,
            description: parsed.data.description,
            totalRequestedAmount,
          },
        },
        { returnDocument: "after", runValidators: true, session }
      );

      await replaceBudgetItems(parsedId.data, parsed.data.items, session);
      await createBudgetAuditLog({
        userId: auth.session.user.id,
        action: "update_budget_request",
        documentId: parsedId.data,
        before,
        after: { totalRequestedAmount },
        session,
      });

      return { budgetRequest };
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Permintaan anggaran gagal diperbarui." },
      { status: 400 }
    );
  } finally {
    await session.endSession();
  }
}
