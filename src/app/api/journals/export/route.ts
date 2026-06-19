import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import dbConnect from "@/lib/db";
import { financeReadRoles, requireApiRole } from "@/lib/api-auth";
import JournalEntry from "@/models/JournalEntry";
import JournalLine from "@/models/JournalLine";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildJournalFilters(searchParams: URLSearchParams) {
  const dateFrom = searchParams.get("dateFrom")?.trim();
  const dateTo = searchParams.get("dateTo")?.trim();
  const status = searchParams.get("status")?.trim();
  const sourceType = searchParams.get("sourceType")?.trim();
  const search = searchParams.get("search")?.trim();
  const filters: Record<string, unknown> = {};

  if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {};

    if (dateFrom) {
      dateFilter.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }

    if (dateTo) {
      dateFilter.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }

    filters.date = dateFilter;
  }

  if (status) {
    filters.status = status;
  }

  if (sourceType) {
    filters.sourceType = sourceType;
  }

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filters.$or = [{ entryNumber: regex }, { description: regex }];
  }

  return filters;
}

export async function GET(request: Request) {
  const auth = await requireApiRole(financeReadRoles);
  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);

  await dbConnect();

  const journals = await JournalEntry.find(buildJournalFilters(searchParams))
    .sort({ date: -1, createdAt: -1 })
    .populate("createdBy", "name")
    .lean();
  const journalIds = journals.map((journal) => journal._id);
  const totals = await JournalLine.aggregate([
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
      "Nomor Jurnal": journal.entryNumber,
      Tanggal: new Date(journal.date).toLocaleDateString("id-ID"),
      Deskripsi: journal.description,
      Sumber: journal.sourceType,
      Status: journal.status,
      "Total Debit": total?.totalDebit ?? 0,
      "Total Kredit": total?.totalCredit ?? 0,
      "Jumlah Baris": total?.lineCount ?? 0,
      "Dibuat Oleh": journal.createdBy?.name ?? "-",
      "Tanggal Buat": new Date(journal.createdAt).toLocaleString("id-ID"),
    };
  });
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);

  XLSX.utils.book_append_sheet(workbook, worksheet, "Jurnal Umum");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="jurnal-umum-finara.xlsx"`,
    },
  });
}
