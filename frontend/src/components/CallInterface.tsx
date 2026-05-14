"use client";

import { LiveKitRoom, useVoiceAssistant, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import { Transcript } from "./Transcript";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";

interface Props {
  token: string | null;
  serverUrl: string | null;
  onStart: () => void;
  onEnd: () => void;
  isConnecting: boolean;
}

export function CallInterface({ token, serverUrl, onStart, onEnd, isConnecting }: Props) {
  if (!token || !serverUrl) {
    return (
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-primary">Cliff</h1>
          <p className="text-muted-foreground text-lg">Your Bay Area Outdoor Guide</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Ask Cliff about trails, fishing spots, fire closures, weather, and more — all Bay Area.
          </p>
        </div>
        <button
          onClick={onStart}
          disabled={isConnecting}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-full text-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          <Phone className="w-5 h-5" />
          {isConnecting ? "Connecting..." : "Start Call"}
        </button>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      audio={true}
      video={false}
      onDisconnected={onEnd}
      className="w-full max-w-2xl"
    >
      <ActiveCall onEnd={onEnd} />
    </LiveKitRoom>
  );
}

function ActiveCall({ onEnd }: { onEnd: () => void }) {
  const { state } = useVoiceAssistant();

  return (
    <div className="flex flex-col gap-6 w-full">
      <RoomAudioRenderer />
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-primary">Cliff</h2>
          <p className="text-sm text-muted-foreground capitalize">{state}</p>
        </div>
        <button
          onClick={onEnd}
          className="flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-2 rounded-full hover:opacity-90 transition"
        >
          <PhoneOff className="w-4 h-4" />
          End Call
        </button>
      </div>

      <Transcript />
    </div>
  );
}
