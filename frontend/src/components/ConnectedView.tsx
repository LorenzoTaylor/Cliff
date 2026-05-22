"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVoiceAssistant, useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { ConnectionState, RoomEvent } from "livekit-client";
import { AgentPanel } from "@/components/AgentPanel";
import { LiveKitTranscript } from "@/components/LiveKitTranscript";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import { type Place } from "@/components/PlacesMap";
import { type AgentState } from "@/components/ui/orb";

const SOURCE_DISPLAY_MS = 8000;

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
  const [currentSource, setCurrentSource] = useState<string | null>(null);
  const queueRef = useRef<string[]>([]);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (room.state !== ConnectionState.Connected) return;
    void localParticipant.setMicrophoneEnabled(true);
  }, [room.state, localParticipant]);

  useEffect(() => {
    onStateChange(state);
    return () => onStateChange(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const advanceQueue = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) return;
    setCurrentSource(next);
    if (queueRef.current.length > 0) {
      advanceTimerRef.current = setTimeout(advanceQueue, SOURCE_DISPLAY_MS);
    }
  }, []);

  useEffect(() => {
    if (state === "listening") {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      queueRef.current = [];
      setCurrentSource(null);
      return;
    }

    if (state === "speaking") {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceQueue();
      if (queueRef.current.length > 0) {
        advanceTimerRef.current = setTimeout(advanceQueue, SOURCE_DISPLAY_MS);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleData = (payload: Uint8Array, _p: any, _k: any, topic?: string) => {
      console.log("[cliff] data received, topic:", topic);
      if (topic === "cliff:places") {
        try {
          const places = JSON.parse(new TextDecoder().decode(payload)) as Place[];
          console.log("[cliff] places received:", places);
          onPlacesReceived(places);
        } catch (e) {
          console.error("[cliff] failed to parse places payload", e);
        }
      } else if (topic === "cliff:attribution") {
        const source = new TextDecoder().decode(payload);
        console.log("[cliff] attribution received:", source);
        queueRef.current.push(source);
      }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [room, onPlacesReceived]);

  return (
    <AgentPanel
      agentState={toOrbState(state)}
      variant={sidebarMode ? "sidebar" : "card"}
      className={sidebarMode ? undefined : "animate-blur-in"}
    >
      <LiveKitTranscript />
      {currentSource && (
        <div className="w-full text-xs space-y-0.5">
          <p className="text-muted-foreground font-medium">Sources</p>
          <ShimmeringText
            key={currentSource}
            text={currentSource}
            className="text-xs"
            duration={2.5}
            color="hsl(var(--foreground))"
            shimmerColor="hsl(var(--muted-foreground))"
          />
        </div>
      )}
    </AgentPanel>
  );
}
