import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// GET /api/conversations?userAddress=0x...
export async function GET(req: NextRequest) {
  const userAddress = req.nextUrl.searchParams.get("userAddress");
  if (!userAddress) {
    return Response.json({ error: "userAddress required" }, { status: 400 });
  }

  const conversations = await prisma.conversation.findMany({
    where: { userAddress: userAddress.toLowerCase() },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });

  return Response.json({ conversations });
}

// POST /api/conversations — create a new conversation
export async function POST(req: Request) {
  const { userAddress, title } = await req.json();
  if (!userAddress) {
    return Response.json({ error: "userAddress required" }, { status: 400 });
  }

  const conversation = await prisma.conversation.create({
    data: {
      userAddress: userAddress.toLowerCase(),
      title: title || "New Chat",
    },
  });

  return Response.json({ conversation });
}
