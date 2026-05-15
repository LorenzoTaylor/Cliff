"use client";

import { useEffect, useRef, useState } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import type { TranscriptionSegment, Participant } from "livekit-client";

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
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Smooth-scroll to end on every text update
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  }, [entries]);

  if (entries.length === 0) return null;

  const latest = entries[entries.length - 1];
  const label = latest.speaker === "cliff" ? "Cliff" : "You";

  return (
    // key on latest.id: remounts (resetting scroll + blur-in) only when a NEW segment starts,
    // not on every word update within the same segment
    <div
      key={latest.id}
      ref={containerRef}
      className="animate-blur-in w-full overflow-x-auto text-sm [mask-image:linear-gradient(to_right,transparent,black_14px,black_calc(100%-14px),transparent)]"
      style={{ scrollbarWidth: "none" }}
    >
      <div className="whitespace-nowrap">
        <span className="text-muted-foreground">{label}:&nbsp;</span>
        <span className="text-foreground">{latest.text}</span>
      </div>
    </div>
  );
}
