"use client";

import { useEffect } from "react";
import { useVoiceAssistant, useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { ConnectionState, RoomEvent } from "livekit-client";
import { AgentPanel } from "@/components/AgentPanel";
import { LiveKitTranscript } from "@/components/LiveKitTranscript";
import { type Place } from "@/components/PlacesMap";
import { type AgentState } from "@/components/ui/orb";

function toOrbState(state?: string): AgentState {
  if (state === "listening") return "listening";
  if (state === "thinking") return "thinking";
  if (state === "speaking") return "talking";
  return null;
}

interface ConnectedViewProps {
  onStateChange: (state: string | undefined) => void;
  onPlacesReceived: (places: Place[]) => void;
  sidebarMode?: boolean;
}

export function ConnectedView({ onStateChange, onPlacesReceived, sidebarMode = false }: ConnectedViewProps) {
  const { state } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();

  useEffect(() => {
    if (room.state !== ConnectionState.Connected) return;
    void localParticipant.setMicrophoneEnabled(true);
  }, [room.state, localParticipant]);

  useEffect(() => {
    onStateChange(state);
    return () => onStateChange(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleData = (payload: Uint8Array, _p: any, _k: any, topic?: string) => {
      console.log("[cliff] data received, topic:", topic);
      if (topic !== "cliff:places") return;
      try {
        const places = JSON.parse(new TextDecoder().decode(payload)) as Place[];
        console.log("[cliff] places received:", places);
        onPlacesReceived(places);
      } catch (e) {
        console.error("[cliff] failed to parse places payload", e);
      }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room, onPlacesReceived]);

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
