"use client";

import { useState } from "react";
import { CallInterface } from "@/components/CallInterface";

export default function Home() {
  const [roomToken, setRoomToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  async function startCall() {
    setIsConnecting(true);
    try {
      const res = await fetch("/api/token");
      const data = await res.json();
      setRoomToken(data.token);
      setServerUrl(data.serverUrl);
    } finally {
      setIsConnecting(false);
    }
  }

  function endCall() {
    setRoomToken(null);
    setServerUrl(null);
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <CallInterface
        token={roomToken}
        serverUrl={serverUrl}
        onStart={startCall}
        onEnd={endCall}
        isConnecting={isConnecting}
      />
    </main>
  );
}
