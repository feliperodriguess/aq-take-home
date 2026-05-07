/**
 * Phase → microcopy / accent / disabled-flag helpers. All written as
 * top-to-bottom `if` flows (no nested ternaries) so they read like
 * specs the designer can audit without parsing operator precedence.
 */

import type { PhaseKind } from "./types"

/** mm:ss formatter for the wall-clock timer. */
export function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

/** Microcopy beneath the avatar: "ready" / "listening" / "speaking" / etc. */
export function getStatusLabel(phase: PhaseKind): string {
  if (phase === "speaking") return "speaking"
  if (phase === "listening") return "listening"
  if (phase === "thinking") return "thinking"
  if (phase === "uploading") return "transcribing"
  if (phase === "ending" || phase === "done") return "complete"
  return "ready"
}

/** Tailwind text-color class for the avatar status accent. `null` = inherit. */
export function getStatusAccentClass(phase: PhaseKind): string | null {
  if (phase === "listening") return "text-pass"
  if (phase === "speaking" || phase === "thinking") return "text-accent"
  return null
}

/** Microcopy beneath the mic button. `hasTurns` toggles "tap to begin" vs "tap to talk". */
export function getMicCaption(phase: PhaseKind, hasTurns: boolean): string {
  if (phase === "listening") return "tap to send"
  if (phase === "uploading") return "transcribing…"
  if (phase === "thinking") return "iris is thinking…"
  if (phase === "speaking") return "iris is speaking…"
  if (phase === "ending" || phase === "done") return "wrapping up…"
  if (!hasTurns) return "tap to begin"
  return "tap to talk"
}

/** Whether the mic button should be disabled in the current phase. */
export function isMicDisabled(phase: PhaseKind): boolean {
  if (phase === "speaking") return true
  if (phase === "ending") return true
  if (phase === "done") return true
  if (phase === "error") return true
  return false
}

/** Whether the mic is actively capturing. */
export function isListening(phase: PhaseKind): boolean {
  return phase === "listening"
}

/** Whether the room is busy with an in-flight network call (STT or /turn). */
export function isBusy(phase: PhaseKind): boolean {
  return phase === "uploading" || phase === "thinking"
}
