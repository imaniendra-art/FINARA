import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { objectIdSchema } from "@/lib/validation";
import AcademicPeriod from "@/models/AcademicPeriod";
import AuditLog from "@/models/AuditLog";

const academicPeriodWriteRoles = ["super_admin", "admin_bauk"] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireApiRole([...academicPeriodWriteRoles]);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "ID tahun akademik tidak valid." }, { status: 400 });
  }

  await dbConnect();

  const dbSession = await mongoose.startSession();

  try {
    const result = await dbSession.withTransaction(async () => {
      const before = await AcademicPeriod.findById(parsedId.data).session(dbSession).lean();
      if (!before) {
        throw new Error("Tahun akademik tidak ditemukan.");
      }

      await AcademicPeriod.updateMany({}, { $set: { isActive: false } }, { session: dbSession });
      const period = await AcademicPeriod.findByIdAndUpdate(
        parsedId.data,
        { $set: { isActive: true } },
        { returnDocument: "after", runValidators: true, session: dbSession }
      );

      await AuditLog.create(
        [
          {
            userId: auth.session.user.id,
            action: "set_active_academic_period",
            module: "AcademicPeriod",
            documentId: parsedId.data,
            before,
            after: period,
          },
        ],
        { session: dbSession, ordered: true }
      );

      return { period };
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Tahun akademik aktif gagal diperbarui." },
      { status: 400 }
    );
  } finally {
    await dbSession.endSession();
  }
}
