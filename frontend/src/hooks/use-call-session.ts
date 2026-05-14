"use client";

import { useState } from "react";
import { type ControlState } from "@/components/ControlDock";

export interface CallSession {
  token: string | undefined;
  serverUrl: string | undefined;
  isConnected: boolean;
  controlState: ControlState;
  startCall: () => Promise<void>;
  endCall: () => void;
  setAgentState: (state: string | undefined) => void;
}

export function useCallSession(): CallSession {
  const [token, setToken] = useState<string | undefined>(undefined);
  const [serverUrl, setServerUrl] = useState<string | undefined>(undefined);
  const [isConnecting, setIsConnecting] = useState(false);
  const [agentState, setAgentState] = useState<string | undefined>(undefined);

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
    setToken(undefined);
    setServerUrl(undefined);
    setAgentState(undefined);
  }

  const isConnected = !!(token && serverUrl);

  let controlState: ControlState;
  if (!isConnected && isConnecting) controlState = "connecting";
  else if (!isConnected) controlState = "idle";
  else if (agentState === "listening") controlState = "listening";
  else if (agentState === "thinking") controlState = "thinking";
  else if (agentState === "speaking") controlState = "speaking";
  else controlState = "connected";

  return { token, serverUrl, isConnected, controlState, startCall, endCall, setAgentState };
}
