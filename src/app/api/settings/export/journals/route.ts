import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { auditSettingsExport, createExcelResponse } from "@/lib/settings-export";
import JournalEntry from "@/models/JournalEntry";
import JournalLine from "@/models/JournalLine";

const exportRoles = ["super_admin", "admin_bauk"] as const;

type JournalTotal = {
  _id: object;
  totalDebit: number;
  totalCredit: number;
  lineCount: number;
};

export async function GET() {
  const auth = await requireApiRole([...exportRoles]);
  if (auth.response) {
    return auth.response;
  }

  await dbConnect();

  const journals = await JournalEntry.find({})
    .sort({ date: -1, createdAt: -1 })
    .populate("createdBy", "name")
    .lean();
  const journalIds = journals.map((journal) => journal._id);
  const totals = await JournalLine.aggregate<JournalTotal>([
    { $match: { journalEntryId: { $in: journalIds } } },
    {
      $group: {
        _id: "$journalEntryId",
        totalDebit: { $sum: "$debit" },
        totalCredit: { $sum: "$credit" },
        lineCount: { $sum: 1 },
      },
    },
  ]);
  const totalMap = new Map(totals.map((total) => [String(total._id), total]));
  const rows = journals.map((journal) => {
    const total = totalMap.get(String(journal._id));

    return {
      entryNumber: journal.entryNumber,
      date: journal.date,
      description: journal.description,
      sourceType: journal.sourceType,
      status: journal.status,
      totalDebit: total?.totalDebit ?? 0,
      totalCredit: total?.totalCredit ?? 0,
      lineCount: total?.lineCount ?? 0,
      createdAt: journal.createdAt,
    };
  });

  await auditSettingsExport(auth.session.user.id, "journals", rows.length);

  return createExcelResponse(rows, "finara-jurnal.xlsx");
}
