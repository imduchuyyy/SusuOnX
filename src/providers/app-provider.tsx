"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export interface PersonaState {
  riskLevel: number;
  systemPrompt: string;
  allowSwap: boolean;
  allowBridge: boolean;
  allowDeposit: boolean;
}

export interface ConversationPreview {
  id: string;
  title: string;
  updatedAt: string;
}

interface AppState {
  chatActive: boolean;
  setChatActive: (active: boolean) => void;
  initialChatMessage: string | null;
  setInitialChatMessage: (msg: string | null) => void;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  conversations: ConversationPreview[];
  setConversations: (convos: ConversationPreview[]) => void;
  addConversation: (convo: ConversationPreview) => void;
  updateConversationTitle: (id: string, title: string) => void;
  persona: PersonaState;
  setPersona: (persona: Partial<PersonaState>) => void;
  setFullPersona: (persona: PersonaState) => void;
  agentAddress: string | null;
  setAgentAddress: (address: string | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const AppContext = createContext<AppState | null>(null);

const DEFAULT_PERSONA: PersonaState = {
  riskLevel: 50,
  systemPrompt: "",
  allowSwap: true,
  allowBridge: false,
  allowDeposit: true,
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [chatActive, setChatActive] = useState(false);
  const [initialChatMessage, setInitialChatMessage] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [persona, setPersonaState] = useState<PersonaState>(DEFAULT_PERSONA);
  const [agentAddress, setAgentAddress] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const setPersona = useCallback((updates: Partial<PersonaState>) => {
    setPersonaState((prev) => ({ ...prev, ...updates }));
  }, []);

  const setFullPersona = useCallback((p: PersonaState) => {
    setPersonaState(p);
  }, []);

  const addConversation = useCallback((convo: ConversationPreview) => {
    setConversations((prev) => [convo, ...prev]);
  }, []);

  const updateConversationTitle = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
  }, []);

  return (
    <AppContext.Provider
      value={{
        chatActive,
        setChatActive,
        initialChatMessage,
        setInitialChatMessage,
        activeConversationId,
        setActiveConversationId,
        conversations,
        setConversations,
        addConversation,
        updateConversationTitle,
        persona,
        setPersona,
        setFullPersona,
        agentAddress,
        setAgentAddress,
        sidebarOpen,
        setSidebarOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
