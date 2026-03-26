/**
 * Uniswap V3 interaction library for X Layer
 *
 * Uses ethers.js to encode contract calls for Uniswap V3:
 * - SwapRouter: exact input swaps
 * - NonfungiblePositionManager: mint/add/remove liquidity
 * - Pool: read slot0, liquidity, etc.
 *
 * All transactions are signed and broadcast via the OKX Agentic Wallet API.
 * This module only encodes calldata — it does NOT send transactions itself.
 */

import { ethers } from "ethers";

// ---------------------------------------------------------------------------
// X Layer RPC & Uniswap V3 deployment addresses
// ---------------------------------------------------------------------------

export const XLAYER_RPC = "https://rpc.xlayer.tech";
export const XLAYER_CHAIN_ID = 196;

/** Uniswap V3 deployment addresses on X Layer (custom deployment — NOT mainnet addresses) */
export const UNISWAP_V3 = {
  factory: "0x4b2ab38dbf28d31d467aa8993f6c2585981d6804",
  swapRouter: "0x4f0c28f5926afda16bf2506d5d9e57ea190f9bca", // SwapRouter02
  positionManager: "0x315e413a11ab0df498ef83873012430ca36638ae",
  quoter: "0x976183ac3d09840d243a88c0268badb3b3e3259f", // QuoterV2
  tickLens: "0x661e93cca42afacb172121ef892830ca3b70f08d",
  multicall: "0xe2023f3fa515cf070e07fd9d51c1d236e07843f4",
} as const;

/** Known tokens on X Layer */
export const TOKENS = {
  WOKB: {
    address: "0xe538905cf8410324e03A5A23C1c177a474D59b2b",
    decimals: 18,
    symbol: "WOKB",
  },
  USDT: {
    address: "0x779ded0c9e1022225f8e0630b35a9b54be713736",
    decimals: 6,
    symbol: "USDT",
  },
  USDC: {
    address: "0x74b7f16337b8972027f6196a17a631ac6de26d22",
    decimals: 6,
    symbol: "USDC",
  },
  xBTC: {
    address: "0xb7c00000bcdeef966b20b3d884b98e64d2b06b4f",
    decimals: 8,
    symbol: "xBTC",
  },
} as const;

/** Known Uniswap V3 pools on X Layer */
export const USDT_WOKB_POOL = "0x63d62734847E55A266FCa4219A9aD0a02D5F6e02";
export const USDC_WOKB_POOL = "0x92ae4136f5f141f9d20eaa0c3533f48c21fa8580";
export const USDT_XBTC_POOL = "0x5fcfb33c9ab1665fee892eb2af163e863a874d73";

/** Map pool address → fee tier for quick lookup */
export const POOL_FEES: Record<string, number> = {
  [USDT_WOKB_POOL.toLowerCase()]: 3000,   // 0.3%
  [USDC_WOKB_POOL.toLowerCase()]: 500,    // 0.05%
  [USDT_XBTC_POOL.toLowerCase()]: 500,    // 0.05%
};

// ---------------------------------------------------------------------------
// ABIs (minimal — only the functions we need)
// ---------------------------------------------------------------------------

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

const POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function fee() external view returns (uint24)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function liquidity() external view returns (uint128)",
  "function tickSpacing() external view returns (int24)",
];

const SWAP_ROUTER_ABI = [
  // SwapRouter02 — no deadline in the struct (use checkDeadline modifier separately)
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
];

const POSITION_MANAGER_ABI = [
  "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  "function decreaseLiquidity((uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline)) external payable returns (uint256 amount0, uint256 amount1)",
  "function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) external payable returns (uint256 amount0, uint256 amount1)",
  "function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
];

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

let _provider: ethers.JsonRpcProvider | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(XLAYER_RPC);
  }
  return _provider;
}

// ---------------------------------------------------------------------------
// Pool info
// ---------------------------------------------------------------------------

export interface PoolInfo {
  token0: string;
  token1: string;
  fee: number;
  tickSpacing: number;
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
}

export async function getPoolInfo(
  poolAddress: string = USDT_WOKB_POOL,
): Promise<PoolInfo> {
  const provider = getProvider();
  const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);

  const [slot0, fee, token0, token1, liquidity, tickSpacing] =
    await Promise.all([
      pool.slot0(),
      pool.fee(),
      pool.token0(),
      pool.token1(),
      pool.liquidity(),
      pool.tickSpacing(),
    ]);

  return {
    token0: token0 as string,
    token1: token1 as string,
    fee: Number(fee),
    tickSpacing: Number(tickSpacing),
    sqrtPriceX96: BigInt(slot0[0]),
    tick: Number(slot0[1]),
    liquidity: BigInt(liquidity),
  };
}

/**
 * Calculate the price of token0 in terms of token1 from sqrtPriceX96.
 */
export function sqrtPriceX96ToPrice(
  sqrtPriceX96: bigint,
  token0Decimals: number,
  token1Decimals: number,
): number {
  const Q96 = BigInt(2) ** BigInt(96);
  const price =
    Number(sqrtPriceX96 * sqrtPriceX96) /
    Number(Q96 * Q96) *
    10 ** (token0Decimals - token1Decimals);
  return price;
}

// ---------------------------------------------------------------------------
// ERC-20 helpers
// ---------------------------------------------------------------------------

export function encodeApprove(
  spender: string,
  amount: bigint,
): string {
  const iface = new ethers.Interface(ERC20_ABI);
  return iface.encodeFunctionData("approve", [spender, amount]);
}

export async function getAllowance(
  tokenAddress: string,
  owner: string,
  spender: string,
): Promise<bigint> {
  const provider = getProvider();
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  return BigInt(await token.allowance(owner, spender));
}

export async function getTokenBalance(
  tokenAddress: string,
  owner: string,
): Promise<bigint> {
  const provider = getProvider();
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  return BigInt(await token.balanceOf(owner));
}

export async function getNativeBalance(address: string): Promise<bigint> {
  const provider = getProvider();
  return await provider.getBalance(address);
}

// ---------------------------------------------------------------------------
// Swap: exact input single
// ---------------------------------------------------------------------------

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  fee: number;
  recipient: string;
  amountIn: bigint;
  amountOutMinimum: bigint;
  sqrtPriceLimitX96?: bigint;
}

/**
 * Encode a Uniswap V3 exactInputSingle swap calldata (SwapRouter02).
 * Note: SwapRouter02 does not include deadline in the struct —
 * it uses a separate checkDeadline modifier via multicall if needed.
 */
export function encodeSwap(params: SwapParams): string {
  const iface = new ethers.Interface(SWAP_ROUTER_ABI);

  return iface.encodeFunctionData("exactInputSingle", [
    {
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      fee: params.fee,
      recipient: params.recipient,
      amountIn: params.amountIn,
      amountOutMinimum: params.amountOutMinimum,
      sqrtPriceLimitX96: params.sqrtPriceLimitX96 ?? 0n,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Liquidity: mint position (full range)
// ---------------------------------------------------------------------------

export interface MintParams {
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  amount0Desired: bigint;
  amount1Desired: bigint;
  amount0Min: bigint;
  amount1Min: bigint;
  recipient: string;
}

/**
 * Encode a NonfungiblePositionManager mint calldata for adding liquidity.
 */
export function encodeMint(params: MintParams): string {
  const iface = new ethers.Interface(POSITION_MANAGER_ABI);
  const deadline = Math.floor(Date.now() / 1000) + 1800;

  return iface.encodeFunctionData("mint", [
    {
      token0: params.token0,
      token1: params.token1,
      fee: params.fee,
      tickLower: params.tickLower,
      tickUpper: params.tickUpper,
      amount0Desired: params.amount0Desired,
      amount1Desired: params.amount1Desired,
      amount0Min: params.amount0Min,
      amount1Min: params.amount1Min,
      recipient: params.recipient,
      deadline,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Liquidity: decrease liquidity + collect
// ---------------------------------------------------------------------------

export interface DecreaseLiquidityParams {
  tokenId: bigint;
  liquidity: bigint;
  amount0Min: bigint;
  amount1Min: bigint;
}

export function encodeDecreaseLiquidity(
  params: DecreaseLiquidityParams,
): string {
  const iface = new ethers.Interface(POSITION_MANAGER_ABI);
  const deadline = Math.floor(Date.now() / 1000) + 1800;

  return iface.encodeFunctionData("decreaseLiquidity", [
    {
      tokenId: params.tokenId,
      liquidity: params.liquidity,
      amount0Min: params.amount0Min,
      amount1Min: params.amount1Min,
      deadline,
    },
  ]);
}

export function encodeCollect(
  tokenId: bigint,
  recipient: string,
): string {
  const iface = new ethers.Interface(POSITION_MANAGER_ABI);
  const MAX_UINT128 = (1n << 128n) - 1n;

  return iface.encodeFunctionData("collect", [
    {
      tokenId,
      recipient,
      amount0Max: MAX_UINT128,
      amount1Max: MAX_UINT128,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Position helpers
// ---------------------------------------------------------------------------

export interface PositionInfo {
  tokenId: bigint;
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
}

/**
 * Get all Uniswap V3 LP positions owned by an address.
 * Only returns positions with liquidity > 0.
 */
export async function getPositions(owner: string): Promise<PositionInfo[]> {
  const provider = getProvider();
  const pm = new ethers.Contract(
    UNISWAP_V3.positionManager,
    POSITION_MANAGER_ABI,
    provider,
  );

  const balance = Number(await pm.balanceOf(owner));
  const positions: PositionInfo[] = [];

  for (let i = 0; i < balance; i++) {
    const tokenId = BigInt(await pm.tokenOfOwnerByIndex(owner, i));
    const pos = await pm.positions(tokenId);

    // Only include positions with liquidity > 0
    if (BigInt(pos[7]) > 0n) {
      positions.push({
        tokenId,
        token0: pos[2] as string,
        token1: pos[3] as string,
        fee: Number(pos[4]),
        tickLower: Number(pos[5]),
        tickUpper: Number(pos[6]),
        liquidity: BigInt(pos[7]),
      });
    }
  }

  return positions;
}

// ---------------------------------------------------------------------------
// Detailed position info (amounts + uncollected fees)
// ---------------------------------------------------------------------------

export interface DetailedPositionInfo extends PositionInfo {
  /** Human-readable symbol for token0 */
  token0Symbol: string;
  /** Human-readable symbol for token1 */
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  /** Estimated amount of token0 in the position (human-readable) */
  amount0: string;
  /** Estimated amount of token1 in the position (human-readable) */
  amount1: string;
  /** Uncollected fees for token0 (human-readable) */
  fees0: string;
  /** Uncollected fees for token1 (human-readable) */
  fees1: string;
  /** Whether this position has uncollected fees or owed tokens */
  hasUnclaimedFees: boolean;
  /** Whether the position's liquidity is > 0 */
  isActive: boolean;
  /** Fee tier as a human-readable string like "0.3%" */
  feeTierLabel: string;
}

/** Known token metadata lookup (lowercase address → info) */
const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  [TOKENS.USDT.address.toLowerCase()]: { symbol: "USDT", decimals: 6 },
  [TOKENS.WOKB.address.toLowerCase()]: { symbol: "WOKB", decimals: 18 },
};

/**
 * Resolve symbol and decimals for a token address.
 * Uses local cache for known tokens, otherwise reads from chain.
 */
async function resolveTokenMeta(
  tokenAddress: string,
): Promise<{ symbol: string; decimals: number }> {
  const known = KNOWN_TOKENS[tokenAddress.toLowerCase()];
  if (known) return known;

  const provider = getProvider();
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  try {
    const [symbol, decimals] = await Promise.all([
      token.symbol(),
      token.decimals(),
    ]);
    const meta = { symbol: symbol as string, decimals: Number(decimals) };
    // Cache for subsequent lookups
    KNOWN_TOKENS[tokenAddress.toLowerCase()] = meta;
    return meta;
  } catch {
    return { symbol: tokenAddress.slice(0, 8), decimals: 18 };
  }
}

/**
 * Calculate the token amounts held in a Uniswap V3 position given the
 * current pool price (sqrtPriceX96) and the position's tick range and liquidity.
 *
 * Uses the Uniswap V3 math:
 *   amount0 = L * (sqrt(upper) - sqrt(current)) / (sqrt(current) * sqrt(upper))
 *   amount1 = L * (sqrt(current) - sqrt(lower))
 *
 * Returns raw bigint amounts.
 */
function calculatePositionAmounts(
  liquidity: bigint,
  tickLower: number,
  tickUpper: number,
  currentTick: number,
  sqrtPriceX96: bigint,
): { amount0: bigint; amount1: bigint } {
  const Q96 = 1n << 96n;

  // Convert ticks to sqrtPriceX96 values
  const sqrtLower = tickToSqrtPriceX96(tickLower);
  const sqrtUpper = tickToSqrtPriceX96(tickUpper);
  const sqrtCurrent = sqrtPriceX96;

  let amount0 = 0n;
  let amount1 = 0n;

  if (currentTick < tickLower) {
    // Price below range — all token0
    amount0 =
      (liquidity * Q96 * (sqrtUpper - sqrtLower)) /
      (sqrtLower * sqrtUpper);
  } else if (currentTick >= tickUpper) {
    // Price above range — all token1
    amount1 = (liquidity * (sqrtUpper - sqrtLower)) / Q96;
  } else {
    // Price in range
    amount0 =
      (liquidity * Q96 * (sqrtUpper - sqrtCurrent)) /
      (sqrtCurrent * sqrtUpper);
    amount1 = (liquidity * (sqrtCurrent - sqrtLower)) / Q96;
  }

  return { amount0, amount1 };
}

/**
 * Convert a tick to sqrtPriceX96 using the Uniswap V3 TickMath algorithm.
 *
 * This is a direct port of the Solidity TickMath.getSqrtRatioAtTick()
 * using BigInt arithmetic to avoid floating-point precision issues
 * (especially for extreme ticks used in full-range positions).
 *
 * Reference: https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/TickMath.sol
 */
function tickToSqrtPriceX96(tick: number): bigint {
  const absTick = Math.abs(tick);
  if (absTick > 887272) throw new Error(`Tick ${tick} out of range`);

  // Each magic number is 2^128 / sqrt(1.0001^(2^i)) — precomputed constants
  let ratio: bigint = (absTick & 0x1) !== 0
    ? 0xfffcb933bd6fad37aa2d162d1a594001n
    : 0x100000000000000000000000000000000n;

  if ((absTick & 0x2) !== 0)     ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
  if ((absTick & 0x4) !== 0)     ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
  if ((absTick & 0x8) !== 0)     ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
  if ((absTick & 0x10) !== 0)    ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
  if ((absTick & 0x20) !== 0)    ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
  if ((absTick & 0x40) !== 0)    ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
  if ((absTick & 0x80) !== 0)    ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
  if ((absTick & 0x100) !== 0)   ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
  if ((absTick & 0x200) !== 0)   ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
  if ((absTick & 0x400) !== 0)   ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
  if ((absTick & 0x800) !== 0)   ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
  if ((absTick & 0x1000) !== 0)  ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
  if ((absTick & 0x2000) !== 0)  ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
  if ((absTick & 0x4000) !== 0)  ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
  if ((absTick & 0x8000) !== 0)  ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
  if ((absTick & 0x10000) !== 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
  if ((absTick & 0x20000) !== 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
  if ((absTick & 0x40000) !== 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
  if ((absTick & 0x80000) !== 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;

  // If tick is positive, invert (Uniswap convention: positive tick = higher price)
  if (tick > 0) {
    const MAX_UINT256 = (1n << 256n) - 1n;
    ratio = MAX_UINT256 / ratio;
  }

  // Convert from Q128.128 to Q64.96 (shift right by 32)
  return (ratio >> 32n) + (ratio % (1n << 32n) > 0n ? 1n : 0n);
}

/**
 * Get ALL Uniswap V3 LP positions for an address with detailed info:
 * token amounts, uncollected fees, symbols, decimals.
 *
 * Includes positions with zero liquidity that still have uncollected fees/tokens.
 */
export async function getDetailedPositions(
  owner: string,
): Promise<DetailedPositionInfo[]> {
  const provider = getProvider();
  const pm = new ethers.Contract(
    UNISWAP_V3.positionManager,
    POSITION_MANAGER_ABI,
    provider,
  );

  const nftBalance = Number(await pm.balanceOf(owner));
  if (nftBalance === 0) return [];

  // Fetch all token IDs in parallel
  const tokenIdPromises = Array.from({ length: nftBalance }, (_, i) =>
    pm.tokenOfOwnerByIndex(owner, i).then((id: bigint) => BigInt(id)),
  );
  const tokenIds = await Promise.all(tokenIdPromises);

  // Fetch all position data in parallel
  const positionDataPromises = tokenIds.map((id) => pm.positions(id));
  const positionsRaw = await Promise.all(positionDataPromises);

  // Build a map of unique pool keys to fetch pool info once
  const poolKeyMap = new Map<
    string,
    { token0: string; token1: string; fee: number }
  >();

  const positionsBasic = positionsRaw.map((pos, idx) => {
    const token0 = (pos[2] as string).toLowerCase();
    const token1 = (pos[3] as string).toLowerCase();
    const fee = Number(pos[4]);
    const poolKey = `${token0}-${token1}-${fee}`;
    poolKeyMap.set(poolKey, { token0, token1, fee });

    return {
      tokenId: tokenIds[idx],
      token0,
      token1,
      fee,
      tickLower: Number(pos[5]),
      tickUpper: Number(pos[6]),
      liquidity: BigInt(pos[7]),
      tokensOwed0: BigInt(pos[10]),
      tokensOwed1: BigInt(pos[11]),
      poolKey,
    };
  });

  // Filter out positions with no liquidity AND no owed tokens
  const relevantPositions = positionsBasic.filter(
    (p) => p.liquidity > 0n || p.tokensOwed0 > 0n || p.tokensOwed1 > 0n,
  );

  if (relevantPositions.length === 0) return [];

  // Resolve pool info for each unique pool (for current tick/price)
  // Use factory to compute pool addresses
  const factoryContract = new ethers.Contract(
    UNISWAP_V3.factory,
    ["function getPool(address, address, uint24) external view returns (address)"],
    provider,
  );

  const poolInfoCache = new Map<string, { sqrtPriceX96: bigint; tick: number }>();

  const uniquePools = Array.from(poolKeyMap.entries());
  const poolInfoPromises = uniquePools.map(async ([key, { token0, token1, fee }]) => {
    try {
      const poolAddr = await factoryContract.getPool(token0, token1, fee);
      if (poolAddr === ethers.ZeroAddress) return;
      const poolContract = new ethers.Contract(poolAddr, POOL_ABI, provider);
      const slot0 = await poolContract.slot0();
      poolInfoCache.set(key, {
        sqrtPriceX96: BigInt(slot0[0]),
        tick: Number(slot0[1]),
      });
    } catch {
      // Pool may not exist or be uninitialized — skip
    }
  });

  // Resolve token metadata in parallel with pool info
  const allTokenAddresses = new Set<string>();
  for (const p of relevantPositions) {
    allTokenAddresses.add(p.token0);
    allTokenAddresses.add(p.token1);
  }
  const tokenMetaPromise = Promise.all(
    Array.from(allTokenAddresses).map(async (addr) => {
      const meta = await resolveTokenMeta(addr);
      return [addr, meta] as const;
    }),
  );

  const [, tokenMetaEntries] = await Promise.all([
    Promise.all(poolInfoPromises),
    tokenMetaPromise,
  ]);

  const tokenMetaMap = new Map(tokenMetaEntries);

  // Build detailed position info
  const detailed: DetailedPositionInfo[] = relevantPositions.map((p) => {
    const meta0 = tokenMetaMap.get(p.token0) ?? { symbol: "???", decimals: 18 };
    const meta1 = tokenMetaMap.get(p.token1) ?? { symbol: "???", decimals: 18 };
    const pool = poolInfoCache.get(p.poolKey);

    let amount0 = "0";
    let amount1 = "0";

    if (pool && p.liquidity > 0n) {
      try {
        const amounts = calculatePositionAmounts(
          p.liquidity,
          p.tickLower,
          p.tickUpper,
          pool.tick,
          pool.sqrtPriceX96,
        );
        amount0 = formatAmount(amounts.amount0, meta0.decimals);
        amount1 = formatAmount(amounts.amount1, meta1.decimals);
      } catch {
        // If amount calculation fails, leave as "0" — positions still show up
      }
    }

    // Uncollected fees include tokensOwed (these are a lower-bound;
    // the actual uncollected fees from feeGrowth would require more math,
    // but tokensOwed is what the contract will pay on collect)
    const fees0 = formatAmount(p.tokensOwed0, meta0.decimals);
    const fees1 = formatAmount(p.tokensOwed1, meta1.decimals);

    const feeTierLabel =
      p.fee === 100
        ? "0.01%"
        : p.fee === 500
          ? "0.05%"
          : p.fee === 3000
            ? "0.3%"
            : p.fee === 10000
              ? "1%"
              : `${p.fee / 10000}%`;

    return {
      tokenId: p.tokenId,
      token0: p.token0,
      token1: p.token1,
      fee: p.fee,
      tickLower: p.tickLower,
      tickUpper: p.tickUpper,
      liquidity: p.liquidity,
      token0Symbol: meta0.symbol,
      token1Symbol: meta1.symbol,
      token0Decimals: meta0.decimals,
      token1Decimals: meta1.decimals,
      amount0,
      amount1,
      fees0,
      fees1,
      hasUnclaimedFees: p.tokensOwed0 > 0n || p.tokensOwed1 > 0n,
      isActive: p.liquidity > 0n,
      feeTierLabel,
    };
  });

  return detailed;
}

// ---------------------------------------------------------------------------
// Tick math helpers
// ---------------------------------------------------------------------------

/**
 * Calculate a full-range tick range for a given tick spacing.
 * Uses near-maximum ticks aligned to the tick spacing.
 */
export function getFullRangeTicks(tickSpacing: number): {
  tickLower: number;
  tickUpper: number;
} {
  const MAX_TICK = 887272;
  const tickLower =
    -Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
  const tickUpper =
    Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
  return { tickLower, tickUpper };
}

/**
 * Calculate the amounts of token0 and token1 needed to provide liquidity
 * at the current price, given a desired amount of one token.
 * 
 * For a full-range position, the ratio is approximately:
 *   amount1 = amount0 * price
 * where price = (sqrtPriceX96 / 2^96)^2 * 10^(decimals0 - decimals1)
 */
export function calculateAmountsForPool(
  sqrtPriceX96: bigint,
  token0Decimals: number,
  token1Decimals: number,
  amount0?: bigint,
  amount1?: bigint,
): { amount0: bigint; amount1: bigint } {
  // price of token0 in terms of token1
  const price = sqrtPriceX96ToPrice(sqrtPriceX96, token0Decimals, token1Decimals);

  if (amount0 !== undefined && amount0 > 0n) {
    // Calculate amount1 from amount0
    const amount0Human = Number(amount0) / 10 ** token0Decimals;
    const amount1Human = amount0Human * price;
    const calcAmount1 = BigInt(
      Math.floor(amount1Human * 10 ** token1Decimals),
    );
    return { amount0, amount1: calcAmount1 };
  }

  if (amount1 !== undefined && amount1 > 0n) {
    // Calculate amount0 from amount1
    const amount1Human = Number(amount1) / 10 ** token1Decimals;
    const amount0Human = amount1Human / price;
    const calcAmount0 = BigInt(
      Math.floor(amount0Human * 10 ** token0Decimals),
    );
    return { amount0: calcAmount0, amount1 };
  }

  return { amount0: 0n, amount1: 0n };
}

// ---------------------------------------------------------------------------
// Quote swap (read-only, on-chain)
// ---------------------------------------------------------------------------

const QUOTER_ABI = [
  // QuoterV2 — uses a struct param and returns 4 values
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
];

/**
 * Get a swap quote using the Uniswap V3 QuoterV2 contract.
 * Note: Uses staticCall since the quoter is not a view function (it reverts with result).
 */
export async function quoteSwap(
  tokenIn: string,
  tokenOut: string,
  fee: number,
  amountIn: bigint,
): Promise<bigint> {
  const provider = getProvider();
  const quoter = new ethers.Contract(UNISWAP_V3.quoter, QUOTER_ABI, provider);

  // QuoterV2 takes a struct and returns (amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate)
  const result = await quoter.quoteExactInputSingle.staticCall({
    tokenIn,
    tokenOut,
    amountIn,
    fee,
    sqrtPriceLimitX96: 0,
  });

  // result is a tuple: [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate]
  return BigInt(result[0]);
}

/**
 * Parse a human-readable amount to the smallest unit based on decimals.
 */
export function parseAmount(amount: string, decimals: number): bigint {
  return ethers.parseUnits(amount, decimals);
}

/**
 * Format a token amount from smallest unit to human-readable.
 */
export function formatAmount(amount: bigint, decimals: number): string {
  return ethers.formatUnits(amount, decimals);
}

/**
 * Wait for a transaction to be confirmed.
 */
export async function waitForTx(txHash: string, confirmations = 1): Promise<void> {
  const provider = getProvider();
  const receipt = await provider.waitForTransaction(txHash, confirmations, 60000);
  if (!receipt || receipt.status === 0) {
    throw new Error(`Transaction ${txHash} failed or was reverted`);
  }
}
