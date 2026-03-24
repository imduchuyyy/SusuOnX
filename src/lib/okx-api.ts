/**
 * OKX Agentic Wallet API — Browser-side client
 *
 * Calls route through /api/okx/[...path] — a thin CORS proxy that forwards
 * requests to https://www.okx.com/priapi/v5/wallet/agentic/[...path].
 * The proxy is a dumb pipe: it never inspects, logs, or stores credentials.
 * All session data originates from and stays in the browser's localStorage.
 *
 * The separate /api/balances proxy uses server-side HMAC developer keys.
 */

import {
  decryptSessionKey,
  signEncoded,
  signEip191,
  base64ToUint8,
} from "@/lib/okx-crypto";
import type { OkxSession } from "@/lib/okx-auth-store";

const PROXY_PREFIX = "/api/okx";
const XLAYER_CHAIN_INDEX = "196";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

class OkxApiError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "OkxApiError";
  }
}

/**
 * Unwrap the standard OKX envelope: `{ code: "0", msg: "", data: [...] }`.
 * Returns the first element of `data` or throws.
 */
async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new OkxApiError(
      `OKX HTTP ${res.status}: ${text || res.statusText}`,
      String(res.status),
    );
  }

  const json = await res.json();

  // OKX returns code as string "0" or number 0 depending on endpoint
  const codeOk =
    json.code === "0" || json.code === 0 || String(json.code) === "0";

  if (!codeOk) {
    throw new OkxApiError(
      json.msg || `OKX API error (code ${json.code})`,
      String(json.code),
    );
  }

  const item = json.data?.[0];
  if (!item) {
    throw new OkxApiError("No data returned from OKX");
  }

  return item as T;
}

// ---------------------------------------------------------------------------
// Auth: init
// ---------------------------------------------------------------------------

interface AuthInitResponse {
  flowId: string;
}

/**
 * Trigger an OTP email to the user.
 */
export async function authInit(email: string): Promise<{ flowId: string }> {
  const res = await fetch(`${PROXY_PREFIX}/auth/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await unwrap<AuthInitResponse>(res);
  return { flowId: data.flowId };
}

// ---------------------------------------------------------------------------
// Auth: verify
// ---------------------------------------------------------------------------

export interface AuthVerifyResponse {
  accessToken: string;
  refreshToken: string;
  sessionCert: string;
  encryptedSessionSk: string;
  sessionKeyExpireAt: string;
  teeId: string;
  projectId: string;
  accountId: string;
  accountName: string;
  isNew: boolean;
  addressList: {
    address: string;
    chainIndex: string;
    chainName: string;
    addressType?: string;
    chainPath?: string;
  }[];
}

/**
 * Verify the OTP and establish a session.
 */
export async function authVerify(
  email: string,
  flowId: string,
  otp: string,
  tempPubKey: string,
): Promise<AuthVerifyResponse> {
  const res = await fetch(`${PROXY_PREFIX}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, flowId, otp, tempPubKey }),
  });

  return unwrap<AuthVerifyResponse>(res);
}

// ---------------------------------------------------------------------------
// Auth: refresh
// ---------------------------------------------------------------------------

interface AuthRefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * Refresh an expired access token.
 */
export async function authRefresh(
  refreshToken: string,
): Promise<AuthRefreshResponse> {
  const res = await fetch(`${PROXY_PREFIX}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  return unwrap<AuthRefreshResponse>(res);
}

// ---------------------------------------------------------------------------
// Token refresh helper
// ---------------------------------------------------------------------------

/**
 * Decode a JWT payload and extract the `exp` claim (seconds since epoch).
 * Returns null if the token is not a valid JWT.
 */
function jwtExpTimestamp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // URL-safe base64 → standard base64
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Returns true if the JWT is expired (or will expire within 60 seconds).
 */
function isJwtExpired(token: string): boolean {
  const exp = jwtExpTimestamp(token);
  if (exp === null) return true;
  return Date.now() / 1000 >= exp - 60;
}

/**
 * Ensure the session's access token is still valid.
 * If expired, attempt to refresh using the refresh token.
 * Updates localStorage and returns the (possibly refreshed) session.
 *
 * Matches Rust client.rs → resolve_auth_async() flow.
 */
export async function ensureFreshSession(
  session: OkxSession,
): Promise<OkxSession> {
  if (!isJwtExpired(session.accessToken)) {
    return session;
  }

  // Access token expired — try refresh
  if (!session.refreshToken) {
    throw new OkxApiError("Session expired and no refresh token available");
  }

  if (isJwtExpired(session.refreshToken)) {
    throw new OkxApiError(
      "Session fully expired — please sign in again",
      "SESSION_EXPIRED",
    );
  }

  const refreshed = await authRefresh(session.refreshToken);

  // Update session in memory + localStorage
  const updatedSession: OkxSession = {
    ...session,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
  };

  // Persist to localStorage
  const { saveSession } = await import("@/lib/okx-auth-store");
  saveSession(updatedSession);

  return updatedSession;
}

// ---------------------------------------------------------------------------
// Transactions: prepare (unsignedInfo)
// ---------------------------------------------------------------------------

/**
 * Full response from pre-transaction/unsignedInfo.
 * Matches Rust UnsignedInfoResponse.
 */
export interface UnsignedInfoResponse {
  unsignedTxHash: string;
  unsignHash: string; // Solana uses this
  unsignedTx: string;
  uopHash: string;
  hash: string;
  authHashFor7702: string;
  executeErrorMsg: string;
  executeResult: unknown;
  extraData: Record<string, unknown> | null;
  signType: string;
  encoding: string;
  jitoUnsignedTx: string;
}

/**
 * Prepare an unsigned transaction for signing.
 *
 * Matches Rust: pre_transaction_unsigned_info
 * Required: chainIndex (number), fromAddr, toAddr, value, sessionCert
 * Optional: chainPath, contractAddr, inputData, unsignedTx, gasLimit
 */
export async function prepareTx(params: {
  accessToken: string;
  chainIndex: number;
  fromAddr: string;
  toAddr: string;
  value: string;
  sessionCert: string;
  chainPath?: string;
  contractAddr?: string;
  inputData?: string;
  unsignedTx?: string;
  gasLimit?: string;
}): Promise<UnsignedInfoResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = {
    chainIndex: params.chainIndex,
    fromAddr: params.fromAddr,
    toAddr: params.toAddr,
    value: params.value,
    sessionCert: params.sessionCert,
  };
  if (params.chainPath) payload.chainPath = params.chainPath;
  if (params.contractAddr) payload.contractAddr = params.contractAddr;
  if (params.inputData) payload.inputData = params.inputData;
  if (params.unsignedTx) payload.unsignedTx = params.unsignedTx;
  if (params.gasLimit) payload.gasLimit = params.gasLimit;

  const res = await fetch(
    `${PROXY_PREFIX}/pre-transaction/unsignedInfo`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.accessToken}`,
      },
      body: JSON.stringify(payload),
    },
  );

  return unwrap<UnsignedInfoResponse>(res);
}

// ---------------------------------------------------------------------------
// Transactions: broadcast
// ---------------------------------------------------------------------------

export interface BroadcastTransactionResponse {
  pkgId: string;
  orderId: string;
  orderType: string;
  txHash: string;
}

/**
 * Broadcast a signed transaction to the network.
 *
 * Matches Rust: broadcast_transaction(access_token, account_id, address, chain_index, extra_data)
 */
export async function broadcastTx(params: {
  accessToken: string;
  accountId: string;
  address: string;
  chainIndex: string;
  extraData: string; // JSON-stringified extraData object
}): Promise<BroadcastTransactionResponse> {
  const res = await fetch(
    `${PROXY_PREFIX}/pre-transaction/broadcast-transaction`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.accessToken}`,
      },
      body: JSON.stringify({
        accountId: params.accountId,
        address: params.address,
        chainIndex: params.chainIndex,
        extraData: params.extraData,
      }),
    },
  );

  return unwrap<BroadcastTransactionResponse>(res);
}

// ---------------------------------------------------------------------------
// High-level: sign + broadcast
// ---------------------------------------------------------------------------

/**
 * Progress callback for signAndBroadcast.
 */
export type TxProgressCallback = (step: "signing" | "broadcasting") => void;

/**
 * Full sign-and-broadcast flow matching the Rust sign_and_broadcast function.
 *
 * 1. Call prepareTx to get UnsignedInfoResponse
 * 2. Decrypt the session key (HPKE)
 * 3. Build msgForSign (signed hashes using Ed25519)
 * 4. Build extraData JSON
 * 5. Call broadcastTx
 *
 * @returns The transaction hash
 */
export async function signAndBroadcast(params: {
  session: OkxSession;
  toAddr: string;
  value: string;
  /** For ERC-20 calls, set the token contract as contractAddr and inputData */
  contractAddr?: string;
  inputData?: string;
  chainIndex?: number;
  chainPath?: string;
  fromAddr?: string;
  /** Whether this is a contract call (affects txType in extraData) */
  isContractCall?: boolean;
  /** Progress callback */
  onProgress?: TxProgressCallback;
}): Promise<{ txHash: string; session: OkxSession }> {
  // Step 0: Ensure access token is fresh (auto-refresh if expired)
  const session = await ensureFreshSession(params.session);
  const chainIndex = params.chainIndex ?? parseInt(XLAYER_CHAIN_INDEX, 10);
  const chainIndexStr = String(chainIndex);

  // Resolve the address for this chain from session
  const addrInfo = session.addresses.find(
    (a) => a.chainIndex === chainIndexStr,
  ) ?? session.addresses[0];

  if (!addrInfo) {
    throw new OkxApiError("No wallet address found for this chain");
  }

  const fromAddr = params.fromAddr ?? addrInfo.address;
  const chainPath = params.chainPath ?? addrInfo.chainPath ?? "";

  // Step 1: Prepare unsigned transaction
  params.onProgress?.("signing");

  const unsigned = await prepareTx({
    accessToken: session.accessToken,
    chainIndex,
    fromAddr,
    toAddr: params.toAddr,
    value: params.value,
    sessionCert: session.sessionCert,
    chainPath,
    contractAddr: params.contractAddr,
    inputData: params.inputData,
  });

  // Check executeResult
  if (unsigned.executeResult === false) {
    const errMsg = unsigned.executeErrorMsg || "transaction simulation failed";
    throw new OkxApiError(`Transaction simulation failed: ${errMsg}`);
  }

  // Step 2: Decrypt the Ed25519 signing seed
  const signingKeyB64 = await decryptSessionKey(
    session.encryptedSessionSk,
    session.sessionKey,
  );
  const signingSeedBytes = base64ToUint8(signingKeyB64);

  // Step 3: Build msgForSign object (matching Rust sign_and_broadcast)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgForSign: Record<string, any> = {};

  // hash → EIP-191 signature
  if (unsigned.hash) {
    msgForSign.signature = signEip191(unsigned.hash, signingSeedBytes);
  }

  // authHashFor7702 → sign as hex
  if (unsigned.authHashFor7702) {
    msgForSign.authSignatureFor7702 = signEncoded(
      unsigned.authHashFor7702,
      signingKeyB64,
      "hex",
    );
  }

  // unsignedTxHash → sign with encoding from response
  if (unsigned.unsignedTxHash) {
    const encoding = unsigned.encoding || "hex";
    const sig = signEncoded(unsigned.unsignedTxHash, signingKeyB64, encoding);
    msgForSign.unsignedTxHash = unsigned.unsignedTxHash;
    msgForSign.sessionSignature = sig;
  }

  // unsignedTx → pass through
  if (unsigned.unsignedTx) {
    msgForSign.unsignedTx = unsigned.unsignedTx;
  }

  // jitoUnsignedTx → sign + pass through
  if (unsigned.jitoUnsignedTx) {
    const encoding = unsigned.encoding || "hex";
    const jitoSig = signEncoded(unsigned.jitoUnsignedTx, signingKeyB64, encoding);
    msgForSign.jitoUnsignedTx = unsigned.jitoUnsignedTx;
    msgForSign.jitoSessionSignature = jitoSig;
  }

  // sessionCert → always include
  if (session.sessionCert) {
    msgForSign.sessionCert = session.sessionCert;
  }

  // Step 4: Build extraData
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extraDataObj: Record<string, any> = {
    ...(unsigned.extraData ?? {}),
    checkBalance: true,
    uopHash: unsigned.uopHash ?? "",
    encoding: unsigned.encoding ?? "",
    signType: unsigned.signType ?? "",
    msgForSign,
  };

  // For non-contract-call transfers, set txType = 2
  if (!params.isContractCall) {
    extraDataObj.txType = 2;
  }

  const extraDataStr = JSON.stringify(extraDataObj);

  // Step 5: Broadcast
  params.onProgress?.("broadcasting");

  const broadcastResult = await broadcastTx({
    accessToken: session.accessToken,
    accountId: session.accountId,
    address: fromAddr,
    chainIndex: chainIndexStr,
    extraData: extraDataStr,
  });

  return { txHash: broadcastResult.txHash, session };
}
