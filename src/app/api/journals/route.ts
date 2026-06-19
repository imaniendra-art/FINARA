import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { financeReadRoles, requireApiRole } from "@/lib/api-auth";
import { createFinanceNumber } from "@/lib/finance";
import { manualJournalInputSchema } from "@/lib/validation";
import Account from "@/models/Account";
import AuditLog from "@/models/AuditLog";
import JournalEntry from "@/models/JournalEntry";
import JournalLine from "@/models/JournalLine";

const manualJournalCreateRoles = ["super_admin", "admin_bauk", "staff_bauk"] as const;

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

async function validateLineAccounts(accountIds: string[], session: mongoose.ClientSession) {
  const uniqueAccountIds = [...new Set(accountIds)];
  const accounts = await Account.find({ _id: { $in: uniqueAccountIds }, isActive: true })
    .session(session)
    .select("_id")
    .lean();

  if (accounts.length !== uniqueAccountIds.length) {
    throw new Error("Salah satu akun jurnal tidak ditemukan atau tidak aktif.");
  }
}

export async function GET(request: Request) {
  const auth = await requireApiRole(financeReadRoles);
  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const filters = buildJournalFilters(searchParams);

  await dbConnect();

  const [journals, accounts] = await Promise.all([
    JournalEntry.find(filters)
      .sort({ date: -1, createdAt: -1 })
      .populate("createdBy", "name")
      .lean(),
    Account.find({ isActive: true }).sort({ code: 1 }).select("code name type").lean(),
  ]);

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

  return NextResponse.json({
    journals: journals.map((journal) => ({
      ...journal,
      totals: totalMap.get(String(journal._id)) ?? {
        totalDebit: 0,
        totalCredit: 0,
        lineCount: 0,
      },
    })),
    accounts,
    options: {
      statuses: ["draft", "posted", "cancelled"],
      sourceTypes: ["payment", "cash_transaction", "manual"],
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireApiRole([...manualJournalCreateRoles]);
  if (auth.response) {
    return auth.response;
  }

  const parsed = manualJournalInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data jurnal manual tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();

  const dbSession = await mongoose.startSession();

  try {
    const result = await dbSession.withTransaction(async () => {
      await validateLineAccounts(
        parsed.data.lines.map((line) => line.accountId),
        dbSession
      );

      const [journalEntry] = await JournalEntry.create(
        [
          {
            entryNumber: createFinanceNumber("JRN"),
            date: parsed.data.date,
            description: parsed.data.description,
            sourceType: "manual",
            status: "draft",
            createdBy: auth.session.user.id,
          },
        ],
        { session: dbSession, ordered: true }
      );

      await JournalLine.create(
        parsed.data.lines.map((line) => ({
          journalEntryId: journalEntry._id,
          accountId: new mongoose.Types.ObjectId(line.accountId),
          debit: line.debit,
          credit: line.credit,
          description: line.description,
        })),
        { session: dbSession, ordered: true }
      );

      await AuditLog.create(
        [
          {
            userId: auth.session.user.id,
            action: "create_manual_journal",
            module: "JournalEntry",
            documentId: journalEntry._id,
            before: null,
            after: {
              entryNumber: journalEntry.entryNumber,
              description: journalEntry.description,
              lineCount: parsed.data.lines.length,
            },
          },
        ],
        { session: dbSession, ordered: true }
      );

      return { journalEntry };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Create manual journal error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Jurnal manual gagal disimpan." },
      { status: 400 }
    );
  } finally {
    await dbSession.endSession();
  }
}
