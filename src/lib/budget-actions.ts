import mongoose from "mongoose";
import { Session } from "next-auth";
import {
  assertApprovedAmountAllowed,
  budgetApproveRoles,
  budgetManageRoles,
  canAccessBudgetRequest,
  createBudgetAuditLog,
  isBudgetAdmin,
} from "@/lib/budget";
import { isBudgetRequesterRole } from "@/lib/roles";
import BudgetRequest from "@/models/BudgetRequest";

type ActionResult = {
  budgetRequest: unknown;
};

export async function updateBudgetStatus({
  id,
  session,
  expectedStatuses,
  nextStatus,
  action,
  buildSet,
}: {
  id: string;
  session: Session;
  expectedStatuses: string[];
  nextStatus: string;
  action: string;
  buildSet: (request: {
    status: string;
    totalRequestedAmount: number;
    totalApprovedAmount: number;
    createdBy?: mongoose.Types.ObjectId;
    requesterUserId?: mongoose.Types.ObjectId;
  }) => Record<string, unknown> | Promise<Record<string, unknown>>;
}): Promise<ActionResult> {
  const before = await BudgetRequest.findById(id)
    .select("status totalRequestedAmount totalApprovedAmount createdBy requesterUserId")
    .lean<{
      status: string;
      totalRequestedAmount: number;
      totalApprovedAmount: number;
      createdBy?: mongoose.Types.ObjectId;
      requesterUserId?: mongoose.Types.ObjectId;
    } | null>();

  if (!before) {
    throw new Error("Permintaan anggaran tidak ditemukan.");
  }

  if (!canAccessBudgetRequest(session, before)) {
    throw new Error("Anda tidak memiliki akses ke permintaan ini.");
  }

  if (!expectedStatuses.includes(before.status)) {
    throw new Error("Status permintaan tidak valid untuk aksi ini.");
  }

  const set = await buildSet(before);
  const budgetRequest = await BudgetRequest.findByIdAndUpdate(
    id,
    { $set: { ...set, status: nextStatus } },
    { returnDocument: "after", runValidators: true }
  );

  await createBudgetAuditLog({
    userId: session.user.id,
    action,
    documentId: id,
    before,
    after: { status: nextStatus, ...set },
  });

  return { budgetRequest };
}

export function assertBudgetManager(session: Session) {
  if (!budgetManageRoles.includes(session.user.role as never)) {
    throw new Error("Aksi ini hanya untuk admin BAUK.");
  }
}

export function assertBudgetApprover(session: Session) {
  if (!budgetApproveRoles.includes(session.user.role as never)) {
    throw new Error("Aksi ini hanya untuk pimpinan atau admin BAUK.");
  }
}

export function assertOwnDraftOrAdmin(
  session: Session,
  request: { createdBy?: mongoose.Types.ObjectId; requesterUserId?: mongoose.Types.ObjectId }
) {
  if (isBudgetAdmin(session.user.role)) return;

  const owns =
    request.createdBy?.toString() === session.user.id || request.requesterUserId?.toString() === session.user.id;
  if (!isBudgetRequesterRole(session.user.role) || !owns) {
    throw new Error("Anda hanya boleh memproses permintaan milik sendiri.");
  }
}

export function checkedApprovedAmount(amount: number, totalRequested: number, role?: string) {
  assertApprovedAmountAllowed(amount, totalRequested, role);
  return amount;
}
