import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { z } from "zod";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import AcademicPeriod from "@/models/AcademicPeriod";
import Account from "@/models/Account";
import AuditLog from "@/models/AuditLog";
import CashTransaction from "@/models/CashTransaction";
import FeeType from "@/models/FeeType";
import JournalEntry from "@/models/JournalEntry";
import JournalLine from "@/models/JournalLine";
import Payment from "@/models/Payment";
import Student from "@/models/Student";
import StudentBill from "@/models/StudentBill";
import User from "@/models/User";

const resetRoles = ["super_admin"] as const;

const resetAllSchema = z.object({
  password: z.string().min(1, "Password wajib diisi"),
});

const resetCollections = [
  { key: "students", model: Student },
  { key: "accounts", model: Account },
  { key: "feeTypes", model: FeeType },
  { key: "studentBills", model: StudentBill },
  { key: "payments", model: Payment },
  { key: "cashTransactions", model: CashTransaction },
  { key: "journalEntries", model: JournalEntry },
  { key: "journalLines", model: JournalLine },
  { key: "academicPeriods", model: AcademicPeriod },
] as const;

function backupFileName() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return `finara-reset-backup-${timestamp}.json`;
}

export async function POST(request: Request) {
  const auth = await requireApiRole([...resetRoles]);
  if (auth.response) {
    return auth.response;
  }

  const parsed = resetAllSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Konfirmasi reset tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();

  const user = await User.findById(auth.session.user.id).select("name email password role isActive").lean();
  if (!user?.password || !user.isActive) {
    return NextResponse.json({ error: "Akun tidak valid untuk melakukan reset." }, { status: 403 });
  }

  const passwordMatches = await bcrypt.compare(parsed.data.password, user.password);
  if (!passwordMatches) {
    return NextResponse.json({ error: "Password tidak sesuai." }, { status: 401 });
  }

  const backupCollections = await Promise.all(
    resetCollections.map(async (collection) => ({
      key: collection.key,
      documents: await collection.model.find({}).lean(),
    }))
  );
  const backupData = Object.fromEntries(
    backupCollections.map((collection) => [collection.key, collection.documents])
  );
  const countsBefore = Object.fromEntries(
    backupCollections.map((collection) => [collection.key, collection.documents.length])
  );

  for (const collection of resetCollections) {
    await collection.model.collection.deleteMany({});
  }

  await AuditLog.create({
    userId: auth.session.user.id,
    action: "reset_all_operational_data",
    module: "Settings",
    documentId: auth.session.user.id,
    before: countsBefore,
    after: { backupGenerated: true, resetAt: new Date() },
  });

  const backup = {
    app: "FINARA",
    type: "reset_all_operational_data_backup",
    generatedAt: new Date().toISOString(),
    generatedBy: {
      id: auth.session.user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    note: "Backup dibuat otomatis sebelum reset data operasional. Akun pengguna, password, pengaturan aplikasi, dan audit log tidak disertakan.",
    counts: countsBefore,
    data: backupData,
  };

  return new Response(JSON.stringify(backup, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${backupFileName()}"`,
    },
  });
}
