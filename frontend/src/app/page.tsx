"use client";

import { useState } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { ConnectedView } from "@/components/ConnectedView";
import { ControlDock } from "@/components/ControlDock";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { useCallSession } from "@/hooks/use-call-session";
import { cn } from "@/lib/utils";

type LayoutState = "hidden" | "panel" | "sidebar";

export default function Home() {
  const { token, serverUrl, isConnected, controlState, startCall, endCall, setAgentState } =
    useCallSession();
  // future: call setSidebarMode(true) when the sidebar trigger is built
  const [sidebarMode, setSidebarMode] = useState(false);

  const layoutState: LayoutState = !isConnected
    ? "hidden"
    : sidebarMode
    ? "sidebar"
    : "panel";

  function handleEndCall() {
    setSidebarMode(false);
    endCall();
  }

  return (
    <main className="min-h-screen w-full bg-background relative overflow-hidden">
      <div className="fixed top-4 right-4 z-50">
        <AnimatedThemeToggler
          variant="circle"
          className="w-9 h-9 rounded-full border border-border bg-background hover:bg-muted transition-colors flex items-center justify-center text-foreground"
        />
      </div>

      {layoutState !== "hidden" && (
        <div
          className={cn(
            "fixed transition-all duration-500 ease-out z-30",
            layoutState === "panel" && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            layoutState === "sidebar" && "top-0 left-0 h-full w-72 border-r border-border bg-background/80 backdrop-blur-sm",
          )}
        >
          <LiveKitRoom
            token={token!}
            serverUrl={serverUrl!}
            connect={true}
            audio={false}
            video={false}
            onDisconnected={handleEndCall}
            className={layoutState === "sidebar" ? "h-full w-full flex items-center justify-center" : undefined}
          >
            <RoomAudioRenderer />
            <ConnectedView onStateChange={setAgentState} sidebarMode={layoutState === "sidebar"} />
          </LiveKitRoom>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 flex justify-center p-5 z-40">
        <ControlDock
          state={controlState}
          onStart={startCall}
          onEnd={handleEndCall}
          sidebarMode={sidebarMode}
          onToggleLayout={() => setSidebarMode((m) => !m)}
        />
      </div>
    </main>
  );
}
