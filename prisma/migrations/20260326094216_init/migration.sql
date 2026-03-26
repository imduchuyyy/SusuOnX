-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userAddress" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Chat',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonaSettings" (
    "id" TEXT NOT NULL,
    "userAddress" TEXT NOT NULL,
    "riskLevel" INTEGER NOT NULL DEFAULT 50,
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "allowSwap" BOOLEAN NOT NULL DEFAULT true,
    "allowBridge" BOOLEAN NOT NULL DEFAULT false,
    "allowDeposit" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonaSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveStrategy" (
    "id" TEXT NOT NULL,
    "userAddress" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "depositAmount" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "txHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonaSettings_userAddress_key" ON "PersonaSettings"("userAddress");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
