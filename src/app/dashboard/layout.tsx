"use client";

import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { DataFetcher } from "@/components/data-fetcher";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <DataFetcher />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto scrollbar-playful">
          {children}
        </main>
      </div>
    </div>
  );
}
