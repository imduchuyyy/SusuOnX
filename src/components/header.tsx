"use client";

import { WalletConnect } from "@/components/wallet-connect";
import { useApp } from "@/providers/app-provider";

export function Header() {
  const { sidebarOpen } = useApp();

  return (
    <header className="flex h-16 items-center justify-between px-8">
      <div className={sidebarOpen ? "" : "ml-12"}>
        <h1 className="text-sm font-medium text-muted-foreground">
          AI Yield Agent on X Layer
        </h1>
      </div>
      <WalletConnect />
    </header>
  );
}
