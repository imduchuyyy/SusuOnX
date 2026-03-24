/**
 * POST /api/swap
 *
 * Server-side proxy for OKX DEX Aggregator API endpoints.
 * Uses HMAC-SHA256 auth (same pattern as /api/balances).
 *
 * Supports three actions via `action` field in the request body:
 *   - "quote"   → GET /api/v6/dex/aggregator/quote
 *   - "approve" → GET /api/v6/dex/aggregator/approve-transaction
 *   - "swap"    → GET /api/v6/dex/aggregator/swap
 *
 * The OKX DEX API uses GET requests with query parameters + HMAC headers.
 * All amount values must be in minimal units (wei).
 */

import { createHmac } from "node:crypto";

const OKX_API_BASE = "https://web3.okx.com";

const OKX_ACCESS_KEY = process.env.OKX_ACCESS_KEY ?? "";
const OKX_SECRET_KEY = process.env.OKX_SECRET_KEY ?? "";
const OKX_PASSPHRASE = process.env.OKX_PASSPHRASE ?? "";

function getOkxHeaders(
  method: string,
  requestPath: string,
): Record<string, string> {
  const timestamp = new Date().toISOString();
  const preSign = timestamp + method.toUpperCase() + requestPath;
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

type SwapAction = "quote" | "approve" | "swap";

const ENDPOINTS: Record<SwapAction, string> = {
  quote: "/api/v6/dex/aggregator/quote",
  approve: "/api/v6/dex/aggregator/approve-transaction",
  swap: "/api/v6/dex/aggregator/swap",
};

export async function POST(req: Request) {
  const body = await req.json();
  const { action, params } = body as {
    action: SwapAction;
    params: Record<string, string>;
  };

  if (!action || !ENDPOINTS[action]) {
    return Response.json(
      { error: `Invalid action: ${action}. Must be quote, approve, or swap.` },
      { status: 400 },
    );
  }

  if (!OKX_ACCESS_KEY || !OKX_SECRET_KEY || !OKX_PASSPHRASE) {
    return Response.json(
      { error: "OKX API keys not configured" },
      { status: 500 },
    );
  }

  try {
    const queryString = new URLSearchParams(params).toString();
    const requestPath = `${ENDPOINTS[action]}?${queryString}`;
    const headers = getOkxHeaders("GET", requestPath);

    const res = await fetch(`${OKX_API_BASE}${requestPath}`, {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[api/swap] OKX HTTP error (${action}):`, res.status, text);
      return Response.json(
        { error: `OKX API HTTP ${res.status}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    const code = String(data.code ?? "");

    if (code !== "0") {
      console.error(`[api/swap] OKX API error (${action}):`, data.code, data.msg);
      return Response.json(
        { error: `OKX DEX error: ${data.msg || "unknown"}`, code: data.code },
        { status: 502 },
      );
    }

    return Response.json({ data: data.data });
  } catch (err) {
    console.error(`[api/swap] Error (${action}):`, err);
    return Response.json(
      { error: "Failed to call OKX DEX API" },
      { status: 500 },
    );
  }
}
