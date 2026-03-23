"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Search, Sparkles, ArrowRight, TrendingUp, Wallet, Layers } from "lucide-react";
import { useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VaultCard } from "@/components/vault-card";
import { DoodleMascot } from "@/components/doodle-mascot";
import { useApp } from "@/providers/app-provider";
import { STRATEGIES, type Strategy } from "@/lib/strategies";

export function HomeContent() {
  const { address } = useAccount();
  const { persona, setChatActive, setInitialChatMessage, setActiveConversationId } = useApp();
  const [searchQuery, setSearchQuery] = useState("");

  const greeting = getGreeting();
  const displayName = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "Anon";

  function openChat(message?: string) {
    if (message) {
      setInitialChatMessage(message);
    }
    setActiveConversationId(null);
    setChatActive(true);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    openChat(searchQuery.trim());
    setSearchQuery("");
  }

  function handleDeposit(strategy: Strategy) {
    openChat(`I want to deposit into ${strategy.name} (${strategy.apy}% APY). Can you tell me more about it?`);
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-6">
      {/* Top Section: Greeting + Mascot */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-8"
      >
        <Card className="overflow-visible border-0 bg-gradient-to-br from-pastel-blue/40 via-white to-pastel-mint/30 shadow-none">
          <CardContent className="flex items-center justify-between py-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="pastel" className="text-xs font-medium">
                  {getRiskLabel(persona.riskLevel)}
                </Badge>
              </div>
              <h1 className="text-3xl font-bold text-[#1F2937] tracking-tight mb-1">
                {greeting},{" "}
                <span className="text-primary">{displayName}</span>
              </h1>
              <p className="text-muted-foreground text-base">
                What yield strategy are you looking for today?
              </p>
            </div>
            <div className="hidden md:block">
              <DoodleMascot size={100} mood="waving" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Search Bar */}
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        onSubmit={handleSearch}
        className="relative mb-8"
      >
        <div className="card-playful flex items-center px-5 py-2">
          <Search className="h-5 w-5 text-muted-foreground/50 mr-3 shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ask about yield strategies on X Layer..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none py-2"
          />
          <Button
            type="submit"
            size="sm"
            className="ml-3 gap-1.5 shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Ask AI
          </Button>
        </div>
      </motion.form>

      {/* Multi-panel Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        {/* Stats Panel - Left Column */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="lg:col-span-1 space-y-4"
        >
          <h3 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest px-1">
            Overview
          </h3>
          {[
            {
              label: "X Layer TVL",
              value: "$18.4M",
              icon: Layers,
              bg: "bg-pastel-blue",
              color: "text-[#3730A3]",
            },
            {
              label: "Active Vaults",
              value: "3",
              icon: Wallet,
              bg: "bg-pastel-mint",
              color: "text-[#065F46]",
            },
            {
              label: "Avg APY",
              value: "22.1%",
              icon: TrendingUp,
              bg: "bg-pastel-lavender",
              color: "text-[#5B21B6]",
            },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
              >
                <Card className="shadow-none">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${stat.bg}`}>
                      <Icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</p>
                      <p className="text-xl font-bold text-[#1F2937]">{stat.value}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Recommended Vaults - Right 2 Columns */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">
              Recommended Vaults
            </h3>
            <Link
              href="/dashboard/persona"
              className="flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2 font-medium"
            >
              Edit risk profile
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-4">
            {STRATEGIES.map((strategy, i) => (
              <VaultCard
                key={strategy.id}
                strategy={strategy}
                index={i}
                onDeposit={handleDeposit}
              />
            ))}
          </div>
        </motion.div>
      </div>
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
