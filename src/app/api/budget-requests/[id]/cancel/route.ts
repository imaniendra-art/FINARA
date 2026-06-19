import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { budgetCreateRoles } from "@/lib/budget";
import { assertOwnDraftOrAdmin, updateBudgetStatus } from "@/lib/budget-actions";
import { budgetCancelSchema, objectIdSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiRole(budgetCreateRoles);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  const parsed = budgetCancelSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data pembatalan tidak valid", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  await dbConnect();
  try {
    const result = await updateBudgetStatus({
      id: parsedId.data,
      session: auth.session,
      expectedStatuses: ["draft", "submitted"],
      nextStatus: "cancelled",
      action: "cancel_budget_request",
      buildSet: (req) => {
        assertOwnDraftOrAdmin(auth.session, req);
        return { userNote: parsed.data.userNote };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pembatalan gagal." }, { status: 400 });
  }
}
