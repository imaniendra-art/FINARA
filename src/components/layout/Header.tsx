"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, User as UserIcon, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

type HeaderProps = {
  onMenuClick?: () => void;
};

export function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-full"
          onClick={onMenuClick}
          aria-label="Buka menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-base sm:text-lg text-slate-800 hidden sm:block">
          Finance Administration and Reporting Application
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
            <UserIcon className="w-4 h-4" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm sm:text-base font-medium text-slate-700 leading-none">
              {session?.user?.name || "User"}
            </p>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 capitalize">
              {session?.user?.role?.replace("_", " ") || "Role"}
            </p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-slate-500 hover:text-red-600"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}
