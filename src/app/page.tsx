"use client";

import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { HomeView } from "@/components/views/home-view";
import { ChatView } from "@/components/views/chat-view";
import { PortfolioView } from "@/components/views/portfolio-view";
import { PersonaView } from "@/components/views/persona-view";
import { useApp } from "@/providers/app-provider";
import { useAccount } from "wagmi";
import { useEffect } from "react";

export default function Home() {
  const { currentView, setAgentAddress, setConversations, setFullPersona } = useApp();
  const { address } = useAccount();

  // Fetch agent wallet, conversations, and persona when user connects
  useEffect(() => {
    if (!address) {
      setAgentAddress(null);
      setConversations([]);
      return;
    }

    // Fetch agent wallet
    fetch("/api/agent-wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAddress: address }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.agentAddress) {
          setAgentAddress(data.agentAddress);
        }
      })
      .catch(console.error);

    // Fetch conversations
    fetch(`/api/conversations?userAddress=${address}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.conversations) {
          setConversations(
            data.conversations.map((c: { id: string; title: string; updatedAt: string }) => ({
              id: c.id,
              title: c.title,
              updatedAt: c.updatedAt,
            }))
          );
        }
      })
      .catch(console.error);

    // Fetch persona settings
    fetch(`/api/persona?userAddress=${address}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.persona) {
          setFullPersona(data.persona);
        }
      })
      .catch(console.error);
  }, [address, setAgentAddress, setConversations, setFullPersona]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          {currentView === "home" && <HomeView />}
          {currentView === "chat" && <ChatView />}
          {currentView === "portfolio" && <PortfolioView />}
          {currentView === "persona" && <PersonaView />}
        </main>
      </div>
    </div>
  );
}
