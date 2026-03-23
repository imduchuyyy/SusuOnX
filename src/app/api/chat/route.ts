import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { STRATEGIES } from "@/lib/strategies";

export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    persona,
  }: {
    messages: UIMessage[];
    persona?: {
      riskLevel: number;
      systemPrompt: string;
      allowSwap: boolean;
      allowBridge: boolean;
      allowDeposit: boolean;
    };
  } = await req.json();

  const riskLevel = persona?.riskLevel ?? 50;
  const riskLabel = getRiskLabel(riskLevel);
  const approvedActions = [
    persona?.allowSwap && "swap tokens",
    persona?.allowBridge && "bridge tokens cross-chain",
    persona?.allowDeposit && "deposit into yield vaults",
  ]
    .filter(Boolean)
    .join(", ");

  const strategyContext = STRATEGIES.map(
    (s) =>
      `- ${s.name} (${s.protocol}): ${s.apy}% APY, Risk: ${s.riskLabel}, TVL: ${s.tvl}, Min deposit: ${s.minDeposit} ${s.token}. ${s.description}`
  ).join("\n");

  const systemPrompt = `You are Long.AI, an AI yield agent on the X Layer blockchain (OKX Layer 2).

USER PROFILE:
- Risk tolerance: ${riskLabel} (${riskLevel}/100)
- Approved actions: ${approvedActions || "none configured"}

AVAILABLE STRATEGIES:
${strategyContext}

BEHAVIOR:
- Recommend strategies matching the user's risk level
- For "Safe Bet" users (0-25): only recommend low-risk strategies
- For "Cautious" users (26-50): recommend low and medium-risk strategies
- For "Balanced" users (51-75): all strategies are fair game
- For "Ape In" users (76-100): emphasize high-yield opportunities
- Always explain the risks involved before recommending deposits
- Be concise, friendly, and use simple language
- When the user wants to deposit, confirm the strategy details and encourage them to click the "Deposit" button on the vault card
- Format APY and financial numbers clearly
- If asked about actions not in the approved list, politely explain those actions haven't been enabled in their Persona settings

${persona?.systemPrompt ? `\nADDITIONAL USER INSTRUCTIONS:\n${persona.systemPrompt}` : ""}`;

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}

function getRiskLabel(level: number): string {
  if (level <= 25) return "Safe Bet";
  if (level <= 50) return "Cautious";
  if (level <= 75) return "Balanced";
  return "Ape In";
}
