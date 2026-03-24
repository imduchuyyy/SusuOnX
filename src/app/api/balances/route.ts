/**
 * POST /api/balances
 *
 * Proxies balance requests to OKX Wallet API (v6).
 * Uses the public Wallet API with HMAC-SHA256 authentication.
 *
 * Client sends { address } (the EVM wallet address).
 * Server adds OKX API key authentication headers.
 *
 * Docs: https://web3.okx.com/onchainos/dev-docs/wallet/balance-api-all-token-balances
 */

import { createHmac } from "node:crypto";

const OKX_API_BASE = "https://web3.okx.com";
const XLAYER_CHAIN_INDEX = "196";

// OKX API key credentials (server-side only)
const OKX_ACCESS_KEY = process.env.OKX_ACCESS_KEY ?? "";
const OKX_SECRET_KEY = process.env.OKX_SECRET_KEY ?? "";
const OKX_PASSPHRASE = process.env.OKX_PASSPHRASE ?? "";

/**
 * Generate OKX HMAC-SHA256 authentication headers.
 * Signature = Base64(HMAC-SHA256(timestamp + method + requestPath + body, secretKey))
 */
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
  const body = await req.json();
  const { address } = body;

  if (!address) {
    return Response.json(
      { error: "address is required" },
      { status: 400 },
    );
  }

  // Check if OKX API keys are configured
  if (!OKX_ACCESS_KEY || !OKX_SECRET_KEY || !OKX_PASSPHRASE) {
    return Response.json(
      { error: "OKX API keys not configured", balances: [] },
      { status: 200 },
    );
  }

  try {
    const queryParams = new URLSearchParams({
      address,
      chains: XLAYER_CHAIN_INDEX,
    });
    const requestPath = `/api/v6/dex/balance/all-token-balances-by-address?${queryParams.toString()}`;
    const headers = getOkxHeaders("GET", requestPath);

    const res = await fetch(`${OKX_API_BASE}${requestPath}`, {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[api/balances] OKX HTTP error:", res.status, text);
      return Response.json(
        { error: "Failed to fetch balances from OKX" },
        { status: 502 },
      );
    }

    const data = await res.json();
    const code = typeof data.code === "string" ? data.code : String(data.code);

    if (code !== "0") {
      console.error("[api/balances] OKX API error:", data.code, data.msg);
      return Response.json(
        { error: `OKX API error: ${data.msg}` },
        { status: 502 },
      );
    }

    // Response shape: data.data[0].tokenAssets[]
    const tokenAssets = data.data?.[0]?.tokenAssets ?? [];

    const balances = tokenAssets.map(
      (b: {
        chainIndex: string;
        tokenContractAddress: string;
        symbol: string;
        balance: string;
        tokenPrice: string;
        isRiskToken: boolean;
      }) => ({
        chainIndex: b.chainIndex,
        tokenAddress: b.tokenContractAddress, // normalize to our internal field name
        symbol: b.symbol,
        balance: b.balance, // already human-readable (OKX divides by 10^decimals)
        tokenPrice: b.tokenPrice,
        tokenType: b.tokenContractAddress ? "token" : "native",
        isRiskToken: b.isRiskToken,
      }),
    );

    return Response.json({ balances });
  } catch (err) {
    console.error("[api/balances] Error:", err);
    return Response.json(
      { error: "Failed to fetch balances" },
      { status: 500 },
    );
  }
}
