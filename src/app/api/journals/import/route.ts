import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { createFinanceNumber } from "@/lib/finance";
import { journalImportConfirmSchema } from "@/lib/validation";
import Account from "@/models/Account";
import AuditLog from "@/models/AuditLog";
import JournalEntry from "@/models/JournalEntry";
import JournalLine from "@/models/JournalLine";
import dayjs from "dayjs";

const importRoles = ["super_admin", "admin_bauk", "staff_bauk"] as const;

export async function POST(request: Request) {
  try {
    const auth = await requireApiRole([...importRoles]);
    if (auth.response) {
      return auth.response;
    }

    const body = await request.json();
    const parsed = journalImportConfirmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Data import jurnal tidak valid.", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    await dbConnect();

    // 1. Group rows by noJurnal
    const groupsMap = new Map<string, typeof parsed.data.rows>();
    parsed.data.rows.forEach((row) => {
      const noJurnal = String(row.noJurnal || "unknown").trim();
      if (!groupsMap.has(noJurnal)) {
        groupsMap.set(noJurnal, []);
      }
      groupsMap.get(noJurnal)!.push(row);
    });

    const uniqueCodes = [
      ...new Set(
        parsed.data.rows
          .map((r) => String(r.kodeAkun || "").trim())
          .filter(Boolean)
      ),
    ];

    const dbSession = await mongoose.startSession();
    let createdCount = 0;

    try {
      await dbSession.withTransaction(async () => {
        // Fetch and validate accounts in this transaction
        const accounts = await Account.find({ code: { $in: uniqueCodes }, isActive: true })
          .session(dbSession)
          .select("code name")
          .lean();

        const accountMap = new Map(accounts.map((acc) => [acc.code, acc]));

        // Process each journal entry group
        for (const [noJurnal, rows] of groupsMap.entries()) {
          const firstRow = rows[0];
          if (!firstRow) continue;

          const dateVal = dayjs(firstRow.tanggal);
          if (!dateVal.isValid()) {
            throw new Error(`Tanggal jurnal '${firstRow.tanggal}' di jurnal '${noJurnal}' tidak valid.`);
          }

          const description = String(firstRow.keteranganJurnal).trim();
          if (!description) {
            throw new Error(`Keterangan jurnal di jurnal '${noJurnal}' wajib diisi.`);
          }

          let totalDebit = 0;
          let totalCredit = 0;

          // Create lines data
          const linesToCreate = rows.map((row) => {
            const account = accountMap.get(row.kodeAkun);
            if (!account) {
              throw new Error(`Akun dengan kode '${row.kodeAkun}' tidak ditemukan atau tidak aktif.`);
            }

            totalDebit += row.debit;
            totalCredit += row.kredit;

            return {
              accountId: account._id,
              debit: row.debit,
              credit: row.kredit,
              description: String(row.deskripsiBaris || row.keteranganJurnal || "").trim(),
            };
          });

          if (linesToCreate.length < 2) {
            throw new Error(`Jurnal '${noJurnal}' minimal harus memiliki 2 baris transaksi.`);
          }

          if (totalDebit !== totalCredit) {
            throw new Error(`Jurnal '${noJurnal}' tidak balance (Debit: ${totalDebit} vs Kredit: ${totalCredit}).`);
          }

          if (totalDebit <= 0) {
            throw new Error(`Jurnal '${noJurnal}' total debet dan kredit harus lebih besar dari 0.`);
          }

          // Create the JournalEntry document
          const [journalEntry] = await JournalEntry.create(
            [
              {
                entryNumber: createFinanceNumber("JRN"),
                date: dateVal.toDate(),
                description,
                sourceType: "manual",
                status: "draft",
                createdBy: auth.session.user.id,
              },
            ],
            { session: dbSession, ordered: true }
          );

          // Create lines
          await JournalLine.create(
            linesToCreate.map((line) => ({
              journalEntryId: journalEntry._id,
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
              description: line.description,
            })),
            { session: dbSession, ordered: true }
          );

          // Create AuditLog
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
                  lineCount: linesToCreate.length,
                  isImported: true,
                },
              },
            ],
            { session: dbSession, ordered: true }
          );

          createdCount++;
        }
      });

      return NextResponse.json({
        summary: {
          created: createdCount,
          failed: 0,
        },
      });
    } finally {
      await dbSession.endSession();
    }
  } catch (error: unknown) {
    console.error("Journal import execution error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengimport jurnal massal." },
      { status: 400 }
    );
  }
}
