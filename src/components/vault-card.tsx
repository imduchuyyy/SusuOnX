"use client";

import { motion } from "framer-motion";
import { TrendingUp, Shield, Flame, Zap } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Strategy, type RiskTier } from "@/lib/strategies";
import { cn } from "@/lib/utils";

const RISK_CONFIG: Record<
  RiskTier,
  { icon: typeof Shield; badgeVariant: "mint" | "pastel" | "peach"; label: string }
> = {
  low: {
    icon: Shield,
    badgeVariant: "mint",
    label: "Low Risk",
  },
  medium: {
    icon: Zap,
    badgeVariant: "pastel",
    label: "Medium",
  },
  high: {
    icon: Flame,
    badgeVariant: "peach",
    label: "High Risk",
  },
};

interface VaultCardProps {
  strategy: Strategy;
  index?: number;
  onDeposit?: (strategy: Strategy) => void;
  compact?: boolean;
}

export function VaultCard({
  strategy,
  index = 0,
  onDeposit,
  compact = false,
}: VaultCardProps) {
  const risk = RISK_CONFIG[strategy.risk];
  const RiskIcon = risk.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.35, ease: "easeOut" }}
    >
      <Card
        className={cn(
          "transition-all",
          compact ? "w-64 shrink-0" : "w-full"
        )}
      >
        <CardHeader className={compact ? "pb-2" : undefined}>
          <div className="flex items-center justify-between">
            <Badge variant={risk.badgeVariant}>
              <RiskIcon className="mr-1 h-3 w-3" />
              {strategy.riskLabel}
            </Badge>
            <span className="text-xs text-muted-foreground font-medium">
              TVL {strategy.tvl}
            </span>
          </div>
          <CardTitle className={compact ? "text-base" : "text-lg"}>
            {strategy.name}
          </CardTitle>
          {!compact && (
            <CardDescription>{strategy.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl bg-pastel-mint px-2.5 py-1">
                <TrendingUp className="h-3.5 w-3.5 text-[#059669]" />
                <span className="text-base font-bold text-[#059669]">
                  {strategy.apy}%
                </span>
              </div>
              <span className="text-xs text-muted-foreground">APY</span>
            </div>
            {onDeposit && (
              <Button size="sm" onClick={() => onDeposit(strategy)}>
                Deposit
              </Button>
            )}
          </div>
          {!compact && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-lg bg-[#F1F5F9] px-2 py-0.5">Min: {strategy.minDeposit} {strategy.token}</span>
              <span className="rounded-lg bg-[#F1F5F9] px-2 py-0.5">{strategy.protocol}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
