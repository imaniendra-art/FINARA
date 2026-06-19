"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

// Mapping of paths to friendly Indonesian labels
const pathMap: Record<string, string> = {
  dashboard: "Dashboard",
  students: "Mahasiswa",
  accounts: "Kode Akun",
  "fee-types": "Jenis Tagihan",
  bills: "Tagihan Mahasiswa",
  payments: "Pembayaran",
  "cash-transactions": "Kas Masuk & Keluar",
  journals: "Jurnal Umum",
  ledger: "Buku Besar",
  "trial-balance": "Neraca Saldo",
  reports: "Laporan Keuangan",
  users: "User & Role",
  settings: "Pengaturan",
};

export function Breadcrumb() {
  const pathname = usePathname();

  // If we are on the dashboard itself, we don't need a deep breadcrumb
  if (pathname === "/dashboard" || pathname === "/") {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className="mb-5 flex w-fit items-center space-x-1.5 rounded-2xl border border-white/70 bg-white/70 px-4 py-2 text-xs font-bold text-slate-500 shadow-xs backdrop-blur-xl">
      <Link
        href="/dashboard"
        className="flex items-center gap-1.5 hover:text-primary transition-colors duration-150"
      >
        <Home className="w-4 h-4" />
        <span>Beranda</span>
      </Link>

      {segments.map((segment, index) => {
        const url = `/${segments.slice(0, index + 1).join("/")}`;
        const isLast = index === segments.length - 1;
        const label = pathMap[segment] || segment.replace(/-/g, " ");

        return (
          <div key={url} className="flex items-center space-x-1.5">
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            {isLast ? (
              <span className="font-bold text-slate-800 capitalize">{label}</span>
            ) : (
              <Link
                href={url}
                className="hover:text-primary transition-colors duration-150 capitalize"
              >
                {label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
