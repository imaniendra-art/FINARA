import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { appSettingInputSchema } from "@/lib/validation";
import AppSetting from "@/models/AppSetting";
import AuditLog from "@/models/AuditLog";

const settingsReadRoles = ["super_admin", "admin_bauk", "pimpinan"] as const;
const settingsWriteRoles = ["super_admin", "admin_bauk"] as const;

async function getOrCreateSetting() {
  const existing = await AppSetting.findOne({}).lean();

  if (existing) {
    return existing;
  }

  return AppSetting.create({});
}

export async function GET() {
  const auth = await requireApiRole([...settingsReadRoles]);
  if (auth.response) {
    return auth.response;
  }

  await dbConnect();

  const setting = await getOrCreateSetting();

  return NextResponse.json({ setting });
}

export async function PATCH(request: Request) {
  const auth = await requireApiRole([...settingsWriteRoles]);
  if (auth.response) {
    return auth.response;
  }

  const parsed = appSettingInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data pengaturan tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();

  const before = await getOrCreateSetting();
  const setting = await AppSetting.findByIdAndUpdate(
    before._id,
    { $set: parsed.data },
    { returnDocument: "after", runValidators: true }
  );

  await AuditLog.create({
    userId: auth.session.user.id,
    action: "update_settings",
    module: "AppSetting",
    documentId: before._id,
    before,
    after: setting,
  });

  return NextResponse.json({ setting });
}
