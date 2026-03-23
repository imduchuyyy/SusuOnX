"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/providers/app-provider";
import { HomeContent } from "@/components/views/home-content";
import { ChatView } from "@/components/views/chat-view";

export default function HomePage() {
  const { chatActive } = useApp();

  return (
    <AnimatePresence mode="wait">
      {!chatActive ? (
        <motion.div
          key="home"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20, scale: 0.98 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="h-full"
        >
          <HomeContent />
        </motion.div>
      ) : (
        <motion.div
          key="chat"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="h-full"
        >
          <ChatView />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
