"use client";

import { useState } from "react";
import { LiveKitRoom, RoomAudioRenderer, useVoiceAssistant } from "@livekit/components-react";
import { AgentPanel, LiveKitTranscript } from "@/components/AgentPanel";
import { ChatBar } from "@/components/ChatBar";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { type AgentState } from "@/components/ui/orb";

function toOrbState(state?: string): AgentState {
  if (state === "listening") return "listening";
  if (state === "thinking") return "thinking";
  if (state === "speaking") return "talking";
  return null;
}

function toStatusText(state?: string): string {
  const map: Record<string, string> = {
    connecting: "Connecting...",
    initializing: "Connecting...",
    connected: "Connected",
    listening: "Listening...",
    thinking: "Thinking...",
    speaking: "Speaking",
  };
  return map[state ?? ""] ?? "Tap to speak";
}

function ConnectedContent() {
  const { state } = useVoiceAssistant();
  return (
    <AgentPanel agentState={toOrbState(state)} statusText={toStatusText(state)}>
      <LiveKitTranscript />
    </AgentPanel>
  );
}

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  async function startCall() {
    setIsConnecting(true);
    try {
      const res = await fetch("/api/token");
      const data = await res.json();
      setToken(data.token);
      setServerUrl(data.serverUrl);
    } finally {
      setIsConnecting(false);
    }
  }

  function endCall() {
    setToken(null);
    setServerUrl(null);
  }

  const isConnected = !!(token && serverUrl);

  return (
    <main className="min-h-screen bg-background flex flex-col items-center relative overflow-hidden">
      <div className="fixed top-4 right-4 z-50">
        <AnimatedThemeToggler
          variant="circle"
          className="w-9 h-9 rounded-full border border-border bg-background hover:bg-muted transition-colors flex items-center justify-center text-foreground"
        />
      </div>

      <div className="flex-1 flex items-center justify-center w-full px-6 pt-16 pb-28">
        {isConnected ? (
          <LiveKitRoom
            token={token}
            serverUrl={serverUrl}
            connect={true}
            audio={true}
            video={false}
            onDisconnected={endCall}
          >
            <RoomAudioRenderer />
            <ConnectedContent />
          </LiveKitRoom>
        ) : (
          <AgentPanel
            agentState={null}
            statusText={isConnecting ? "Connecting..." : "Tap to speak"}
          />
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 flex justify-center p-5">
        <ChatBar
          onStart={startCall}
          onEnd={endCall}
          isConnected={isConnected}
          isConnecting={isConnecting}
        />
      </div>
    </main>
  );
}
