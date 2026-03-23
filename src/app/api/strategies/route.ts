import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// GET /api/strategies?userAddress=0x...
export async function GET(req: NextRequest) {
  const userAddress = req.nextUrl.searchParams.get("userAddress");
  if (!userAddress) {
    return Response.json({ error: "userAddress required" }, { status: 400 });
  }

  const strategies = await prisma.activeStrategy.findMany({
    where: { userAddress: userAddress.toLowerCase() },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ strategies });
}

// POST /api/strategies — record a new deposit
export async function POST(req: Request) {
  const { userAddress, strategyId, depositAmount, txHash } = await req.json();

  if (!userAddress || !strategyId || !depositAmount || !txHash) {
    return Response.json(
      { error: "userAddress, strategyId, depositAmount, and txHash required" },
      { status: 400 }
    );
  }

  const strategy = await prisma.activeStrategy.create({
    data: {
      userAddress: userAddress.toLowerCase(),
      strategyId,
      depositAmount,
      currentValue: depositAmount, // starts at deposit amount
      txHash,
    },
  });

  return Response.json({ strategy });
}
