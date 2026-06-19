import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { budgetCreateRoles } from "@/lib/budget";
import { assertOwnDraftOrAdmin, updateBudgetStatus } from "@/lib/budget-actions";
import { budgetSubmitLpjSchema, objectIdSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiRole(budgetCreateRoles);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  const parsed = budgetSubmitLpjSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data LPJ tidak valid", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  await dbConnect();
  try {
    const result = await updateBudgetStatus({
      id: parsedId.data,
      session: auth.session,
      expectedStatuses: ["disbursed"],
      nextStatus: "lpj_submitted",
      action: "submit_budget_lpj",
      buildSet: (req) => {
        assertOwnDraftOrAdmin(auth.session, req);
        return {
          lpjNote: parsed.data.lpjNote,
          lpjProofUrl: parsed.data.lpjProofUrl,
          lpjSubmittedAt: new Date(),
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Submit LPJ gagal." }, { status: 400 });
  }
}
