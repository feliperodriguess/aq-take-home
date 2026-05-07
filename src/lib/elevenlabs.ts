/**
 * Lazy singleton wrapper around the ElevenLabs SDK + thin route helpers.
 *
 * Why lazy: `ELEVENLABS_API_KEY` is optional at boot (mirrors `@/lib/openai`).
 *
 * SDK shape verified against `@elevenlabs/elevenlabs-js@2.45.0`:
 *   - `client.speechToText.convert({ file, modelId, languageCode, ... })`
 *     resolves to `SpeechToTextChunkResponseModel | MultichannelSpeechToText…
 *     | SpeechToTextWebhookResponseModel`. We only use the synchronous
 *     (non-webhook) path, so the result has `text`, `languageCode`, and an
 *     optional `audioDurationSecs` field.
 *   - `client.textToSpeech.convert(voiceId, { text, modelId, outputFormat })`
 *     resolves to `ReadableStream<Uint8Array>` (the underlying byte stream
 *     can be piped straight to a `Response`).
 *
 * Spec 04 sketch deviation:
 *   - The STT chunk response field is `audioDurationSecs` (camelCase), not
 *     `audio_duration_secs`. The SDK returns no `duration` top-level field;
 *     we expose it as `durationSec` in our `SttResponse` shape.
 */

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js"
import { env, requireEnv } from "@/lib/env"

let _client: ElevenLabsClient | null = null

/** Returns the shared ElevenLabs client, constructing it on first call. */
export function getElevenLabs(): ElevenLabsClient {
  if (!_client) {
    _client = new ElevenLabsClient({ apiKey: requireEnv("ELEVENLABS_API_KEY") })
  }
  return _client
}

/**
 * Proxy facade matching `@/lib/openai`'s ergonomics so callers can write
 * `elevenlabs.speechToText.convert(...)` without thinking about lazy init.
 */
export const elevenlabs: ElevenLabsClient = new Proxy({} as ElevenLabsClient, {
  get(_target, prop, receiver) {
    const client = getElevenLabs() as unknown as Record<PropertyKey, unknown>
    const value = Reflect.get(client, prop, receiver)
    return typeof value === "function" ? value.bind(client) : value
  },
})

// ─── STT helper (Scribe v2) ──────────────────────────────────────────────────

/** Anything the SDK accepts as an upload payload for STT. */
export type TranscribeInput = Blob | Buffer | Uint8Array | ArrayBuffer | ReadableStream<Uint8Array>

export interface TranscribeOptions {
  /** ISO-639-1 language code; defaults to `"en"`. Pass `null` to auto-detect. */
  languageCode?: string | null
}

export interface TranscribeResult {
  /** Trimmed transcription text. Empty string when no speech was detected. */
  text: string
  /** Provider-reported language code, when available. */
  languageCode?: string
  /** Total speech duration in seconds, when reported. 0 if unknown. */
  durationSec: number
}

/**
 * Wraps `client.speechToText.convert({ file, modelId: "scribe_v2" })`.
 * Returns a normalized `{ text, languageCode, durationSec }` shape regardless
 * of whether the underlying response is single- or multi-channel.
 */
export async function transcribeAudio(file: TranscribeInput, opts: TranscribeOptions = {}): Promise<TranscribeResult> {
  const languageCode = opts.languageCode === null ? undefined : (opts.languageCode ?? "en")

  const response = await getElevenLabs().speechToText.convert({
    // SDK's Uploadable union accepts Blob, Buffer, ArrayBuffer, Uint8Array,
    // node Readable, web ReadableStream, etc.
    file,
    modelId: "scribe_v2",
    ...(languageCode ? { languageCode } : {}),
  })

  // Webhook responses don't carry transcripts inline; we don't enable webhook.
  // Defensive narrowing: only the chunk + multichannel shapes have `text`.
  const text = "text" in response && typeof response.text === "string" ? response.text.trim() : ""

  const detectedLanguage =
    "languageCode" in response && typeof response.languageCode === "string" ? response.languageCode : undefined

  const durationSec =
    "audioDurationSecs" in response && typeof response.audioDurationSecs === "number" ? response.audioDurationSecs : 0

  return { text, languageCode: detectedLanguage, durationSec }
}

// ─── TTS helper (eleven_flash_v2_5) ──────────────────────────────────────────

export interface SynthesizeOptions {
  /** Override the default voice id from `env.ELEVENLABS_VOICE_ID`. */
  voiceId?: string
}

/**
 * Wraps `client.textToSpeech.convert(voiceId, { text, modelId, outputFormat })`.
 * Returns the raw MP3 byte stream so route handlers can pipe it straight to
 * the HTTP response (`new Response(stream, { headers: { "Content-Type": "audio/mpeg" } })`).
 */
export async function synthesizeSpeech(
  text: string,
  opts: SynthesizeOptions = {},
): Promise<ReadableStream<Uint8Array>> {
  const voiceId = opts.voiceId ?? env.ELEVENLABS_VOICE_ID
  return getElevenLabs().textToSpeech.convert(voiceId, {
    text,
    modelId: "eleven_flash_v2_5",
    outputFormat: "mp3_44100_128",
  })
}
