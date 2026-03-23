import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// GET /api/conversations/[id]/messages — get messages for a conversation
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({ messages });
}

// POST /api/conversations/[id]/messages — add a message
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { role, content } = await req.json();

  if (!role || !content) {
    return Response.json(
      { error: "role and content required" },
      { status: 400 }
    );
  }

  const message = await prisma.message.create({
    data: {
      conversationId: id,
      role,
      content,
    },
  });

  // Update conversation title from first user message
  if (role === "user") {
    const msgCount = await prisma.message.count({
      where: { conversationId: id },
    });
    if (msgCount === 1) {
      // First message — use it as title (truncated)
      const title =
        content.length > 50 ? content.slice(0, 47) + "..." : content;
      await prisma.conversation.update({
        where: { id },
        data: { title },
      });
    }
    // Always touch updatedAt
    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
  }

  return Response.json({ message });
}
