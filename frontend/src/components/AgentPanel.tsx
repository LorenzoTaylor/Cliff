"use client";

import dynamic from "next/dynamic";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type AgentState } from "@/components/ui/orb";

// ssr: false keeps Three.js off the server. No loading fallback — makeNoiseTexture()
// in orb.tsx generates the texture synchronously so the canvas is stable from first paint.
const Orb = dynamic(
  () => import("@/components/ui/orb").then((m) => ({ default: m.Orb })),
  { ssr: false }
);

interface AgentPanelProps {
  agentState: AgentState;
  children?: ReactNode;
  className?: string;
  variant?: "card" | "sidebar";
}

const ORB_COLORS: [string, string] = ["#c2c2c2", "#ffffff"]

export function AgentPanel({ agentState, children, className, variant = "card" }: AgentPanelProps) {
  return (
    <div className={cn(
      "flex flex-col items-center gap-5 transition-all duration-500 ease-out",
      variant === "card" && "w-full max-w-md rounded-2xl border border-border bg-background p-10",
      variant === "sidebar" && "w-full px-6 py-10",
      className
    )}>
      <div className="min-w-full h-56 overflow-hidden">
        <Orb colors={ORB_COLORS} seed={42} agentState={agentState} />
      </div>

      {children && (
        <>
          <div className="w-full h-px bg-border" />
          {children}
        </>
      )}
    </div>
  );
}
