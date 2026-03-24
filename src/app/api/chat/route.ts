import { openai } from "@ai-sdk/openai";
import {
  streamText,
  convertToModelMessages,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { createHmac } from "node:crypto";
import {
  STRATEGIES,
  TOKENS,
  XLAYER_CHAIN_INDEX,
  toMinimalUnits,
  getActionableStrategy,
} from "@/lib/strategies";

export const maxDuration = 30;

// OKX API key credentials (server-side only) for balance lookups
const OKX_API_BASE = "https://web3.okx.com";
const OKX_ACCESS_KEY = process.env.OKX_ACCESS_KEY ?? "";
const OKX_SECRET_KEY = process.env.OKX_SECRET_KEY ?? "";
const OKX_PASSPHRASE = process.env.OKX_PASSPHRASE ?? "";

function getOkxHeaders(
  method: string,
  requestPath: string,
  body: string = "",
): Record<string, string> {
  const timestamp = new Date().toISOString();
  const preSign = timestamp + method.toUpperCase() + requestPath + body;
  const sign = createHmac("sha256", OKX_SECRET_KEY)
    .update(preSign)
    .digest("base64");
  return {
    "Content-Type": "application/json",
    "OK-ACCESS-KEY": OKX_ACCESS_KEY,
    "OK-ACCESS-SIGN": sign,
    "OK-ACCESS-PASSPHRASE": OKX_PASSPHRASE,
    "OK-ACCESS-TIMESTAMP": timestamp,
  };
}

export async function POST(req: Request) {
  const {
    messages,
    persona,
    userAddress,
    walletAddress,
  }: {
    messages: UIMessage[];
    persona?: {
      riskLevel: number;
      systemPrompt: string;
      allowSwap: boolean;
      allowBridge: boolean;
      allowDeposit: boolean;
    };
    userAddress?: string;
    walletAddress?: string;
  } = await req.json();

  const riskLevel = persona?.riskLevel ?? 50;
  const riskLabel = getRiskLabel(riskLevel);
  const approvedActions = [
    persona?.allowSwap && "swap tokens",
    persona?.allowBridge && "bridge tokens cross-chain",
    persona?.allowDeposit && "deposit into yield pools",
  ]
    .filter(Boolean)
    .join(", ");

  const strategyContext = STRATEGIES.map(
    (s) =>
      `- ${s.name} (${s.protocol}): ~${s.apy}% APY, Risk: ${s.riskLabel}, TVL: ${s.tvl}, Min deposit: ${s.minDeposit} ${s.token}. ${s.actionable ? "[ACTIONABLE — can execute deposit via chat]" : "[Info only]"} ${s.description}`,
  ).join("\n");

  const systemPrompt = `You are Long.AI, a friendly AI yield agent on X Layer blockchain (OKX Layer 2).

USER PROFILE:
- Risk tolerance: ${riskLabel} (${riskLevel}/100)
- Approved actions: ${approvedActions || "none configured"}
- Email: ${userAddress || "not connected"}
- Wallet address: ${walletAddress || "not connected"}

AVAILABLE YIELD STRATEGIES:
${strategyContext}

THE MAIN ACTIONABLE STRATEGY is the Uniswap V3 USDT/WOKB pool:
- Pool address: 0x63d62734847E55A266FCa4219A9aD0a02D5F6e02
- Token pair: USDT + WOKB (Wrapped OKB)
- The deposit flow works like this: user provides USDT, we swap ~50% to OKB via OKX DEX aggregator, then both tokens go into the Uniswap V3 LP position.
- USDT on X Layer: ${TOKENS.USDT.address}
- WOKB on X Layer: ${TOKENS.WOKB.address}

KNOWN TOKENS ON X LAYER:
- OKB (native gas token): no contract address, 18 decimals
- WOKB (Wrapped OKB): ${TOKENS.WOKB.address}, 18 decimals
- USDT: ${TOKENS.USDT.address}, 6 decimals

BEHAVIOR:
- When users ask about yield farming, staking, or earning yield, recommend the Uniswap V3 USDT/WOKB pool using the recommend_strategy tool.
- Match recommendations to risk tolerance: Safe Bet users get a gentle warning about IL risk, Ape In users hear about the upside.
- When the user wants to deposit, use the prepare_deposit tool to set up the transaction. Always ask how much USDT they want to deposit.
- When the user wants to exit a yield position, use the prepare_withdraw tool.

SENDING / WITHDRAWING TOKENS:
- When the user wants to send, transfer, or withdraw tokens to an external address, use the send_token tool.
- Before sending, confirm with the user: which token, how much, and to which address.
- If the user says "withdraw" without specifying a destination, ask them for the destination address.
- If the user wants to check their balance first, use the get_balances tool.
- The user may say things like "send 5 USDT to 0x...", "withdraw all my OKB to 0x...", "transfer 10 WOKB to 0x...", etc.
- For native OKB, use tokenSymbol "OKB" and an empty string for tokenAddress.
- For USDT, use tokenSymbol "USDT" and tokenAddress "${TOKENS.USDT.address}".
- For WOKB, use tokenSymbol "WOKB" and tokenAddress "${TOKENS.WOKB.address}".
- IMPORTANT: Always double-check the destination address looks like a valid Ethereum address (starts with 0x, 42 characters). If it doesn't look right, ask the user to verify.
- IMPORTANT: Do NOT explain technical signing steps. Just say you'll handle the transfer for them.

- Be concise, friendly, and use simple language. Explain risks before recommending deposits.
- Format APY and financial numbers clearly.
- If asked about actions not in the approved list, politely explain those actions haven't been enabled in their Persona settings.

${persona?.systemPrompt ? `\nADDITIONAL USER INSTRUCTIONS:\n${persona.systemPrompt}` : ""}`;

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: {
      // ------------------------------------------------------------------
      // Tool: recommend_strategy
      // The AI calls this to show a strategy card to the user.
      // Server-executed: returns strategy data in the stream.
      // ------------------------------------------------------------------
      recommend_strategy: tool({
        description:
          "Recommend a yield strategy to the user. Call this when the user asks about yield, farming, staking, or earning. Returns strategy details that render as an interactive card in the chat.",
        inputSchema: z.object({
          strategyId: z
            .string()
            .describe(
              'The strategy ID to recommend. Use "uniswap-v3-usdt-wokb" for the main pool.',
            ),
          reason: z
            .string()
            .describe(
              "Brief explanation of why this strategy fits the user (1-2 sentences).",
            ),
        }),
        execute: async ({ strategyId, reason }) => {
          const strategy = STRATEGIES.find((s) => s.id === strategyId);
          if (!strategy) {
            return {
              error: true,
              message: `Strategy "${strategyId}" not found.`,
            };
          }
          return {
            error: false,
            strategy: {
              id: strategy.id,
              name: strategy.name,
              protocol: strategy.protocol,
              description: strategy.description,
              apy: strategy.apy,
              risk: strategy.risk,
              riskLabel: strategy.riskLabel,
              tvl: strategy.tvl,
              minDeposit: strategy.minDeposit,
              token: strategy.token,
              poolAddress: strategy.poolAddress ?? null,
              actionable: strategy.actionable,
            },
            reason,
          };
        },
      }),

      // ------------------------------------------------------------------
      // Tool: prepare_deposit
      // AI calls this when user confirms they want to deposit.
      // No execute → sent to client as a tool call for client-side execution.
      // ------------------------------------------------------------------
      prepare_deposit: tool({
        description:
          "Prepare a deposit into a yield strategy. Call this when the user confirms they want to deposit a specific amount. This triggers the multi-step deposit flow on the client: (1) approve USDT spending, (2) swap ~50% USDT to OKB via OKX DEX, (3) add liquidity to Uniswap V3. The client handles all transaction signing.",
        inputSchema: z.object({
          strategyId: z
            .string()
            .describe("The strategy ID to deposit into."),
          amount: z
            .string()
            .describe(
              "The amount of USDT to deposit (human-readable, e.g. '100'). Must be >= strategy minimum.",
            ),
        }),
        // No execute → this becomes a client-side tool call
      }),

      // ------------------------------------------------------------------
      // Tool: prepare_withdraw
      // Client-side only — triggers strategy exit flow.
      // ------------------------------------------------------------------
      prepare_withdraw: tool({
        description:
          "Prepare a withdrawal from a yield strategy. Call this when the user wants to exit their LP position or yield strategy. This is NOT for simple token transfers — use send_token for that.",
        inputSchema: z.object({
          strategyId: z
            .string()
            .describe("The strategy ID to withdraw from."),
        }),
        // No execute → client-side
      }),

      // ------------------------------------------------------------------
      // Tool: get_balances
      // Server-executed: fetches user's token balances on X Layer.
      // ------------------------------------------------------------------
      get_balances: tool({
        description:
          "Fetch the user's token balances on X Layer. Use this when the user asks about their balance, how much they have, or before confirming a send/withdraw to verify they have enough funds.",
        inputSchema: z.object({}),
        execute: async () => {
          if (!walletAddress) {
            return { error: true, message: "Wallet not connected." };
          }
          if (!OKX_ACCESS_KEY || !OKX_SECRET_KEY) {
            return { error: true, message: "Balance API not configured." };
          }

          try {
            const queryParams = new URLSearchParams({
              address: walletAddress,
              chains: XLAYER_CHAIN_INDEX,
            });
            const requestPath = `/api/v6/dex/balance/all-token-balances-by-address?${queryParams.toString()}`;
            const headers = getOkxHeaders("GET", requestPath);

            const res = await fetch(`${OKX_API_BASE}${requestPath}`, {
              method: "GET",
              headers,
            });

            if (!res.ok) {
              return { error: true, message: "Failed to fetch balances." };
            }

            const data = await res.json();
            const code = typeof data.code === "string" ? data.code : String(data.code);
            if (code !== "0") {
              return { error: true, message: `OKX error: ${data.msg}` };
            }

            const tokenAssets = data.data?.[0]?.tokenAssets ?? [];
            const balances = tokenAssets
              .filter((b: { balance: string }) => parseFloat(b.balance) > 0)
              .map(
                (b: {
                  symbol: string;
                  balance: string;
                  tokenPrice: string;
                  tokenContractAddress: string;
                }) => ({
                  symbol: b.symbol,
                  balance: b.balance,
                  usdValue: (parseFloat(b.balance) * parseFloat(b.tokenPrice || "0")).toFixed(2),
                  tokenAddress: b.tokenContractAddress || "",
                }),
              );

            return {
              error: false,
              address: walletAddress,
              balances,
              totalTokens: balances.length,
            };
          } catch {
            return { error: true, message: "Balance fetch failed." };
          }
        },
      }),

      // ------------------------------------------------------------------
      // Tool: send_token
      // Client-side only — triggers token transfer flow in the chat UI.
      // ------------------------------------------------------------------
      send_token: tool({
        description:
          "Send/transfer/withdraw tokens to an external address on X Layer. Use this when the user wants to send tokens to another wallet. The client handles transaction signing and broadcasting.",
        inputSchema: z.object({
          tokenSymbol: z
            .string()
            .describe('The token to send (e.g. "USDT", "OKB", "WOKB").'),
          tokenAddress: z
            .string()
            .describe(
              'The token contract address. Use empty string "" for native OKB.',
            ),
          amount: z
            .string()
            .describe(
              'The amount to send in human-readable units (e.g. "10.5").',
            ),
          toAddress: z
            .string()
            .describe("The destination wallet address (0x...)."),
        }),
        // No execute → client-side
      }),

      // ------------------------------------------------------------------
      // Tool: get_swap_quote
      // Server-executed: fetches a real-time swap quote from OKX DEX API.
      // ------------------------------------------------------------------
      get_swap_quote: tool({
        description:
          "Get a price quote for swapping tokens on X Layer via OKX DEX aggregator. Use this when the user asks about token prices or swap rates.",
        inputSchema: z.object({
          fromToken: z
            .enum(["USDT", "OKB", "WOKB"])
            .describe("Source token symbol."),
          toToken: z
            .enum(["USDT", "OKB", "WOKB"])
            .describe("Destination token symbol."),
          amount: z
            .string()
            .describe("Amount to swap in human-readable units (e.g. '100')."),
        }),
        execute: async ({ fromToken, toToken, amount }) => {
          const from = TOKENS[fromToken as keyof typeof TOKENS];
          const to = TOKENS[toToken as keyof typeof TOKENS];
          if (!from || !to) {
            return { error: true, message: "Unknown token" };
          }

          const amountWei = toMinimalUnits(amount, from.decimals);

          try {
            const res = await fetch(
              `${getBaseUrl()}/api/swap`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "quote",
                  params: {
                    chainIndex: XLAYER_CHAIN_INDEX,
                    fromTokenAddress: from.address,
                    toTokenAddress: to.address,
                    amount: amountWei,
                    swapMode: "exactIn",
                  },
                }),
              },
            );

            if (!res.ok) {
              return { error: true, message: "Failed to get quote" };
            }

            const json = await res.json();
            const quote = json.data?.[0];
            if (!quote) {
              return { error: true, message: "No quote available" };
            }

            return {
              error: false,
              fromToken: fromToken,
              toToken: toToken,
              fromAmount: amount,
              toAmount: quote.toTokenAmount
                ? (
                    Number(quote.toTokenAmount) /
                    Math.pow(10, to.decimals)
                  ).toFixed(6)
                : "unknown",
              estimatedGas: quote.estimateGasFee ?? "unknown",
            };
          } catch {
            return { error: true, message: "Quote request failed" };
          }
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}

function getRiskLabel(level: number): string {
  if (level <= 25) return "Safe Bet";
  if (level <= 50) return "Cautious";
  if (level <= 75) return "Balanced";
  return "Ape In";
}

/** Resolve the base URL for internal API calls during SSR */
function getBaseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
