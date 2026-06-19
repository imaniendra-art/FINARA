import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { budgetManageRoles } from "@/lib/budget";
import { updateBudgetStatus } from "@/lib/budget-actions";
import { budgetCompleteSchema, objectIdSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiRole(budgetManageRoles);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  const parsed = budgetCompleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data penyelesaian tidak valid", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  await dbConnect();
  try {
    const result = await updateBudgetStatus({
      id: parsedId.data,
      session: auth.session,
      expectedStatuses: ["lpj_submitted"],
      nextStatus: "completed",
      action: "complete_budget_request",
      buildSet: () => ({ adminNote: parsed.data.adminNote }),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Penyelesaian gagal." }, { status: 400 });
  }
}
