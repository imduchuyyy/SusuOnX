import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createHmac } from "node:crypto";
import { serverSignAndBroadcast, getWalletAddress } from "@/lib/okx-server";
import type { OkxSession } from "@/lib/okx-auth-store";
import {
  getPoolInfo,
  getTokenBalance,
  getNativeBalance,
  getAllowance,
  getPositions,
  getDetailedPositions,
  getFullRangeTicks,
  calculateAmountsForPool,
  encodeApprove,
  encodeSwap,
  encodeMint,
  encodeDecreaseLiquidity,
  encodeCollect,
  quoteSwap,
  parseAmount,
  formatAmount,
  waitForTx,
  sqrtPriceX96ToPrice,
  UNISWAP_V3,
  TOKENS,
  USDT_WOKB_POOL,
  USDC_WOKB_POOL,
  USDT_XBTC_POOL,
} from "@/lib/uniswap";

export const maxDuration = 120;

// OKX API key credentials (server-side only) for balance lookups
const OKX_API_BASE = "https://web3.okx.com";
const OKX_ACCESS_KEY = process.env.OKX_ACCESS_KEY ?? "";
const OKX_SECRET_KEY = process.env.OKX_SECRET_KEY ?? "";
const OKX_PASSPHRASE = process.env.OKX_PASSPHRASE ?? "";

const XLAYER_CHAIN_INDEX = "196";

/** Map a pool name (e.g. "USDT/WOKB") to its address */
const POOL_MAP: Record<string, string> = {
  "USDT/WOKB": USDT_WOKB_POOL,
  "WOKB/USDT": USDT_WOKB_POOL,
  "USDC/WOKB": USDC_WOKB_POOL,
  "WOKB/USDC": USDC_WOKB_POOL,
  "USDT/xBTC": USDT_XBTC_POOL,
  "xBTC/USDT": USDT_XBTC_POOL,
};

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
    session: clientSession,
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
    session?: OkxSession;
  } = await req.json();

  const riskLevel = persona?.riskLevel ?? 50;
  const riskLabel = getRiskLabel(riskLevel);

  const systemPrompt = `You are SusuOnX, a DeFi AI agent on X Layer blockchain (OKX Layer 2).

USER PROFILE:
- Risk tolerance: ${riskLabel} (${riskLevel}/100)
- Email: ${userAddress || "not connected"}
- Wallet address: ${walletAddress || "not connected"}

KNOWN TOKENS ON X LAYER:
- OKB (native gas token): no contract address, 18 decimals
- WOKB (Wrapped OKB): ${TOKENS.WOKB.address}, 18 decimals  
- USDT: ${TOKENS.USDT.address}, 6 decimals
- USDC: ${TOKENS.USDC.address}, 6 decimals
- xBTC (OKX Wrapped BTC): ${TOKENS.xBTC.address}, 8 decimals

AVAILABLE UNISWAP V3 POOLS ON X LAYER:
1. USDT/WOKB pool: ${USDT_WOKB_POOL} (~9.76% APY, TVL $2.3M)
   Token0: USDT, Token1: WOKB, Fee tier: 3000 (0.3%)
2. USDC/WOKB pool: ${USDC_WOKB_POOL} (~7.2% APY, TVL $850K)
   Token0: USDC, Token1: WOKB, Fee tier: 500 (0.05%)
3. USDT/xBTC pool: ${USDT_XBTC_POOL} (~12.5% APY, TVL $420K)
   Token0: USDT, Token1: xBTC, Fee tier: 500 (0.05%)

YOUR CAPABILITIES (tools available):
1. get_balances — Check the user's wallet balances on X Layer
2. get_positions — Find all of the user's Uniswap V3 LP positions with detailed info (token amounts, fees, etc.)
3. swap_token — Swap tokens on Uniswap V3 (e.g. USDT -> WOKB or WOKB -> USDT)
4. add_liquidity — Add liquidity to a Uniswap V3 pool (mint a new LP position)
5. remove_liquidity — Remove liquidity from a Uniswap V3 pool (burn LP position)
6. withdraw_to_address — Send/withdraw tokens to an external wallet address

IMPORTANT BEHAVIORAL RULES:

1. When the user asks about earning yield, present ALL available pools with their APY, risk level, and TVL:
   - USDT/WOKB: ~9.76% APY, medium risk (impermanent loss from OKB price moves)
   - USDC/WOKB: ~7.2% APY, medium risk, lower fees (0.05%) good for tighter spreads
   - USDT/xBTC: ~12.5% APY, higher risk (BTC volatility + impermanent loss)
   Help the user choose based on their risk tolerance and token holdings.

2. When the user wants to deposit into a Uniswap pool:
   a. First ask which pool they want (or recommend based on their risk profile).
   b. Call get_balances to check what tokens they have.
   c. The pool needs BOTH tokens of the pair. Check if they have both.
   d. If they only have one side, tell them you'll swap half to get both tokens, then ask for confirmation.
   e. Once confirmed, execute the steps: swap if needed, approve tokens, then add_liquidity with the chosen pool.
   f. IMPORTANT: You MUST get explicit user confirmation before executing any swap or deposit. Say exactly what you'll do and wait for "yes" or confirmation.

3. When the user wants to withdraw/exit a pool position, or asks about their positions:
   a. ALWAYS call get_positions first to find all their LP positions with amounts and fees.
   b. Present the positions clearly: show token pair, token amounts, uncollected fees, and position ID.
   c. If they have multiple positions, ask which one they want to withdraw from.
   d. Once confirmed, call remove_liquidity with the specific tokenId.
   e. After removing liquidity, the tokens (USDT + WOKB) are returned to their wallet.
   f. If the user wants to convert everything to a single token after withdrawal, offer to swap.

4. For token swaps, use the swap_token tool. Always confirm the amounts with the user first.

5. For sending tokens to external addresses, use withdraw_to_address. Always verify the destination address with the user.

6. Be concise and professional. Format numbers clearly. Don't explain technical details of transactions unless asked.
7. When showing balances, format them nicely with USD values when available.
8. After executing transactions, always report the result with the transaction hash.

${persona?.systemPrompt ? `\nADDITIONAL USER INSTRUCTIONS:\n${persona.systemPrompt}` : ""}`;

  const result = streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(10),
    tools: {
      // ================================================================
      // Tool: get_balances
      // ================================================================
      get_balances: tool({
        description:
          "Fetch the user's token balances on X Layer. Call this before any swap/deposit/withdraw to check available funds. Also use when user asks 'what do I have' or 'check balance'.",
        inputSchema: z.object({}),
        execute: async () => {
          if (!walletAddress) {
            return { error: true, message: "Wallet not connected." };
          }

          try {
            // Try OKX Balance API first for comprehensive balances
            if (OKX_ACCESS_KEY && OKX_SECRET_KEY) {
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

              if (res.ok) {
                const data = await res.json();
                if (String(data.code) === "0") {
                  const tokenAssets = data.data?.[0]?.tokenAssets ?? [];
                  const balances = tokenAssets
                    .filter(
                      (b: { balance: string }) => parseFloat(b.balance) > 0,
                    )
                    .map(
                      (b: {
                        symbol: string;
                        balance: string;
                        tokenPrice: string;
                        tokenContractAddress: string;
                      }) => ({
                        symbol: b.symbol,
                        balance: b.balance,
                        usdValue: (
                          parseFloat(b.balance) *
                          parseFloat(b.tokenPrice || "0")
                        ).toFixed(2),
                        tokenAddress: b.tokenContractAddress || "",
                      }),
                    );

                  // Also get LP positions
                  let positions: { tokenId: string; liquidity: string; token0: string; token1: string }[] = [];
                  try {
                    const lpPositions = await getPositions(walletAddress);
                    positions = lpPositions.map((p) => ({
                      tokenId: p.tokenId.toString(),
                      liquidity: p.liquidity.toString(),
                      token0: p.token0,
                      token1: p.token1,
                    }));
                  } catch {
                    // Ignore LP position errors
                  }

                  return {
                    error: false,
                    address: walletAddress,
                    balances,
                    lpPositions: positions,
                    totalTokens: balances.length,
                  };
                }
              }
            }

            // Fallback: direct RPC balance check
            const [nativeBalance, usdtBalance, wokbBalance, usdcBalance, xbtcBalance] =
              await Promise.all([
                getNativeBalance(walletAddress),
                getTokenBalance(TOKENS.USDT.address, walletAddress),
                getTokenBalance(TOKENS.WOKB.address, walletAddress),
                getTokenBalance(TOKENS.USDC.address, walletAddress),
                getTokenBalance(TOKENS.xBTC.address, walletAddress),
              ]);

            const balances = [];
            if (nativeBalance > 0n) {
              balances.push({
                symbol: "OKB",
                balance: formatAmount(nativeBalance, 18),
                usdValue: "0",
                tokenAddress: "",
              });
            }
            if (usdtBalance > 0n) {
              balances.push({
                symbol: "USDT",
                balance: formatAmount(usdtBalance, 6),
                usdValue: formatAmount(usdtBalance, 6),
                tokenAddress: TOKENS.USDT.address,
              });
            }
            if (wokbBalance > 0n) {
              balances.push({
                symbol: "WOKB",
                balance: formatAmount(wokbBalance, 18),
                usdValue: "0",
                tokenAddress: TOKENS.WOKB.address,
              });
            }
            if (usdcBalance > 0n) {
              balances.push({
                symbol: "USDC",
                balance: formatAmount(usdcBalance, 6),
                usdValue: formatAmount(usdcBalance, 6),
                tokenAddress: TOKENS.USDC.address,
              });
            }
            if (xbtcBalance > 0n) {
              balances.push({
                symbol: "xBTC",
                balance: formatAmount(xbtcBalance, 8),
                usdValue: "0",
                tokenAddress: TOKENS.xBTC.address,
              });
            }

            let positions: { tokenId: string; liquidity: string; token0: string; token1: string }[] = [];
            try {
              const lpPositions = await getPositions(walletAddress);
              positions = lpPositions.map((p) => ({
                tokenId: p.tokenId.toString(),
                liquidity: p.liquidity.toString(),
                token0: p.token0,
                token1: p.token1,
              }));
            } catch {
              // Ignore
            }

            return {
              error: false,
              address: walletAddress,
              balances,
              lpPositions: positions,
              totalTokens: balances.length,
            };
          } catch (err) {
            return {
              error: true,
              message:
                err instanceof Error ? err.message : "Balance fetch failed.",
            };
          }
        },
      }),

      // ================================================================
      // Tool: get_positions
      // ================================================================
      get_positions: tool({
        description:
          "Find all Uniswap V3 LP positions owned by the user on X Layer. Returns detailed info for each position: token pair, token amounts, uncollected fees, fee tier, and whether the position is active. ALWAYS call this before removing liquidity so you know which positions exist and their token IDs.",
        inputSchema: z.object({}),
        execute: async () => {
          if (!walletAddress) {
            return { error: true, message: "Wallet not connected." };
          }

          try {
            const positions = await getDetailedPositions(walletAddress);

            if (positions.length === 0) {
              return {
                error: false,
                positions: [],
                message: "No Uniswap V3 LP positions found for this wallet.",
              };
            }

            return {
              error: false,
              totalPositions: positions.length,
              positions: positions.map((p) => ({
                tokenId: p.tokenId.toString(),
                pair: `${p.token0Symbol}/${p.token1Symbol}`,
                feeTier: p.feeTierLabel,
                isActive: p.isActive,
                amount0: p.amount0,
                amount1: p.amount1,
                token0Symbol: p.token0Symbol,
                token1Symbol: p.token1Symbol,
                unclaimedFees0: p.fees0,
                unclaimedFees1: p.fees1,
                hasUnclaimedFees: p.hasUnclaimedFees,
                liquidity: p.liquidity.toString(),
              })),
            };
          } catch (err) {
            return {
              error: true,
              message:
                err instanceof Error
                  ? err.message
                  : "Failed to fetch positions.",
            };
          }
        },
      }),

      // ================================================================
      // Tool: swap_token
      // ================================================================
      swap_token: tool({
        description:
          "Swap tokens on Uniswap V3 on X Layer. Supported tokens: USDT, WOKB, USDC, xBTC. The correct pool is selected automatically based on the token pair. Call this when user wants to swap tokens, or when you need to prepare tokens for a liquidity deposit.",
        inputSchema: z.object({
          fromToken: z
            .enum(["USDT", "WOKB", "USDC", "xBTC"])
            .describe("Token to swap from."),
          toToken: z
            .enum(["USDT", "WOKB", "USDC", "xBTC"])
            .describe("Token to swap to."),
          amount: z
            .string()
            .describe(
              "Amount of fromToken to swap in human-readable units (e.g. '50' for 50 USDT).",
            ),
          slippagePercent: z
            .number()
            .optional()
            .default(1)
            .describe("Slippage tolerance in percent (default 1%)."),
        }),
        execute: async ({ fromToken, toToken, amount, slippagePercent }) => {
          if (!clientSession) {
            return { error: true, message: "Not authenticated. Please sign in first." };
          }
          const wallet = getWalletAddress(clientSession);
          if (!wallet) {
            return { error: true, message: "No wallet address found." };
          }

          const fromTokenInfo = TOKENS[fromToken as keyof typeof TOKENS];
          const toTokenInfo = TOKENS[toToken as keyof typeof TOKENS];
          if (!fromTokenInfo || !toTokenInfo) {
            return { error: true, message: "Unknown token." };
          }

          // Resolve the correct pool for this token pair
          const poolKey = `${fromToken}/${toToken}`;
          const poolAddress = POOL_MAP[poolKey];
          if (!poolAddress) {
            return {
              error: true,
              message: `No direct pool found for ${fromToken}/${toToken}. Try swapping through USDT first.`,
            };
          }

          try {
            const amountIn = parseAmount(amount, fromTokenInfo.decimals);

            // Step 1: Check balance
            const balance = await getTokenBalance(fromTokenInfo.address, wallet);
            if (balance < amountIn) {
              return {
                error: true,
                message: `Insufficient ${fromToken} balance. Have ${formatAmount(balance, fromTokenInfo.decimals)}, need ${amount}.`,
              };
            }

            // Step 2: Get quote
            const poolInfo = await getPoolInfo(poolAddress);
            const expectedOut = await quoteSwap(
              fromTokenInfo.address,
              toTokenInfo.address,
              poolInfo.fee,
              amountIn,
            );
            const minOut =
              (expectedOut * BigInt(Math.floor((100 - (slippagePercent ?? 1)) * 100))) /
              10000n;

            // Step 3: Approve token for SwapRouter
            const allowance = await getAllowance(
              fromTokenInfo.address,
              wallet,
              UNISWAP_V3.swapRouter,
            );
            if (allowance < amountIn) {
              const approveData = encodeApprove(
                UNISWAP_V3.swapRouter,
                amountIn * 2n, // approve extra for convenience
              );
              const approveResult = await serverSignAndBroadcast({
                session: clientSession,
                toAddr: fromTokenInfo.address,
                value: "0",
                contractAddr: fromTokenInfo.address,
                inputData: approveData,
                isContractCall: true,
              });
              // Wait for approval confirmation
              await waitForTx(approveResult.txHash);
            }

            // Step 4: Execute swap
            const swapData = encodeSwap({
              tokenIn: fromTokenInfo.address,
              tokenOut: toTokenInfo.address,
              fee: poolInfo.fee,
              recipient: wallet,
              amountIn,
              amountOutMinimum: minOut,
            });

            const swapResult = await serverSignAndBroadcast({
              session: clientSession,
              toAddr: UNISWAP_V3.swapRouter,
              value: "0",
              contractAddr: UNISWAP_V3.swapRouter,
              inputData: swapData,
              isContractCall: true,
            });

            return {
              error: false,
              action: "swap",
              fromToken,
              toToken,
              amountIn: amount,
              expectedOut: formatAmount(expectedOut, toTokenInfo.decimals),
              minOut: formatAmount(minOut, toTokenInfo.decimals),
              txHash: swapResult.txHash,
              explorerUrl: `https://www.okx.com/explorer/xlayer/tx/${swapResult.txHash}`,
            };
          } catch (err) {
            return {
              error: true,
              message: err instanceof Error ? err.message : "Swap failed.",
            };
          }
        },
      }),

      // ================================================================
      // Tool: add_liquidity
      // ================================================================
      add_liquidity: tool({
        description:
          "Add liquidity to a Uniswap V3 pool on X Layer. Supported pools: USDT/WOKB, USDC/WOKB, USDT/xBTC. Creates a new LP position with full-range ticks. Both tokens of the pair must be in the wallet. Call this after ensuring the user has both tokens (swap first if needed).",
        inputSchema: z.object({
          pool: z
            .enum(["USDT/WOKB", "USDC/WOKB", "USDT/xBTC"])
            .describe("Which pool to add liquidity to."),
          amountA: z
            .string()
            .describe("Amount of the first token (USDT or USDC) to provide as liquidity (human-readable, e.g. '100')."),
          amountB: z
            .string()
            .describe("Amount of the second token (WOKB or xBTC) to provide as liquidity (human-readable, e.g. '5.5')."),
        }),
        execute: async ({ pool, amountA, amountB }) => {
          if (!clientSession) {
            return { error: true, message: "Not authenticated. Please sign in first." };
          }
          const wallet = getWalletAddress(clientSession);
          if (!wallet) {
            return { error: true, message: "No wallet address found." };
          }

          try {
            // Resolve pool address and token info
            const poolAddress = POOL_MAP[pool];
            if (!poolAddress) {
              return { error: true, message: `Unknown pool: ${pool}.` };
            }
            const [symbolA, symbolB] = pool.split("/") as [string, string];
            const tokenAInfo = TOKENS[symbolA as keyof typeof TOKENS];
            const tokenBInfo = TOKENS[symbolB as keyof typeof TOKENS];
            if (!tokenAInfo || !tokenBInfo) {
              return { error: true, message: "Unknown token in pool pair." };
            }

            const poolInfo = await getPoolInfo(poolAddress);
            const { tickLower, tickUpper } = getFullRangeTicks(
              poolInfo.tickSpacing,
            );

            // Determine token ordering (Uniswap requires token0 < token1)
            const token0 = poolInfo.token0.toLowerCase();

            const isAToken0 =
              token0 === tokenAInfo.address.toLowerCase();

            let amount0: bigint, amount1: bigint;
            let token0Addr: string, token1Addr: string;

            if (isAToken0) {
              amount0 = parseAmount(amountA, tokenAInfo.decimals);
              amount1 = parseAmount(amountB, tokenBInfo.decimals);
              token0Addr = tokenAInfo.address;
              token1Addr = tokenBInfo.address;
            } else {
              amount0 = parseAmount(amountB, tokenBInfo.decimals);
              amount1 = parseAmount(amountA, tokenAInfo.decimals);
              token0Addr = tokenBInfo.address;
              token1Addr = tokenAInfo.address;
            }

            // Check balances
            const balanceA = await getTokenBalance(tokenAInfo.address, wallet);
            const balanceB = await getTokenBalance(tokenBInfo.address, wallet);

            const neededA = parseAmount(amountA, tokenAInfo.decimals);
            const neededB = parseAmount(amountB, tokenBInfo.decimals);

            if (balanceA < neededA) {
              return {
                error: true,
                message: `Insufficient ${symbolA}. Have ${formatAmount(balanceA, tokenAInfo.decimals)}, need ${amountA}.`,
              };
            }
            if (balanceB < neededB) {
              return {
                error: true,
                message: `Insufficient ${symbolB}. Have ${formatAmount(balanceB, tokenBInfo.decimals)}, need ${amountB}.`,
              };
            }

            // Approve token A for NonfungiblePositionManager
            const allowanceA = await getAllowance(
              tokenAInfo.address,
              wallet,
              UNISWAP_V3.positionManager,
            );
            if (allowanceA < neededA) {
              const approveData = encodeApprove(
                UNISWAP_V3.positionManager,
                neededA * 2n,
              );
              const approveTx = await serverSignAndBroadcast({
                session: clientSession,
                toAddr: tokenAInfo.address,
                value: "0",
                contractAddr: tokenAInfo.address,
                inputData: approveData,
                isContractCall: true,
              });
              await waitForTx(approveTx.txHash);
            }

            // Approve token B for NonfungiblePositionManager
            const allowanceB = await getAllowance(
              tokenBInfo.address,
              wallet,
              UNISWAP_V3.positionManager,
            );
            if (allowanceB < neededB) {
              const approveData = encodeApprove(
                UNISWAP_V3.positionManager,
                neededB * 2n,
              );
              const approveTx = await serverSignAndBroadcast({
                session: clientSession,
                toAddr: tokenBInfo.address,
                value: "0",
                contractAddr: tokenBInfo.address,
                inputData: approveData,
                isContractCall: true,
              });
              await waitForTx(approveTx.txHash);
            }

            // Mint LP position
            const mintData = encodeMint({
              token0: token0Addr,
              token1: token1Addr,
              fee: poolInfo.fee,
              tickLower,
              tickUpper,
              amount0Desired: amount0,
              amount1Desired: amount1,
              amount0Min: 0n,
              amount1Min: 0n,
              recipient: wallet,
            });

            const mintResult = await serverSignAndBroadcast({
              session: clientSession,
              toAddr: UNISWAP_V3.positionManager,
              value: "0",
              contractAddr: UNISWAP_V3.positionManager,
              inputData: mintData,
              isContractCall: true,
            });

            return {
              error: false,
              action: "add_liquidity",
              pool,
              [`amount${symbolA}`]: amountA,
              [`amount${symbolB}`]: amountB,
              txHash: mintResult.txHash,
              explorerUrl: `https://www.okx.com/explorer/xlayer/tx/${mintResult.txHash}`,
            };
          } catch (err) {
            return {
              error: true,
              message:
                err instanceof Error ? err.message : "Add liquidity failed.",
            };
          }
        },
      }),

      // ================================================================
      // Tool: remove_liquidity
      // ================================================================
      remove_liquidity: tool({
        description:
          "Remove liquidity from a Uniswap V3 pool on X Layer. Burns the LP position and returns both tokens (USDT + WOKB) to the wallet. If tokenId is not provided, removes from the first active position found.",
        inputSchema: z.object({
          tokenId: z
            .string()
            .optional()
            .describe(
              "The NFT token ID of the LP position to remove. If not provided, uses the first active position.",
            ),
          percentToRemove: z
            .number()
            .optional()
            .default(100)
            .describe(
              "Percentage of liquidity to remove (1-100, default 100 for full withdrawal).",
            ),
        }),
        execute: async ({ tokenId, percentToRemove }) => {
          if (!clientSession) {
            return { error: true, message: "Not authenticated. Please sign in first." };
          }
          const wallet = getWalletAddress(clientSession);
          if (!wallet) {
            return { error: true, message: "No wallet address found." };
          }

          try {
            let targetTokenId: bigint;
            let positionLiquidity: bigint;

            if (tokenId) {
              targetTokenId = BigInt(tokenId);
              // We need to look up the position's liquidity
              const positions = await getPositions(wallet);
              const pos = positions.find(
                (p) => p.tokenId === targetTokenId,
              );
              if (!pos) {
                return {
                  error: true,
                  message: `Position ${tokenId} not found or has no liquidity.`,
                };
              }
              positionLiquidity = pos.liquidity;
            } else {
              // Find first active position
              const positions = await getPositions(wallet);
              if (positions.length === 0) {
                return {
                  error: true,
                  message:
                    "No active Uniswap V3 LP positions found for this wallet.",
                };
              }
              targetTokenId = positions[0].tokenId;
              positionLiquidity = positions[0].liquidity;
            }

            const pct = Math.min(Math.max(percentToRemove ?? 100, 1), 100);
            const liquidityToRemove =
              (positionLiquidity * BigInt(pct)) / 100n;

            // Step 1: Decrease liquidity
            const decreaseData = encodeDecreaseLiquidity({
              tokenId: targetTokenId,
              liquidity: liquidityToRemove,
              amount0Min: 0n,
              amount1Min: 0n,
            });

            const decreaseTx = await serverSignAndBroadcast({
              session: clientSession,
              toAddr: UNISWAP_V3.positionManager,
              value: "0",
              contractAddr: UNISWAP_V3.positionManager,
              inputData: decreaseData,
              isContractCall: true,
            });

            await waitForTx(decreaseTx.txHash);

            // Step 2: Collect tokens
            const collectData = encodeCollect(targetTokenId, wallet);

            const collectTx = await serverSignAndBroadcast({
              session: clientSession,
              toAddr: UNISWAP_V3.positionManager,
              value: "0",
              contractAddr: UNISWAP_V3.positionManager,
              inputData: collectData,
              isContractCall: true,
            });

            return {
              error: false,
              action: "remove_liquidity",
              tokenId: targetTokenId.toString(),
              percentRemoved: pct,
              decreaseTxHash: decreaseTx.txHash,
              collectTxHash: collectTx.txHash,
              explorerUrl: `https://www.okx.com/explorer/xlayer/tx/${collectTx.txHash}`,
            };
          } catch (err) {
            return {
              error: true,
              message:
                err instanceof Error
                  ? err.message
                  : "Remove liquidity failed.",
            };
          }
        },
      }),

      // ================================================================
      // Tool: withdraw_to_address
      // ================================================================
      withdraw_to_address: tool({
        description:
          "Send/transfer/withdraw tokens from the agent wallet to an external address on X Layer. Use for OKB (native), USDT, WOKB, USDC, or xBTC transfers.",
        inputSchema: z.object({
          token: z
            .enum(["OKB", "USDT", "WOKB", "USDC", "xBTC"])
            .describe("Token to send."),
          amount: z
            .string()
            .describe(
              'Amount to send in human-readable units (e.g. "10.5").',
            ),
          toAddress: z
            .string()
            .describe("Destination wallet address (0x...)."),
        }),
        execute: async ({ token, amount, toAddress }) => {
          if (!clientSession) {
            return { error: true, message: "Not authenticated. Please sign in first." };
          }
          const wallet = getWalletAddress(clientSession);
          if (!wallet) {
            return { error: true, message: "No wallet address found." };
          }

          // Validate address
          if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
            return {
              error: true,
              message: "Invalid destination address format.",
            };
          }

          try {
            if (token === "OKB") {
              // Native token transfer
              const balance = await getNativeBalance(wallet);
              const amountWei = parseAmount(amount, 18);
              if (balance < amountWei) {
                return {
                  error: true,
                  message: `Insufficient OKB. Have ${formatAmount(balance, 18)}, need ${amount}.`,
                };
              }

              const result = await serverSignAndBroadcast({
                session: clientSession,
                toAddr: toAddress,
                value: amountWei.toString(),
                isContractCall: false,
              });

              return {
                error: false,
                action: "send",
                token: "OKB",
                amount,
                toAddress,
                txHash: result.txHash,
                explorerUrl: `https://www.okx.com/explorer/xlayer/tx/${result.txHash}`,
              };
            }

            // ERC-20 transfer
            const tokenInfo = TOKENS[token as keyof typeof TOKENS];
            if (!tokenInfo) {
              return { error: true, message: "Unknown token." };
            }

            const balance = await getTokenBalance(tokenInfo.address, wallet);
            const amountUnits = parseAmount(amount, tokenInfo.decimals);
            if (balance < amountUnits) {
              return {
                error: true,
                message: `Insufficient ${token}. Have ${formatAmount(balance, tokenInfo.decimals)}, need ${amount}.`,
              };
            }

            // Encode ERC-20 transfer(address to, uint256 amount)
            const transferData =
              "0xa9059cbb" +
              toAddress.slice(2).padStart(64, "0") +
              amountUnits.toString(16).padStart(64, "0");

            const result = await serverSignAndBroadcast({
              session: clientSession,
              toAddr: tokenInfo.address,
              value: "0",
              contractAddr: tokenInfo.address,
              inputData: transferData,
              isContractCall: true,
            });

            return {
              error: false,
              action: "send",
              token,
              amount,
              toAddress,
              txHash: result.txHash,
              explorerUrl: `https://www.okx.com/explorer/xlayer/tx/${result.txHash}`,
            };
          } catch (err) {
            return {
              error: true,
              message: err instanceof Error ? err.message : "Transfer failed.",
            };
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
