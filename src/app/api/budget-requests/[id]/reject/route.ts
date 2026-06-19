import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { budgetApproveRoles } from "@/lib/budget";
import { updateBudgetStatus } from "@/lib/budget-actions";
import { budgetRejectSchema, objectIdSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiRole(budgetApproveRoles);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  const parsed = budgetRejectSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data penolakan tidak valid", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  await dbConnect();
  try {
    const result = await updateBudgetStatus({
      id: parsedId.data,
      session: auth.session,
      expectedStatuses: ["verified"],
      nextStatus: "rejected",
      action: "reject_budget_request",
      buildSet: () => ({
        totalApprovedAmount: 0,
        rejectionReason: parsed.data.rejectionReason,
        adminNote: parsed.data.adminNote,
        leaderNote: parsed.data.leaderNote,
        userNote: parsed.data.userNote,
        rejectedBy: auth.session.user.id,
        rejectedAt: new Date(),
      }),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Penolakan gagal." }, { status: 400 });
  }
}
