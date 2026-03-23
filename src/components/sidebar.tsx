"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  PieChart,
  User,
  MessageSquare,
  Plus,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useApp } from "@/providers/app-provider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MascotIcon } from "@/components/doodle-mascot";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { href: string; label: string; icon: typeof Home }[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/dashboard/persona", label: "Persona", icon: User },
];

export function Sidebar() {
  const {
    chatActive,
    setChatActive,
    setInitialChatMessage,
    conversations,
    activeConversationId,
    setActiveConversationId,
    sidebarOpen,
    setSidebarOpen,
  } = useApp();
  const pathname = usePathname();
  const router = useRouter();

  function handleNewChat() {
    setActiveConversationId(null);
    setInitialChatMessage(null);
    // If already on dashboard, just activate chat mode
    if (pathname.startsWith("/dashboard")) {
      setChatActive(true);
    } else {
      setChatActive(true);
      router.push("/dashboard");
    }
  }

  function handleSelectConvo(id: string) {
    setActiveConversationId(id);
    setInitialChatMessage(null);
    if (pathname.startsWith("/dashboard")) {
      setChatActive(true);
    } else {
      setChatActive(true);
      router.push("/dashboard");
    }
  }

  function handleNavClick(href: string) {
    // When clicking Home, go back to home content (not chat)
    if (href === "/dashboard") {
      setChatActive(false);
      setInitialChatMessage(null);
    }
    router.push(href);
  }

  return (
    <>
      {/* Toggle button when sidebar is closed */}
      <AnimatePresence>
        {!sidebarOpen && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="fixed left-4 top-4 z-50"
          >
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl bg-white shadow-md"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 272, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="flex h-screen flex-col overflow-hidden p-3"
          >
            {/* Floating sidebar panel */}
            <div className="flex h-full flex-col panel-floating overflow-hidden">
              {/* Logo & Toggle */}
              <div className="flex h-16 items-center justify-between px-5">
                <button
                  onClick={() => handleNavClick("/")}
                  className="flex items-center gap-2.5"
                >
                  <MascotIcon size={30} />
                  <span className="text-lg font-bold text-[#1F2937] tracking-tight">
                    Long.AI
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSidebarOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>

              {/* New Chat Button */}
              <div className="px-4 pb-2">
                <Button
                  variant="default"
                  className="w-full justify-center gap-2 text-sm font-medium"
                  onClick={handleNewChat}
                >
                  <Plus className="h-4 w-4" />
                  New Chat
                </Button>
              </div>

              {/* Navigation */}
              <nav className="px-3 py-2 space-y-0.5">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href &&
                    (item.href !== "/dashboard" || !chatActive);
                  return (
                    <button
                      key={item.href}
                      onClick={() => handleNavClick(item.href)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                        isActive
                          ? "bg-pastel-blue text-[#3730A3] font-semibold"
                          : "text-muted-foreground hover:bg-[#F1F5F9] hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>

              {/* Divider */}
              <div className="mx-4 my-2 h-px bg-border/60" />

              {/* Past Convos */}
              <div className="px-5 py-1">
                <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                  Past Chats
                </p>
              </div>

              <ScrollArea className="flex-1 px-3">
                {conversations.length === 0 ? (
                  <div className="space-y-2 px-2 py-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-9 animate-pulse rounded-xl bg-[#F1F5F9]"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {conversations.map((convo) => (
                      <button
                        key={convo.id}
                        onClick={() => handleSelectConvo(convo.id)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all text-left",
                          activeConversationId === convo.id && chatActive
                            ? "bg-pastel-mint text-[#065F46] font-medium"
                            : "text-muted-foreground hover:bg-[#F1F5F9] hover:text-foreground"
                        )}
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        <span className="truncate">{convo.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Footer */}
              <div className="border-t border-border/40 px-5 py-3">
                <p className="text-[11px] text-muted-foreground/50 text-center">
                  Powered by X Layer
                </p>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
