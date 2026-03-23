"use client";

import { motion } from "framer-motion";
import { Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { useAccount } from "wagmi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VaultCard } from "@/components/vault-card";
import { useApp } from "@/providers/app-provider";
import { STRATEGIES, type Strategy } from "@/lib/strategies";

export function HomeView() {
  const { address } = useAccount();
  const { setCurrentView, persona } = useApp();
  const [searchQuery, setSearchQuery] = useState("");

  const greeting = getGreeting();
  const displayName = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}.xlayer`
    : "Anon";

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setCurrentView("chat");
  }

  function handleDeposit(strategy: Strategy) {
    void strategy;
    setCurrentView("chat");
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold tracking-tight">
          {greeting},{" "}
          <span className="text-primary">{displayName}</span>
        </h1>
        <p className="mt-2 text-muted-foreground">
          What yield strategy are you looking for today?
        </p>
      </motion.div>

      {/* Search / Chat Bar */}
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        onSubmit={handleSearch}
        className="relative mb-10"
      >
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Ask me about yield strategies on X Layer..."
          className="h-12 pl-11 pr-24 text-base"
        />
        <Button
          type="submit"
          size="sm"
          className="absolute right-2 top-1/2 -translate-y-1/2 gap-1.5"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Ask AI
        </Button>
      </motion.form>

      {/* Recommended Vaults */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recommended Vaults</h2>
          <span className="text-xs text-muted-foreground">
            Based on your{" "}
            <button
              onClick={() => setCurrentView("persona")}
              className="text-primary underline-offset-2 hover:underline"
            >
              risk profile
            </button>
            {" "}({getRiskLabel(persona.riskLevel)})
          </span>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
          {STRATEGIES.map((strategy, i) => (
            <VaultCard
              key={strategy.id}
              strategy={strategy}
              index={i}
              onDeposit={handleDeposit}
              compact
            />
          ))}
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="mt-8 grid grid-cols-3 gap-4"
      >
        {[
          { label: "X Layer TVL", value: "$18.4M" },
          { label: "Active Vaults", value: "3" },
          { label: "Avg APY", value: "22.1%" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-4 text-center"
          >
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "GM";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getRiskLabel(level: number): string {
  if (level <= 25) return "Safe Bet";
  if (level <= 50) return "Cautious";
  if (level <= 75) return "Balanced";
  return "Ape In";
}
