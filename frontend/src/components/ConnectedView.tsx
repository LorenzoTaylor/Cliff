"use client";

import { useEffect } from "react";
import { useVoiceAssistant, useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { AgentPanel } from "@/components/AgentPanel";
import { LiveKitTranscript } from "@/components/LiveKitTranscript";
import { type AgentState } from "@/components/ui/orb";

function toOrbState(state?: string): AgentState {
  if (state === "listening") return "listening";
  if (state === "thinking") return "thinking";
  if (state === "speaking") return "talking";
  return null;
}

interface ConnectedViewProps {
  onStateChange: (state: string | undefined) => void;
  sidebarMode?: boolean;
}

export function ConnectedView({ onStateChange, sidebarMode = false }: ConnectedViewProps) {
  const { state } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();

  // Wait for the room to be fully connected before publishing the mic track.
  // audio={true} on LiveKitRoom races with the handshake and can leave the
  // track unpublished, so Silero VAD never fires and the agent stays "connected".
  useEffect(() => {
    if (room.state !== ConnectionState.Connected) return;
    void localParticipant.setMicrophoneEnabled(true);
  }, [room.state, localParticipant]);

  useEffect(() => {
    onStateChange(state);
    return () => onStateChange(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <AgentPanel
      agentState={toOrbState(state)}
      variant={sidebarMode ? "sidebar" : "card"}
      className={sidebarMode ? undefined : "animate-blur-in"}
    >
      <LiveKitTranscript />
    </AgentPanel>
  );
}
