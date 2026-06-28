"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  Wallet, 
  ReceiptText,
  CreditCard,
  ArrowRightLeft,
  WalletCards,
  BookOpen,
  BookText,
  BarChart3,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
  allowedRoles?: string[];
};

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Mahasiswa", href: "/students", icon: GraduationCap, allowedRoles: ["super_admin", "admin_bauk", "staff_bauk"] },
  { title: "Kode Akun", href: "/accounts", icon: Wallet, allowedRoles: ["super_admin", "admin_bauk"] },
  { title: "Jenis Tagihan", href: "/fee-types", icon: ReceiptText, allowedRoles: ["super_admin", "admin_bauk"] },
  { title: "Tagihan Mahasiswa", href: "/bills", icon: BookText, allowedRoles: ["super_admin", "admin_bauk", "staff_bauk"] },
  { title: "Pembayaran", href: "/payments", icon: CreditCard, allowedRoles: ["super_admin", "admin_bauk", "staff_bauk"] },
  { title: "Kas Masuk/Keluar", href: "/cash-transactions", icon: ArrowRightLeft, allowedRoles: ["super_admin", "admin_bauk", "staff_bauk"] },
  { title: "Jurnal Umum", href: "/journals", icon: BookOpen, allowedRoles: ["super_admin", "admin_bauk", "staff_bauk", "auditor"] },
  { title: "Buku Besar", href: "/ledger", icon: BookOpen, allowedRoles: ["super_admin", "admin_bauk", "pimpinan", "auditor"] },
  { title: "Neraca Saldo", href: "/trial-balance", icon: BookOpen, allowedRoles: ["super_admin", "admin_bauk", "pimpinan", "auditor"] },
  { title: "KASPRO", href: "/budget-requests", icon: WalletCards, allowedRoles: ["super_admin", "admin_bauk", "staff_bauk", "unit", "tendik", "dosen", "organisasi", "pimpinan", "auditor"] },
  { title: "PMB STIMI", href: "/pmb-finance", icon: WalletCards, allowedRoles: ["super_admin", "admin_bauk", "pimpinan", "auditor"] },
  { title: "PANDAWA", href: "/wisuda-finance", icon: WalletCards, allowedRoles: ["super_admin", "admin_bauk", "pimpinan", "auditor"] },
  { title: "Laporan", href: "/reports", icon: BarChart3, allowedRoles: ["super_admin", "admin_bauk", "pimpinan", "auditor"] },
  { title: "User & Role", href: "/users", icon: Users, allowedRoles: ["super_admin"] },
  { title: "Pengaturan", href: "/settings", icon: Settings, allowedRoles: ["super_admin", "admin_bauk"] },
] satisfies NavItem[];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "";
  const visibleNavItems = navItems.filter((item) => !item.allowedRoles || item.allowedRoles.includes(userRole));

  const { data: pendingData } = useQuery({
    queryKey: ["kaspro-pending-count"],
    queryFn: async () => {
      const res = await fetch("/api/kaspro-requests/pending-count");
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    refetchInterval: 15000, // Check every 15 seconds
  });
  const pendingCount = pendingData?.count || 0;

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col h-screen border-r border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800">
        {/* Branding dihapus dari sini untuk menghindari duplikasi dengan header utama */}
      </div>
      
      <div className="flex-1 overflow-y-auto py-3">
        <nav className="space-y-0.5 px-3">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-xs sm:text-[13px] font-medium",
                  isActive 
                    ? "bg-blue-50 text-blue-700 dark:bg-[#1b3d5f] dark:text-white font-bold" 
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#132c47]"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1">{item.title}</span>
                {item.title === "KASPRO" && pendingCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 min-w-5 text-center">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-6 mt-auto">
        <div className="text-sm text-slate-900 dark:text-white text-center">
          STIMI YAPMI Makassar &copy; {new Date().getFullYear()}
        </div>
      </div>
    </aside>
  );
}
