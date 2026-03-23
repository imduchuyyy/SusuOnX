"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Save, RotateCcw, Loader2, Check } from "lucide-react";
import { useApp } from "@/providers/app-provider";
import { useAccount } from "wagmi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DoodleMascot } from "@/components/doodle-mascot";

const RISK_LABELS = [
  { max: 25, label: "Safe Bet", emoji: "🛡️", variant: "mint" as const },
  { max: 50, label: "Cautious", emoji: "🧭", variant: "pastel" as const },
  { max: 75, label: "Balanced", emoji: "⚖️", variant: "lavender" as const },
  { max: 100, label: "Ape In", emoji: "🦍", variant: "peach" as const },
];

function getRiskInfo(level: number) {
  return RISK_LABELS.find((r) => level <= r.max) || RISK_LABELS[3];
}

export function PersonaView() {
  const { persona, setPersona } = useApp();
  const { address } = useAccount();
  const riskInfo = getRiskInfo(persona.riskLevel);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleReset() {
    setPersona({
      riskLevel: 50,
      systemPrompt: "",
      allowSwap: true,
      allowBridge: false,
      allowDeposit: true,
    });
    setSaved(false);
  }

  async function handleSave() {
    if (!address) return;
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/persona", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAddress: address, persona }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save persona:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Persona Settings</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Configure your AI agent&apos;s behavior and risk tolerance
          </p>
        </div>
        <DoodleMascot size={64} mood="happy" />
      </motion.div>

      <div className="space-y-6">
        {/* Risk Level */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Risk Level
                <Badge
                  variant={riskInfo.variant}
                  className="text-xs font-medium"
                >
                  {riskInfo.emoji} {riskInfo.label}
                </Badge>
              </CardTitle>
              <CardDescription>
                Adjust how aggressive your AI agent should be when selecting
                yield strategies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Slider
                value={[persona.riskLevel]}
                onValueChange={(value) => {
                  const v = Array.isArray(value) ? value[0] : value;
                  setPersona({ riskLevel: v });
                }}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground/70">
                <span>🛡️ Safe Bet</span>
                <span>🧭 Cautious</span>
                <span>⚖️ Balanced</span>
                <span>🦍 Ape In</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* System Prompt */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>System Prompt</CardTitle>
              <CardDescription>
                Customize the AI agent&apos;s personality and instructions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={persona.systemPrompt}
                onChange={(e) =>
                  setPersona({ systemPrompt: e.target.value })
                }
                placeholder="e.g., Focus on stablecoin yields. Avoid protocols under 1 month old. Always explain risks before depositing..."
                className="min-h-[120px] resize-none"
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Approved Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Approved Actions</CardTitle>
              <CardDescription>
                Choose which on-chain actions your AI agent is allowed to execute
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#1F2937]">Swap</p>
                  <p className="text-xs text-muted-foreground">
                    Allow token swaps on DEXes
                  </p>
                </div>
                <Switch
                  checked={persona.allowSwap}
                  onCheckedChange={(checked) =>
                    setPersona({ allowSwap: checked })
                  }
                />
              </div>
              <div className="h-px bg-border/40" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#1F2937]">Bridge</p>
                  <p className="text-xs text-muted-foreground">
                    Allow cross-chain bridging
                  </p>
                </div>
                <Switch
                  checked={persona.allowBridge}
                  onCheckedChange={(checked) =>
                    setPersona({ allowBridge: checked })
                  }
                />
              </div>
              <div className="h-px bg-border/40" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#1F2937]">Deposit</p>
                  <p className="text-xs text-muted-foreground">
                    Allow deposits into yield vaults
                  </p>
                </div>
                <Switch
                  checked={persona.allowDeposit}
                  onCheckedChange={(checked) =>
                    setPersona({ allowDeposit: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex gap-3"
        >
          <Button
            onClick={handleSave}
            className="flex-1 gap-2"
            disabled={saving || !address}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
          </Button>
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </motion.div>

        {!address && (
          <p className="text-center text-xs text-muted-foreground/60 mt-2">
            Connect your wallet to save persona settings
          </p>
        )}
      </div>
    </div>
  );
}
