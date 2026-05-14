"use client";

import { useState } from "react";

interface DockButtonProps {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function DockButton({ label, onClick, disabled, children }: DockButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`p-2 rounded-lg transition-colors ${
          disabled
            ? "text-muted-foreground/30 cursor-not-allowed"
            : "text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
        }`}
      >
        {children}
      </button>
      {hovered && !disabled && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md bg-foreground text-background text-xs whitespace-nowrap pointer-events-none">
          {label}
        </div>
      )}
    </div>
  );
}
