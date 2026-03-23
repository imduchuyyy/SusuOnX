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
  { icon: typeof Shield; color: string; badgeClass: string }
> = {
  low: {
    icon: Shield,
    color: "text-success",
    badgeClass: "bg-success/15 text-success border-success/30",
  },
  medium: {
    icon: Zap,
    color: "text-warning",
    badgeClass: "bg-warning/15 text-warning-foreground border-warning/30",
  },
  high: {
    icon: Flame,
    color: "text-destructive",
    badgeClass: "bg-destructive/15 text-destructive border-destructive/30",
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
      transition={{ delay: index * 0.1, duration: 0.3 }}
    >
      <Card
        className={cn(
          "transition-all hover:shadow-md hover:border-primary/30",
          compact ? "w-64 shrink-0" : "w-full"
        )}
      >
        <CardHeader className={compact ? "pb-2" : undefined}>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className={cn("text-xs", risk.badgeClass)}>
              <RiskIcon className="mr-1 h-3 w-3" />
              {strategy.riskLabel}
            </Badge>
            <span className="text-xs text-muted-foreground">
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
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-success" />
              <span className="text-lg font-bold text-success">
                {strategy.apy}%
              </span>
              <span className="text-xs text-muted-foreground">APY</span>
            </div>
            {onDeposit && (
              <Button size="sm" onClick={() => onDeposit(strategy)}>
                Deposit
              </Button>
            )}
          </div>
          {!compact && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Min: {strategy.minDeposit} {strategy.token}</span>
              <span>|</span>
              <span>{strategy.protocol}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
