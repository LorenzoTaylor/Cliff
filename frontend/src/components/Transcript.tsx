"use client";

import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import type { TranscriptionSegment, Participant } from "livekit-client";
import { useEffect, useRef, useState } from "react";

type Speaker = "cliff" | "you";

interface Entry {
  id: string;
  text: string;
  speaker: Speaker;
  firstReceivedTime: number;
}

export function Transcript() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const handleTranscription = (
      segments: TranscriptionSegment[],
      participant?: Participant
    ) => {
      console.log("[Transcript] TranscriptionReceived", { participant: participant?.identity, segments });
      const speaker: Speaker =
        participant?.identity === localParticipant.identity ? "you" : "cliff";

      setEntries((prev) => {
        const updated = [...prev];
        for (const seg of segments) {
          const entry: Entry = {
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

    console.log("[Transcript] Registering TranscriptionReceived listener, room state:", room.state);
    room.on(RoomEvent.TranscriptionReceived, handleTranscription);
    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
    };
  }, [room, localParticipant.identity]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  return (
    <div
      ref={scrollRef}
      className="h-80 overflow-y-auto rounded-xl border border-border bg-card p-4 space-y-3 scroll-smooth"
    >
      {entries.length === 0 && (
        <p className="text-muted-foreground text-sm text-center pt-8">
          Transcript will appear here as you speak...
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
            className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
              entry.speaker === "cliff"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {entry.text}
          </div>
        </div>
      ))}
    </div>
  );
}
