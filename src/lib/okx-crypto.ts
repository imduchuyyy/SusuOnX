/**
 * OKX Agentic Wallet — Browser-side Crypto
 *
 * Implements the cryptographic primitives needed for the email OTP auth flow:
 * 1. X25519 keypair generation (for HPKE key exchange with OKX TEE)
 * 2. HPKE decryption of the encrypted session signing key
 * 3. Ed25519 signing (multiple encoding modes matching crypto.rs)
 *
 * Uses @noble/curves for X25519/Ed25519, @noble/hashes for keccak,
 * and hpke-js for HPKE decryption. All operations run in the browser.
 *
 * References:
 * - okx/onchainos-skills/cli/src/crypto.rs
 * - HPKE Suite: DHKEM(X25519, HKDF-SHA256) + HKDF-SHA256 + AES-256-GCM
 * - Info string: b"okx-tee-sign"
 */

import { x25519, ed25519 } from "@noble/curves/ed25519.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { CipherSuite, Kem, Kdf, Aead } from "hpke-js";

// ---------------------------------------------------------------------------
// X25519 Keypair Generation
// ---------------------------------------------------------------------------

export interface X25519KeyPair {
  /** Base64-encoded 32-byte public key (sent to OKX as tempPubKey) */
  publicKeyBase64: string;
  /** Base64-encoded 32-byte private key (stored in localStorage) */
  privateKeyBase64: string;
}

/**
 * Generate an X25519 keypair for the HPKE key exchange.
 * The public key is sent to OKX during auth/verify.
 * The private key is stored locally to decrypt the encryptedSessionSk later.
 */
export function generateX25519KeyPair(): X25519KeyPair {
  const secretKey = x25519.utils.randomSecretKey();
  const publicKey = x25519.getPublicKey(secretKey);

  return {
    publicKeyBase64: uint8ToBase64(publicKey),
    privateKeyBase64: uint8ToBase64(secretKey),
  };
}

// ---------------------------------------------------------------------------
// HPKE Decryption — Decrypt the Ed25519 Session Signing Key
// ---------------------------------------------------------------------------

/**
 * Decrypt the encryptedSessionSk from OKX to recover the Ed25519 signing seed.
 *
 * The encrypted payload format (from crypto.rs):
 *   enc (32 bytes) || ciphertext (plaintext_len + 16 bytes AES-GCM tag)
 *
 * HPKE Suite: DHKEM(X25519, HKDF-SHA256) + HKDF-SHA256 + AES-256-GCM
 * Info: b"okx-tee-sign"
 *
 * @param encryptedSessionSkBase64 - Base64-encoded encrypted session key from OKX
 * @param x25519PrivateKeyBase64 - Base64-encoded X25519 private key (our session key)
 * @returns Base64-encoded 32-byte Ed25519 signing seed
 */
export async function decryptSessionKey(
  encryptedSessionSkBase64: string,
  x25519PrivateKeyBase64: string
): Promise<string> {
  const encryptedBytes = base64ToUint8(encryptedSessionSkBase64);
  const secretKeyBytes = base64ToUint8(x25519PrivateKeyBase64);

  // Split: first 32 bytes = enc (ephemeral public key), rest = ciphertext
  const enc = encryptedBytes.slice(0, 32);
  const ciphertext = encryptedBytes.slice(32);

  // Derive the public key from our secret key
  const publicKeyBytes = x25519.getPublicKey(secretKeyBytes);

  // Set up the HPKE suite: DHKEM(X25519, HKDF-SHA256) + HKDF-SHA256 + AES-256-GCM
  const suite = new CipherSuite({
    kem: Kem.DhkemX25519HkdfSha256,
    kdf: Kdf.HkdfSha256,
    aead: Aead.Aes256Gcm,
  });

  // Import our keypair as the recipient
  // hpke-js importKey expects ArrayBuffer
  const privateKey = await suite.importKey(
    "raw",
    secretKeyBytes.buffer as ArrayBuffer,
    false,
  );
  const publicKey = await suite.importKey(
    "raw",
    publicKeyBytes.buffer as ArrayBuffer,
    true,
  );

  const info = new TextEncoder().encode("okx-tee-sign");

  // Open (decrypt) in base mode
  const recipient = await suite.createRecipientContext({
    recipientKey: { privateKey, publicKey },
    enc: enc.buffer as ArrayBuffer,
    info,
  });

  const plaintext = await recipient.open(ciphertext);
  return uint8ToBase64(new Uint8Array(plaintext));
}

// ---------------------------------------------------------------------------
// Ed25519 Signing — Low-level
// ---------------------------------------------------------------------------

/**
 * Sign raw bytes with Ed25519 using a 32-byte seed.
 * Returns raw 64-byte signature as Uint8Array.
 */
function ed25519SignRaw(
  message: Uint8Array,
  seed: Uint8Array,
): Uint8Array {
  return ed25519.sign(message, seed);
}

/**
 * Sign a hex-encoded message with Ed25519 (legacy helper, returns hex signature).
 *
 * @param messageHex - Hex-encoded message (with or without 0x prefix)
 * @param signingKeyBase64 - Base64-encoded 32-byte Ed25519 seed
 * @returns Hex-encoded 64-byte Ed25519 signature
 */
export function signWithEd25519(
  messageHex: string,
  signingKeyBase64: string,
): string {
  const seed = base64ToUint8(signingKeyBase64);
  const message = hexToUint8(messageHex);
  const signature = ed25519SignRaw(message, seed);
  return uint8ToHex(signature);
}

// ---------------------------------------------------------------------------
// Ed25519 Signing — Encoded variants (matching crypto.rs)
// ---------------------------------------------------------------------------

/**
 * Ed25519-sign an encoded message.
 * Matches crypto.rs `ed25519_sign_encoded`:
 *   1. Decode message according to `encoding` ("hex", "base64", "base58")
 *   2. Sign the decoded bytes with Ed25519
 *   3. Return base64-encoded signature
 *
 * @param msg - Encoded message string
 * @param signingKeyBase64 - Base64-encoded 32-byte Ed25519 seed
 * @param encoding - "hex" | "base64" | "base58"
 * @returns Base64-encoded 64-byte signature
 */
export function signEncoded(
  msg: string,
  signingKeyBase64: string,
  encoding: string,
): string {
  if (!msg) return "";

  let msgBytes: Uint8Array;
  switch (encoding) {
    case "hex":
      msgBytes = hexToUint8(msg);
      break;
    case "base64":
      msgBytes = base64ToUint8(msg);
      break;
    case "base58":
      msgBytes = base58ToUint8(msg);
      break;
    default:
      throw new Error(`Unsupported encoding: ${encoding}, expected hex/base64/base58`);
  }

  const seed = base64ToUint8(signingKeyBase64);
  const signature = ed25519SignRaw(msgBytes, seed);
  return uint8ToBase64(signature);
}

/**
 * EIP-191 personal_sign + Ed25519.
 * Matches crypto.rs `ed25519_sign_eip191`:
 *   1. Decode hex hash to raw bytes
 *   2. Build EIP-191 prefix: "\x19Ethereum Signed Message:\n{len}" + data
 *   3. Keccak-256 the prefixed message
 *   4. Ed25519 sign the keccak hash with the raw seed bytes
 *   5. Return base64-encoded signature
 *
 * @param hexHash - Hex-encoded hash (with or without 0x prefix)
 * @param signingSeed - Raw 32-byte Ed25519 seed (Uint8Array, NOT base64)
 * @returns Base64-encoded 64-byte signature
 */
export function signEip191(
  hexHash: string,
  signingSeed: Uint8Array,
): string {
  const clean = hexHash.startsWith("0x") ? hexHash.slice(2) : hexHash;
  if (!clean) return "";

  const data = hexToUint8(clean);

  // Build EIP-191 message
  const prefix = new TextEncoder().encode(
    `\x19Ethereum Signed Message:\n${data.length}`,
  );
  const ethMsg = new Uint8Array(prefix.length + data.length);
  ethMsg.set(prefix, 0);
  ethMsg.set(data, prefix.length);

  // Keccak-256
  const hash = keccak_256(ethMsg);

  // Sign with raw seed and return base64
  const signature = ed25519SignRaw(hash, signingSeed);
  return uint8ToBase64(signature);
}

// ---------------------------------------------------------------------------
// Encoding Utilities
// ---------------------------------------------------------------------------

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function uint8ToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToUint8(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58ToUint8(str: string): Uint8Array {
  if (!str) return new Uint8Array(0);
  // Count leading '1's (= leading zero bytes)
  let leadingZeros = 0;
  for (let i = 0; i < str.length && str[i] === "1"; i++) leadingZeros++;

  // Decode base58 to big integer
  let num = BigInt(0);
  for (let i = 0; i < str.length; i++) {
    const idx = BASE58_ALPHABET.indexOf(str[i]);
    if (idx < 0) throw new Error(`Invalid base58 character: ${str[i]}`);
    num = num * BigInt(58) + BigInt(idx);
  }

  // Convert big integer to bytes
  const hex = num === BigInt(0) ? "" : num.toString(16);
  const padded = hex.length % 2 ? "0" + hex : hex;
  const dataBytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < padded.length; i += 2) {
    dataBytes[i / 2] = parseInt(padded.substring(i, i + 2), 16);
  }

  // Prepend leading zero bytes
  const result = new Uint8Array(leadingZeros + dataBytes.length);
  result.set(dataBytes, leadingZeros);
  return result;
}
