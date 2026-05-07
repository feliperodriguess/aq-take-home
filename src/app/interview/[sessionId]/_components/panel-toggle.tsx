"use client"

import { TargetIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

interface PanelToggleProps {
  open: boolean
  onToggle: () => void
}

/**
 * Top-bar pill that opens/closes the decision panel. Mirrors the handoff's
 * "Decision panel" toggle — when active, it adopts the apricot accent tint;
 * when collapsed, it sits flat in the chrome.
 */
export function PanelToggle({ open, onToggle }: PanelToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="decision-panel"
      className={cn(
        "hidden h-8 items-center gap-1.5 rounded-md border px-3 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors lg:inline-flex",
        open
          ? "border-accent/30 bg-accent-soft text-accent"
          : "border-border-default bg-transparent text-fg-3 hover:text-fg-1 hover:bg-bg-hover",
      )}
    >
      <TargetIcon className="size-3" />
      Decision panel
    </button>
  )
}
