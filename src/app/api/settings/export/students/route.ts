import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { auditSettingsExport, createExcelResponse } from "@/lib/settings-export";
import Student from "@/models/Student";

const exportRoles = ["super_admin", "admin_bauk"] as const;

export async function GET() {
  const auth = await requireApiRole([...exportRoles]);
  if (auth.response) {
    return auth.response;
  }

  await dbConnect();

  const students = await Student.find({}).sort({ entryYear: -1, name: 1 }).lean();
  const rows = students.map((student) => ({
    nim: student.nim,
    name: student.name,
    gender: student.gender,
    programStudy: student.programStudy,
    className: student.className,
    entryYear: student.entryYear,
    phone: student.phone ?? "",
    address: student.address ?? "",
    status: student.status,
  }));

  await auditSettingsExport(auth.session.user.id, "students", rows.length);

  return createExcelResponse(rows, "finara-mahasiswa.xlsx");
}
