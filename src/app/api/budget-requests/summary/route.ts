import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { budgetReadRoles, getBudgetRequestFilter } from "@/lib/budget";
import BudgetRequest from "@/models/BudgetRequest";

export async function GET() {
  const auth = await requireApiRole(budgetReadRoles);
  if (auth.response) return auth.response;

  await dbConnect();
  const filter = getBudgetRequestFilter(auth.session);
  const totals = await BudgetRequest.aggregate<{
    _id: string;
    count: number;
    requested: number;
    approved: number;
  }>([
    { $match: filter },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        requested: { $sum: "$totalRequestedAmount" },
        approved: { $sum: "$totalApprovedAmount" },
      },
    },
  ]);

  return NextResponse.json({ summary: totals });
}
