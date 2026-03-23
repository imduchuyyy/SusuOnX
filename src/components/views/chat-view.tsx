"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { type FormEvent, useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  CheckCircle2,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VaultCard } from "@/components/vault-card";
import { DoodleMascot, MascotIcon } from "@/components/doodle-mascot";
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
  const { persona, activeConversationId, setActiveConversationId, addConversation, updateConversationTitle, initialChatMessage, setInitialChatMessage, setChatActive } = useApp();
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
  const hasSentInitialRef = useRef(false);

  // Auto-send initial message from home search bar
  useEffect(() => {
    if (initialChatMessage && !hasSentInitialRef.current) {
      hasSentInitialRef.current = true;
      sendMessage({ text: initialChatMessage });
      setInitialChatMessage(null);
    }
  }, [initialChatMessage, sendMessage, setInitialChatMessage]);

  // Reset initial message flag when conversation changes
  useEffect(() => {
    hasSentInitialRef.current = false;
  }, [activeConversationId]);

  function handleBackToHome() {
    setChatActive(false);
    setInitialChatMessage(null);
  }

  // Keep ref in sync
  useEffect(() => {
    conversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // Load existing messages when switching to a conversation
  useEffect(() => {
    if (!activeConversationId) {
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

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, txState]);

  // Persist messages
  const lastPersistedCountRef = useRef(0);

  useEffect(() => {
    if (status !== "ready") return;
    if (messages.length === 0) return;
    if (messages.length <= lastPersistedCountRef.current) return;

    const newMessages = messages.slice(lastPersistedCountRef.current);
    lastPersistedCountRef.current = messages.length;

    (async () => {
      let convoId = conversationIdRef.current;

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
          await fetch(`/api/conversations/${convoId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: msg.role, content }),
          });

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

    setTimeout(async () => {
      const mockHash = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("")}`;
      setTxState({ status: "completed", strategy, txHash: mockHash });

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

  const recommendedStrategies = getStrategiesForRisk(persona.riskLevel);

  return (
    <div className="flex h-full flex-col">
      {/* Back to Home */}
      <div className="px-8 pt-4 pb-1">
        <button
          onClick={handleBackToHome}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </button>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-8 py-6" ref={scrollRef}>
        <div className="mx-auto max-w-2xl space-y-5">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-12 text-center"
            >
              <div className="flex justify-center mb-5">
                <DoodleMascot size={88} mood="happy" />
              </div>
              <h3 className="text-xl font-bold text-[#1F2937] mb-1">
                Hey there! I&apos;m your yield buddy
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Tell me about your yield goals and I&apos;ll find the best
                strategies on X Layer for you.
              </p>

              {/* Recommended Vaults */}

            </motion.div>
          )}

          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-pastel-mint">
                  <MascotIcon size={20} />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[75%] rounded-3xl px-5 py-3 text-sm leading-relaxed",
                  message.role === "user"
                    ? "bg-primary text-white rounded-br-lg"
                    : "bg-white border border-border/60 text-[#1F2937] rounded-bl-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                )}
              >
                {message.parts.map((part, i) =>
                  part.type === "text" ? (
                    <p key={i} className="whitespace-pre-wrap">
                      {part.text}
                    </p>
                  ) : null
                )}
              </div>
              {message.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-pastel-blue">
                  <span className="text-xs font-bold text-[#3730A3]">
                    {address ? address.slice(2, 4).toUpperCase() : "U"}
                  </span>
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
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-pastel-mint">
                <MascotIcon size={20} />
              </div>
              <div className="flex items-center gap-2 rounded-3xl rounded-bl-lg border border-border/60 bg-white px-5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary/40 [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary/40 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary/40 [animation-delay:300ms]" />
                </div>
              </div>
            </motion.div>
          )}

          {/* Strategy Cards */}
          {messages.length > 0 && messages.length % 4 === 0 && txState.status === "idle" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest px-1">
                My recommendations
              </p>
              <div className="grid gap-4">
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
            className="mx-8 mb-4"
          >
            <div className="card-playful px-6 py-4">
              <div className="mx-auto max-w-2xl">
                {txState.status === "confirming" && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#1F2937]">
                        Deposit into {txState.strategy.name}?
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
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
                      <Button size="sm" variant="mint" onClick={handleConfirmDeposit}>
                        Confirm
                      </Button>
                    </div>
                  </div>
                )}

                {txState.status === "executing" && (
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pastel-blue">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1F2937]">
                        Executing deposit...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Submitting transaction to X Layer
                      </p>
                    </div>
                  </div>
                )}

                {txState.status === "completed" && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pastel-mint">
                        <CheckCircle2 className="h-5 w-5 text-[#059669]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1F2937]">
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
                        View Tx
                      </Button>
                      <Button size="sm" onClick={handleDismissTx}>
                        Done
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="px-8 pb-6 pt-2">
        <form
          onSubmit={handleSubmit}
          className="mx-auto max-w-2xl"
        >
          <div className="card-playful flex items-center gap-2 px-5 py-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell me about your yield goals..."
              disabled={isLoading}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none py-2 disabled:opacity-50"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className="shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
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
