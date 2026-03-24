/**
 * X Layer yield strategies.
 *
 * The primary strategy is the USDT/WOKB Uniswap V3 pool on X Layer.
 * We keep a few more strategies for the AI to reason about, but only
 * the Uniswap V3 pool is fully actionable through the chat flow.
 */

// ---------------------------------------------------------------------------
// X Layer token addresses (chain index 196)
// ---------------------------------------------------------------------------

export const XLAYER_CHAIN_INDEX = "196";

export const TOKENS = {
  /** Native gas token (OKB) — use empty string for DEX API */
  OKB: {
    symbol: "OKB",
    address: "",
    decimals: 18,
  },
  /** Wrapped OKB */
  WOKB: {
    symbol: "WOKB",
    address: "0xe538905cf8410324e03A5A23C1c177a474D59b2b",
    decimals: 18,
  },
  /** Tether USD (bridged) */
  USDT: {
    symbol: "USDT",
    address: "0x779ded0c9e1022225f8e0630b35a9b54be713736",
    decimals: 6,
  },
} as const;

export type TokenSymbol = keyof typeof TOKENS;

// ---------------------------------------------------------------------------
// Strategy types
// ---------------------------------------------------------------------------

export type RiskTier = "low" | "medium" | "high";

export interface Strategy {
  id: string;
  name: string;
  protocol: string;
  description: string;
  apy: number;
  risk: RiskTier;
  riskLabel: string;
  tvl: string;
  minDeposit: number;
  /** The token the user deposits (what they hold) */
  token: string;
  /** Pool address on chain */
  poolAddress?: string;
  /** Token pair in the pool */
  poolTokens?: { tokenA: TokenSymbol; tokenB: TokenSymbol };
  /** Whether this strategy supports automated deposit through chat */
  actionable: boolean;
}

// ---------------------------------------------------------------------------
// Available strategies
// ---------------------------------------------------------------------------

export const STRATEGIES: Strategy[] = [
  {
    id: "uniswap-v3-usdt-wokb",
    name: "Uniswap V3 USDT/WOKB",
    protocol: "Uniswap V3",
    description:
      "Provide liquidity to the USDT/WOKB pair on Uniswap V3 on X Layer. " +
      "Earn trading fees from the most active OKB pair. " +
      "To enter this position, a portion of your USDT is swapped to OKB via the OKX DEX aggregator.",
    apy: 24.5,
    risk: "medium",
    riskLabel: "Balanced",
    tvl: "$2.1M",
    minDeposit: 5,
    token: "USDT",
    poolAddress: "0x63d62734847E55A266FCa4219A9aD0a02D5F6e02",
    poolTokens: { tokenA: "USDT", tokenB: "WOKB" },
    actionable: true,
  },
  {
    id: "okb-staking",
    name: "OKB Staking",
    protocol: "OKX Earn",
    description:
      "Stake OKB tokens for steady yield. Low risk with auto-compounding rewards on X Layer.",
    apy: 5.2,
    risk: "low",
    riskLabel: "Safe Bet",
    tvl: "$12.4M",
    minDeposit: 1,
    token: "OKB",
    actionable: false,
  },
  {
    id: "leveraged-yield",
    name: "Leveraged OKB Yield",
    protocol: "DeFi Alpha",
    description:
      "Leveraged yield farming on emerging X Layer protocols. Higher risk with potential for outsized returns.",
    apy: 42.5,
    risk: "high",
    riskLabel: "Ape In",
    tvl: "$1.2M",
    minDeposit: 100,
    token: "OKB",
    actionable: false,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getStrategyById(id: string): Strategy | undefined {
  return STRATEGIES.find((s) => s.id === id);
}

export function getStrategiesByRisk(risk: RiskTier): Strategy[] {
  return STRATEGIES.filter((s) => s.risk === risk);
}

export function getRecommendedStrategies(riskLevel: number): Strategy[] {
  if (riskLevel <= 33) return STRATEGIES.filter((s) => s.risk === "low");
  if (riskLevel <= 66)
    return STRATEGIES.filter((s) => s.risk === "low" || s.risk === "medium");
  return STRATEGIES;
}

export function getActionableStrategy(): Strategy {
  return STRATEGIES.find((s) => s.actionable)!;
}

/**
 * Convert a human-readable token amount to minimal units (wei).
 * e.g. toMinimalUnits("10", 6) → "10000000"
 */
export function toMinimalUnits(amount: string, decimals: number): string {
  const parts = amount.split(".");
  const whole = parts[0] || "0";
  let frac = (parts[1] || "").slice(0, decimals).padEnd(decimals, "0");
  // Remove leading zeros from the concatenated result
  const raw = whole + frac;
  return raw.replace(/^0+/, "") || "0";
}

/**
 * Convert minimal units to human-readable.
 * e.g. fromMinimalUnits("10000000", 6) → "10"
 */
export function fromMinimalUnits(raw: string, decimals: number): string {
  if (decimals === 0) return raw;
  const padded = raw.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const frac = padded.slice(padded.length - decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}
