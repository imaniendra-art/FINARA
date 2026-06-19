import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { financeReadRoles, requireApiRole } from "@/lib/api-auth";
import StudentBill from "@/models/StudentBill";
import Student from "@/models/Student";
import FeeType from "@/models/FeeType";

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(financeReadRoles);
  if (auth.response) {
    return auth.response;
  }

  await dbConnect();

  const searchParams = request.nextUrl.searchParams;
  const entryYear = searchParams.get("entryYear");
  const semester = searchParams.get("semester");

  const studentFilter: Record<string, unknown> = {
    biayaPendidikan: "KIP",
  };

  if (entryYear) {
    studentFilter.entryYear = Number(entryYear);
  }

  // Ensure FeeType model is registered in Mongoose schema registry before populating
  if (!FeeType.modelName) {
    throw new Error("FeeType model not registered");
  }
  const students = await Student.find(studentFilter).select("_id").lean();
  const studentIds = students.map((student) => student._id);

  const billFilter: Record<string, unknown> = {
    studentId: { $in: studentIds },
    status: { $in: ["unpaid", "partial"] },
  };

  if (semester) {
    billFilter.semester = semester;
  }

  const bills = await StudentBill.find(billFilter)
    .populate("studentId", "nim name entryYear programStudy")
    .populate("feeTypeId", "name")
    .sort({ dueDate: 1 })
    .lean();

  return NextResponse.json({ bills });
}
