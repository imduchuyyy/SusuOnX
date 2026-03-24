"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { type FormEvent, useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  CheckCircle2,
  ExternalLink,
  ArrowLeft,
  AlertCircle,
  TrendingUp,
  Shield,
  Zap,
  Flame,
  ArrowRightLeft,
  CircleDot,
  Wallet,
  ArrowUpRight,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { DoodleMascot, MascotIcon } from "@/components/doodle-mascot";
import { useApp } from "@/providers/app-provider";
import { STRATEGIES, TOKENS, XLAYER_CHAIN_INDEX, toMinimalUnits, type Strategy } from "@/lib/strategies";
import { signAndBroadcast } from "@/lib/okx-api";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { UIMessage } from "ai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DepositStep = "idle" | "approve" | "swap" | "done";

interface DepositFlowState {
  status: "confirming" | "executing" | "completed" | "error";
  strategyId: string;
  amount: string;
  /** Current step in the multi-step flow */
  step: DepositStep;
  /** Transaction hashes for completed steps */
  txHashes: { approve?: string; swap?: string };
  error?: string;
}

interface WithdrawFlowState {
  status: "confirming" | "executing" | "completed" | "error";
  strategyId: string;
  txHash?: string;
  error?: string;
}

interface SendFlowState {
  status: "confirming" | "signing" | "broadcasting" | "completed" | "error";
  tokenSymbol: string;
  tokenAddress: string;
  amount: string;
  toAddress: string;
  txHash?: string;
  error?: string;
}

type FlowState =
  | { type: "idle" }
  | { type: "deposit"; flow: DepositFlowState }
  | { type: "withdraw"; flow: WithdrawFlowState }
  | { type: "send"; flow: SendFlowState };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RISK_ICONS = {
  low: Shield,
  medium: Zap,
  high: Flame,
} as const;

const RISK_BADGE_VARIANTS = {
  low: "mint" as const,
  medium: "pastel" as const,
  high: "peach" as const,
};

function getStrategy(id: string): Strategy | undefined {
  return STRATEGIES.find((s) => s.id === id);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatView() {
  const {
    persona,
    activeConversationId,
    setActiveConversationId,
    addConversation,
    updateConversationTitle,
    initialChatMessage,
    setInitialChatMessage,
    setChatActive,
    email,
    userAddress,
    session,
  } = useApp();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { persona, userAddress, walletAddress: userAddress },
      }),
    [persona, userAddress],
  );

  const { messages, sendMessage, status, setMessages, addToolOutput } = useChat({
    transport,
  });

  const [input, setInput] = useState("");
  const [flowState, setFlowState] = useState<FlowState>({ type: "idle" });
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
            (m: {
              id: string;
              role: string;
              content: string;
              createdAt: string;
            }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              parts: [{ type: "text" as const, text: m.content }],
              createdAt: new Date(m.createdAt),
            }),
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
  }, [messages, flowState]);

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

      if (!convoId && email) {
        try {
          const res = await fetch("/api/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userAddress: email }),
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
          .filter(
            (p): p is { type: "text"; text: string } => p.type === "text",
          )
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
            const title =
              content.length > 50 ? content.slice(0, 47) + "..." : content;
            updateConversationTitle(convoId, title);
          }
        } catch (err) {
          console.error("Failed to persist message:", err);
        }
      }
    })();
  }, [
    status,
    messages,
    email,
    setActiveConversationId,
    addConversation,
    updateConversationTitle,
  ]);

  useEffect(() => {
    lastPersistedCountRef.current = 0;
  }, [activeConversationId]);

  // -------------------------------------------------------------------------
  // Form submit
  // -------------------------------------------------------------------------

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  }

  // -------------------------------------------------------------------------
  // Deposit flow — triggered by prepare_deposit tool call
  // -------------------------------------------------------------------------

  const handleStartDeposit = useCallback(
    (strategyId: string, amount: string, toolCallId: string) => {
      setFlowState({
        type: "deposit",
        flow: {
          status: "confirming",
          strategyId,
          amount,
          step: "idle",
          txHashes: {},
        },
      });

      // Provide the tool output so the AI can continue
      addToolOutput({
        tool: "prepare_deposit",
        toolCallId,
        output: {
          status: "awaiting_confirmation",
          strategyId,
          amount,
          message: `Deposit of ${amount} USDT into ${getStrategy(strategyId)?.name ?? strategyId} is ready for user confirmation.`,
        },
      });
    },
    [addToolOutput],
  );

  const executeDeposit = useCallback(async () => {
    if (flowState.type !== "deposit" || flowState.flow.status !== "confirming") return;
    if (!session) {
      setFlowState({
        type: "deposit",
        flow: { ...flowState.flow, status: "error", error: "Not authenticated — please sign in first" },
      });
      return;
    }

    const { strategyId, amount } = flowState.flow;
    const strategy = getStrategy(strategyId);
    if (!strategy || !strategy.actionable) {
      setFlowState({
        type: "deposit",
        flow: { ...flowState.flow, status: "error", error: "Strategy not actionable" },
      });
      return;
    }

    // Start executing
    setFlowState({
      type: "deposit",
      flow: { ...flowState.flow, status: "executing", step: "approve" },
    });

    try {
      // Step 1: Approve USDT spending for the OKX DEX router
      // We need to get the approve transaction data from our swap proxy
      const amountWei = toMinimalUnits(amount, TOKENS.USDT.decimals);

      const approveRes = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          params: {
            chainIndex: XLAYER_CHAIN_INDEX,
            tokenContractAddress: TOKENS.USDT.address,
            approveAmount: amountWei,
          },
        }),
      });

      if (!approveRes.ok) throw new Error("Failed to get approve transaction");

      const approveData = await approveRes.json();
      const approveTx = approveData.data?.[0];

      if (approveTx?.data) {
        // Execute the approve transaction
        const approveResult = await signAndBroadcast({
          session,
          toAddr: approveTx.to || TOKENS.USDT.address,
          value: "0",
          contractAddr: TOKENS.USDT.address,
          inputData: approveTx.data,
          isContractCall: true,
        });

        setFlowState((prev) => {
          if (prev.type !== "deposit") return prev;
          return {
            type: "deposit",
            flow: {
              ...prev.flow,
              step: "swap",
              txHashes: { ...prev.flow.txHashes, approve: approveResult.txHash },
            },
          };
        });

        // Small delay to let the approval propagate
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        // No approval needed (already approved or native token)
        setFlowState((prev) => {
          if (prev.type !== "deposit") return prev;
          return {
            type: "deposit",
            flow: { ...prev.flow, step: "swap" },
          };
        });
      }

      // Step 2: Swap ~50% of USDT to OKB via OKX DEX
      const swapAmount = Math.floor(Number(amount) * 50) / 100; // 50%
      const swapAmountWei = toMinimalUnits(String(swapAmount), TOKENS.USDT.decimals);

      // Get the wallet address from session
      const walletAddr =
        session.addresses.find((a) => a.chainIndex === XLAYER_CHAIN_INDEX)?.address ??
        session.addresses[0]?.address;

      if (!walletAddr) throw new Error("No wallet address found");

      const swapRes = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "swap",
          params: {
            chainIndex: XLAYER_CHAIN_INDEX,
            fromTokenAddress: TOKENS.USDT.address,
            toTokenAddress: TOKENS.WOKB.address,
            amount: swapAmountWei,
            userWalletAddress: walletAddr,
            swapMode: "exactIn",
            gasLevel: "average",
            autoSlippage: "true",
            slippagePercent: "0.5",
          },
        }),
      });

      if (!swapRes.ok) throw new Error("Failed to get swap transaction");

      const swapData = await swapRes.json();
      const swapTx = swapData.data?.[0]?.tx;

      if (!swapTx) throw new Error("No swap transaction data returned");

      // Execute the swap transaction
      const swapResult = await signAndBroadcast({
        session,
        toAddr: swapTx.to,
        value: swapTx.value || "0",
        contractAddr: swapTx.to,
        inputData: swapTx.data,
        isContractCall: true,
      });

      setFlowState({
        type: "deposit",
        flow: {
          status: "completed",
          strategyId,
          amount,
          step: "done",
          txHashes: {
            approve: flowState.flow.txHashes.approve,
            swap: swapResult.txHash,
          },
        },
      });

      // Persist the strategy activation
      if (email) {
        try {
          await fetch("/api/strategies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userAddress: email,
              strategyId,
              depositAmount: Number(amount),
              txHash: swapResult.txHash,
            }),
          });
        } catch (err) {
          console.error("Failed to persist strategy:", err);
        }
      }
    } catch (err) {
      console.error("Deposit flow failed:", err);
      setFlowState((prev) => {
        if (prev.type !== "deposit") return prev;
        return {
          type: "deposit",
          flow: {
            ...prev.flow,
            status: "error",
            error: err instanceof Error ? err.message : "Transaction failed",
          },
        };
      });
    }
  }, [flowState, session, email]);

  // -------------------------------------------------------------------------
  // Withdraw flow — triggered by prepare_withdraw tool call
  // -------------------------------------------------------------------------

  const handleStartWithdraw = useCallback(
    (strategyId: string, toolCallId: string) => {
      setFlowState({
        type: "withdraw",
        flow: { status: "confirming", strategyId },
      });

      addToolOutput({
        tool: "prepare_withdraw",
        toolCallId,
        output: {
          status: "awaiting_confirmation",
          strategyId,
          message: `Withdrawal from ${getStrategy(strategyId)?.name ?? strategyId} is ready for user confirmation.`,
        },
      });
    },
    [addToolOutput],
  );

  // -------------------------------------------------------------------------
  // Send token flow — triggered by send_token tool call
  // -------------------------------------------------------------------------

  const handleStartSend = useCallback(
    (
      tokenSymbol: string,
      tokenAddress: string,
      amount: string,
      toAddress: string,
      toolCallId: string,
    ) => {
      setFlowState({
        type: "send",
        flow: {
          status: "confirming",
          tokenSymbol,
          tokenAddress,
          amount,
          toAddress,
        },
      });

      addToolOutput({
        tool: "send_token",
        toolCallId,
        output: {
          status: "awaiting_confirmation",
          tokenSymbol,
          amount,
          toAddress,
          message: `Send ${amount} ${tokenSymbol} to ${toAddress} is ready for user confirmation.`,
        },
      });
    },
    [addToolOutput],
  );

  const executeSend = useCallback(async () => {
    if (flowState.type !== "send" || flowState.flow.status !== "confirming") return;
    if (!session) {
      setFlowState({
        type: "send",
        flow: { ...flowState.flow, status: "error", error: "Not authenticated — please sign in first" },
      });
      return;
    }

    const { tokenSymbol, tokenAddress, amount, toAddress } = flowState.flow;
    const isNative = !tokenAddress || tokenAddress === "" || tokenAddress === "0x0000000000000000000000000000000000000000";

    setFlowState({
      type: "send",
      flow: { ...flowState.flow, status: "signing" },
    });

    try {
      const result = await signAndBroadcast({
        session,
        toAddr: toAddress,
        value: amount,
        contractAddr: isNative ? undefined : tokenAddress,
        isContractCall: false,
        onProgress: (step) => {
          if (step === "broadcasting") {
            setFlowState((prev) => {
              if (prev.type !== "send") return prev;
              return { type: "send", flow: { ...prev.flow, status: "broadcasting" } };
            });
          }
        },
      });

      setFlowState({
        type: "send",
        flow: {
          ...flowState.flow,
          status: "completed",
          txHash: result.txHash,
        },
      });
    } catch (err) {
      console.error("Send failed:", err);
      setFlowState((prev) => {
        if (prev.type !== "send") return prev;
        return {
          type: "send",
          flow: {
            ...prev.flow,
            status: "error",
            error: err instanceof Error ? err.message : "Transaction failed",
          },
        };
      });
    }
  }, [flowState, session]);

  function handleDismissFlow() {
    setFlowState({ type: "idle" });
  }

  // User avatar initials from email
  const avatarInitials = email ? email.slice(0, 2).toUpperCase() : "U";

  // -------------------------------------------------------------------------
  // Render a single message part
  // -------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderPart(part: any, msgId: string, partIndex: number, role: string) {
    // Guard against undefined/null parts during streaming
    if (!part || !part.type) return null;

    // Text parts
    if (part.type === "text") {
      if (!part.text) return null;

      // Render assistant text as markdown, user text as plain
      if (role === "assistant") {
        return (
          <div key={`${msgId}-text-${partIndex}`} className="chat-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {part.text}
            </ReactMarkdown>
          </div>
        );
      }

      return (
        <p key={`${msgId}-text-${partIndex}`} className="whitespace-pre-wrap">
          {part.text}
        </p>
      );
    }

    // Normalize: AI SDK v6 may send tool parts as "dynamic-tool" with toolName
    // instead of "tool-{name}" when useChat isn't typed with tool definitions
    const toolType = part.type === "dynamic-tool"
      ? `tool-${part.toolName}`
      : part.type;

    // Tool parts — strategy recommendation (server-executed, has output)
    if (toolType === "tool-recommend_strategy") {
      if (part.state === "output-available" && part.output && !part.output.error) {
        const s = part.output.strategy;
        const RiskIcon = RISK_ICONS[s.risk as keyof typeof RISK_ICONS] ?? Shield;
        const badgeVariant = RISK_BADGE_VARIANTS[s.risk as keyof typeof RISK_BADGE_VARIANTS] ?? "pastel";

        return (
          <motion.div
            key={`${msgId}-strategy-${partIndex}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="my-3 w-full"
          >
            <div className="card-playful px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <Badge variant={badgeVariant}>
                  <RiskIcon className="mr-1 h-3 w-3" />
                  {s.riskLabel}
                </Badge>
                <span className="text-xs text-muted-foreground font-medium">
                  TVL {s.tvl}
                </span>
              </div>
              <h4 className="text-base font-bold text-[#1F2937] mb-1">
                {s.name}
              </h4>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                {s.description}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-xl bg-pastel-mint px-2.5 py-1">
                    <TrendingUp className="h-3.5 w-3.5 text-[#059669]" />
                    <span className="text-base font-bold text-[#059669]">
                      {s.apy}%
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">APY</span>
                </div>
                {s.actionable && (
                  <span className="text-xs text-muted-foreground rounded-lg bg-[#F1F5F9] px-2 py-0.5">
                    Min: {s.minDeposit} {s.token}
                  </span>
                )}
              </div>
              {part.output.reason && (
                <p className="mt-2 text-xs text-muted-foreground italic">
                  {part.output.reason}
                </p>
              )}
            </div>
          </motion.div>
        );
      }

      // Loading state
      if (part.state === "input-available" || part.state === "input-streaming") {
        return (
          <div key={`${msgId}-strategy-loading-${partIndex}`} className="my-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Looking up strategy...
          </div>
        );
      }

      return null;
    }

    // Tool parts — prepare_deposit (client-side, no execute on server)
    if (toolType === "tool-prepare_deposit") {
      if (part.state === "input-available") {
        const { strategyId, amount } = part.input;
        const strategy = getStrategy(strategyId);

        // If we haven't started the flow yet for this tool call, start it
        if (flowState.type === "idle") {
          // Use setTimeout to avoid setState during render
          setTimeout(() => handleStartDeposit(strategyId, amount, part.toolCallId), 0);
        }

        return (
          <motion.div
            key={`${msgId}-deposit-${partIndex}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="my-3 w-full"
          >
            <div className="card-playful px-5 py-4 border-l-4 border-l-primary">
              <div className="flex items-center gap-2 mb-2">
                <ArrowRightLeft className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-[#1F2937]">
                  Deposit Ready
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {amount} USDT into {strategy?.name ?? strategyId}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Steps: Approve USDT → Swap 50% to OKB → Add Liquidity
              </p>
            </div>
          </motion.div>
        );
      }

      // After output is provided
      if (part.state === "output-available") {
        return null; // The flow overlay handles the UI
      }

      if (part.state === "input-streaming") {
        return (
          <div key={`${msgId}-deposit-loading-${partIndex}`} className="my-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Preparing deposit...
          </div>
        );
      }

      return null;
    }

    // Tool parts — prepare_withdraw (client-side)
    if (toolType === "tool-prepare_withdraw") {
      if (part.state === "input-available") {
        const { strategyId } = part.input;

        if (flowState.type === "idle") {
          setTimeout(() => handleStartWithdraw(strategyId, part.toolCallId), 0);
        }

        return (
          <motion.div
            key={`${msgId}-withdraw-${partIndex}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="my-3 w-full"
          >
            <div className="card-playful px-5 py-4 border-l-4 border-l-amber-400">
              <div className="flex items-center gap-2 mb-2">
                <ArrowRightLeft className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-[#1F2937]">
                  Withdrawal Ready
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Withdraw from {getStrategy(strategyId)?.name ?? strategyId}
              </p>
            </div>
          </motion.div>
        );
      }

      if (part.state === "output-available") return null;

      return null;
    }

    // Tool parts — send_token (client-side)
    if (toolType === "tool-send_token") {
      if (part.state === "input-available") {
        const { tokenSymbol, tokenAddress, amount, toAddress } = part.input;

        if (flowState.type === "idle") {
          setTimeout(
            () =>
              handleStartSend(tokenSymbol, tokenAddress, amount, toAddress, part.toolCallId),
            0,
          );
        }

        return (
          <motion.div
            key={`${msgId}-send-${partIndex}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="my-3 w-full"
          >
            <div className="card-playful px-5 py-4 border-l-4 border-l-[#6366F1]">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpRight className="h-4 w-4 text-[#6366F1]" />
                <span className="text-sm font-semibold text-[#1F2937]">
                  Send Ready
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {amount} {tokenSymbol} to{" "}
                <span className="font-mono">{toAddress.slice(0, 8)}...{toAddress.slice(-6)}</span>
              </p>
            </div>
          </motion.div>
        );
      }

      if (part.state === "output-available") return null;

      if (part.state === "input-streaming") {
        return (
          <div key={`${msgId}-send-loading-${partIndex}`} className="my-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Preparing transfer...
          </div>
        );
      }

      return null;
    }

    // Tool parts — get_balances (server-executed)
    if (toolType === "tool-get_balances") {
      if (part.state === "output-available" && part.output && !part.output.error) {
        const { balances } = part.output;
        if (!balances || balances.length === 0) {
          return (
            <div key={`${msgId}-balances-empty-${partIndex}`} className="my-2 text-xs text-muted-foreground">
              No token balances found.
            </div>
          );
        }

        return (
          <motion.div
            key={`${msgId}-balances-${partIndex}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="my-2 w-full"
          >
            <div className="rounded-2xl bg-[#F1F5F9] px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium text-[#1F2937] mb-2">
                <Wallet className="h-3.5 w-3.5 text-primary" />
                Your Balances
              </div>
              <div className="space-y-1.5">
                {balances.map((b: { symbol: string; balance: string; usdValue: string }, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#1F2937]">{b.symbol}</span>
                    <div className="text-right">
                      <span className="text-[#1F2937]">{parseFloat(b.balance).toFixed(4)}</span>
                      {parseFloat(b.usdValue) > 0 && (
                        <span className="text-muted-foreground ml-1.5">(${b.usdValue})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        );
      }

      if (part.state === "input-available" || part.state === "input-streaming") {
        return (
          <div key={`${msgId}-balances-loading-${partIndex}`} className="my-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Checking balances...
          </div>
        );
      }

      return null;
    }

    // Tool parts — get_swap_quote (server-executed)
    if (toolType === "tool-get_swap_quote") {
      if (part.state === "output-available" && part.output && !part.output.error) {
        const q = part.output;
        return (
          <motion.div
            key={`${msgId}-quote-${partIndex}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="my-2 w-full"
          >
            <div className="rounded-2xl bg-[#F1F5F9] px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium text-[#1F2937]">
                <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
                Swap Quote
              </div>
              <p className="text-sm text-[#1F2937] mt-1 font-medium">
                {q.fromAmount} {q.fromToken} → {q.toAmount} {q.toToken}
              </p>
            </div>
          </motion.div>
        );
      }

      if (part.state === "input-available" || part.state === "input-streaming") {
        return (
          <div key={`${msgId}-quote-loading-${partIndex}`} className="my-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Fetching swap quote...
          </div>
        );
      }

      return null;
    }

    // Step start parts
    if (part.type === "step-start") {
      return null; // Don't render step boundaries visually
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

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
                Ask me about yield farming on X Layer and I&apos;ll help you
                deposit into the best pools.
              </p>
            </motion.div>
          )}

          {messages.map((message) => {
            // Skip rendering assistant messages with no visible content
            // (happens during submitted/streaming state before text arrives)
            const hasVisibleContent =
              message.role === "user" ||
              message.parts.some((p: any) => {
                if (!p || !p.type) return false;
                if (p.type === "text" && p.text) return true;
                // Check for tool parts with renderable states
                const tType = p.type === "dynamic-tool" ? `tool-${p.toolName}` : p.type;
                if (typeof tType === "string" && tType.startsWith("tool-") && p.state) return true;
                return false;
              });

            if (!hasVisibleContent) return null;

            return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "justify-end" : "justify-start",
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
                    : "bg-white border border-border/60 text-[#1F2937] rounded-bl-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
                )}
              >
                {message.parts.map((part: any, i: number) => renderPart(part, message.id, i, message.role))}
              </div>
              {message.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-pastel-blue">
                  <span className="text-xs font-bold text-[#3730A3]">
                    {avatarInitials}
                  </span>
                </div>
              )}
            </motion.div>
            );
          })}

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
        </div>
      </ScrollArea>

      {/* Transaction Flow Overlay */}
      <AnimatePresence>
        {flowState.type === "deposit" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mx-8 mb-4"
          >
            <div className="card-playful px-6 py-4">
              <div className="mx-auto max-w-2xl">
                <DepositFlowUI
                  flow={flowState.flow}
                  onConfirm={executeDeposit}
                  onDismiss={handleDismissFlow}
                  onRetry={() => {
                    setFlowState({
                      type: "deposit",
                      flow: {
                        ...flowState.flow,
                        status: "confirming",
                        step: "idle",
                        error: undefined,
                      },
                    });
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {flowState.type === "withdraw" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mx-8 mb-4"
          >
            <div className="card-playful px-6 py-4">
              <div className="mx-auto max-w-2xl">
                <WithdrawFlowUI
                  flow={flowState.flow}
                  onDismiss={handleDismissFlow}
                />
              </div>
            </div>
          </motion.div>
        )}

        {flowState.type === "send" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mx-8 mb-4"
          >
            <div className="card-playful px-6 py-4">
              <div className="mx-auto max-w-2xl">
                <SendFlowUI
                  flow={flowState.flow}
                  onConfirm={executeSend}
                  onDismiss={handleDismissFlow}
                  onRetry={() => {
                    setFlowState({
                      type: "send",
                      flow: {
                        ...flowState.flow,
                        status: "confirming",
                        error: undefined,
                      },
                    });
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="px-8 pb-6 pt-2">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl">
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

// ---------------------------------------------------------------------------
// Deposit Flow UI Sub-component
// ---------------------------------------------------------------------------

function DepositFlowUI({
  flow,
  onConfirm,
  onDismiss,
  onRetry,
}: {
  flow: DepositFlowState;
  onConfirm: () => void;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  const strategy = getStrategy(flow.strategyId);
  const name = strategy?.name ?? flow.strategyId;

  if (flow.status === "confirming") {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1F2937]">
            Deposit {flow.amount} USDT into {name}?
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            This will: Approve USDT → Swap 50% to OKB → Enter LP position
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onDismiss}>
            Cancel
          </Button>
          <Button size="sm" variant="mint" onClick={onConfirm}>
            Confirm Deposit
          </Button>
        </div>
      </div>
    );
  }

  if (flow.status === "executing") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm font-semibold text-[#1F2937]">
            Executing deposit...
          </p>
        </div>
        <div className="flex gap-4">
          <StepIndicator
            label="Approve"
            active={flow.step === "approve"}
            done={flow.step !== "approve" && flow.step !== "idle"}
            txHash={flow.txHashes.approve}
          />
          <StepIndicator
            label="Swap USDT→OKB"
            active={flow.step === "swap"}
            done={flow.step === "done"}
            txHash={flow.txHashes.swap}
          />
          <StepIndicator
            label="Add LP"
            active={false}
            done={flow.step === "done"}
          />
        </div>
      </div>
    );
  }

  if (flow.status === "completed") {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pastel-mint">
            <CheckCircle2 className="h-5 w-5 text-[#059669]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1F2937]">
              Deposit Completed!
            </p>
            <p className="text-xs text-muted-foreground">
              {flow.amount} USDT deposited into {name}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {flow.txHashes.swap && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                window.open(
                  `https://www.okx.com/explorer/xlayer/tx/${flow.txHashes.swap}`,
                  "_blank",
                )
              }
            >
              <ExternalLink className="h-3 w-3" />
              View Tx
            </Button>
          )}
          <Button size="sm" onClick={onDismiss}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  if (flow.status === "error") {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1F2937]">
              Deposit Failed
            </p>
            <p className="text-xs text-muted-foreground max-w-xs truncate">
              {flow.error}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onDismiss}>
            Cancel
          </Button>
          <Button size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Withdraw Flow UI Sub-component (strategy exit — stub)
// ---------------------------------------------------------------------------

function WithdrawFlowUI({
  flow,
  onDismiss,
}: {
  flow: WithdrawFlowState;
  onDismiss: () => void;
}) {
  const strategy = getStrategy(flow.strategyId);
  const name = strategy?.name ?? flow.strategyId;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pastel-lavender">
          <ArrowRightLeft className="h-5 w-5 text-[#7C3AED]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#1F2937]">
            Withdraw from {name}
          </p>
          <p className="text-xs text-muted-foreground">
            Strategy exit is currently available through the Portfolio page.
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onDismiss}>
        Got it
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Send Flow UI Sub-component
// ---------------------------------------------------------------------------

function SendFlowUI({
  flow,
  onConfirm,
  onDismiss,
  onRetry,
}: {
  flow: SendFlowState;
  onConfirm: () => void;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyTxHash() {
    if (flow.txHash) {
      navigator.clipboard.writeText(flow.txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const shortAddr = `${flow.toAddress.slice(0, 8)}...${flow.toAddress.slice(-6)}`;

  if (flow.status === "confirming") {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pastel-blue">
            <ArrowUpRight className="h-5 w-5 text-[#4338CA]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1F2937]">
              Send {flow.amount} {flow.tokenSymbol}?
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              To <span className="font-mono">{shortAddr}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onDismiss}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm}>
            Confirm Send
          </Button>
        </div>
      </div>
    );
  }

  if (flow.status === "signing" || flow.status === "broadcasting") {
    return (
      <div className="flex items-center gap-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div>
          <p className="text-sm font-semibold text-[#1F2937]">
            {flow.status === "signing" ? "Signing transaction..." : "Broadcasting transaction..."}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sending {flow.amount} {flow.tokenSymbol} to <span className="font-mono">{shortAddr}</span>
          </p>
        </div>
      </div>
    );
  }

  if (flow.status === "completed") {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pastel-mint">
            <CheckCircle2 className="h-5 w-5 text-[#059669]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1F2937]">
              Transfer Sent!
            </p>
            <p className="text-xs text-muted-foreground">
              {flow.amount} {flow.tokenSymbol} sent to <span className="font-mono">{shortAddr}</span>
            </p>
            {flow.txHash && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-mono text-muted-foreground">
                  {flow.txHash.slice(0, 12)}...{flow.txHash.slice(-8)}
                </span>
                <button
                  onClick={copyTxHash}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied ? <Check className="h-3 w-3 text-[#059669]" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {flow.txHash && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                window.open(
                  `https://www.okx.com/explorer/xlayer/tx/${flow.txHash}`,
                  "_blank",
                )
              }
            >
              <ExternalLink className="h-3 w-3" />
              Explorer
            </Button>
          )}
          <Button size="sm" onClick={onDismiss}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  if (flow.status === "error") {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1F2937]">
              Transfer Failed
            </p>
            <p className="text-xs text-muted-foreground max-w-xs truncate">
              {flow.error}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onDismiss}>
            Cancel
          </Button>
          <Button size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Step Indicator
// ---------------------------------------------------------------------------

function StepIndicator({
  label,
  active,
  done,
  txHash,
}: {
  label: string;
  active: boolean;
  done: boolean;
  txHash?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
          done
            ? "bg-pastel-mint"
            : active
              ? "bg-primary/10"
              : "bg-gray-100",
        )}
      >
        {done ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-[#059669]" />
        ) : active ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        ) : (
          <CircleDot className="h-3.5 w-3.5 text-gray-300" />
        )}
      </div>
      <div>
        <p
          className={cn(
            "text-xs font-medium",
            done ? "text-[#059669]" : active ? "text-[#1F2937]" : "text-gray-400",
          )}
        >
          {label}
        </p>
        {txHash && (
          <button
            className="text-[10px] text-primary hover:underline"
            onClick={() =>
              window.open(
                `https://www.okx.com/explorer/xlayer/tx/${txHash}`,
                "_blank",
              )
            }
          >
            {txHash.slice(0, 8)}...
          </button>
        )}
      </div>
    </div>
  );
}
