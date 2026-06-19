import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { auditSettingsExport, createExcelResponse } from "@/lib/settings-export";
import StudentBill from "@/models/StudentBill";

const exportRoles = ["super_admin", "admin_bauk"] as const;

type PopulatedBill = {
  academicYear: string;
  semester: string;
  amount: number;
  discount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: Date;
  status: string;
  studentId?: { nim?: string; name?: string };
  feeTypeId?: { name?: string };
};

export async function GET() {
  const auth = await requireApiRole([...exportRoles]);
  if (auth.response) {
    return auth.response;
  }

  await dbConnect();

  const bills = await StudentBill.find({})
    .sort({ dueDate: -1 })
    .populate("studentId", "nim name")
    .populate("feeTypeId", "name")
    .lean<PopulatedBill[]>();
  const rows = bills.map((bill) => ({
    nim: bill.studentId?.nim ?? "",
    mahasiswa: bill.studentId?.name ?? "",
    jenisTagihan: bill.feeTypeId?.name ?? "",
    academicYear: bill.academicYear,
    semester: bill.semester,
    amount: bill.amount,
    discount: bill.discount,
    paidAmount: bill.paidAmount,
    remainingAmount: bill.remainingAmount,
    dueDate: bill.dueDate,
    status: bill.status,
  }));

  await auditSettingsExport(auth.session.user.id, "bills", rows.length);

  return createExcelResponse(rows, "finara-tagihan.xlsx");
}
