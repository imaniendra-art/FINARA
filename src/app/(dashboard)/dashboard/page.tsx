"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  GraduationCap,
  Wallet,
  ReceiptText,
  BookText,
  CreditCard,
  ArrowRightLeft,
  WalletCards,
  BookOpen,
  Scale,
  BarChart3,
  Users,
  Settings,
  Calendar,
  PlusCircle,
  ArrowRight
} from "lucide-react";

import UserDashboard from "./UserDashboard";

type DashboardSummary = {
  totalCashBank: number;
  bankBalance: number;
  pettyCashBalance: number;
  monthIncome: number;
  monthExpense: number;
  totalReceivable: number;
  unpaidBillCount: number;
  monthPaymentCount: number;
  monthPaymentAmount: number;
  activeStudentCount: number;
};

type MonthlyChartItem = {
  key: string;
  label: string;
  income: number;
  expense: number;
};

type ReceivableStatusItem = {
  status: "unpaid" | "partial";
  total: number;
  count: number;
};

type PopulatedStudent = {
  nim?: string;
  name?: string;
};

type PopulatedFeeType = {
  name?: string;
};

type PopulatedAccount = {
  code?: string;
  name?: string;
};

type LatestPayment = {
  _id: string;
  paymentDate: string;
  amount: number;
  studentId?: PopulatedStudent;
};

type DueBill = {
  _id: string;
  academicYear: string;
  semester: string;
  dueDate: string;
  remainingAmount: number;
  studentId?: PopulatedStudent;
  feeTypeId?: PopulatedFeeType;
};

type LatestExpense = {
  _id: string;
  date: string;
  amount: number;
  description: string;
  accountId?: PopulatedAccount;
};

type DashboardData = {
  summary: DashboardSummary;
  charts: {
    monthly: MonthlyChartItem[];
    receivablesByStatus: ReceivableStatusItem[];
  };
  lists: {
    latestPayments: LatestPayment[];
    dueBills: DueBill[];
    latestExpenses: LatestExpense[];
  };
};

type AcademicPeriod = {
  _id: string;
  academicYear: string;
  semester: "ganjil" | "genap";
  isActive: boolean;
};

// All modules configuration for role-based cards
const ALL_MODULES = [
  { 
    title: "Mahasiswa", 
    icon: GraduationCap, 
    href: "/students", 
    caption: "Kelola data & NIM mahasiswa", 
    section: "master", 
    allowedRoles: ["super_admin", "admin_bauk", "staff_bauk"],
    color: "text-[#0284c7] bg-[#f0f9ff] dark:bg-sky-500/10 dark:text-sky-400",
  },
  { 
    title: "Kode Akun", 
    icon: Wallet, 
    href: "/accounts", 
    caption: "Bagan akun perkiraan (COA)", 
    section: "master", 
    allowedRoles: ["super_admin", "admin_bauk"],
    color: "text-[#0d9488] bg-[#f0fdfa] dark:bg-teal-500/10 dark:text-teal-400",
  },
  { 
    title: "Jenis Tagihan", 
    icon: ReceiptText, 
    href: "/fee-types", 
    caption: "Kategori tagihan semester", 
    section: "master", 
    allowedRoles: ["super_admin", "admin_bauk"],
    color: "text-[#ca8a04] bg-[#fefce8] dark:bg-yellow-500/10 dark:text-yellow-400",
  },
  { 
    title: "Tagihan Mahasiswa", 
    icon: BookText, 
    href: "/bills", 
    caption: "Distribusi tagihan kuliah", 
    section: "transaksi", 
    allowedRoles: ["super_admin", "admin_bauk", "staff_bauk"],
    color: "text-[#7c3aed] bg-[#faf5ff] dark:bg-purple-500/10 dark:text-purple-400",
  },
  { 
    title: "Pembayaran", 
    icon: CreditCard, 
    href: "/payments", 
    caption: "Registrasi pembayaran & kwitansi", 
    section: "transaksi", 
    allowedRoles: ["super_admin", "admin_bauk", "staff_bauk"],
    color: "text-[#2563eb] bg-[#eff6ff] dark:bg-blue-500/10 dark:text-blue-400",
  },
  { 
    title: "Kas Masuk/Keluar", 
    icon: ArrowRightLeft, 
    href: "/cash-transactions", 
    caption: "Pencatatan kas operasional", 
    section: "transaksi", 
    allowedRoles: ["super_admin", "admin_bauk", "staff_bauk"],
    color: "text-[#0891b2] bg-[#ecfeff] dark:bg-cyan-500/10 dark:text-cyan-400",
  },
  { 
    title: "Jurnal Umum", 
    icon: BookOpen, 
    href: "/journals", 
    caption: "Daftar entri jurnal penyesuaian", 
    section: "transaksi", 
    allowedRoles: ["super_admin", "admin_bauk", "staff_bauk", "auditor"],
    color: "text-[#ea580c] bg-[#fff7ed] dark:bg-orange-500/10 dark:text-orange-400",
  },
  {
    title: "Permintaan Anggaran",
    icon: WalletCards,
    href: "/budget-requests",
    caption: "Pengajuan, approval, pencairan, dan LPJ",
    section: "anggaran",
    allowedRoles: ["super_admin", "admin_bauk", "staff_bauk", "unit", "tendik", "dosen", "organisasi", "pimpinan", "auditor"],
    color: "text-[#047857] bg-[#ecfdf5] dark:bg-emerald-500/10 dark:text-emerald-400",
  },
  {
    title: "Keuangan PMB",
    icon: WalletCards,
    href: "/pmb-finance",
    caption: "Integrasi Aplikasi PMB STIMI",
    section: "anggaran",
    allowedRoles: ["super_admin", "admin_bauk", "pimpinan", "auditor"],
    color: "text-[#0369a1] bg-[#e0f2fe] dark:bg-sky-500/10 dark:text-sky-400",
  },
  {
    title: "Keuangan Wisuda",
    icon: WalletCards,
    href: "/wisuda-finance",
    caption: "Integrasi Aplikasi PANDAWA",
    section: "anggaran",
    allowedRoles: ["super_admin", "admin_bauk", "pimpinan", "auditor"],
    color: "text-[#6d28d9] bg-[#ede9fe] dark:bg-violet-500/10 dark:text-violet-400",
  },
  { 
    title: "Laporan Keuangan", 
    icon: BarChart3, 
    href: "/income-statement", 
    caption: "Ekspor neraca dan laba rugi", 
    section: "laporan", 
    allowedRoles: ["super_admin", "admin_bauk", "pimpinan", "auditor"],
    color: "text-[#b91c1c] bg-[#fef2f2] dark:bg-red-500/10 dark:text-red-400",
  },
  { 
    title: "Buku Besar", 
    icon: BookOpen, 
    href: "/ledger", 
    caption: "Rincian mutasi per akun perkiraan", 
    section: "laporan", 
    allowedRoles: ["super_admin", "admin_bauk", "pimpinan", "auditor"],
    color: "text-[#be185d] bg-[#fdf2f8] dark:bg-pink-500/10 dark:text-pink-400",
  },
  { 
    title: "Neraca Saldo", 
    icon: Scale, 
    href: "/trial-balance", 
    caption: "Keseimbangan saldo debit kredit", 
    section: "laporan", 
    allowedRoles: ["super_admin", "admin_bauk", "pimpinan", "auditor"],
    color: "text-[#4f46e5] bg-[#eef2ff] dark:bg-indigo-500/10 dark:text-indigo-400",
  },
  { 
    title: "User & Role", 
    icon: Users, 
    href: "/users", 
    caption: "Manajemen hak akses admin", 
    section: "sistem", 
    allowedRoles: ["super_admin"],
    color: "text-[#15803d] bg-[#f0fdf4] dark:bg-green-500/10 dark:text-green-400",
  },
  { 
    title: "Pengaturan", 
    icon: Settings, 
    href: "/settings", 
    caption: "Profil kampus & nomor kwitansi", 
    section: "sistem", 
    allowedRoles: ["super_admin", "admin_bauk", "pimpinan"],
    color: "text-[#4b5563] bg-[#f9fafb] dark:bg-slate-500/10 dark:text-slate-400",
  },
];

const emptySummary: DashboardSummary = {
  totalCashBank: 0,
  bankBalance: 0,
  pettyCashBalance: 0,
  monthIncome: 0,
  monthExpense: 0,
  totalReceivable: 0,
  unpaidBillCount: 0,
  monthPaymentCount: 0,
  monthPaymentAmount: 0,
  activeStudentCount: 0,
};

const statusLabels: Record<ReceivableStatusItem["status"], string> = {
  unpaid: "Belum Bayar",
  partial: "Sebagian Bayar",
};

const statusColors: Record<ReceivableStatusItem["status"], { color: string; bg: string }> = {
  unpaid: { color: "#be123c", bg: "#fff1f2" },
  partial: { color: "#b45309", bg: "#fff4df" },
};

async function fetchDashboard() {
  const response = await fetch("/api/dashboard", { cache: "no-store" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Dashboard tidak dapat dimuat.");
  }
  return response.json() as Promise<DashboardData>;
}

async function fetchAcademicPeriods() {
  const response = await fetch("/api/academic-periods");
  if (!response.ok) return [];
  const data = await response.json();
  return (data.periods || []) as AcademicPeriod[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function EmptyLine({ label }: { label: string }) {
  return <p className="text-xs text-slate-400 font-medium">{label}</p>;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role || "";
  const canReadFinanceDashboard = ["super_admin", "admin_bauk", "staff_bauk", "pimpinan", "auditor"].includes(userRole);

  // Dashboard primary queries
  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    enabled: canReadFinanceDashboard,
  });

  // Academic Period queries for dynamic status
  const periodsQuery = useQuery({
    queryKey: ["academic-periods"],
    queryFn: fetchAcademicPeriods,
    enabled: canReadFinanceDashboard,
  });

  const dashboard = dashboardQuery.data;
  const summary = dashboard?.summary ?? emptySummary;
  const monthlyData = dashboard?.charts.monthly ?? [];
  const receivableStatus = dashboard?.charts.receivablesByStatus ?? [];
  const maxMonthlyAmount = Math.max(1, ...monthlyData.flatMap((item) => [item.income, item.expense]));
  const receivableTotalCount = receivableStatus.reduce((total, item) => total + item.count, 0);

  // Determine active period dynamically
  const activePeriod = periodsQuery.data?.find((p) => p.isActive);

  // Filter main menu cards dynamically based on user role
  const filteredModules = useMemo(() => {
    return ALL_MODULES.filter((module) => module.allowedRoles.includes(userRole));
  }, [userRole]);

  if (session && !canReadFinanceDashboard) {
    return <UserDashboard session={session} />;
  }

  // Split modules into categorized lists for clean groups
  const masterModules = filteredModules.filter((m) => m.section === "master");
  const transactionModules = filteredModules.filter((m) => m.section === "transaksi");
  const budgetModules = filteredModules.filter((m) => m.section === "anggaran");
  const reportModules = filteredModules.filter((m) => m.section === "laporan");
  const systemModules = filteredModules.filter((m) => m.section === "sistem");

  return (
    <div className="space-y-8">
      {/* 1. Executive finance hero */}
      <section className="relative overflow-hidden rounded-[32px] bg-white dark:bg-slate-900 p-5 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-sm md:p-7">
        
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:items-center">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-900/10 px-4 py-2 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {activePeriod ? `TA ${activePeriod.academicYear} - ${activePeriod.semester === "ganjil" ? "Ganjil" : "Genap"}` : "Periode akademik belum aktif"}
                </span>
              </div>
              <div className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                Dashboard BAUK
              </div>
            </div>

            <div className="max-w-3xl space-y-4">
              <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-900 dark:text-white md:text-5xl">
                Kendali kas, piutang, dan laporan dalam satu layar.
              </h1>
              <p className="max-w-2xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-300 md:text-lg">
                Selamat datang, {session?.user?.name || "Rekan FINARA"}. Fokus hari ini: pastikan saldo kas terbaca, arus masuk-keluar seimbang, dan tagihan aktif mudah ditindaklanjuti.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Kas Tersedia</p>
                <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{dashboardQuery.isLoading ? "..." : formatCompactCurrency(summary.totalCashBank)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-900/10 p-4">
                <p className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">Kas Masuk Bulan Ini</p>
                <p className="mt-2 text-xl font-black text-emerald-700 dark:text-emerald-400">{dashboardQuery.isLoading ? "..." : formatCompactCurrency(summary.monthIncome)}</p>
              </div>
              <div className="rounded-2xl border border-rose-200 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-900/10 p-4">
                <p className="text-xs font-bold uppercase text-rose-700 dark:text-rose-400">Kas Keluar Bulan Ini</p>
                <p className="mt-2 text-xl font-black text-rose-700 dark:text-rose-400">{dashboardQuery.isLoading ? "..." : formatCompactCurrency(summary.monthExpense)}</p>
              </div>
              <div className="rounded-2xl border border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10 p-4">
                <p className="text-xs font-bold uppercase text-amber-700 dark:text-amber-400">Piutang Aktif</p>
                <p className="mt-2 text-xl font-black text-amber-700 dark:text-amber-400">{dashboardQuery.isLoading ? "..." : formatCompactCurrency(summary.totalReceivable)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-5">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Visual Arus Kas</p>
                <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-white">Pemasukan vs Pengeluaran</h2>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
            </div>

            <div className="relative h-52 overflow-hidden rounded-3xl bg-slate-100 dark:bg-slate-950/35 p-5">
              <div className="absolute inset-x-5 top-1/2 h-px bg-slate-200 dark:bg-white/10" />
              <div className="absolute inset-y-5 left-1/2 w-px bg-slate-200 dark:bg-white/10" />
              <div className="absolute left-6 top-8 h-20 w-20 animate-pulse rounded-full border border-emerald-400/30 dark:border-emerald-300/30 bg-emerald-400/10 dark:bg-emerald-300/10" />
              <div className="absolute bottom-8 right-8 h-24 w-24 animate-pulse rounded-full border border-sky-400/25 dark:border-sky-300/25 bg-sky-400/10 dark:bg-sky-300/10 [animation-delay:450ms]" />

              <div className="relative z-10 flex h-full items-end gap-3">
                {[38, 68, 45, 82, 54, 74].map((height, index) => (
                  <div key={height + index} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-36 w-full items-end gap-1.5">
                      <div
                        className="w-full animate-[pulse_2.4s_ease-in-out_infinite] rounded-t-full bg-emerald-400 dark:bg-emerald-300"
                        style={{ height: `${height}%`, animationDelay: `${index * 120}ms` }}
                      />
                      <div
                        className="w-full animate-[pulse_2.8s_ease-in-out_infinite] rounded-t-full bg-rose-400/80 dark:bg-rose-300/70"
                        style={{ height: `${Math.max(18, height - 24)}%`, animationDelay: `${index * 160}ms` }}
                      />
                    </div>
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-white/45" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm font-bold">
              <div className="rounded-2xl bg-sky-50 dark:bg-sky-900/20 px-4 py-3 text-sky-700 dark:text-sky-100">
                <span className="block text-xs uppercase tracking-wide text-sky-600 dark:text-sky-300">Dana Bank</span>
                <span className="mt-1 block text-lg font-black text-sky-800 dark:text-sky-50">{dashboardQuery.isLoading ? "..." : formatCompactCurrency(summary.bankBalance)}</span>
              </div>
              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-emerald-700 dark:text-emerald-100">
                <span className="block text-xs uppercase tracking-wide text-emerald-600 dark:text-emerald-300">Kas Kecil / Cash</span>
                <span className="mt-1 block text-lg font-black text-emerald-800 dark:text-emerald-50">{dashboardQuery.isLoading ? "..." : formatCompactCurrency(summary.pettyCashBalance)}</span>
              </div>
            </div>
          </div>
        </div>

        {dashboardQuery.error && (
          <div className="mt-4 rounded-xl bg-rose-500/20 border border-rose-500/30 p-3 text-sm font-semibold text-rose-100">
            {dashboardQuery.error.message}
          </div>
        )}
      </section>

      {/* 2. Main Dashboard Workspace Layout */}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.85fr)]">
        
        {/* Left Column: Categorized Module Cards & Transaction Lists */}
        <div className="space-y-8">
          
          {/* Main workspace navigation (Categorized Card Menus) */}
          <div className="space-y-7 rounded-[32px] bg-card/70 dark:bg-slate-900/40 p-4 ring-1 ring-border sm:p-6">

            {/* 1. Transaksi BAUK Group */}
            {transactionModules.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200/70 pb-2">
                  1. Transaksi BAUK
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {transactionModules.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex min-h-[112px] items-center justify-between rounded-[24px] bg-card border border-border/80 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-border dark:hover:border-primary/50"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shrink-0 ${item.color}`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-base font-extrabold text-foreground group-hover:text-primary transition-colors leading-snug">
                              {item.title}
                            </h4>
                            <p className="text-sm text-muted-foreground font-medium mt-1 leading-snug">
                              {item.caption}
                            </p>
                          </div>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-accent group-hover:text-primary transition-colors shrink-0">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Transaksi Anggaran BAUK Group */}
            {budgetModules.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200/70 pb-2">
                  2. Transaksi Anggaran BAUK
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {budgetModules.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex min-h-[112px] items-center justify-between rounded-[24px] bg-card border border-border/80 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-border dark:hover:border-primary/50"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shrink-0 ${item.color}`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-base font-extrabold text-foreground group-hover:text-primary transition-colors leading-snug">
                              {item.title}
                            </h4>
                            <p className="text-sm text-muted-foreground font-medium mt-1 leading-snug">
                              {item.caption}
                            </p>
                          </div>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-accent group-hover:text-primary transition-colors shrink-0">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Laporan Keuangan Group */}
            {reportModules.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200/70 pb-2">
                  3. Laporan Keuangan
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {reportModules.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex min-h-[112px] items-center justify-between rounded-[24px] bg-card border border-border/80 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-border dark:hover:border-primary/50"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shrink-0 ${item.color}`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-base font-extrabold text-foreground group-hover:text-primary transition-colors leading-snug">
                              {item.title}
                            </h4>
                            <p className="text-sm text-muted-foreground font-medium mt-1 leading-snug">
                              {item.caption}
                            </p>
                          </div>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-accent group-hover:text-primary transition-colors shrink-0">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Master Data Group */}
            {masterModules.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200/70 pb-2">
                  4. Master Data
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {masterModules.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex min-h-[112px] items-center justify-between rounded-[24px] bg-card border border-border/80 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-border dark:hover:border-primary/50"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shrink-0 ${item.color}`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-base font-extrabold text-foreground group-hover:text-primary transition-colors leading-snug">
                              {item.title}
                            </h4>
                            <p className="text-sm text-muted-foreground font-medium mt-1 leading-snug">
                              {item.caption}
                            </p>
                          </div>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-accent group-hover:text-primary transition-colors shrink-0">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. Sistem & Kontrol Group */}
            {systemModules.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200/70 pb-2">
                  5. Sistem &amp; Kontrol
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {systemModules.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex min-h-[112px] items-center justify-between rounded-[24px] bg-card border border-border/80 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-border dark:hover:border-primary/50"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shrink-0 ${item.color}`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-base font-extrabold text-foreground group-hover:text-primary transition-colors leading-snug">
                              {item.title}
                            </h4>
                            <p className="text-sm text-muted-foreground font-medium mt-1 leading-snug">
                              {item.caption}
                            </p>
                          </div>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-accent group-hover:text-primary transition-colors shrink-0">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Quick Actions, Financial Charts, and Receivable Distributions */}
        <div className="space-y-6">
          
          {/* Quick Actions Panel */}
          <div className="rounded-[28px] bg-card p-6 border border-border shadow-sm">
            <div className="mb-5">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Aksi Cepat</span>
              <h3 className="mt-1 text-xl font-black text-card-foreground">Transaksi Kas</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Link
                href="/cash-transactions?action=create&type=cash_in"
                className="group flex min-h-[104px] items-center justify-between rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-5 text-emerald-900 transition hover:-translate-y-0.5 hover:bg-emerald-100 hover:shadow-md dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100 dark:hover:bg-emerald-500/20"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                    <PlusCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-black">Kas Masuk</p>
                    <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">Catat penerimaan dana</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-emerald-700 dark:text-emerald-400 transition group-hover:translate-x-1" />
              </Link>
 
              <Link
                href="/cash-transactions?action=create&type=cash_out"
                className="group flex min-h-[104px] items-center justify-between rounded-3xl border border-rose-200 bg-rose-50 px-5 py-5 text-rose-900 transition hover:-translate-y-0.5 hover:bg-rose-100 hover:shadow-md dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100 dark:hover:bg-rose-500/20"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-sm">
                    <PlusCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-black">Kas Keluar</p>
                    <p className="mt-1 text-sm font-semibold text-rose-700 dark:text-rose-400">Catat pembayaran operasional</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-rose-700 dark:text-rose-400 transition group-hover:translate-x-1" />
              </Link>
            </div>
          </div>

          {/* Polished MD3 Finance Trend Chart */}
          <div className="flex flex-col rounded-[28px] bg-card p-5 shadow-sm border border-border">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Tren Keuangan</span>
            <h3 className="mt-1 text-sm font-extrabold text-card-foreground">Pemasukan vs Pengeluaran</h3>
            <p className="text-[10px] text-muted-foreground font-medium">Rekapitulasi 6 bulan terakhir</p>

            <div className="mt-6 flex min-h-[140px] flex-1 items-end gap-2.5 px-2">
              {monthlyData.length ? (
                monthlyData.map((item) => (
                  <div key={item.key} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex w-full flex-1 items-end gap-1">
                      <div
                        className="flex-1 rounded-t-full bg-primary transition-all duration-300"
                        style={{ height: `${Math.max(4, (item.income / maxMonthlyAmount) * 100)}%` }}
                        title={`Pemasukan ${formatCurrency(item.income)}`}
                      />
                      <div
                        className="flex-1 rounded-t-full bg-rose-500/20 transition-all duration-300"
                        style={{ height: `${Math.max(4, (item.expense / maxMonthlyAmount) * 100)}%` }}
                        title={`Pengeluaran ${formatCurrency(item.expense)}`}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-muted-foreground mt-1">{item.label}</span>
                  </div>
                ))
              ) : (
                <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground py-10">
                  {dashboardQuery.isLoading ? "Memuat grafik..." : "Belum ada data grafik."}
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-4 border-t border-border pt-3 text-[10px] font-semibold">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                <span className="text-muted-foreground">Pemasukan</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="text-muted-foreground">Pengeluaran</span>
              </div>
            </div>
          </div>

          {/* Receivable Distribution Panel */}
          <div className="rounded-[28px] bg-card p-5 shadow-sm border border-border">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Distribusi Tagihan</span>
            <h3 className="mt-1 text-sm font-extrabold text-card-foreground">Piutang Berdasarkan Status</h3>

            <div className="mt-5 space-y-4">
              {receivableStatus.length ? (
                receivableStatus.map((item) => {
                  const colors = statusColors[item.status];
                  const percent = receivableTotalCount > 0 ? Math.round((item.count / receivableTotalCount) * 100) : 0;

                  return (
                    <div key={item.status} className="text-xs">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.color }} />
                          <span className="font-bold text-card-foreground">{statusLabels[item.status]}</span>
                        </div>
                        <div className="flex items-center gap-2 font-bold">
                          <span
                            className="rounded-full px-2 py-0.5 text-[9px]"
                            style={{ backgroundColor: colors.bg, color: colors.color }}
                          >
                            {item.count.toLocaleString("id-ID")} tagihan
                          </span>
                          <span className="text-muted-foreground">{percent}%</span>
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted border border-border">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${percent}%`, backgroundColor: colors.color }}
                        />
                      </div>
                      <p className="mt-1.5 text-[10px] font-bold text-muted-foreground">
                        {formatCurrency(item.total)}
                      </p>
                    </div>
                  );
                })
              ) : (
                <EmptyLine label={dashboardQuery.isLoading ? "Memuat..." : "Tidak ada piutang aktif."} />
              )}
            </div>

            {/* Total Active Receivables Footer block */}
            <div className="mt-5 rounded-2xl bg-muted px-4 py-3.5 border border-border">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-bold text-muted-foreground">Total piutang aktif</span>
                <span className="font-extrabold text-foreground text-sm">{formatCurrency(summary.totalReceivable)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
