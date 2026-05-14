"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import type { TranscriptionSegment, Participant } from "livekit-client";
import { type AgentState } from "@/components/ui/orb";

const Orb = dynamic(
  () => import("@/components/ui/orb").then((m) => ({ default: m.Orb })),
  { ssr: false, loading: () => <div className="w-full h-full rounded-full bg-muted/40 animate-pulse" /> }
);

interface AgentPanelProps {
  agentState: AgentState;
  statusText: string;
  children?: ReactNode;
}

export function AgentPanel({ agentState, statusText, children }: AgentPanelProps) {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-8 flex flex-col items-center gap-5">
      <div className="w-52 h-52">
        <Orb colors={["#4ade80", "#d1fae5"]} seed={42} agentState={agentState} />
      </div>

      <p
        className="text-lg text-foreground text-center"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {statusText}
      </p>

      {children && (
        <>
          <div className="w-full h-px bg-border" />
          {children}
        </>
      )}
    </div>
  );
}

type Speaker = "cliff" | "you";

interface TranscriptEntry {
  id: string;
  text: string;
  speaker: Speaker;
  firstReceivedTime: number;
}

export function LiveKitTranscript() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);

  useEffect(() => {
    const handleTranscription = (
      segments: TranscriptionSegment[],
      participant?: Participant
    ) => {
      const speaker: Speaker =
        participant?.identity === localParticipant.identity ? "you" : "cliff";

      setEntries((prev) => {
        const updated = [...prev];
        for (const seg of segments) {
          const entry: TranscriptEntry = {
            id: seg.id,
            text: seg.text,
            speaker,
            firstReceivedTime: seg.firstReceivedTime,
          };
          const idx = updated.findIndex((e) => e.id === seg.id);
          if (idx >= 0) {
            updated[idx] = entry;
          } else {
            updated.push(entry);
          }
        }
        return updated.sort((a, b) => a.firstReceivedTime - b.firstReceivedTime);
      });
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);
    return () => { room.off(RoomEvent.TranscriptionReceived, handleTranscription); };
  }, [room, localParticipant.identity]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  return (
    <div
      ref={scrollRef}
      className="w-full h-44 overflow-y-auto space-y-2 scroll-smooth"
    >
      {entries.length === 0 && (
        <p className="text-muted-foreground text-sm text-center pt-6">
          Transcript will appear here...
        </p>
      )}
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={`flex flex-col gap-0.5 ${
            entry.speaker === "you" ? "items-end" : "items-start"
          }`}
        >
          <span className="text-xs text-muted-foreground">
            {entry.speaker === "cliff" ? "Cliff" : "You"}
          </span>
          <div
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
              entry.speaker === "cliff"
                ? "bg-primary/15 text-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            {entry.text}
          </div>
        </div>
      ))}
    </div>
  );
}
