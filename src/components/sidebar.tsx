"use client";

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
import { useApp, type AppView } from "@/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { id: AppView; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "portfolio", label: "Portfolio", icon: PieChart },
  { id: "persona", label: "Persona", icon: User },
];

export function Sidebar() {
  const {
    currentView,
    setCurrentView,
    conversations,
    activeConversationId,
    setActiveConversationId,
    sidebarOpen,
    setSidebarOpen,
  } = useApp();

  function handleNewChat() {
    setActiveConversationId(null);
    setCurrentView("chat");
  }

  function handleSelectConvo(id: string) {
    setActiveConversationId(id);
    setCurrentView("chat");
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
            className="fixed left-3 top-3 z-50"
          >
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setSidebarOpen(true)}
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
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex h-screen flex-col border-r border-sidebar-border bg-sidebar overflow-hidden"
          >
            <div className="flex h-14 items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                  L
                </div>
                <span className="font-semibold text-sidebar-foreground">
                  Long.AI
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSidebarOpen(false)}
                className="text-sidebar-foreground/60 hover:text-sidebar-foreground"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>

            <div className="px-3 py-2">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-sm"
                onClick={handleNewChat}
              >
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
            </div>

            <nav className="px-3 py-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  currentView === item.id ||
                  (currentView === "chat" && item.id === "home");
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <Separator className="my-2" />

            <div className="px-3 py-1">
              <p className="px-3 py-1 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
                Past Convos
              </p>
            </div>

            <ScrollArea className="flex-1 px-3">
              {conversations.length === 0 ? (
                <div className="space-y-2 px-3 py-1">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-8 animate-pulse rounded-md bg-sidebar-accent/30"
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
                        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors text-left",
                        activeConversationId === convo.id
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{convo.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="border-t border-sidebar-border p-3">
              <p className="text-xs text-sidebar-foreground/40 text-center">
                Powered by X Layer
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
