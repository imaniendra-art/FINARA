export const userRoles = [
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
] as const;

export type UserRole = (typeof userRoles)[number];

export const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin_bauk: "Admin BAUK",
  staff_bauk: "Staff BAUK",
  unit: "Unit",
  tendik: "Tendik",
  dosen: "Dosen",
  mahasiswa: "Mahasiswa",
  organisasi: "Organisasi",
  pimpinan: "Pimpinan",
  auditor: "Auditor",
};

export const budgetRequesterRoles: UserRole[] = [
  "super_admin",
  "admin_bauk",
  "staff_bauk",
  "unit",
  "tendik",
  "dosen",
  "organisasi",
];

export function isBudgetRequesterRole(role?: string) {
  if (!role) return false;
  return budgetRequesterRoles.includes(role as UserRole);
}
