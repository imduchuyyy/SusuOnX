import { keccak256, toHex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const SERVER_SECRET = process.env.AGENT_WALLET_SECRET || "default-dev-secret-change-in-production";

/**
 * Generate a deterministic agent wallet from user address + server secret.
 * Formula: privateKey = keccak256(userAddress + serverSecret)
 */
export function generateAgentWallet(userAddress: string): {
  address: Address;
  privateKey: `0x${string}`;
} {
  const seed = `${userAddress.toLowerCase()}:${SERVER_SECRET}`;
  const privateKey = keccak256(toHex(seed));
  const account = privateKeyToAccount(privateKey);

  return {
    address: account.address,
    privateKey,
  };
}
