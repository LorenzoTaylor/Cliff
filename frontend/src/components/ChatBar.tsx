"use client";

import {
  SpeechInput,
  SpeechInputRecordButton,
  SpeechInputPreview,
  SpeechInputCancelButton,
} from "@/components/ui/speech-input";

interface ChatBarProps {
  onStart: () => void;
  onEnd: () => void;
  isConnected: boolean;
  isConnecting: boolean;
}

async function getScribeToken(): Promise<string> {
  const res = await fetch("/api/get-scribe-token", { method: "POST" });
  if (!res.ok) throw new Error("Failed to get Scribe token");
  const data = await res.json();
  return data.token;
}

export function ChatBar({ onStart, onEnd, isConnected, isConnecting }: ChatBarProps) {
  const handleStart = () => {
    if (!isConnected && !isConnecting) onStart();
  };

  const handleStop = () => {
    if (isConnected) onEnd();
  };

  return (
    <div className="w-full max-w-lg px-2">
      <SpeechInput
        getToken={getScribeToken}
        onStart={handleStart}
        onStop={handleStop}
        onCancel={handleStop}
        className="w-full rounded-full border border-border bg-background/95 backdrop-blur-sm px-2 py-1 shadow-sm"
      >
        <SpeechInputRecordButton />
        <SpeechInputPreview placeholder="Start speaking to Cliff..." />
        <SpeechInputCancelButton />
      </SpeechInput>
    </div>
  );
}
