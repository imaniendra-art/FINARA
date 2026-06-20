"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, User as UserIcon, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";

type HeaderProps = {
  onMenuClick?: () => void;
};

export function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();

  return (
    <header className="h-16 bg-background border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="md:hidden p-2 text-muted-foreground hover:bg-accent rounded-full"
          onClick={onMenuClick}
          aria-label="Buka menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="FINARA Logo" className="h-8 w-auto object-contain" />
          <div className="flex flex-col justify-center">
            <span className="font-extrabold text-base sm:text-lg leading-none tracking-tight text-foreground">FINARA</span>
            <span className="hidden sm:inline-block text-[10px] sm:text-xs font-semibold text-muted-foreground mt-0.5">
              Finance Administration and Reporting Application
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <ModeToggle />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center text-muted-foreground">
            <UserIcon className="w-4 h-4" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm sm:text-base font-medium text-foreground leading-none">
              {session?.user?.name || "User"}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 capitalize">
              {session?.user?.role?.replace("_", " ") || "Role"}
            </p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-destructive"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}
