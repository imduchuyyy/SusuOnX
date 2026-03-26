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
  /** USD Coin (bridged) */
  USDC: {
    symbol: "USDC",
    address: "0x74b7f16337b8972027f6196a17a631ac6de26d22",
    decimals: 6,
  },
  /** OKX Wrapped BTC */
  xBTC: {
    symbol: "xBTC",
    address: "0xb7c00000bcdeef966b20b3d884b98e64d2b06b4f",
    decimals: 8,
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
  /** OKX DeFi API investment ID (for actionable strategies) */
  investmentId?: string;
  /**
   * Token addresses as used by the OKX DeFi API for this product.
   * Native tokens use 0xeee...eee. These may differ from the DEX API addresses.
   */
  defiTokens?: {
    tokenA: { address: string; symbol: string };
    tokenB: { address: string; symbol: string };
  };
}

// ---------------------------------------------------------------------------
// Available strategies
// ---------------------------------------------------------------------------

export const STRATEGIES: Strategy[] = [
  {
    id: "uniswap-v3-usdt-wokb",
    name: "Uniswap V3 USDT/OKB",
    protocol: "Uniswap V3",
    description:
      "Provide liquidity to the USDT/OKB pair on Uniswap V3 on X Layer. " +
      "Earn trading fees from the most active OKB pair (~9.7% APY). " +
      "Deposit is handled via the OKX DeFi API which manages the LP position for you.",
    apy: 9.76,
    risk: "medium",
    riskLabel: "Balanced",
    tvl: "$2.3M",
    minDeposit: 5,
    token: "USDT",
    poolAddress: "0x63d62734847E55A266FCa4219A9aD0a02D5F6e02",
    poolTokens: { tokenA: "USDT", tokenB: "WOKB" },
    actionable: true,
    investmentId: "42003",
    defiTokens: {
      tokenA: {
        address: "0x779ded0c9e1022225f8e0630b35a9b54be713736",
        symbol: "USDT",
      },
      tokenB: {
        address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        symbol: "OKB",
      },
    },
  },
  {
    id: "uniswap-v3-usdc-wokb",
    name: "Uniswap V3 USDC/OKB",
    protocol: "Uniswap V3",
    description:
      "Provide liquidity to the USDC/OKB pair on Uniswap V3 on X Layer. " +
      "A low-fee (0.05%) pool ideal for high-volume OKB trading with tighter spreads.",
    apy: 7.2,
    risk: "medium",
    riskLabel: "Balanced",
    tvl: "$850K",
    minDeposit: 5,
    token: "USDC",
    poolAddress: "0x92ae4136f5f141f9d20eaa0c3533f48c21fa8580",
    poolTokens: { tokenA: "USDC", tokenB: "WOKB" },
    actionable: true,
    defiTokens: {
      tokenA: {
        address: "0x74b7f16337b8972027f6196a17a631ac6de26d22",
        symbol: "USDC",
      },
      tokenB: {
        address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        symbol: "OKB",
      },
    },
  },
  {
    id: "uniswap-v3-usdt-xbtc",
    name: "Uniswap V3 USDT/xBTC",
    protocol: "Uniswap V3",
    description:
      "Provide liquidity to the USDT/xBTC pair on Uniswap V3 on X Layer. " +
      "Earn fees from BTC/stablecoin trading. Higher risk due to BTC price volatility but strong demand.",
    apy: 12.5,
    risk: "high",
    riskLabel: "Ape In",
    tvl: "$420K",
    minDeposit: 10,
    token: "USDT",
    poolAddress: "0x5fcfb33c9ab1665fee892eb2af163e863a874d73",
    poolTokens: { tokenA: "USDT", tokenB: "xBTC" },
    actionable: true,
    defiTokens: {
      tokenA: {
        address: "0x779ded0c9e1022225f8e0630b35a9b54be713736",
        symbol: "USDT",
      },
      tokenB: {
        address: "0xb7c00000bcdeef966b20b3d884b98e64d2b06b4f",
        symbol: "xBTC",
      },
    },
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

export function getActionableStrategies(): Strategy[] {
  return STRATEGIES.filter((s) => s.actionable);
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
