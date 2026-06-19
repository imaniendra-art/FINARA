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
    <div className="relative mb-6 flex min-w-0 flex-1 overflow-hidden rounded-[28px] bg-[#0f2942] p-4 text-white shadow-[0_14px_36px_-18px_rgba(15,41,66,0.7)] md:p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-white/30" />
      <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-24 w-52 bg-[radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.16),transparent_65%)]" />
      <div className="relative flex min-w-0 items-center gap-4">
      <button
        onClick={() => router.push("/dashboard")}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-sm transition-all hover:bg-white hover:text-[#0f2942] cursor-pointer active:scale-95"
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
