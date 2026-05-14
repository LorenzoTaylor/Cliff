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
  const textRef = useRef<HTMLDivElement>(null);
  const targetOffsetRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const rafRef = useRef<number>(0);

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

  // Update the scroll target whenever text grows.
  useEffect(() => {
    if (!containerRef.current || !textRef.current) return;
    const overflow = textRef.current.scrollWidth - containerRef.current.clientWidth;
    targetOffsetRef.current = overflow > 0 ? -overflow : 0;
  }, [entries]);

  // Lerp toward the target offset every frame for continuous smooth motion.
  useEffect(() => {
    function animate() {
      const diff = targetOffsetRef.current - currentOffsetRef.current;
      if (Math.abs(diff) > 0.1 && textRef.current) {
        currentOffsetRef.current += diff * 0.15;
        textRef.current.style.transform = `translateX(${currentOffsetRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    }
    rafRef.current = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(rafRef.current); };
  }, []);

  if (entries.length === 0) return null;

  const latest = entries[entries.length - 1];
  const label = latest.speaker === "cliff" ? "Cliff" : "You";

  return (
    // key resets scroll and re-triggers blur-in when a new segment starts
    <div
      key={entries.length}
      ref={containerRef}
      className="animate-blur-in w-full overflow-hidden text-sm [mask-image:linear-gradient(to_right,transparent,black_14px,black_calc(100%-14px),transparent)]"
    >
      <div ref={textRef} className="whitespace-nowrap">
        <span className="text-muted-foreground">{label}:&nbsp;</span>
        <span className="text-foreground">{latest.text}</span>
      </div>
    </div>
  );
}
