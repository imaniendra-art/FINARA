import mongoose from "mongoose";
import { Session } from "next-auth";
import { createFinanceNumber } from "@/lib/finance";
import { UserRole } from "@/lib/rbac";
import { isBudgetRequesterRole } from "@/lib/roles";
import AuditLog from "@/models/AuditLog";
import BudgetPeriod from "@/models/BudgetPeriod";
import BudgetRequest from "@/models/BudgetRequest";
import BudgetRequestItem from "@/models/BudgetRequestItem";
import BudgetWorkUnit from "@/models/BudgetWorkUnit";

export const budgetReadRoles: UserRole[] = [
  "super_admin",
  "admin_bauk",
  "staff_bauk",
  "unit",
  "tendik",
  "dosen",
  "organisasi",
  "pimpinan",
  "auditor",
];
export const budgetManageRoles: UserRole[] = ["super_admin", "admin_bauk"];
export const budgetCreateRoles: UserRole[] = [
  "super_admin",
  "admin_bauk",
  "staff_bauk",
  "unit",
  "tendik",
  "dosen",
  "organisasi",
];
export const budgetApproveRoles: UserRole[] = ["super_admin", "admin_bauk", "pimpinan"];

export const requestTypeLabels = {
  proker: "Proker",
  incidental: "Insidentil",
  operational: "Operasional",
  other: "Lainnya",
} as const;

export const statusLabels = {
  draft: "Draft",
  submitted: "Menunggu Verifikasi",
  verified: "Menunggu Approval",
  approved: "Disetujui",
  rejected: "Ditolak",
  disbursed: "Dicairkan",
  lpj_submitted: "LPJ Dikirim",
  completed: "Selesai",
  cancelled: "Dibatalkan",
} as const;

type BudgetItemInput = {
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  note?: string;
  referenceUrl?: string;
};

type BudgetRequestSnapshot = {
  _id?: mongoose.Types.ObjectId;
  status: string;
  requesterUserId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  totalRequestedAmount: number;
  totalApprovedAmount: number;
};

export function isBudgetAdmin(role?: string) {
  return role === "super_admin" || role === "admin_bauk";
}

export function isBudgetReadAll(role?: string) {
  return role === "super_admin" || role === "admin_bauk" || role === "pimpinan" || role === "auditor";
}

export function canEditBudgetDraft(session: Session, request: BudgetRequestSnapshot) {
  if (isBudgetAdmin(session.user.role)) {
    return request.status === "draft";
  }

  return (
    isBudgetRequesterRole(session.user.role) &&
    request.status === "draft" &&
    request.createdBy?.toString() === session.user.id
  );
}

export function canAccessBudgetRequest(session: Session, request: BudgetRequestSnapshot) {
  if (isBudgetReadAll(session.user.role)) {
    return true;
  }

  return request.createdBy?.toString() === session.user.id || request.requesterUserId?.toString() === session.user.id;
}

export function getBudgetRequestFilter(session: Session) {
  if (isBudgetReadAll(session.user.role)) {
    return {};
  }

  const userId = new mongoose.Types.ObjectId(session.user.id);

  return {
    $or: [{ createdBy: userId }, { requesterUserId: userId }],
  };
}

export function calculateBudgetItemsTotal(items: BudgetItemInput[]) {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

export function buildBudgetItems(requestId: mongoose.Types.ObjectId | string, items: BudgetItemInput[]) {
  return items.map((item) => ({
    budgetRequestId: requestId,
    itemName: item.itemName,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    total: item.quantity * item.unitPrice,
    note: item.note,
    referenceUrl: item.referenceUrl,
  }));
}

export function assertApprovedAmountAllowed(amount: number, totalRequested: number, role?: string) {
  if (amount > totalRequested && role !== "super_admin") {
    throw new Error("Nominal disetujui tidak boleh melebihi total diajukan.");
  }
}

export async function ensureDefaultBudgetData() {
  const defaultUnits = [
    { code: "BAUK", name: "BAUK" },
    { code: "BAAK", name: "BAAK" },
    { code: "PUSDATIN", name: "PUSDATIN" },
    { code: "PRODI", name: "PRODI" },
    { code: "PERPUSTAKAAN", name: "PERPUSTAKAAN" },
    { code: "KEMAHASISWAAN", name: "KEMAHASISWAAN" },
    { code: "ORGANISASI_MAHASISWA", name: "ORGANISASI MAHASISWA" },
    { code: "UMUM", name: "UMUM" },
  ];

  await Promise.all(
    defaultUnits.map((unit) =>
      BudgetWorkUnit.findOneAndUpdate(
        { code: unit.code },
        { $setOnInsert: { ...unit, isActive: true } },
        { upsert: true, returnDocument: "after" }
      )
    )
  );

  const activePeriod = await BudgetPeriod.findOne({ isActive: true }).lean();
  if (!activePeriod) {
    const year = new Date().getFullYear();
    await BudgetPeriod.create({
      name: String(year),
      startDate: new Date(year, 0, 1),
      endDate: new Date(year, 11, 31),
      isActive: true,
    });
  }
}

export async function createBudgetAuditLog({
  userId,
  action,
  documentId,
  before,
  after,
  session,
}: {
  userId: string;
  action: string;
  documentId: mongoose.Types.ObjectId | string;
  before: unknown;
  after: unknown;
  session?: mongoose.ClientSession;
}) {
  await AuditLog.create(
    [
      {
        userId,
        action,
        module: "BudgetRequest",
        documentId,
        before,
        after,
      },
    ],
    session ? { session, ordered: true } : { ordered: true }
  );
}

export async function findBudgetRequestForAction(
  id: string,
  session?: mongoose.ClientSession
): Promise<BudgetRequestSnapshot | null> {
  return BudgetRequest.findById(id)
    .session(session ?? null)
    .select("status requesterUserId createdBy totalRequestedAmount totalApprovedAmount")
    .lean<BudgetRequestSnapshot | null>();
}

export async function replaceBudgetItems(
  requestId: mongoose.Types.ObjectId | string,
  items: BudgetItemInput[],
  session: mongoose.ClientSession
) {
  await BudgetRequestItem.deleteMany({ budgetRequestId: requestId }).session(session);
  await BudgetRequestItem.create(buildBudgetItems(requestId, items), { session, ordered: true });
}

export function createBudgetRequestNumber() {
  return createFinanceNumber("BUD");
}
