import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { studentImportRowSchema } from "@/lib/validation";
import Student from "@/models/Student";

const importRoles = ["super_admin", "admin_bauk"] as const;
const requiredHeaders = ["nim", "name", "entryYear"];

type ExistingStudentSource = {
  _id: unknown;
  nim: string;
};

function normalizeNim(value: string) {
  return value.trim().toLowerCase();
}

function getErrorMessages(error: unknown) {
  const parsedError = studentImportRowSchema.safeParse(error);

  if (parsedError.success) {
    return [];
  }

  return parsedError.error.issues.map((issue) => issue.message);
}

export async function POST(request: Request) {
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
  const headers = (headerRows[0] ?? []).map((header) => String(header).trim());
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    return NextResponse.json(
      { error: `Kolom template belum lengkap: ${missingHeaders.join(", ")}.` },
      { status: 400 }
    );
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });
  const nimCounts = new Map<string, number>();

  rawRows.forEach((row) => {
    const nim = String(row.nim ?? "").trim();

    if (nim) {
      const key = normalizeNim(nim);
      nimCounts.set(key, (nimCounts.get(key) ?? 0) + 1);
    }
  });

  await dbConnect();

  const uniqueNims = [...nimCounts.keys()];
  const existingStudents = uniqueNims.length
    ? await Student.find({ nim: { $in: uniqueNims } })
        .collation({ locale: "en", strength: 2 })
        .select("nim")
        .lean<ExistingStudentSource[]>()
    : [];
  const existingByNim = new Map(existingStudents.map((student) => [normalizeNim(student.nim), String(student._id)]));

  const rows = rawRows.map((rawRow, index) => {
    const rowNumber = index + 2;
    const parsed = studentImportRowSchema.safeParse(rawRow);
    const nim = String(rawRow.nim ?? "").trim();
    const nimKey = normalizeNim(nim);
    const errors = getErrorMessages(rawRow);

    if (nim && (nimCounts.get(nimKey) ?? 0) > 1) {
      errors.push("NIM duplikat di file import.");
    }

    return {
      rowNumber,
      data: parsed.success ? parsed.data : { ...rawRow, nim },
      isValid: parsed.success && errors.length === 0,
      exists: existingByNim.has(nimKey),
      existingStudentId: existingByNim.get(nimKey) ?? null,
      errors,
    };
  });

  return NextResponse.json({
    rows,
    summary: {
      total: rows.length,
      valid: rows.filter((row) => row.isValid).length,
      errors: rows.filter((row) => row.errors.length > 0).length,
      existing: rows.filter((row) => row.exists).length,
    },
  });
}
