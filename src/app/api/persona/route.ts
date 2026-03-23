import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// GET /api/persona?userAddress=0x...
export async function GET(req: NextRequest) {
  const userAddress = req.nextUrl.searchParams.get("userAddress");
  if (!userAddress) {
    return Response.json({ error: "userAddress required" }, { status: 400 });
  }

  const settings = await prisma.personaSettings.findUnique({
    where: { userAddress: userAddress.toLowerCase() },
  });

  if (!settings) {
    return Response.json({
      persona: {
        riskLevel: 50,
        systemPrompt: "",
        allowSwap: true,
        allowBridge: false,
        allowDeposit: true,
      },
    });
  }

  return Response.json({
    persona: {
      riskLevel: settings.riskLevel,
      systemPrompt: settings.systemPrompt,
      allowSwap: settings.allowSwap,
      allowBridge: settings.allowBridge,
      allowDeposit: settings.allowDeposit,
    },
  });
}

// PUT /api/persona — save persona settings
export async function PUT(req: Request) {
  const { userAddress, persona } = await req.json();
  if (!userAddress) {
    return Response.json({ error: "userAddress required" }, { status: 400 });
  }

  const settings = await prisma.personaSettings.upsert({
    where: { userAddress: userAddress.toLowerCase() },
    update: {
      riskLevel: persona.riskLevel,
      systemPrompt: persona.systemPrompt,
      allowSwap: persona.allowSwap,
      allowBridge: persona.allowBridge,
      allowDeposit: persona.allowDeposit,
    },
    create: {
      userAddress: userAddress.toLowerCase(),
      riskLevel: persona.riskLevel,
      systemPrompt: persona.systemPrompt,
      allowSwap: persona.allowSwap,
      allowBridge: persona.allowBridge,
      allowDeposit: persona.allowDeposit,
    },
  });

  return Response.json({ persona: settings });
}
