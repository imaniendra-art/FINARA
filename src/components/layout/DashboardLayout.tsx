"use client";

import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { ReactNode } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Breadcrumb } from "./Breadcrumb";
import { ModeToggle } from "@/components/mode-toggle";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#0f2942] text-white font-bold text-3xl shadow-[0_10px_24px_rgba(15,41,66,0.2)] animate-pulse">
            F
          </div>
          <div className="h-1 w-32 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-1/2 animate-[pulse_1s_infinite] rounded-full bg-[#0f2942]" />
          </div>
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Memuat FINARA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_38%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_34%)] dark:opacity-20" />
      
      {/* Top App Bar Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/90 backdrop-blur-xl shadow-sm">
        <div className="flex h-16 w-full max-w-[1600px] mx-auto items-center justify-between px-4 sm:px-6 lg:px-8">
          
          {/* Left: Brand Logo */}
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-90 transition">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white font-black text-lg shadow-sm shadow-[#0f2942]/20">
                F
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-base leading-none tracking-tight text-primary">FINARA</span>
                <span className="hidden sm:inline-block text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-1">
                  Finance Administration and Reporting Application STIMI YAPMI Makassar.
                </span>
              </div>
            </Link>
          </div>

          {/* Right: Profile Badge */}
          <div className="flex items-center gap-3">
            <ModeToggle />
            {/* User profile card */}
            <div className="flex items-center gap-2 rounded-2xl bg-muted border border-border p-1 pr-3 shadow-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white text-[11px] font-bold">
                {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-extrabold text-foreground leading-none truncate max-w-[96px]">
                  {session?.user?.name || "User"}
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mt-0.5 truncate max-w-[96px]">
                  {session?.user?.role?.replace("_", " ")}
                </span>
              </div>
            </div>

            {/* Log Out */}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex h-10 px-3 items-center justify-center gap-1.5 rounded-2xl bg-card border border-border text-muted-foreground font-bold text-sm shadow-sm transition hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 cursor-pointer active:scale-95"
              aria-label="Keluar"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="relative flex-1 w-full max-w-[1600px] mx-auto px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <Breadcrumb />

        <main className="flex-1 w-full pb-20 animate-in fade-in duration-300">
          {children}
        </main>
      </div>

      {/* Watermark Footer */}
      <footer className="sticky bottom-0 w-full border-t border-border/70 bg-background/90 backdrop-blur-xl shadow-sm z-40 shrink-0">
        <div className="flex h-16 w-full max-w-[1600px] mx-auto items-center justify-center px-4 sm:px-6 md:px-12">
          <p className="text-[10px] font-bold text-muted-foreground uppercase select-none">
            PUSDATIN - STIMI YAPMI MAKASSAR &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
