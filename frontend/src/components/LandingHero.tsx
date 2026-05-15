"use client"

import { SparkleIcon } from "@/components/ui/sparkle-icon"

interface LandingHeroProps {
  leaving: boolean
}

// Exit sequence:
//   t=0ms     Stars start leaving: small (0ms), medium (100ms), large (200ms), each 380ms
//   t=580ms   All stars gone
//   t=600ms   G'Day fades out (350ms)
//   t=950ms   G'Day gone → fog begins shrinking (600ms)
//   t=1550ms  Fog gone

export function LandingHero({ leaving }: LandingHeroProps) {
  return (
    <>
      {/* Semi-circular fog rising from the bottom */}
      <div
        className="fixed bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: "95vh",
          zIndex: 10,
          // Sharper gradient: solid bg from 0–35%, quick blend 35–65%, fully transparent above
          background:
            "radial-gradient(ellipse 85% 65% at 50% 100%, hsl(var(--background)) 35%, transparent 65%)",
          transformOrigin: "bottom center",
          animation: leaving
            ? "fog-shrink 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.9s both"
            : undefined,
        }}
      />

      {/* G'Day heading — slides in from above, exits after stars */}
      <div
        className="fixed left-0 right-0 flex items-center justify-center gap-3 pointer-events-none select-none"
        style={{
          bottom: "100px",
          zIndex: 45,
          animation: leaving
            ? "fade-up-out 0.35s cubic-bezier(0.22, 1, 0.36, 1) 0.6s both"
            : "blur-in-down 0.65s cubic-bezier(0.22, 1, 0.36, 1) 0.25s both",
        }}
      >
        <h1
          className="text-foreground text-6xl tracking-tight"
          style={{ fontFamily: "var(--font-heading)", lineHeight: 1 }}
        >
          G&apos;<em>Day</em>
        </h1>
        <SparkleIcon
          className="w-12 h-12 shrink-0 text-foreground"
          leaving={leaving}
          delay={1}
        />
      </div>
    </>
  )
}
