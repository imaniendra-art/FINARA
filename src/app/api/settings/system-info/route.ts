import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import AppSetting from "@/models/AppSetting";
import JournalEntry from "@/models/JournalEntry";
import Payment from "@/models/Payment";
import Student from "@/models/Student";
import User from "@/models/User";

const systemInfoRoles = ["super_admin", "admin_bauk", "pimpinan", "auditor"] as const;

async function getOrCreateSetting() {
  const existing = await AppSetting.findOne({}).lean();

  if (existing) {
    return existing;
  }

  return AppSetting.create({});
}

export async function GET() {
  const auth = await requireApiRole([...systemInfoRoles]);
  if (auth.response) {
    return auth.response;
  }

  await dbConnect();

  const [setting, studentCount, userCount, paymentCount, journalCount] = await Promise.all([
    getOrCreateSetting(),
    Student.countDocuments(),
    User.countDocuments(),
    Payment.countDocuments(),
    JournalEntry.countDocuments(),
  ]);

  return NextResponse.json({
    system: {
      appName: setting.appName,
      appFullName: setting.appFullName,
      version: process.env.npm_package_version || "0.1.0",
      environment: process.env.NODE_ENV || "development",
      databaseStatus: "connected",
      counts: {
        students: studentCount,
        users: userCount,
        payments: paymentCount,
        journals: journalCount,
      },
    },
  });
}
