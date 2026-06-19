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
    color: "text-[#0284c7] bg-[#f0f9ff]",
  },
  { 
    title: "Kode Akun", 
    icon: Wallet, 
    href: "/accounts", 
    caption: "Bagan akun perkiraan (COA)", 
    section: "master", 
    allowedRoles: ["super_admin", "admin_bauk"],
    color: "text-[#0d9488] bg-[#f0fdfa]",
  },
  { 
    title: "Jenis Tagihan", 
    icon: ReceiptText, 
    href: "/fee-types", 
    caption: "Kategori tagihan semester", 
    section: "master", 
    allowedRoles: ["super_admin", "admin_bauk"],
    color: "text-[#ca8a04] bg-[#fefce8]",
  },
  { 
    title: "Tagihan Mahasiswa", 
    icon: BookText, 
    href: "/bills", 
    caption: "Distribusi tagihan kuliah", 
    section: "transaksi", 
    allowedRoles: ["super_admin", "admin_bauk", "staff_bauk"],
    color: "text-[#7c3aed] bg-[#faf5ff]",
  },
  { 
    title: "Pembayaran", 
    icon: CreditCard, 
    href: "/payments", 
    caption: "Registrasi pembayaran & kwitansi", 
    section: "transaksi", 
    allowedRoles: ["super_admin", "admin_bauk", "staff_bauk"],
    color: "text-[#2563eb] bg-[#eff6ff]",
  },
  { 
    title: "Kas Masuk/Keluar", 
    icon: ArrowRightLeft, 
    href: "/cash-transactions", 
    caption: "Pencatatan kas operasional", 
    section: "transaksi", 
    allowedRoles: ["super_admin", "admin_bauk", "staff_bauk"],
    color: "text-[#0891b2] bg-[#ecfeff]",
  },
  { 
    title: "Jurnal Umum", 
    icon: BookOpen, 
    href: "/journals", 
    caption: "Daftar entri jurnal penyesuaian", 
    section: "transaksi", 
    allowedRoles: ["super_admin", "admin_bauk", "staff_bauk", "auditor"],
    color: "text-[#ea580c] bg-[#fff7ed]",
  },
  {
    title: "Permintaan Anggaran",
    icon: WalletCards,
    href: "/budget-requests",
    caption: "Pengajuan, approval, pencairan, dan LPJ",
    section: "anggaran",
    allowedRoles: ["super_admin", "admin_bauk", "staff_bauk", "unit", "tendik", "dosen", "organisasi", "pimpinan", "auditor"],
    color: "text-[#047857] bg-[#ecfdf5]",
  },
  { 
    title: "Laporan Keuangan", 
    icon: BarChart3, 
    href: "/reports", 
    caption: "Ekspor neraca dan laba rugi", 
    section: "laporan", 
    allowedRoles: ["super_admin", "admin_bauk", "pimpinan", "auditor"],
    color: "text-[#b91c1c] bg-[#fef2f2]",
  },
  { 
    title: "Buku Besar", 
    icon: BookOpen, 
    href: "/ledger", 
    caption: "Rincian mutasi per akun perkiraan", 
    section: "laporan", 
    allowedRoles: ["super_admin", "admin_bauk", "pimpinan", "auditor"],
    color: "text-[#be185d] bg-[#fdf2f8]",
  },
  { 
    title: "Neraca Saldo", 
    icon: Scale, 
    href: "/trial-balance", 
    caption: "Keseimbangan saldo debit kredit", 
    section: "laporan", 
    allowedRoles: ["super_admin", "admin_bauk", "pimpinan", "auditor"],
    color: "text-[#4f46e5] bg-[#eef2ff]",
  },
  { 
    title: "User & Role", 
    icon: Users, 
    href: "/users", 
    caption: "Manajemen hak akses admin", 
    section: "sistem", 
    allowedRoles: ["super_admin"],
    color: "text-[#15803d] bg-[#f0fdf4]",
  },
  { 
    title: "Pengaturan", 
    icon: Settings, 
    href: "/settings", 
    caption: "Profil kampus & nomor kwitansi", 
    section: "sistem", 
    allowedRoles: ["super_admin", "admin_bauk", "pimpinan"],
    color: "text-[#4b5563] bg-[#f9fafb]",
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
      <section className="relative overflow-hidden rounded-[32px] bg-[#0f2942] p-5 text-white shadow-[0_18px_48px_-18px_rgba(15,41,66,0.65)] md:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-white/30" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-40 w-72 bg-[radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.18),transparent_65%)]" />

        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:items-center">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-extrabold text-emerald-100 backdrop-blur">
                <Calendar className="h-4 w-4 text-emerald-300" />
                <span>
                  {activePeriod ? `TA ${activePeriod.academicYear} - ${activePeriod.semester === "ganjil" ? "Ganjil" : "Genap"}` : "Periode akademik belum aktif"}
                </span>
              </div>
              <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-slate-200">
                Dashboard BAUK
              </div>
            </div>

            <div className="max-w-3xl space-y-4">
              <h1 className="text-3xl font-black leading-tight tracking-tight text-white md:text-5xl">
                Kendali kas, piutang, dan laporan dalam satu layar.
              </h1>
              <p className="max-w-2xl text-base font-medium leading-relaxed text-slate-200 md:text-lg">
                Selamat datang, {session?.user?.name || "Rekan FINARA"}. Fokus hari ini: pastikan saldo kas terbaca, arus masuk-keluar seimbang, dan tagihan aktif mudah ditindaklanjuti.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-bold uppercase text-slate-300">Kas Tersedia</p>
                <p className="mt-2 text-xl font-black text-white">{dashboardQuery.isLoading ? "..." : formatCompactCurrency(summary.totalCashBank)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 backdrop-blur">
                <p className="text-xs font-bold uppercase text-emerald-100">Kas Masuk Bulan Ini</p>
                <p className="mt-2 text-xl font-black text-emerald-100">{dashboardQuery.isLoading ? "..." : formatCompactCurrency(summary.monthIncome)}</p>
              </div>
              <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 backdrop-blur">
                <p className="text-xs font-bold uppercase text-rose-100">Kas Keluar Bulan Ini</p>
                <p className="mt-2 text-xl font-black text-rose-100">{dashboardQuery.isLoading ? "..." : formatCompactCurrency(summary.monthExpense)}</p>
              </div>
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 backdrop-blur">
                <p className="text-xs font-bold uppercase text-amber-100">Piutang Aktif</p>
                <p className="mt-2 text-xl font-black text-amber-100">{dashboardQuery.isLoading ? "..." : formatCompactCurrency(summary.totalReceivable)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-white/[0.08] p-5 backdrop-blur-md">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-300">Visual Arus Kas</p>
                <h2 className="mt-1 text-lg font-black text-white">Pemasukan vs Pengeluaran</h2>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#0f2942]">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
            </div>

            <div className="relative h-52 overflow-hidden rounded-3xl bg-slate-950/35 p-5">
              <div className="absolute inset-x-5 top-1/2 h-px bg-white/10" />
              <div className="absolute inset-y-5 left-1/2 w-px bg-white/10" />
              <div className="absolute left-6 top-8 h-20 w-20 animate-pulse rounded-full border border-emerald-300/30 bg-emerald-300/10" />
              <div className="absolute bottom-8 right-8 h-24 w-24 animate-pulse rounded-full border border-sky-300/25 bg-sky-300/10 [animation-delay:450ms]" />

              <div className="relative z-10 flex h-full items-end gap-3">
                {[38, 68, 45, 82, 54, 74].map((height, index) => (
                  <div key={height + index} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-36 w-full items-end gap-1.5">
                      <div
                        className="w-full animate-[pulse_2.4s_ease-in-out_infinite] rounded-t-full bg-emerald-300"
                        style={{ height: `${height}%`, animationDelay: `${index * 120}ms` }}
                      />
                      <div
                        className="w-full animate-[pulse_2.8s_ease-in-out_infinite] rounded-t-full bg-rose-300/70"
                        style={{ height: `${Math.max(18, height - 24)}%`, animationDelay: `${index * 160}ms` }}
                      />
                    </div>
                    <span className="h-1.5 w-1.5 rounded-full bg-white/45" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm font-bold">
              <div className="rounded-2xl bg-sky-300/10 px-4 py-3 text-sky-100">
                <span className="block text-xs uppercase tracking-wide text-sky-200/80">Dana Bank</span>
                <span className="mt-1 block text-lg font-black">{dashboardQuery.isLoading ? "..." : formatCompactCurrency(summary.bankBalance)}</span>
              </div>
              <div className="rounded-2xl bg-emerald-300/10 px-4 py-3 text-emerald-100">
                <span className="block text-xs uppercase tracking-wide text-emerald-200/80">Kas Kecil / Cash</span>
                <span className="mt-1 block text-lg font-black">{dashboardQuery.isLoading ? "..." : formatCompactCurrency(summary.pettyCashBalance)}</span>
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
          <div className="space-y-7 rounded-[32px] bg-white/70 p-4 ring-1 ring-slate-100 sm:p-6">

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
                        className="group flex min-h-[112px] items-center justify-between rounded-[24px] bg-white border border-slate-200/80 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shrink-0 ${item.color}`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-base font-extrabold text-slate-900 group-hover:text-primary transition-colors leading-snug">
                              {item.title}
                            </h4>
                            <p className="text-sm text-slate-500 font-medium mt-1 leading-snug">
                              {item.caption}
                            </p>
                          </div>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-primary transition-colors shrink-0">
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
                        className="group flex min-h-[112px] items-center justify-between rounded-[24px] bg-white border border-slate-200/80 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shrink-0 ${item.color}`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-base font-extrabold text-slate-900 group-hover:text-primary transition-colors leading-snug">
                              {item.title}
                            </h4>
                            <p className="text-sm text-slate-500 font-medium mt-1 leading-snug">
                              {item.caption}
                            </p>
                          </div>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-primary transition-colors shrink-0">
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
                        className="group flex min-h-[112px] items-center justify-between rounded-[24px] bg-white border border-slate-200/80 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shrink-0 ${item.color}`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-base font-extrabold text-slate-900 group-hover:text-primary transition-colors leading-snug">
                              {item.title}
                            </h4>
                            <p className="text-sm text-slate-500 font-medium mt-1 leading-snug">
                              {item.caption}
                            </p>
                          </div>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-primary transition-colors shrink-0">
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
                        className="group flex min-h-[112px] items-center justify-between rounded-[24px] bg-white border border-slate-200/80 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shrink-0 ${item.color}`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-base font-extrabold text-slate-900 group-hover:text-primary transition-colors leading-snug">
                              {item.title}
                            </h4>
                            <p className="text-sm text-slate-500 font-medium mt-1 leading-snug">
                              {item.caption}
                            </p>
                          </div>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-primary transition-colors shrink-0">
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
                        className="group flex min-h-[112px] items-center justify-between rounded-[24px] bg-white border border-slate-200/80 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shrink-0 ${item.color}`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-base font-extrabold text-slate-900 group-hover:text-primary transition-colors leading-snug">
                              {item.title}
                            </h4>
                            <p className="text-sm text-slate-500 font-medium mt-1 leading-snug">
                              {item.caption}
                            </p>
                          </div>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-primary transition-colors shrink-0">
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
          <div className="rounded-[28px] bg-white p-6 border border-slate-100 shadow-2xs">
            <div className="mb-5">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Aksi Cepat</span>
              <h3 className="mt-1 text-xl font-black text-slate-900">Transaksi Kas</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Link
                href="/cash-transactions?action=create&type=cash_in"
                className="group flex min-h-[104px] items-center justify-between rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-5 text-emerald-900 transition hover:-translate-y-0.5 hover:bg-emerald-100 hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                    <PlusCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-black">Kas Masuk</p>
                    <p className="mt-1 text-sm font-semibold text-emerald-700">Catat penerimaan dana</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-emerald-700 transition group-hover:translate-x-1" />
              </Link>
 
              <Link
                href="/cash-transactions?action=create&type=cash_out"
                className="group flex min-h-[104px] items-center justify-between rounded-3xl border border-rose-100 bg-rose-50 px-5 py-5 text-rose-900 transition hover:-translate-y-0.5 hover:bg-rose-100 hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-sm">
                    <PlusCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-black">Kas Keluar</p>
                    <p className="mt-1 text-sm font-semibold text-rose-700">Catat pembayaran operasional</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-rose-700 transition group-hover:translate-x-1" />
              </Link>
            </div>
          </div>

          {/* Polished MD3 Finance Trend Chart */}
          <div className="flex flex-col rounded-[28px] bg-white p-5 shadow-2xs border border-slate-100">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Tren Keuangan</span>
            <h3 className="mt-1 text-sm font-extrabold text-slate-800">Pemasukan vs Pengeluaran</h3>
            <p className="text-[10px] text-slate-400 font-medium">Rekapitulasi 6 bulan terakhir</p>

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
                    <span className="text-[9px] font-bold text-slate-400 mt-1">{item.label}</span>
                  </div>
                ))
              ) : (
                <div className="flex flex-1 items-center justify-center text-xs text-slate-400 py-10">
                  {dashboardQuery.isLoading ? "Memuat grafik..." : "Belum ada data grafik."}
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-4 border-t border-slate-50 pt-3 text-[10px] font-semibold">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                <span className="text-slate-500">Pemasukan</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="text-slate-500">Pengeluaran</span>
              </div>
            </div>
          </div>

          {/* Receivable Distribution Panel */}
          <div className="rounded-[28px] bg-white p-5 shadow-2xs border border-slate-100">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Distribusi Tagihan</span>
            <h3 className="mt-1 text-sm font-extrabold text-slate-800">Piutang Berdasarkan Status</h3>

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
                          <span className="font-bold text-slate-700">{statusLabels[item.status]}</span>
                        </div>
                        <div className="flex items-center gap-2 font-bold">
                          <span
                            className="rounded-full px-2 py-0.5 text-[9px]"
                            style={{ backgroundColor: colors.bg, color: colors.color }}
                          >
                            {item.count.toLocaleString("id-ID")} tagihan
                          </span>
                          <span className="text-slate-400">{percent}%</span>
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-50 border border-slate-100">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${percent}%`, backgroundColor: colors.color }}
                        />
                      </div>
                      <p className="mt-1.5 text-[10px] font-bold text-slate-400">
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
            <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3.5 border border-slate-100">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-bold text-slate-500">Total piutang aktif</span>
                <span className="font-extrabold text-slate-900 text-sm">{formatCurrency(summary.totalReceivable)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
