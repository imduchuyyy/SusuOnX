import { generateAgentWallet } from "@/lib/agent-wallet";

export async function POST(req: Request) {
  const { userAddress } = await req.json();

  if (!userAddress || typeof userAddress !== "string") {
    return Response.json({ error: "userAddress is required" }, { status: 400 });
  }

  const { address: agentAddress } = generateAgentWallet(userAddress);

  return Response.json({ agentAddress });
}
