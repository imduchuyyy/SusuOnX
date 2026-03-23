"use client";

import { WalletConnect } from "@/components/wallet-connect";
import { useApp } from "@/providers/app-provider";

export function Header() {
  const { sidebarOpen } = useApp();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-6">
      <div className={sidebarOpen ? "" : "ml-10"}>
        <h1 className="text-sm font-medium text-muted-foreground">
          X Layer AI Yield Agent
        </h1>
      </div>
      <WalletConnect />
    </header>
  );
}
