/**
 * POST /api/stt — thin transcription utility (spec 04).
 *
 * Body: raw audio bytes; `Content-Type` selects the codec.
 * Response: `SttResponseSchema` shape — `{ transcript, durationSec }`.
 *
 * Notes:
 *   - No session validation (per spec 04 §"Notes"); STT does not mutate state.
 *   - Empty transcripts still return 200 with `transcript: ""`. The client
 *     surfaces a toast, it is not an error.
 *   - Default Node runtime — ElevenLabs SDK depends on Node primitives.
 */

import { NextResponse } from "next/server"
import { transcribeAudio } from "@/lib/elevenlabs"
import type { SttResponse } from "@/types/interview"

const ALLOWED_MIME = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
])

const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

function errorJson(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status })
}

export async function POST(req: Request): Promise<NextResponse> {
  const rawCtype = req.headers.get("content-type") ?? ""
  // Normalize: strip whitespace; "audio/webm; codecs=opus" → "audio/webm;codecs=opus"
  const ctype = rawCtype.replace(/\s+/g, "").toLowerCase()
  // Also accept the bare base type when codec params are present.
  const baseCtype = ctype.split(";")[0] ?? ""

  if (!ALLOWED_MIME.has(ctype) && !ALLOWED_MIME.has(baseCtype)) {
    return errorJson(415, "unsupported_media_type", `Unsupported audio mime: ${rawCtype || "(missing)"}`)
  }

  let ab: ArrayBuffer
  try {
    ab = await req.arrayBuffer()
  } catch (err) {
    return errorJson(400, "bad_body", err instanceof Error ? err.message : "Failed to read body")
  }

  if (ab.byteLength === 0) return errorJson(400, "empty_body", "Audio body was empty")
  if (ab.byteLength > MAX_BYTES) return errorJson(413, "too_large", `Audio exceeds ${MAX_BYTES} bytes`)

  // Wrap as a Blob so the SDK's multipart upload handles it cleanly.
  const blob = new Blob([ab], { type: baseCtype || ctype })

  try {
    const result = await transcribeAudio(blob, { languageCode: "en" })
    const body: SttResponse = {
      transcript: result.text,
      durationSec: result.durationSec,
    }
    return NextResponse.json(body, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown STT error"
    if (isTimeoutError(err)) {
      return errorJson(504, "stt_upstream_timeout", message)
    }
    return errorJson(502, "stt_upstream", message)
  }
}

function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const name = (err as { name?: unknown }).name
  const code = (err as { code?: unknown }).code
  if (typeof name === "string" && /timeout/i.test(name)) return true
  if (typeof code === "string" && (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT")) return true
  return false
}
