"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
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
  { title: "Permintaan Anggaran", href: "/budget-requests", icon: WalletCards, allowedRoles: ["super_admin", "admin_bauk", "staff_bauk", "unit", "tendik", "dosen", "organisasi", "pimpinan", "auditor"] },
  { title: "Laporan", href: "/reports", icon: BarChart3, allowedRoles: ["super_admin", "admin_bauk", "pimpinan", "auditor"] },
  { title: "User & Role", href: "/users", icon: Users, allowedRoles: ["super_admin"] },
  { title: "Pengaturan", href: "/settings", icon: Settings, allowedRoles: ["super_admin", "admin_bauk"] },
] satisfies NavItem[];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "";
  const visibleNavItems = navItems.filter((item) => !item.allowedRoles || item.allowedRoles.includes(userRole));

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen hidden md:flex border-r border-slate-800">
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center font-bold text-lg">
            F
          </div>
          <span className="font-bold text-xl tracking-tight">FINARA</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-md transition-colors text-sm sm:text-base font-medium",
                  isActive 
                    ? "bg-blue-600 text-white" 
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="text-sm text-slate-500">
          STIMI YAPMI Makassar &copy; {new Date().getFullYear()}
        </div>
      </div>
    </aside>
  );
}
