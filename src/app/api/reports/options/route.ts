import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { reportReadRoles, requireApiRole } from "@/lib/api-auth";
import StudentBill from "@/models/StudentBill";
import Student from "@/models/Student";

export async function GET() {
  const auth = await requireApiRole(reportReadRoles);
  if (auth.response) {
    return auth.response;
  }

  await dbConnect();

  const [entryYears, programStudies, semesters] = await Promise.all([
    Student.distinct("entryYear"),
    Student.distinct("programStudy"),
    StudentBill.distinct("semester"),
  ]);

  return NextResponse.json({
    entryYears: entryYears.sort((a, b) => Number(b) - Number(a)),
    programStudies: programStudies.sort(),
    semesters: semesters.sort(),
    statuses: ["unpaid", "partial", "paid", "cancelled"],
  });
}
