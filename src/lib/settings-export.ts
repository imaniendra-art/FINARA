import * as XLSX from "xlsx";
import AppSetting from "@/models/AppSetting";
import AuditLog from "@/models/AuditLog";

export function createExcelResponse(rows: Record<string, string | number | boolean | Date | null>[], filename: string) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const sheetName = filename.replace(".xlsx", "").slice(0, 31) || "Export";

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function auditSettingsExport(userId: string, exportName: string, rowCount: number) {
  let setting = await AppSetting.findOne({}).select("_id").lean<{ _id: object } | null>();

  if (!setting) {
    const createdSetting = await AppSetting.create({});
    setting = { _id: createdSetting._id };
  }

  await AuditLog.create({
    userId,
    action: "export_data",
    module: "AppSetting",
    documentId: setting._id,
    before: null,
    after: { exportName, rowCount },
  });
}
