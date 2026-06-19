import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
export { userRoles, type UserRole } from "@/lib/roles";
import { UserRole } from "@/lib/roles";

export const dashboardRoles: UserRole[] = [
  "super_admin",
  "admin_bauk",
  "staff_bauk",
  "unit",
  "tendik",
  "dosen",
  "mahasiswa",
  "organisasi",
  "pimpinan",
  "auditor",
];

export const reportRoles: UserRole[] = [
  "super_admin",
  "admin_bauk",
  "pimpinan",
  "auditor",
];

export const receiptRoles: UserRole[] = ["super_admin", "admin_bauk", "staff_bauk"];

export async function getRequiredSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.role) {
    redirect("/login");
  }

  return session;
}

export async function requireRole(allowedRoles: UserRole[]) {
  const session = await getRequiredSession();

  if (!allowedRoles.includes(session.user.role as UserRole)) {
    redirect("/login");
  }

  return session;
}
