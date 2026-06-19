import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { financeReadRoles, requireApiRole } from "@/lib/api-auth";
import { manualJournalInputSchema, objectIdSchema } from "@/lib/validation";
import Account from "@/models/Account";
import AuditLog from "@/models/AuditLog";
import JournalEntry from "@/models/JournalEntry";
import JournalLine from "@/models/JournalLine";

const manualJournalEditRoles = ["super_admin", "admin_bauk"] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type JournalEntrySnapshot = {
  _id: mongoose.Types.ObjectId;
  entryNumber: string;
  date: Date;
  description: string;
  sourceType: "payment" | "cash_transaction" | "manual";
  sourceId?: mongoose.Types.ObjectId;
  status: "draft" | "posted" | "cancelled";
};

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

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(financeReadRoles);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json({ error: "ID jurnal tidak valid." }, { status: 400 });
  }

  await dbConnect();

  const [journal, lines] = await Promise.all([
    JournalEntry.findById(parsedId.data).populate("createdBy", "name").lean(),
    JournalLine.find({ journalEntryId: parsedId.data })
      .sort({ createdAt: 1 })
      .populate("accountId", "code name type")
      .lean(),
  ]);

  if (!journal) {
    return NextResponse.json({ error: "Jurnal tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({
    journal,
    lines,
    totals: {
      totalDebit: lines.reduce((sum, line) => sum + line.debit, 0),
      totalCredit: lines.reduce((sum, line) => sum + line.credit, 0),
      lineCount: lines.length,
    },
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRole([...manualJournalEditRoles]);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json({ error: "ID jurnal tidak valid." }, { status: 400 });
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
      const before = await JournalEntry.findById(parsedId.data)
        .session(dbSession)
        .lean<JournalEntrySnapshot | null>();

      if (!before) {
        throw new Error("Jurnal tidak ditemukan.");
      }

      if (before.sourceType !== "manual") {
        throw new Error("Jurnal otomatis tidak boleh diedit manual.");
      }

      if (before.status !== "draft") {
        throw new Error("Hanya jurnal manual draft yang boleh diedit.");
      }

      await validateLineAccounts(
        parsed.data.lines.map((line) => line.accountId),
        dbSession
      );

      const journal = await JournalEntry.findByIdAndUpdate(
        parsedId.data,
        {
          $set: {
            date: parsed.data.date,
            description: parsed.data.description,
          },
        },
        { returnDocument: "after", session: dbSession, runValidators: true }
      );

      await JournalLine.deleteMany({ journalEntryId: parsedId.data }).session(dbSession);
      await JournalLine.create(
        parsed.data.lines.map((line) => ({
          journalEntryId: parsedId.data,
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
            action: "update_draft_journal",
            module: "JournalEntry",
            documentId: parsedId.data,
            before,
            after: {
              date: parsed.data.date,
              description: parsed.data.description,
              lineCount: parsed.data.lines.length,
            },
          },
        ],
        { session: dbSession, ordered: true }
      );

      return { journal };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Update manual journal error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Jurnal manual gagal diperbarui." },
      { status: 400 }
    );
  } finally {
    await dbSession.endSession();
  }
}
