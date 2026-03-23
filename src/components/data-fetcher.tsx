"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { useApp } from "@/providers/app-provider";

export function DataFetcher() {
  const { setAgentAddress, setConversations, setFullPersona } = useApp();
  const { address } = useAccount();

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
            data.conversations.map(
              (c: { id: string; title: string; updatedAt: string }) => ({
                id: c.id,
                title: c.title,
                updatedAt: c.updatedAt,
              })
            )
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

  return null;
}
