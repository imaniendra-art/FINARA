import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { journalImportRowSchema } from "@/lib/validation";
import Account from "@/models/Account";
import dayjs from "dayjs";

const importRoles = ["super_admin", "admin_bauk", "staff_bauk"] as const;

const headerMap: Record<string, string> = {
  "no. jurnal": "noJurnal",
  "no jurnal": "noJurnal",
  "nojurnal": "noJurnal",
  "tanggal": "tanggal",
  "keterangan jurnal": "keteranganJurnal",
  "keteranganjurnal": "keteranganJurnal",
  "kode akun": "kodeAkun",
  "kodeakun": "kodeAkun",
  "debit": "debit",
  "kredit": "kredit",
  "deskripsi baris": "deskripsiBaris",
  "keterangan baris": "deskripsiBaris",
  "deskripsibaris": "deskripsiBaris",
};

const requiredHeaders = ["noJurnal", "tanggal", "keteranganJurnal", "kodeAkun", "debit", "kredit"];

export async function POST(request: Request) {
  try {
    const auth = await requireApiRole([...importRoles]);
    if (auth.response) {
      return auth.response;
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File Excel wajib diupload." }, { status: 400 });
    }

    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return NextResponse.json({ error: "File Excel tidak memiliki sheet." }, { status: 400 });
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const headerRows = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, blankrows: false });
    const originalHeaders = (headerRows[0] ?? []).map((header) => String(header).trim());
    
    // Check if headers match
    const headers = originalHeaders.map((h) => headerMap[h.toLowerCase()] ?? "");
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));

    if (missingHeaders.length > 0) {
      // Find what original header names are expected for the missing ones
      const missingFriendly = missingHeaders.map((m) => {
        if (m === "noJurnal") return "No. Jurnal";
        if (m === "tanggal") return "Tanggal";
        if (m === "keteranganJurnal") return "Keterangan Jurnal";
        if (m === "kodeAkun") return "Kode Akun";
        if (m === "debit") return "Debit";
        if (m === "kredit") return "Kredit";
        return m;
      });

      return NextResponse.json(
        { error: `Kolom template belum lengkap. Kolom wajib: ${missingFriendly.join(", ")}.` },
        { status: 400 }
      );
    }

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });
    
    // Normalize and validate rows
    const normalizedRows = rawRows.map((row, index) => {
      const rowNumber = index + 2;
      const normalizedRow: Record<string, unknown> = { rowNumber };
      
      for (const [key, value] of Object.entries(row)) {
        const mappedKey = headerMap[key.trim().toLowerCase()];
        if (mappedKey) {
          normalizedRow[mappedKey] = value;
        }
      }
      return normalizedRow;
    });

    // 1. Fetch all unique account codes
    const uniqueCodes = [
      ...new Set(
        normalizedRows
          .map((r) => String(r.kodeAkun || "").trim())
          .filter(Boolean)
      ),
    ];

    await dbConnect();

    const accounts = uniqueCodes.length
      ? await Account.find({ code: { $in: uniqueCodes }, isActive: true })
          .select("code name type normalBalance")
          .lean()
      : [];

    const accountMap = new Map(accounts.map((acc) => [acc.code, acc]));

    // 2. Group rows by noJurnal
    const groupsMap = new Map<string, typeof normalizedRows>();
    normalizedRows.forEach((row) => {
      const noJurnal = String(row.noJurnal || "unknown").trim();
      if (!groupsMap.has(noJurnal)) {
        groupsMap.set(noJurnal, []);
      }
      groupsMap.get(noJurnal)!.push(row);
    });

    // 3. Process each group
    const previewGroups = Array.from(groupsMap.entries()).map(([noJurnal, rows]) => {
      const groupErrors: string[] = [];
      const firstRow = rows[0] || {};
      const tanggalStr = String(firstRow.tanggal || "").trim();
      const keteranganJurnal = String(firstRow.keteranganJurnal || "").trim();

      const parsedDate = dayjs(tanggalStr);
      let formattedDate = "";
      if (!tanggalStr) {
        groupErrors.push("Tanggal jurnal wajib diisi.");
      } else if (!parsedDate.isValid()) {
        groupErrors.push(`Format tanggal '${tanggalStr}' tidak valid.`);
      } else {
        formattedDate = parsedDate.format("YYYY-MM-DD");
      }

      if (!keteranganJurnal) {
        groupErrors.push("Keterangan jurnal wajib diisi.");
      }

      let groupTotalDebit = 0;
      let groupTotalCredit = 0;

      const lines = rows.map((row) => {
        const lineErrors: string[] = [];
        const parsed = journalImportRowSchema.safeParse(row);

        const kodeAkun = String(row.kodeAkun || "").trim();
        const debit = parsed.success ? parsed.data.debit : 0;
        const kredit = parsed.success ? parsed.data.kredit : 0;
        const description = String(row.deskripsiBaris || row.keteranganJurnal || "").trim();

        groupTotalDebit += debit;
        groupTotalCredit += kredit;

        if (!parsed.success) {
          parsed.error.issues.forEach((issue) => {
            lineErrors.push(issue.message);
          });
        }

        const account = accountMap.get(kodeAkun);
        if (!kodeAkun) {
          lineErrors.push("Kode akun wajib diisi.");
        } else if (!account) {
          lineErrors.push(`Akun dengan kode '${kodeAkun}' tidak ditemukan atau tidak aktif.`);
        }

        return {
          rowNumber: Number(row.rowNumber),
          kodeAkun,
          accountId: account ? String(account._id) : null,
          accountName: account ? account.name : null,
          debit,
          credit: kredit,
          description,
          isValid: lineErrors.length === 0,
          errors: lineErrors,
        };
      });

      if (lines.length < 2) {
        groupErrors.push("Jurnal minimal harus memiliki 2 baris transaksi.");
      }

      if (groupTotalDebit <= 0) {
        groupErrors.push("Total transaksi debit dan kredit harus lebih dari 0.");
      }

      if (groupTotalDebit !== groupTotalCredit) {
        const diff = Math.abs(groupTotalDebit - groupTotalCredit);
        const diffFormatted = new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(diff);
        groupErrors.push(
          `Debit dan Kredit tidak balance. Selisih: ${diffFormatted} (Total Debit: ${groupTotalDebit} vs Kredit: ${groupTotalCredit}).`
        );
      }

      const allLinesValid = lines.every((line) => line.isValid);

      return {
        noJurnal,
        tanggal: formattedDate || tanggalStr,
        keteranganJurnal,
        lines,
        totalDebit: groupTotalDebit,
        totalCredit: groupTotalCredit,
        isValid: groupErrors.length === 0 && allLinesValid,
        errors: groupErrors,
      };
    });

    const summary = {
      total: previewGroups.length,
      valid: previewGroups.filter((g) => g.isValid).length,
      errors: previewGroups.filter((g) => !g.isValid).length,
    };

    return NextResponse.json({
      groups: previewGroups,
      summary,
    });
  } catch (error: unknown) {
    console.error("Journal import preview error:", error);
    return NextResponse.json(
      {
        error: "Gagal memproses file import.",
        details: error instanceof Error ? error.message : "Terjadi kesalahan tidak dikenal.",
      },
      { status: 500 }
    );
  }
}
