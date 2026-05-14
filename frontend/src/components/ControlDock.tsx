"use client";

import { X, Square, Mic, PanelLeft, Maximize2 } from "lucide-react";
import { SparkleIcon } from "@/components/ui/sparkle-icon";
import { DockButton } from "@/components/ui/dock-button";

export type ControlState =
  | "idle"
  | "connecting"
  | "connected"
  | "listening"
  | "thinking"
  | "speaking";

const STATUS_LABELS: Record<ControlState, string> = {
  idle: "Tap to speak",
  connecting: "Connecting...",
  connected: "Connected",
  listening: "Listening...",
  thinking: "Thinking",
  speaking: "Speaking",
};

interface ControlDockProps {
  state: ControlState;
  onStart: () => void;
  onEnd: () => void;
  sidebarMode?: boolean;
  onToggleLayout?: () => void;
}

export function ControlDock({ state, onStart, onEnd, sidebarMode = false, onToggleLayout }: ControlDockProps) {
  const isIdle = state === "idle";
  const isThinking = state === "thinking";
  const canInterrupt = state === "listening" || state === "speaking";
  const canEnd = state !== "idle" && state !== "connecting" && !isThinking;
  const isActive = state !== "idle" && state !== "connecting";

  return (
    <div className="w-fit rounded-full border border-border bg-background px-5 py-3 flex items-center justify-center gap-2">
      {isThinking ? (
        <div className="flex items-center gap-2 mr-8">
          <span
            className="text-foreground"
            style={{ fontFamily: "var(--font-heading)", fontSize: "1.1rem" }}
          >
            Thinking
          </span>
          <SparkleIcon className="w-4 h-4 shrink-0" loop />
        </div>
      ) : isIdle ? (
        <span
          className="text-foreground mr-8 cursor-pointer hover:text-foreground/60 transition-colors"
          style={{ fontFamily: "var(--font-heading)", fontSize: "1.1rem" }}
          onClick={isIdle ? onStart : undefined}
        >
          Tap to speak
        </span>
      ) : (
        <span
          className="text-foreground mr-8"
          style={{ fontFamily: "var(--font-heading)", fontSize: "1.1rem" }}
        >
          {STATUS_LABELS[state]}
        </span>
      )}

      <div className="w-px h-5 bg-border shrink-0" />

      <div className="flex items-center gap-1 shrink-0">
        <DockButton
          label="Stop"
          onClick={canInterrupt ? onEnd : undefined}
          disabled={!canInterrupt}
        >
          <Square size={15} />
        </DockButton>

        <DockButton
          label="Speak"
          onClick={isIdle ? onStart : undefined}
          disabled={!isIdle}
        >
          <Mic size={15} />
        </DockButton>

        <DockButton
          label={sidebarMode ? "Expand" : "Sidebar"}
          onClick={isActive ? onToggleLayout : undefined}
          disabled={!isActive}
        >
          {sidebarMode ? <Maximize2 size={15} /> : <PanelLeft size={15} />}
        </DockButton>

        <DockButton
          label="End call"
          onClick={canEnd ? onEnd : undefined}
          disabled={!canEnd}
        >
          <X size={15} />
        </DockButton>
      </div>
    </div>
  );
}
