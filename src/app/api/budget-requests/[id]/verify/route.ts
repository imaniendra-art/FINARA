import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { budgetManageRoles } from "@/lib/budget";
import { checkedApprovedAmount, updateBudgetStatus } from "@/lib/budget-actions";
import { budgetVerifySchema, objectIdSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiRole(budgetManageRoles);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  const parsed = budgetVerifySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data verifikasi tidak valid", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  await dbConnect();
  try {
    const result = await updateBudgetStatus({
      id: parsedId.data,
      session: auth.session,
      expectedStatuses: ["submitted"],
      nextStatus: "verified",
      action: "verify_budget_request",
      buildSet: (req) => ({
        totalApprovedAmount: checkedApprovedAmount(
          parsed.data.totalApprovedAmount ?? req.totalRequestedAmount,
          req.totalRequestedAmount,
          auth.session.user.role
        ),
        adminNote: parsed.data.adminNote,
        userNote: parsed.data.userNote,
        verifiedBy: auth.session.user.id,
        verifiedAt: new Date(),
      }),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Verifikasi gagal." }, { status: 400 });
  }
}
