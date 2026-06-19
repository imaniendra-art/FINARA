import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { academicPeriodInputSchema } from "@/lib/validation";
import AcademicPeriod from "@/models/AcademicPeriod";
import AuditLog from "@/models/AuditLog";

const academicPeriodReadRoles = ["super_admin", "admin_bauk"] as const;
const academicPeriodWriteRoles = ["super_admin", "admin_bauk"] as const;

export async function GET() {
  const auth = await requireApiRole([...academicPeriodReadRoles]);
  if (auth.response) {
    return auth.response;
  }

  await dbConnect();

  const periods = await AcademicPeriod.find({}).sort({ academicYear: -1, semester: 1 }).lean();

  return NextResponse.json({ periods });
}

export async function POST(request: Request) {
  const auth = await requireApiRole([...academicPeriodWriteRoles]);
  if (auth.response) {
    return auth.response;
  }

  const parsed = academicPeriodInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data tahun akademik tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();

  const dbSession = await mongoose.startSession();

  try {
    const result = await dbSession.withTransaction(async () => {
      if (parsed.data.isActive) {
        await AcademicPeriod.updateMany({}, { $set: { isActive: false } }, { session: dbSession });
      }

      const [period] = await AcademicPeriod.create([parsed.data], { session: dbSession, ordered: true });

      await AuditLog.create(
        [
          {
            userId: auth.session.user.id,
            action: "create_academic_period",
            module: "AcademicPeriod",
            documentId: period._id,
            before: null,
            after: period,
          },
        ],
        { session: dbSession, ordered: true }
      );

      return { period };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json({ error: "Tahun akademik dan semester sudah ada." }, { status: 409 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Tahun akademik gagal disimpan." },
      { status: 400 }
    );
  } finally {
    await dbSession.endSession();
  }
}
