"use client";

import { useEffect } from "react";
import { useApp } from "@/providers/app-provider";

/**
 * DataFetcher — loads user data from the API when authenticated.
 * Replaces the old wagmi-based version. Now reads identity from the
 * AppProvider session (which comes from localStorage).
 */
export function DataFetcher() {
  const { isAuthenticated, email, setConversations, setFullPersona } = useApp();

  useEffect(() => {
    if (!isAuthenticated || !email) {
      setConversations([]);
      return;
    }

    // Fetch conversations (keyed by email now instead of address)
    fetch(`/api/conversations?userAddress=${encodeURIComponent(email)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.conversations) {
          setConversations(
            data.conversations.map(
              (c: { id: string; title: string; updatedAt: string }) => ({
                id: c.id,
                title: c.title,
                updatedAt: c.updatedAt,
              }),
            ),
          );
        }
      })
      .catch(console.error);

    // Fetch persona settings
    fetch(`/api/persona?userAddress=${encodeURIComponent(email)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.persona) {
          setFullPersona(data.persona);
        }
      })
      .catch(console.error);
  }, [isAuthenticated, email, setConversations, setFullPersona]);

  return null;
}
