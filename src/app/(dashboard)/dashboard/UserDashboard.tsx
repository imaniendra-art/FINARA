"use client";

import { useQuery } from "@tanstack/react-query";
import { Session } from "next-auth";
import Link from "next/link";
import { BookMarked, Send, Hourglass, Wallet2, FilePlus, ListTodo } from "lucide-react";

type RequestType = {
  status: string;
  totalRequestedAmount: number;
  totalApprovedAmount: number;
};

export default function UserDashboard({ session }: { session: Session | null }) {
  // Fetch budget requests for this specific user/unit
  const { data, isLoading } = useQuery({
    queryKey: ["user-budget-requests"],
    queryFn: async () => {
      const res = await fetch("/api/budget-requests");
      if (!res.ok) throw new Error("Failed to fetch budget requests");
      return res.json();
    },
  });

  const requests: RequestType[] = data?.requests || [];

  // Calculate metrics
  let totalEstimasi = 0; // Total Rencana
  let totalDiajukan = 0; // Status !== 'draft'
  let sisaMenunggu = 0;  // Status === 'submitted' || 'verified'
  let totalCair = 0;     // Status === 'approved' || 'disbursed' || 'completed' || 'lpj_submitted'

  requests.forEach((req) => {
    totalEstimasi += req.totalRequestedAmount;
    if (req.status !== "draft") {
      totalDiajukan += req.totalRequestedAmount;
    }
    if (req.status === "submitted" || req.status === "verified") {
      sisaMenunggu += req.totalRequestedAmount;
    }
    if (["approved", "disbursed", "completed", "lpj_submitted"].includes(req.status)) {
      totalCair += req.totalApprovedAmount || req.totalRequestedAmount;
    }
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Halo, {session?.user?.name}</h2>
          <p className="text-sm font-medium text-muted-foreground">Panel Kendali Unit Kerja STIMI YAPMI</p>
        </div>
      </div>

      {/* SIPUANG-style Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Rencana Proker */}
        <div className="relative overflow-hidden rounded-[20px] bg-blue-600 p-5 text-white shadow-md transition-all hover:bg-blue-700">
          <h6 className="text-[11px] font-bold uppercase tracking-widest text-white/80">Rencana Proker</h6>
          <h3 className="mt-2 text-2xl font-black">{isLoading ? "..." : formatCurrency(totalEstimasi)}</h3>
          <BookMarked className="absolute -bottom-4 -right-4 h-24 w-24 text-white/10" />
        </div>

        {/* Card 2: Total Diajukan */}
        <div className="relative overflow-hidden rounded-[20px] bg-slate-800 p-5 text-white shadow-md transition-all hover:bg-slate-900">
          <h6 className="text-[11px] font-bold uppercase tracking-widest text-white/80">Total Diajukan</h6>
          <h3 className="mt-2 text-2xl font-black">{isLoading ? "..." : formatCurrency(totalDiajukan)}</h3>
          <Send className="absolute -bottom-4 -right-4 h-24 w-24 text-white/10" />
        </div>

        {/* Card 3: Menunggu Proses */}
        <div className="relative overflow-hidden rounded-[20px] bg-amber-500 p-5 text-slate-900 shadow-md transition-all hover:bg-amber-600">
          <h6 className="text-[11px] font-bold uppercase tracking-widest text-slate-900/80">Menunggu Proses</h6>
          <h3 className="mt-2 text-2xl font-black">{isLoading ? "..." : formatCurrency(sisaMenunggu)}</h3>
          <Hourglass className="absolute -bottom-4 -right-4 h-24 w-24 text-slate-900/10" />
        </div>

        {/* Card 4: Dana Cair (ACC) */}
        <div className="relative overflow-hidden rounded-[20px] bg-emerald-600 p-5 text-white shadow-md transition-all hover:bg-emerald-700">
          <h6 className="text-[11px] font-bold uppercase tracking-widest text-white/80">Dana Cair (ACC)</h6>
          <h3 className="mt-2 text-2xl font-black">{isLoading ? "..." : formatCurrency(totalCair)}</h3>
          <Wallet2 className="absolute -bottom-4 -right-4 h-24 w-24 text-white/10" />
        </div>
      </div>

      {/* Action Links */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link 
          href="/budget-requests"
          className="group flex flex-col items-center justify-center rounded-[20px] bg-card border border-border p-8 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-blue-500/50"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <ListTodo className="h-8 w-8" />
          </div>
          <h5 className="text-lg font-bold text-foreground">Kelola Rencana (Proker)</h5>
          <p className="mt-1 text-sm text-muted-foreground">Lihat riwayat dan pantau status pengajuan anggaran Anda</p>
        </Link>

        <Link 
          href="/budget-requests?action=create"
          className="group flex flex-col items-center justify-center rounded-[20px] bg-card border border-border p-8 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-emerald-500/50"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <FilePlus className="h-8 w-8" />
          </div>
          <h5 className="text-lg font-bold text-foreground">Ajukan Pencairan Dana</h5>
          <p className="mt-1 text-sm text-muted-foreground">Buat permohonan pencairan dana atau kegiatan baru</p>
        </Link>
      </div>
    </div>
  );
}
