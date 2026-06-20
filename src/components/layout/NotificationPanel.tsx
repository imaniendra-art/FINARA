"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCircle2, AlertTriangle, X, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type DashboardSummary = {
  totalCashBank: number;
  monthIncome: number;
  monthExpense: number;
  totalReceivable: number;
  unpaidBillCount: number;
  monthPaymentCount: number;
  monthPaymentAmount: number;
  activeStudentCount: number;
};

type DashboardData = {
  summary: DashboardSummary;
};

async function fetchDashboard() {
  const response = await fetch("/api/dashboard", { cache: "no-store" });
  if (!response.ok) throw new Error("Gagal memuat notifikasi.");
  return response.json() as Promise<DashboardData>;
}

export function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    refetchOnWindowFocus: false,
  });

  const summary = data?.summary;
  const unpaidCount = summary?.unpaidBillCount || 0;
  const paymentCount = summary?.monthPaymentCount || 0;

  // Build real actionable notifications
  const alerts = [];
  if (unpaidCount > 0) {
    alerts.push({
      id: "unpaid-bills",
      title: "Tagihan Belum Lunas",
      desc: `Terdapat ${unpaidCount} tagihan mahasiswa berstatus belum lunas / partial.`,
      icon: AlertTriangle,
      color: "text-amber-600 bg-amber-50 border-amber-100",
    });
  }
  if (paymentCount > 0) {
    alerts.push({
      id: "recent-payments",
      title: "Pembayaran Diterima",
      desc: `${paymentCount} transaksi pembayaran terkonfirmasi bulan ini.`,
      icon: CheckCircle2,
      color: "text-emerald-600 bg-emerald-50 border-emerald-100",
    });
  }
  if (summary && summary.monthExpense > 0) {
    alerts.push({
      id: "expense-alert",
      title: "Arus Kas Keluar",
      desc: `Pengeluaran bulan ini tercatat sebesar ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(summary.monthExpense)}.`,
      icon: TrendingUp,
      color: "text-rose-600 bg-rose-50 border-rose-100",
    });
  }

  return (
    <div className="relative">
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white active:scale-95 cursor-pointer"
        aria-label="Notifikasi"
      >
        <Bell className="w-5 h-5" />
        {alerts.length > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
        )}
      </button>

      {/* Floating Notification Panel Card */}
      {isOpen && (
        <>
          {/* Overlay to close panel */}
          <div
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 mt-3 w-80 sm:w-96 overflow-hidden rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_12px_40px_rgba(0,0,0,0.08)] dark:shadow-slate-950/20 z-50 transition-all duration-200 animate-in fade-in-0 zoom-in-95 origin-top-right">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4 bg-slate-50/50 dark:bg-slate-950/50">
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white text-sm">Notifikasi</h3>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                  Informasi aktivitas BAUK hari ini
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="max-h-[360px] overflow-y-auto p-4 space-y-3">
              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl border p-3.5 transition-all text-xs",
                      alert.color
                    )}
                  >
                    <alert.icon className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200 leading-tight">{alert.title}</p>
                      <p className="mt-1 text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{alert.desc}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-400 mb-3">
                    <Bell className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">Semua Beres!</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">
                    Tidak ada aktivitas mendesak yang memerlukan tindakan admin saat ini.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            {alerts.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-3 text-center bg-slate-50/50">
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition"
                >
                  Tutup Panel
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
