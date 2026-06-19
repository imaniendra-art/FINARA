import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { budgetManageRoles } from "@/lib/budget";
import { updateBudgetStatus } from "@/lib/budget-actions";
import { budgetDisburseSchema, objectIdSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiRole(budgetManageRoles);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  const parsed = budgetDisburseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data pencairan tidak valid", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  await dbConnect();
  try {
    const result = await updateBudgetStatus({
      id: parsedId.data,
      session: auth.session,
      expectedStatuses: ["approved"],
      nextStatus: "disbursed",
      action: "disburse_budget_request",
      buildSet: () => ({
        disbursementNote: parsed.data.disbursementNote,
        disbursementProofUrl: parsed.data.disbursementProofUrl,
        disbursedBy: auth.session.user.id,
        disbursedAt: new Date(),
      }),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pencairan gagal." }, { status: 400 });
  }
}
