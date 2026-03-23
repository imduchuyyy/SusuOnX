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
  token: string;
}

export const STRATEGIES: Strategy[] = [
  {
    id: "vault-staking-okx",
    name: "OKX Staking Vault",
    protocol: "OKX Earn",
    description:
      "Stake OKB tokens in the official OKX staking vault. Low risk, steady yield with auto-compounding rewards.",
    apy: 5.2,
    risk: "low",
    riskLabel: "Safe Bet",
    tvl: "$12.4M",
    minDeposit: 10,
    token: "OKB",
  },
  {
    id: "vault-lp-xlayer",
    name: "X Layer LP Farm",
    protocol: "XSwap DEX",
    description:
      "Provide liquidity to the OKB/USDT pair on XSwap. Earn trading fees plus XSwap farming rewards.",
    apy: 18.7,
    risk: "medium",
    riskLabel: "Balanced",
    tvl: "$4.8M",
    minDeposit: 50,
    token: "OKB/USDT LP",
  },
  {
    id: "vault-leveraged-yield",
    name: "Leveraged Yield Protocol",
    protocol: "DeFi Alpha",
    description:
      "Leveraged yield farming on new X Layer protocols. Higher risk with potential for outsized returns.",
    apy: 42.5,
    risk: "high",
    riskLabel: "Ape In",
    tvl: "$1.2M",
    minDeposit: 100,
    token: "OKB",
  },
];

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
