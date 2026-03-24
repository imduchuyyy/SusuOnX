"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  Activity,
  ExternalLink,
  Wallet,
  Coins,
  ArrowUpRight,
  Send,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DoodleMascot } from "@/components/doodle-mascot";
import { useApp } from "@/providers/app-provider";
import { STRATEGIES } from "@/lib/strategies";
import { signAndBroadcast } from "@/lib/okx-api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActiveStrategyData {
  id: string;
  strategyId: string;
  depositAmount: number;
  currentValue: number;
  txHash: string;
  createdAt: string;
}

interface TokenBalanceData {
  chainIndex: string;
  tokenAddress: string;
  symbol: string;
  balance: string;
  tokenPrice: string;
  tokenType: string;
  isRiskToken: boolean;
}

type WithdrawStep =
  | "idle"
  | "form"
  | "confirming"
  | "signing"
  | "broadcasting"
  | "completed"
  | "error";

interface WithdrawState {
  step: WithdrawStep;
  token: TokenBalanceData | null;
  toAddress: string;
  amount: string;
  txHash?: string;
  error?: string;
}

const INITIAL_WITHDRAW: WithdrawState = {
  step: "idle",
  token: null,
  toAddress: "",
  amount: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidEvmAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function getRiskLabel(level: number): string {
  if (level <= 25) return "Safe Bet";
  if (level <= 50) return "Cautious";
  if (level <= 75) return "Balanced";
  return "Ape In";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PortfolioView() {
  const { email, userAddress, session, persona } = useApp();
  const [activeStrategies, setActiveStrategies] = useState<
    ActiveStrategyData[]
  >([]);
  const [balances, setBalances] = useState<TokenBalanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [balancesLoading, setBalancesLoading] = useState(true);

  // Withdraw state
  const [withdraw, setWithdraw] = useState<WithdrawState>(INITIAL_WITHDRAW);
  const [copiedTx, setCopiedTx] = useState(false);

  // Fetch active strategies
  useEffect(() => {
    if (!email) {
      setActiveStrategies([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/strategies?userAddress=${encodeURIComponent(email)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.strategies) {
          setActiveStrategies(data.strategies);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [email]);

  // Fetch real token balances from OKX Wallet API
  const fetchBalances = useCallback(() => {
    if (!userAddress) {
      setBalances([]);
      setBalancesLoading(false);
      return;
    }

    setBalancesLoading(true);
    fetch("/api/balances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: userAddress,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.balances) {
          setBalances(data.balances);
        }
      })
      .catch(console.error)
      .finally(() => setBalancesLoading(false));
  }, [userAddress]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  // ------- Withdraw handlers -------

  function openWithdrawForm(token: TokenBalanceData) {
    setWithdraw({
      step: "form",
      token,
      toAddress: "",
      amount: "",
    });
  }

  function closeWithdraw() {
    setWithdraw(INITIAL_WITHDRAW);
    setCopiedTx(false);
  }

  function handleSetMaxAmount() {
    if (!withdraw.token) return;
    const bal = parseFloat(withdraw.token.balance) || 0;
    // For native token, leave a tiny amount for gas
    const isNative =
      !withdraw.token.tokenAddress ||
      withdraw.token.tokenAddress === "" ||
      withdraw.token.tokenAddress ===
        "0x0000000000000000000000000000000000000000";
    const max = isNative ? Math.max(0, bal - 0.001) : bal;
    setWithdraw((prev) => ({ ...prev, amount: String(max > 0 ? max : 0) }));
  }

  function proceedToConfirm() {
    setWithdraw((prev) => ({ ...prev, step: "confirming" }));
  }

  async function executeWithdraw() {
    if (!session || !withdraw.token) return;

    const token = withdraw.token;
    const isNative =
      !token.tokenAddress ||
      token.tokenAddress === "" ||
      token.tokenAddress === "0x0000000000000000000000000000000000000000";

    setWithdraw((prev) => ({ ...prev, step: "signing" }));

    try {
      // Pass the human-readable amount as value and let the OKX agentic
      // wallet backend handle wei conversion & calldata construction.
      // This matches the Rust CLI's cmd_send approach: it passes `amount`
      // directly as `value` with `contract_addr` for ERC-20 tokens and
      // NO inputData — the OKX backend builds the transfer() calldata.
      const result = await signAndBroadcast({
        session,
        toAddr: withdraw.toAddress,
        value: withdraw.amount,
        contractAddr: isNative ? undefined : token.tokenAddress,
        // No inputData — OKX backend builds the ERC-20 calldata itself
        isContractCall: false, // Matches Rust: cmd_send passes is_contract_call=false
        onProgress: (step) => {
          if (step === "broadcasting") {
            setWithdraw((prev) => ({ ...prev, step: "broadcasting" }));
          }
        },
      });

      setWithdraw((prev) => ({
        ...prev,
        step: "completed",
        txHash: result.txHash,
      }));

      // Refresh balances after successful withdrawal
      setTimeout(fetchBalances, 3000);
    } catch (err) {
      console.error("Withdraw failed:", err);
      setWithdraw((prev) => ({
        ...prev,
        step: "error",
        error: err instanceof Error ? err.message : "Withdraw failed",
      }));
    }
  }

  function copyTxHash() {
    if (withdraw.txHash) {
      navigator.clipboard.writeText(withdraw.txHash);
      setCopiedTx(true);
      setTimeout(() => setCopiedTx(false), 2000);
    }
  }

  // ------- Derived values -------

  const displayName = email ?? "Not Signed In";

  const totalDeposit = activeStrategies.reduce(
    (sum, s) => sum + s.depositAmount,
    0,
  );
  const totalValue = activeStrategies.reduce(
    (sum, s) => sum + s.currentValue,
    0,
  );
  const performance =
    totalDeposit > 0
      ? (((totalValue - totalDeposit) / totalDeposit) * 100).toFixed(2)
      : "0.00";

  const totalWalletUsd = balances.reduce((sum, b) => {
    const bal = parseFloat(b.balance) || 0;
    const price = parseFloat(b.tokenPrice) || 0;
    return sum + bal * price;
  }, 0);

  // Form validation
  const formValid =
    withdraw.step === "form" &&
    isValidEvmAddress(withdraw.toAddress) &&
    parseFloat(withdraw.amount) > 0 &&
    withdraw.token !== null &&
    parseFloat(withdraw.amount) <= parseFloat(withdraw.token.balance);

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
              <h1 className="text-2xl font-bold text-[#1F2937]">
                {displayName}
              </h1>
              {userAddress && (
                <p className="mt-1 text-xs text-muted-foreground font-mono">
                  {userAddress.slice(0, 10)}...{userAddress.slice(-8)}
                  <span className="ml-2 inline-flex items-center gap-1 text-[#059669]">
                    <Wallet className="h-3 w-3" /> OKX Wallet
                  </span>
                </p>
              )}
            </div>
            <Badge variant="lavender" className="text-xs font-medium">
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
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                Total Deposit
              </p>
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
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                Performance
              </p>
              <p className="text-xl font-bold text-[#059669]">
                +{performance}%
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pastel-lavender">
              <Activity className="h-5 w-5 text-[#5B21B6]" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                Txs Made
              </p>
              <p className="text-xl font-bold text-[#1F2937]">
                {activeStrategies.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Wallet Balances (from OKX) */}
      {userAddress && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h2 className="mb-4 text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest px-1">
            Wallet Balances
          </h2>

          {balancesLoading ? (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="h-5 w-32 animate-pulse rounded-xl bg-[#F1F5F9]" />
                <div className="h-4 w-24 animate-pulse rounded-xl bg-[#F1F5F9]" />
              </CardContent>
            </Card>
          ) : balances.length === 0 ? (
            <Card className="shadow-none">
              <CardContent className="py-8 text-center">
                <Coins className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  No tokens found in wallet
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">
                    Total Value
                  </span>
                  <span className="text-lg font-bold text-[#1F2937]">
                    $
                    {totalWalletUsd.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="space-y-1">
                  {balances
                    .filter((b) => !b.isRiskToken)
                    .map((balance) => {
                      const bal = parseFloat(balance.balance) || 0;
                      const price = parseFloat(balance.tokenPrice) || 0;
                      const usdValue = bal * price;
                      const isSelected =
                        withdraw.token?.tokenAddress === balance.tokenAddress &&
                        withdraw.token?.symbol === balance.symbol;

                      return (
                        <div key={`${balance.chainIndex}-${balance.tokenAddress}`}>
                          {/* Token Row */}
                          <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pastel-peach">
                                <span className="text-xs font-bold text-[#92400E]">
                                  {balance.symbol.slice(0, 2)}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-[#1F2937]">
                                  {balance.symbol}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {bal.toLocaleString(undefined, {
                                    maximumFractionDigits: 6,
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-sm font-semibold text-[#1F2937]">
                                  $
                                  {usdValue.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </p>
                                {price > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    $
                                    {price.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 4,
                                    })}
                                  </p>
                                )}
                              </div>
                              {bal > 0 && withdraw.step === "idle" && (
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  className="gap-1 text-[#6366F1] hover:text-[#4F46E5] hover:bg-pastel-blue/50"
                                  onClick={() => openWithdrawForm(balance)}
                                >
                                  <Send className="h-3 w-3" />
                                  Send
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Inline Withdraw Panel */}
                          <AnimatePresence>
                            {isSelected && withdraw.step !== "idle" && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: "easeInOut" }}
                                className="overflow-hidden"
                              >
                                <div className="py-4 px-2">
                                  <WithdrawPanel
                                    withdraw={withdraw}
                                    setWithdraw={setWithdraw}
                                    formValid={formValid}
                                    onConfirm={proceedToConfirm}
                                    onExecute={executeWithdraw}
                                    onClose={closeWithdraw}
                                    onSetMax={handleSetMaxAmount}
                                    onCopyTx={copyTxHash}
                                    copiedTx={copiedTx}
                                  />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

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
              <DoodleMascot
                size={72}
                mood="thinking"
                className="mx-auto mb-4"
              />
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
                (s) => s.id === active.strategyId,
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
                        <span
                          className={`font-semibold ${pnl >= 0 ? "text-[#059669]" : "text-destructive"}`}
                        >
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
                            "_blank",
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

// ---------------------------------------------------------------------------
// Withdraw Panel — Inline sub-component
// ---------------------------------------------------------------------------

interface WithdrawPanelProps {
  withdraw: WithdrawState;
  setWithdraw: React.Dispatch<React.SetStateAction<WithdrawState>>;
  formValid: boolean;
  onConfirm: () => void;
  onExecute: () => void;
  onClose: () => void;
  onSetMax: () => void;
  onCopyTx: () => void;
  copiedTx: boolean;
}

function WithdrawPanel({
  withdraw,
  setWithdraw,
  formValid,
  onConfirm,
  onExecute,
  onClose,
  onSetMax,
  onCopyTx,
  copiedTx,
}: WithdrawPanelProps) {
  const token = withdraw.token;
  if (!token) return null;

  const bal = parseFloat(token.balance) || 0;
  const price = parseFloat(token.tokenPrice) || 0;
  const withdrawUsd = (parseFloat(withdraw.amount) || 0) * price;
  const amountExceedsBalance =
    parseFloat(withdraw.amount) > 0 && parseFloat(withdraw.amount) > bal;

  // ---- Form step ----
  if (withdraw.step === "form") {
    return (
      <Card className="border-[#E0E7FF] bg-gradient-to-br from-pastel-blue/20 to-white shadow-none">
        <CardContent className="pt-5 pb-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-[#6366F1]" />
              <span className="text-sm font-semibold text-[#1F2937]">
                Send {token.symbol}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-[#1F2937]"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Destination Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Destination Address
            </label>
            <Input
              placeholder="0x..."
              value={withdraw.toAddress}
              onChange={(e) =>
                setWithdraw((prev) => ({
                  ...prev,
                  toAddress: e.target.value.trim(),
                }))
              }
              className="font-mono text-sm"
            />
            {withdraw.toAddress.length > 0 &&
              !isValidEvmAddress(withdraw.toAddress) && (
                <p className="text-xs text-destructive">
                  Enter a valid EVM address
                </p>
              )}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Amount
              </label>
              <button
                type="button"
                onClick={onSetMax}
                className="text-xs font-medium text-[#6366F1] hover:text-[#4F46E5] transition-colors cursor-pointer"
              >
                Max: {bal.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
                {token.symbol}
              </button>
            </div>
            <div className="relative">
              <Input
                type="number"
                placeholder="0.00"
                value={withdraw.amount}
                onChange={(e) =>
                  setWithdraw((prev) => ({
                    ...prev,
                    amount: e.target.value,
                  }))
                }
                className="pr-16 text-sm"
                step="any"
                min="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                {token.symbol}
              </span>
            </div>
            {amountExceedsBalance && (
              <p className="text-xs text-destructive">
                Amount exceeds balance
              </p>
            )}
            {withdrawUsd > 0 && !amountExceedsBalance && (
              <p className="text-xs text-muted-foreground">
                ~$
                {withdrawUsd.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            )}
          </div>

          <Button
            variant="default"
            size="sm"
            className="w-full gap-1.5"
            disabled={!formValid}
            onClick={onConfirm}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            Review Withdraw
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ---- Confirming step ----
  if (withdraw.step === "confirming") {
    return (
      <Card className="border-[#FEF3C7] bg-gradient-to-br from-pastel-peach/30 to-white shadow-none">
        <CardContent className="pt-5 pb-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#1F2937]">
              Confirm Withdraw
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-[#1F2937]"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2.5 rounded-xl bg-white/60 border border-border/40 p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Token</span>
              <span className="font-semibold text-[#1F2937]">
                {token.symbol}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold text-[#1F2937]">
                {parseFloat(withdraw.amount).toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })}{" "}
                {token.symbol}
              </span>
            </div>
            {withdrawUsd > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Value</span>
                <span className="font-semibold text-[#1F2937]">
                  ~$
                  {withdrawUsd.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">To</span>
              <span className="font-mono text-xs text-[#1F2937]">
                {withdraw.toAddress.slice(0, 8)}...
                {withdraw.toAddress.slice(-6)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Network</span>
              <span className="font-semibold text-[#1F2937]">X Layer</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() =>
                setWithdraw((prev) => ({ ...prev, step: "form" }))
              }
            >
              Back
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={onExecute}
            >
              <Send className="h-3.5 w-3.5" />
              Confirm & Send
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Signing / Broadcasting steps ----
  if (withdraw.step === "signing" || withdraw.step === "broadcasting") {
    return (
      <Card className="border-[#E0E7FF] bg-gradient-to-br from-pastel-lavender/20 to-white shadow-none">
        <CardContent className="py-8 text-center space-y-3">
          <Loader2 className="h-8 w-8 mx-auto text-[#6366F1] animate-spin" />
          <p className="text-sm font-semibold text-[#1F2937]">
            {withdraw.step === "signing"
              ? "Signing transaction..."
              : "Broadcasting to X Layer..."}
          </p>
          <p className="text-xs text-muted-foreground">
            {withdraw.step === "signing"
              ? "Decrypting session key and signing with Ed25519"
              : "Sending signed transaction to the network"}
          </p>
        </CardContent>
      </Card>
    );
  }

  // ---- Completed step ----
  if (withdraw.step === "completed") {
    return (
      <Card className="border-[#D1FAE5] bg-gradient-to-br from-pastel-mint/30 to-white shadow-none">
        <CardContent className="pt-5 pb-4 space-y-4">
          <div className="text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 mx-auto text-[#059669]" />
            <p className="text-sm font-semibold text-[#1F2937]">
              Withdraw Sent!
            </p>
            <p className="text-xs text-muted-foreground">
              {parseFloat(withdraw.amount).toLocaleString(undefined, {
                maximumFractionDigits: 6,
              })}{" "}
              {token.symbol} sent to{" "}
              <span className="font-mono">
                {withdraw.toAddress.slice(0, 8)}...
                {withdraw.toAddress.slice(-6)}
              </span>
            </p>
          </div>

          {withdraw.txHash && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={onCopyTx}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-[#1F2937] transition-colors cursor-pointer"
              >
                {copiedTx ? (
                  <Check className="h-3 w-3 text-[#059669]" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                <span className="font-mono">
                  {withdraw.txHash.slice(0, 10)}...
                  {withdraw.txHash.slice(-8)}
                </span>
              </button>
            </div>
          )}

          <div className="flex gap-2">
            {withdraw.txHash && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() =>
                  window.open(
                    `https://www.okx.com/explorer/xlayer/tx/${withdraw.txHash}`,
                    "_blank",
                  )
                }
              >
                <ExternalLink className="h-3 w-3" />
                Explorer
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Error step ----
  if (withdraw.step === "error") {
    return (
      <Card className="border-destructive/30 bg-gradient-to-br from-red-50/50 to-white shadow-none">
        <CardContent className="pt-5 pb-4 space-y-4">
          <div className="text-center space-y-2">
            <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
            <p className="text-sm font-semibold text-[#1F2937]">
              Withdraw Failed
            </p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              {withdraw.error || "Something went wrong. Please try again."}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              onClick={() =>
                setWithdraw((prev) => ({ ...prev, step: "confirming" }))
              }
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
