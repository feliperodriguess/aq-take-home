/**
 * Shared types for the interview-room client island. Lives in `lib/` rather
 * than next to the components so the reducer + helpers + hooks all import
 * from a single canonical place.
 */

import type { Signals } from "@/types/interview"

export type TurnRole = "assistant" | "candidate"

/** A row in the on-screen transcript. May be optimistic (pending = true). */
export interface DisplayTurn {
  index: number
  role: TurnRole
  text: string
  /** "playing" highlights the currently-speaking assistant bubble. */
  status?: "pending" | "playing" | "done"
}

/**
 * High-level FSM phases. We keep these flat (string union) to make the
 * reducer + visual mapping trivial — the reducer carries auxiliary data
 * (audioUrl, errorMessage) on the state object itself.
 */
export type Phase =
  | { kind: "idle" }
  | { kind: "listening" }
  | { kind: "uploading" }
  | { kind: "thinking" }
  | { kind: "speaking"; question: string; audioUrl: string; isFinal: boolean }
  | { kind: "ending" }
  | { kind: "done" }
  | { kind: "error"; message: string }

export type PhaseKind = Phase["kind"]

export interface RoomState {
  phase: Phase
  turns: DisplayTurn[]
  /** Most recent decision-panel signals from /turn. Null until first response. */
  signals: Signals | null
  /** Seconds since the room mounted. Cosmetic — wall-clock OK. */
  elapsedSec: number
  /** Right-rail visibility (default open on lg+). */
  decisionOpen: boolean
  /** Whether to show the entire transcript (vs just the last 3). */
  fullTranscriptOpen: boolean
}
