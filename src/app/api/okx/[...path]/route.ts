/**
 * Thin CORS proxy: /api/okx/[...path]
 *
 * Forwards requests to https://www.okx.com/priapi/v5/wallet/agentic/[...path].
 * This exists solely because OKX does not set Access-Control-Allow-Origin
 * headers, so browser fetch() calls are blocked by CORS.
 *
 * This proxy is a dumb pipe — it does NOT inspect, log, or store any user
 * credentials (accessToken, sessionCert, etc.). All auth data originates
 * from and stays in the browser's localStorage; it merely transits through
 * this proxy in the HTTP body/headers.
 *
 * Allowed path prefixes (whitelist):
 *   - auth/init
 *   - auth/verify
 *   - auth/refresh
 *   - pre-transaction/unsignedInfo
 *   - pre-transaction/broadcast-transaction
 */

import { type NextRequest, NextResponse } from "next/server";

const OKX_BASE_URL = process.env.OKX_BASE_URL ?? "https://web3.okx.com";
const OKX_API_PREFIX = "/priapi/v5/wallet/agentic";

/**
 * Client-type and version headers required by the OKX agentic wallet API.
 * See Rust reference: client.rs → anonymous_headers() / jwt_headers().
 * Without these OKX may reject the access token as invalid.
 */
const OKX_CLIENT_TYPE = "agent-cli";
const OKX_CLIENT_VERSION = "1.0.0";

const ALLOWED_PATHS = new Set([
  "auth/init",
  "auth/verify",
  "auth/refresh",
  "pre-transaction/unsignedInfo",
  "pre-transaction/broadcast-transaction",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const subPath = path.join("/");

  if (!ALLOWED_PATHS.has(subPath)) {
    return NextResponse.json(
      { error: `Disallowed path: ${subPath}` },
      { status: 403 },
    );
  }

  const targetUrl = `${OKX_BASE_URL}${OKX_API_PREFIX}/${subPath}`;

  // Build headers matching the Rust client's anonymous_headers() + jwt_headers()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Ok-Access-Client-type": OKX_CLIENT_TYPE,
    "ok-client-version": OKX_CLIENT_VERSION,
  };

  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }

  try {
    const body = await req.text();

    const okxRes = await fetch(targetUrl, {
      method: "POST",
      headers,
      body,
    });

    const responseBody = await okxRes.text();

    return new NextResponse(responseBody, {
      status: okxRes.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error(`[api/okx proxy] Error forwarding to ${targetUrl}:`, err);
    return NextResponse.json(
      { error: "Failed to reach OKX API" },
      { status: 502 },
    );
  }
}
