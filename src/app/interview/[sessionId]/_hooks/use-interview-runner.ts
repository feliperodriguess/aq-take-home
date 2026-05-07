import { useRouter } from "next/navigation"
import { type Dispatch, useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"

import type { RoomAction } from "@/lib/interview-room/reducer"
import type { RoomState } from "@/lib/interview-room/types"
import { SttResponseSchema, TurnResponseSchema } from "@/types/interview"

interface UseInterviewRunnerArgs {
  sessionId: string
  state: RoomState
  dispatch: Dispatch<RoomAction>
}

interface UseInterviewRunnerReturn {
  handleMicStart: () => void
  handleAudio: (audio: Blob) => Promise<void>
  handleMicError: (message: string) => void
  handleManualEnd: () => void
  onAudioEnded: () => void
  onAudioError: (message: string) => void
}

/**
 * Owns every side-effect the interview room needs: STT round-trip, /turn
 * round-trip, end-of-session redirect, and the audio callbacks. The room
 * component just renders JSX and forwards events.
 *
 * Two refs guard against duplicate work:
 *  - `turnInFlightRef` — a /turn call is in flight; ignore re-entries.
 *  - `endCalledRef` — /end has been kicked off; do not retry on re-renders.
 */
export function useInterviewRunner({ sessionId, state, dispatch }: UseInterviewRunnerArgs): UseInterviewRunnerReturn {
  const router = useRouter()
  const turnInFlightRef = useRef(false)
  const endCalledRef = useRef(false)

  // POST /api/interview/turn. utterance == null bootstraps turn 0.
  const requestTurn = useCallback(
    async (candidateUtterance: string | null) => {
      if (turnInFlightRef.current) return
      turnInFlightRef.current = true
      try {
        const res = await fetch("/api/interview/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, candidateUtterance: candidateUtterance ?? null }),
        })
        if (res.status === 410) {
          router.push(`/sessions/${sessionId}`)
          return
        }
        if (!res.ok) {
          const text = await res.text().catch(() => "")
          throw new Error(text || `Turn HTTP ${res.status}`)
        }
        const parsed = TurnResponseSchema.parse(await res.json())
        const audioUrl = `/api/tts?sessionId=${encodeURIComponent(sessionId)}&turnIndex=${parsed.turnIndex}`
        dispatch({
          type: "TURN_DONE",
          assistantTurn: { index: parsed.turnIndex, role: "assistant", text: parsed.question, status: "playing" },
          signals: parsed.signals,
          audioUrl,
          isFinal: parsed.isFinal,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Couldn't reach the interviewer"
        toast.error(msg)
        dispatch({ type: "ERROR", message: msg })
      } finally {
        turnInFlightRef.current = false
      }
    },
    [router, sessionId, dispatch],
  )

  // STT round-trip → if non-empty, drive /turn.
  const handleAudio = useCallback(
    async (audio: Blob) => {
      dispatch({ type: "MIC_STOP" })
      try {
        const res = await fetch("/api/stt", {
          method: "POST",
          headers: { "Content-Type": audio.type || "audio/webm" },
          body: audio,
        })
        if (!res.ok) {
          const text = await res.text().catch(() => "")
          throw new Error(text || `STT HTTP ${res.status}`)
        }
        const { transcript } = SttResponseSchema.parse(await res.json())
        if (!transcript.trim()) {
          toast.warning("Couldn't hear you, try again.")
          dispatch({ type: "DISMISS_ERROR" })
          return
        }
        const candidateIndex = (state.turns[state.turns.length - 1]?.index ?? -1) + 1
        dispatch({ type: "STT_DONE", transcript, candidateIndex })
        await requestTurn(transcript)
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Speech-to-text failed"
        toast.error(msg)
        dispatch({ type: "ERROR", message: msg })
      }
    },
    [requestTurn, state.turns, dispatch],
  )

  // First mic click bootstraps turn 0; subsequent clicks open the recorder.
  const handleMicStart = useCallback(() => {
    if (state.turns.length === 0 && !turnInFlightRef.current) {
      // Surface the in-flight state immediately so the mic button shows a
      // spinner and goes disabled while /turn is generating question 0.
      // Without this the FSM stays `idle` until the fetch resolves a few
      // seconds later, and the button reads as still-clickable.
      dispatch({ type: "BEGIN_BOOTSTRAP" })
      void requestTurn(null)
      return
    }
    dispatch({ type: "MIC_START" })
  }, [requestTurn, state.turns.length, dispatch])

  const handleMicError = useCallback(
    (message: string) => {
      dispatch({ type: "ERROR", message })
    },
    [dispatch],
  )

  // POST /api/interview/end, then route to results. Idempotent via ref.
  const finalizeAndRedirect = useCallback(async () => {
    if (endCalledRef.current) return
    endCalledRef.current = true
    try {
      const res = await fetch("/api/interview/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
      if (!res.ok && res.status !== 410) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `End HTTP ${res.status}`)
      }
      router.push(`/sessions/${sessionId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't wrap up"
      toast.error(msg)
      endCalledRef.current = false
      dispatch({ type: "ERROR", message: msg })
    }
  }, [router, sessionId, dispatch])

  // When phase becomes "ending", trigger the end call exactly once.
  useEffect(() => {
    if (state.phase.kind === "ending" && !endCalledRef.current) {
      void finalizeAndRedirect()
    }
  }, [state.phase, finalizeAndRedirect])

  const handleManualEnd = useCallback(() => {
    if (endCalledRef.current) return
    dispatch({ type: "BEGIN_END" })
  }, [dispatch])

  // Audio callbacks for <AssistantAudio>.
  const onAudioEnded = useCallback(() => {
    dispatch({ type: "AUDIO_END" })
  }, [dispatch])

  const onAudioError = useCallback(
    (message: string) => {
      toast.warning(`Audio: ${message}`)
      dispatch({ type: "AUDIO_ERROR", message })
    },
    [dispatch],
  )

  return {
    handleMicStart,
    handleAudio,
    handleMicError,
    handleManualEnd,
    onAudioEnded,
    onAudioError,
  }
}
