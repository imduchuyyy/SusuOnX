"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { type FormEvent, useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Bot,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VaultCard } from "@/components/vault-card";
import { useApp } from "@/providers/app-provider";
import { STRATEGIES, type Strategy } from "@/lib/strategies";
import { cn } from "@/lib/utils";
import { useAccount } from "wagmi";
import type { UIMessage } from "ai";

type TxState =
  | { status: "idle" }
  | { status: "confirming"; strategy: Strategy }
  | { status: "executing"; strategy: Strategy }
  | { status: "completed"; strategy: Strategy; txHash: string };

export function ChatView() {
  const { persona, activeConversationId, setActiveConversationId, addConversation, updateConversationTitle } = useApp();
  const { address } = useAccount();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { persona },
      }),
    [persona]
  );

  const { messages, sendMessage, status, setMessages } = useChat({ transport });
  const [input, setInput] = useState("");
  const [txState, setTxState] = useState<TxState>({ status: "idle" });
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<string | null>(activeConversationId);
  const loadedConversationIdRef = useRef<string | null>(null);

  const isLoading = status === "streaming" || status === "submitted";

  // Keep ref in sync
  useEffect(() => {
    conversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // Load existing messages when switching to a conversation
  useEffect(() => {
    if (!activeConversationId) {
      // New chat — clear messages
      if (loadedConversationIdRef.current !== null) {
        setMessages([]);
        loadedConversationIdRef.current = null;
      }
      return;
    }

    if (loadedConversationIdRef.current === activeConversationId) return;

    loadedConversationIdRef.current = activeConversationId;

    fetch(`/api/conversations/${activeConversationId}/messages`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages && data.messages.length > 0) {
          // Convert DB messages to UIMessage format
          const uiMessages: UIMessage[] = data.messages.map(
            (m: { id: string; role: string; content: string; createdAt: string }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              parts: [{ type: "text" as const, text: m.content }],
              createdAt: new Date(m.createdAt),
            })
          );
          setMessages(uiMessages);
        } else {
          setMessages([]);
        }
      })
      .catch(console.error);
  }, [activeConversationId, setMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, txState]);

  // Persist messages when they change (after streaming completes)
  const lastPersistedCountRef = useRef(0);

  useEffect(() => {
    if (status !== "ready") return;
    if (messages.length === 0) return;
    if (messages.length <= lastPersistedCountRef.current) return;

    const newMessages = messages.slice(lastPersistedCountRef.current);
    lastPersistedCountRef.current = messages.length;

    // Persist new messages
    (async () => {
      let convoId = conversationIdRef.current;

      // Create conversation if needed
      if (!convoId && address) {
        try {
          const res = await fetch("/api/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userAddress: address }),
          });
          const data = await res.json();
          convoId = data.conversation.id;
          conversationIdRef.current = convoId;
          setActiveConversationId(convoId!);
          addConversation({
            id: convoId!,
            title: "New Chat",
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.error("Failed to create conversation:", err);
          return;
        }
      }

      if (!convoId) return;

      for (const msg of newMessages) {
        const content = msg.parts
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("");

        if (!content.trim()) continue;

        try {
          const res = await fetch(`/api/conversations/${convoId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: msg.role, content }),
          });

          // If this was the first user message, the API auto-set the title
          if (msg.role === "user" && messages.indexOf(msg) === 0) {
            const title = content.length > 50 ? content.slice(0, 47) + "..." : content;
            updateConversationTitle(convoId, title);
          }
        } catch (err) {
          console.error("Failed to persist message:", err);
        }
      }
    })();
  }, [status, messages, address, setActiveConversationId, addConversation, updateConversationTitle]);

  // Reset persisted count when conversation changes
  useEffect(() => {
    lastPersistedCountRef.current = 0;
  }, [activeConversationId]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  }

  function handleDeposit(strategy: Strategy) {
    setTxState({ status: "confirming", strategy });
  }

  function handleConfirmDeposit() {
    if (txState.status !== "confirming") return;
    const strategy = txState.strategy;
    setTxState({ status: "executing", strategy });

    // Simulate transaction execution
    setTimeout(async () => {
      const mockHash = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("")}`;
      setTxState({ status: "completed", strategy, txHash: mockHash });

      // Persist the active strategy to the DB
      if (address) {
        try {
          await fetch("/api/strategies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userAddress: address,
              strategyId: strategy.id,
              depositAmount: strategy.minDeposit,
              txHash: mockHash,
            }),
          });
        } catch (err) {
          console.error("Failed to persist strategy:", err);
        }
      }
    }, 3000);
  }

  function handleDismissTx() {
    setTxState({ status: "idle" });
  }

  // Determine which strategies to show as recommendations
  const recommendedStrategies = getStrategiesForRisk(persona.riskLevel);

  return (
    <div className="flex h-full flex-col">
      {/* Messages Area */}
      <ScrollArea className="flex-1 px-6 py-4" ref={scrollRef}>
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-12 text-center"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">
                AI Yield Agent
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Tell me about your yield goals and I&apos;ll recommend the best
                strategies on X Layer.
              </p>

              {/* Recommended Vaults */}
              <div className="mt-8 text-left">
                <p className="mb-3 text-sm font-medium text-muted-foreground">
                  Recommended for you:
                </p>
                <div className="grid gap-3">
                  {recommendedStrategies.map((strategy, i) => (
                    <VaultCard
                      key={strategy.id}
                      strategy={strategy}
                      index={i}
                      onDeposit={handleDeposit}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-card border border-border rounded-bl-md"
                )}
              >
                {message.parts.map((part, i) =>
                  part.type === "text" ? (
                    <p key={i} className="whitespace-pre-wrap leading-relaxed">
                      {part.text}
                    </p>
                  ) : null
                )}
              </div>
              {message.role === "user" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <User className="h-4 w-4 text-secondary-foreground" />
                </div>
              )}
            </motion.div>
          ))}

          {/* AI Thinking Indicator */}
          {isLoading && messages.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                </div>
              </div>
            </motion.div>
          )}

          {/* Strategy Cards After Conversation */}
          {messages.length > 0 && messages.length % 4 === 0 && txState.status === "idle" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <p className="text-sm font-medium text-muted-foreground">
                Based on our conversation, here are my recommendations:
              </p>
              <div className="grid gap-3">
                {recommendedStrategies.map((strategy, i) => (
                  <VaultCard
                    key={strategy.id}
                    strategy={strategy}
                    index={i}
                    onDeposit={handleDeposit}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* Transaction Flow Overlay */}
      <AnimatePresence>
        {txState.status !== "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="border-t border-border bg-card px-6 py-4"
          >
            <div className="mx-auto max-w-2xl">
              {txState.status === "confirming" && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      Deposit into {txState.strategy.name}?
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Min: {txState.strategy.minDeposit} {txState.strategy.token} | APY: {txState.strategy.apy}%
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDismissTx}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleConfirmDeposit}>
                      Confirm Deposit
                    </Button>
                  </div>
                </div>
              )}

              {txState.status === "executing" && (
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="text-sm font-medium">
                      Solid choice. Executing deposit...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitting transaction to X Layer
                    </p>
                  </div>
                </div>
              )}

              {txState.status === "completed" && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <div>
                      <p className="text-sm font-medium">
                        Transaction Completed!
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Deposited into {txState.strategy.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() =>
                        window.open(
                          `https://www.okx.com/explorer/xlayer/tx/${txState.txHash}`,
                          "_blank"
                        )
                      }
                    >
                      <ExternalLink className="h-3 w-3" />
                      Onchain Hash
                    </Button>
                    <Button size="sm" onClick={handleDismissTx}>
                      Done
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="border-t border-border bg-background px-6 py-4">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-2xl gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell me about your yield goals..."
            disabled={isLoading}
            className="h-10"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

function getStrategiesForRisk(riskLevel: number): Strategy[] {
  if (riskLevel <= 33) return STRATEGIES.filter((s) => s.risk === "low");
  if (riskLevel <= 66)
    return STRATEGIES.filter((s) => s.risk === "low" || s.risk === "medium");
  return STRATEGIES;
}
