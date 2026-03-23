"use client";

import { useChat } from "@ai-sdk/react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function Chat() {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");

  const isLoading = status === "streaming" || status === "submitted";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  }

  return (
    <Card className="flex h-[600px] w-full max-w-2xl flex-col">
      <CardHeader>
        <CardTitle>AI Agent</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 overflow-hidden">
        <ScrollArea className="flex-1 rounded-md border p-4">
          {messages.length === 0 && (
            <p className="text-muted-foreground text-center text-sm">
              Ask me anything about Web3 and the X Layer chain.
            </p>
          )}
          <div className="flex flex-col gap-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-muted mr-auto"
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
            ))}
          </div>
        </ScrollArea>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            {isLoading ? "..." : "Send"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
