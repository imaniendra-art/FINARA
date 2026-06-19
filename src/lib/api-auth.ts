import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@/lib/rbac";

export async function requireApiRole(allowedRoles: UserRole[]) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.role) {
    return {
      response: NextResponse.json({ error: "Sesi tidak valid. Silakan login ulang." }, { status: 401 }),
      session: null,
    };
  }

  if (!allowedRoles.includes(session.user.role as UserRole)) {
    return {
      response: NextResponse.json({ error: "Anda tidak memiliki akses untuk aksi ini." }, { status: 403 }),
      session: null,
    };
  }

  return { response: null, session };
}

export const financeWriteRoles: UserRole[] = ["super_admin", "admin_bauk", "staff_bauk"];
export const masterDataWriteRoles: UserRole[] = ["super_admin", "admin_bauk"];
export const financeReadRoles: UserRole[] = [
  "super_admin",
  "admin_bauk",
  "staff_bauk",
  "pimpinan",
  "auditor",
];
export const reportReadRoles: UserRole[] = [
  "super_admin",
  "admin_bauk",
  "pimpinan",
  "auditor",
];
export const receiptPrintRoles: UserRole[] = ["super_admin", "admin_bauk", "staff_bauk"];
