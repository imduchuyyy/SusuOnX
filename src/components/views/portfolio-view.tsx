"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  Activity,
  ExternalLink,
} from "lucide-react";
import { useAccount } from "wagmi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DoodleMascot } from "@/components/doodle-mascot";
import { useApp } from "@/providers/app-provider";
import { STRATEGIES } from "@/lib/strategies";

interface ActiveStrategyData {
  id: string;
  strategyId: string;
  depositAmount: number;
  currentValue: number;
  txHash: string;
  createdAt: string;
}

export function PortfolioView() {
  const { address } = useAccount();
  const { agentAddress, persona } = useApp();
  const [activeStrategies, setActiveStrategies] = useState<ActiveStrategyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setActiveStrategies([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/strategies?userAddress=${address}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.strategies) {
          setActiveStrategies(data.strategies);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [address]);

  const displayName = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}.xlayer`
    : "Not Connected";

  const totalDeposit = activeStrategies.reduce(
    (sum, s) => sum + s.depositAmount,
    0
  );
  const totalValue = activeStrategies.reduce(
    (sum, s) => sum + s.currentValue,
    0
  );
  const performance =
    totalDeposit > 0
      ? (((totalValue - totalDeposit) / totalDeposit) * 100).toFixed(2)
      : "0.00";

  return (
    <div className="mx-auto max-w-4xl px-8 py-6">
      {/* User Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <Card className="border-0 bg-gradient-to-br from-pastel-lavender/40 via-white to-pastel-blue/30 shadow-none">
          <CardContent className="flex items-center justify-between py-6">
            <div>
              <h1 className="text-2xl font-bold text-[#1F2937]">{displayName}</h1>
              {agentAddress && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Agent: {agentAddress.slice(0, 10)}...{agentAddress.slice(-8)}
                </p>
              )}
            </div>
            <Badge
              variant="lavender"
              className="text-xs font-medium"
            >
              {getRiskLabel(persona.riskLevel)}
            </Badge>
          </CardContent>
        </Card>
      </motion.div>

      {/* Key Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8 grid grid-cols-3 gap-5"
      >
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pastel-blue">
              <DollarSign className="h-5 w-5 text-[#3730A3]" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Total Deposit</p>
              <p className="text-xl font-bold text-[#1F2937]">
                ${totalDeposit.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pastel-mint">
              <TrendingUp className="h-5 w-5 text-[#059669]" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Performance</p>
              <p className="text-xl font-bold text-[#059669]">+{performance}%</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pastel-lavender">
              <Activity className="h-5 w-5 text-[#5B21B6]" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Txs Made</p>
              <p className="text-xl font-bold text-[#1F2937]">
                {activeStrategies.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Current Strategies */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="mb-4 text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest px-1">
          Current Strategies
        </h2>

        {loading ? (
          <div className="grid gap-5 md:grid-cols-2">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="space-y-3 pt-6">
                  <div className="h-5 w-32 animate-pulse rounded-xl bg-[#F1F5F9]" />
                  <div className="h-4 w-24 animate-pulse rounded-xl bg-[#F1F5F9]" />
                  <div className="h-4 w-28 animate-pulse rounded-xl bg-[#F1F5F9]" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : activeStrategies.length === 0 ? (
          <Card className="shadow-none">
            <CardContent className="py-16 text-center">
              <DoodleMascot size={72} mood="thinking" className="mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">
                No active strategies yet
              </p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Start chatting with the AI to find your first vault!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {activeStrategies.map((active, i) => {
              const strategy = STRATEGIES.find(
                (s) => s.id === active.strategyId
              );
              if (!strategy) return null;
              const pnl = active.currentValue - active.depositAmount;
              const pnlPct = (
                (pnl / active.depositAmount) *
                100
              ).toFixed(2);

              return (
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          {strategy.name}
                        </CardTitle>
                        <Badge variant="mint" className="text-xs">
                          Active
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Deposited</span>
                        <span className="font-semibold text-[#1F2937]">
                          ${active.depositAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Current Value
                        </span>
                        <span className="font-semibold text-[#1F2937]">
                          ${active.currentValue.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">PnL</span>
                        <span className={`font-semibold ${pnl >= 0 ? "text-[#059669]" : "text-destructive"}`}>
                          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} ({pnlPct}%)
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5 mt-1"
                        onClick={() =>
                          window.open(
                            `https://www.okx.com/explorer/xlayer/tx/${active.txHash}`,
                            "_blank"
                          )
                        }
                      >
                        <ExternalLink className="h-3 w-3" />
                        View on Explorer
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function getRiskLabel(level: number): string {
  if (level <= 25) return "Safe Bet";
  if (level <= 50) return "Cautious";
  if (level <= 75) return "Balanced";
  return "Ape In";
}
