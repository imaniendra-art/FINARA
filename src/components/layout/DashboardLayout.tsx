"use client";

import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { ReactNode, useState } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Breadcrumb } from "./Breadcrumb";
import { ModeToggle } from "@/components/mode-toggle";
import { Sidebar } from "./Sidebar";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(false);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-blue-600 dark:bg-[#0f2942] text-white font-bold text-3xl shadow-lg animate-pulse">
            F
          </div>
          <div className="h-1 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full w-1/2 animate-[pulse_1s_infinite] rounded-full bg-blue-600 dark:bg-[#0f2942]" />
          </div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Memuat FINARA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background bg-grid font-sans text-foreground">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 md:hidden" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      {/* Sidebar Component with mobile and desktop collapsible visibility */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 transform transition-all duration-300 ease-in-out shrink-0 overflow-hidden md:relative border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ${
          isMobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full w-64 md:translate-x-0"
        } ${isDesktopSidebarOpen ? "md:w-64" : "md:w-0"}`}
      >
        <div className="w-64 h-full bg-white dark:bg-slate-900">
          <Sidebar />
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative">
        {/* Top App Bar Header */}
        <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/90 backdrop-blur-xl shadow-sm shrink-0">
          <div className="flex h-16 w-full max-w-[1600px] mx-auto items-center justify-between px-4 sm:px-6 lg:px-8">
            
            {/* Left: Brand Logo & Hamburger */}
            <div className="flex items-center gap-4">
              {/* Mobile Hamburger */}
              <button 
                className="md:hidden p-2 -ml-2 text-muted-foreground hover:bg-muted rounded-xl"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
              </button>
              {/* Desktop Hamburger */}
              <button 
                className="hidden md:block p-2 -ml-2 text-muted-foreground hover:bg-muted rounded-xl transition-colors"
                onClick={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
              </button>
              <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-90 transition">
                <img src="/logo.png" alt="FINARA Logo" className="h-8 w-auto object-contain" />
                <div className="flex flex-col justify-center">
                  <span className="font-extrabold text-base sm:text-lg leading-none tracking-tight text-primary">FINARA</span>
                  <span className="hidden sm:inline-block text-[10px] sm:text-xs font-semibold text-muted-foreground mt-0.5">
                    Finance Administration and Reporting Application
                  </span>
                </div>
              </Link>
            </div>

            {/* Right: Profile Badge */}
            <div className="flex items-center gap-3">
              <ModeToggle />
              {/* User profile card */}
              <div className="flex items-center gap-2 rounded-2xl bg-slate-50 dark:bg-[#0c2237] border border-border p-1 pr-3 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 dark:bg-[#0f2942] text-white text-[11px] font-bold">
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
        <footer className="sticky bottom-0 w-full border-t border-border/70 bg-background/90 backdrop-blur-xl shadow-sm z-40 shrink-0 mt-auto">
          <div className="flex h-16 w-full max-w-[1600px] mx-auto items-center justify-center px-4 sm:px-6 md:px-12">
            <p className="text-[10px] font-bold text-muted-foreground uppercase select-none">
              PUSDATIN - STIMI YAPMI MAKASSAR &copy; {new Date().getFullYear()}
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
