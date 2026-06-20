"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

type PageHeaderProps = {
  title: string;
  description?: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className="relative mb-6 flex min-w-0 flex-1 overflow-hidden rounded-[28px] bg-white dark:bg-slate-900 p-4 text-slate-800 dark:text-slate-200 border border-border shadow-sm md:p-5">
      <div className="relative flex min-w-0 items-center gap-4">
      <button
        onClick={() => router.push("/dashboard")}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shadow-sm transition-all hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer active:scale-95"
        aria-label="Kembali ke Dashboard"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0">
        <div className="mb-2 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-100">
          FINARA Module
        </div>
        <h1 className="truncate text-2xl font-black leading-tight tracking-tight text-white md:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm font-medium leading-relaxed text-slate-200 md:text-base">{description}</p>
        )}
      </div>
      </div>
    </div>
  );
}
