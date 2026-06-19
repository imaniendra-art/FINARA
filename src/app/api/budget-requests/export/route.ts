import { requireApiRole } from "@/lib/api-auth";
import { budgetManageRoles } from "@/lib/budget";
import dbConnect from "@/lib/db";
import { auditSettingsExport, createExcelResponse } from "@/lib/settings-export";
import BudgetRequest from "@/models/BudgetRequest";
import "@/models/BudgetWorkUnit";
import "@/models/BudgetPeriod";

type BudgetExportRow = {
  requestNumber: string;
  requestDate: Date;
  requesterName: string;
  activityName: string;
  requestType: string;
  status: string;
  totalRequestedAmount: number;
  totalApprovedAmount: number;
  unitId?: { name?: string; code?: string };
  periodId?: { name?: string };
};

export async function GET() {
  const auth = await requireApiRole(budgetManageRoles);
  if (auth.response) return auth.response;

  await dbConnect();
  const requests = await BudgetRequest.find({})
    .sort({ requestDate: -1, createdAt: -1 })
    .populate("unitId", "name code")
    .populate("periodId", "name")
    .lean<BudgetExportRow[]>();

  const rows = requests.map((request) => ({
    nomor: request.requestNumber,
    tanggal: request.requestDate,
    pemohon: request.requesterName,
    unit: request.unitId?.name ?? "",
    periode: request.periodId?.name ?? "",
    jenis: request.requestType,
    kegiatan: request.activityName,
    status: request.status,
    totalDiajukan: request.totalRequestedAmount,
    totalDisetujui: request.totalApprovedAmount,
  }));

  await auditSettingsExport(auth.session.user.id, "budget-requests", rows.length);
  return createExcelResponse(rows, "finara-permintaan-anggaran.xlsx");
}
