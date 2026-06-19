import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import {
  buildBudgetItems,
  budgetCreateRoles,
  budgetReadRoles,
  calculateBudgetItemsTotal,
  createBudgetAuditLog,
  createBudgetRequestNumber,
  ensureDefaultBudgetData,
  getBudgetRequestFilter,
} from "@/lib/budget";
import { budgetRequestInputSchema } from "@/lib/validation";
import BudgetPeriod from "@/models/BudgetPeriod";
import BudgetRequest from "@/models/BudgetRequest";
import BudgetRequestItem from "@/models/BudgetRequestItem";
import BudgetWorkUnit from "@/models/BudgetWorkUnit";

function getQueryFilter(request: NextRequest, baseFilter: Record<string, unknown>) {
  const searchParams = request.nextUrl.searchParams;
  const filter: Record<string, unknown> = { ...baseFilter };
  const status = searchParams.get("status");
  const unitId = searchParams.get("unitId");
  const periodId = searchParams.get("periodId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const search = searchParams.get("search")?.trim();

  if (status) filter.status = status;
  if (unitId) filter.unitId = unitId;
  if (periodId) filter.periodId = periodId;
  if (startDate || endDate) {
    filter.requestDate = {
      ...(startDate ? { $gte: new Date(`${startDate}T00:00:00`) } : {}),
      ...(endDate ? { $lte: new Date(`${endDate}T23:59:59`) } : {}),
    };
  }
  if (search) {
    filter.$and = [
      ...(Array.isArray(filter.$and) ? filter.$and : []),
      {
        $or: [
          { requestNumber: { $regex: search, $options: "i" } },
          { requesterName: { $regex: search, $options: "i" } },
          { activityName: { $regex: search, $options: "i" } },
        ],
      },
    ];
  }

  return filter;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(budgetReadRoles);
  if (auth.response) return auth.response;

  await dbConnect();
  await ensureDefaultBudgetData();

  const filter = getQueryFilter(request, getBudgetRequestFilter(auth.session));

  const [requests, workUnits, periods] = await Promise.all([
    BudgetRequest.find(filter)
      .sort({ requestDate: -1, createdAt: -1 })
      .populate("unitId", "name code")
      .populate("periodId", "name")
      .populate("createdBy", "name")
      .lean(),
    BudgetWorkUnit.find({}).sort({ isActive: -1, name: 1 }).lean(),
    BudgetPeriod.find({}).sort({ isActive: -1, startDate: -1 }).lean(),
  ]);

  return NextResponse.json({ requests, workUnits, periods });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(budgetCreateRoles);
  if (auth.response) return auth.response;

  const parsed = budgetRequestInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data permintaan anggaran tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();
  await ensureDefaultBudgetData();
  const session = await mongoose.startSession();

  try {
    const result = await session.withTransaction(async () => {
      const workUnit = await BudgetWorkUnit.findOne({ _id: parsed.data.unitId, isActive: true })
        .session(session)
        .select("_id")
        .lean();
      if (!workUnit) {
        throw new Error("Unit kerja tidak ditemukan atau sudah nonaktif.");
      }

      if (parsed.data.periodId) {
        const period = await BudgetPeriod.findById(parsed.data.periodId).session(session).select("_id").lean();
        if (!period) {
          throw new Error("Periode anggaran tidak ditemukan.");
        }
      }

      const totalRequestedAmount = calculateBudgetItemsTotal(parsed.data.items);
      const activePeriod = parsed.data.periodId
        ? null
        : await BudgetPeriod.findOne({ isActive: true }).session(session).select("_id").lean();
      const [budgetRequest] = await BudgetRequest.create(
        [
          {
            requestNumber: createBudgetRequestNumber(),
            requestDate: parsed.data.requestDate,
            requesterName: parsed.data.requesterName,
            requesterUserId: auth.session.user.id,
            unitId: parsed.data.unitId,
            periodId: parsed.data.periodId || activePeriod?._id || undefined,
            requestType: parsed.data.requestType,
            activityName: parsed.data.activityName,
            description: parsed.data.description,
            totalRequestedAmount,
            totalApprovedAmount: 0,
            status: "draft",
            createdBy: auth.session.user.id,
          },
        ],
        { session, ordered: true }
      );

      await BudgetRequestItem.create(buildBudgetItems(budgetRequest._id, parsed.data.items), {
        session,
        ordered: true,
      });

      await createBudgetAuditLog({
        userId: auth.session.user.id,
        action: "create_budget_request",
        documentId: budgetRequest._id,
        before: null,
        after: { requestNumber: budgetRequest.requestNumber, totalRequestedAmount },
        session,
      });

      return { budgetRequest };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Create budget request error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Permintaan anggaran gagal disimpan." },
      { status: 400 }
    );
  } finally {
    await session.endSession();
  }
}
