import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { objectIdSchema } from "@/lib/validation";
import AuditLog from "@/models/AuditLog";
import JournalEntry from "@/models/JournalEntry";

const journalCancelRoles = ["super_admin", "admin_bauk"] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type JournalEntrySnapshot = {
  _id: mongoose.Types.ObjectId;
  sourceType: "payment" | "cash_transaction" | "manual";
  status: "draft" | "posted" | "cancelled";
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireApiRole([...journalCancelRoles]);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json({ error: "ID jurnal tidak valid." }, { status: 400 });
  }

  await dbConnect();

  const dbSession = await mongoose.startSession();

  try {
    const result = await dbSession.withTransaction(async () => {
      const journal = await JournalEntry.findById(parsedId.data)
        .session(dbSession)
        .lean<JournalEntrySnapshot | null>();

      if (!journal) {
        throw new Error("Jurnal tidak ditemukan.");
      }

      if (journal.sourceType !== "manual") {
        throw new Error("Jurnal otomatis tidak boleh dicancel dari halaman jurnal manual.");
      }

      if (journal.status !== "draft") {
        throw new Error("Hanya jurnal manual draft yang boleh dicancel.");
      }

      const updatedJournal = await JournalEntry.findByIdAndUpdate(
        parsedId.data,
        { $set: { status: "cancelled" } },
        { returnDocument: "after", session: dbSession, runValidators: true }
      );

      await AuditLog.create(
        [
          {
            userId: auth.session.user.id,
            action: "cancel_journal",
            module: "JournalEntry",
            documentId: parsedId.data,
            before: journal,
            after: { status: "cancelled" },
          },
        ],
        { session: dbSession, ordered: true }
      );

      return { journal: updatedJournal };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Cancel journal error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Jurnal gagal dicancel." },
      { status: 400 }
    );
  } finally {
    await dbSession.endSession();
  }
}
