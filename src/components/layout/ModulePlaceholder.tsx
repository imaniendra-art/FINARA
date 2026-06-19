"use client";

import { PageHeader } from "@/components/layout/PageHeader";

type ModulePlaceholderProps = {
  title: string;
  description: string;
};

export function ModulePlaceholder({ title, description }: ModulePlaceholderProps) {
  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description} />

      <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_10px_28px_-22px_rgba(15,41,66,0.45)]">
        <div className="flex items-center gap-3 mb-3">
          <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">
            Dalam Pengembangan
          </div>
        </div>
        <h2 className="text-xl font-black text-slate-950">{title}</h2>
        <p className="mt-2 text-base font-medium leading-7 text-slate-600">
          Halaman ini sudah terhubung ke routing dashboard FINARA. Fitur detailnya dapat
          ditambahkan bertahap tanpa mengganggu modul pembayaran, jurnal, dan laporan yang
          sudah berjalan.
        </p>
      </div>
    </div>
  );
}
