/**
 * GET /api/tts?sessionId=…&turnIndex=… — server-rendered TTS for a stored
 * assistant turn (spec 04).
 *
 * GET so `<audio src="…">` works directly. The text is read server-side from
 * the `turns` row to avoid URL-length limits, prevent budget abuse, and lock
 * each audio clip to a real assistant turn.
 */

import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/db/drizzle"
import { turns } from "@/db/schema"
import { synthesizeSpeech } from "@/lib/elevenlabs"
import { loadSession } from "@/lib/session"

const QuerySchema = z.object({
  sessionId: z.string().uuid(),
  turnIndex: z.coerce.number().int().nonnegative(),
})

function errorJson(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status })
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse({
    sessionId: url.searchParams.get("sessionId"),
    turnIndex: url.searchParams.get("turnIndex"),
  })
  if (!parsed.success) {
    return errorJson(400, "bad_query", "sessionId (uuid) and turnIndex (int) are required")
  }

  const loaded = await loadSession(parsed.data.sessionId)
  if (!loaded) return errorJson(404, "session_not_found", "Unknown sessionId")

  const [turn] = await db
    .select({ text: turns.text, role: turns.role })
    .from(turns)
    .where(and(eq(turns.sessionId, loaded.session.id), eq(turns.index, parsed.data.turnIndex)))
    .limit(1)

  if (!turn) return errorJson(404, "no_turn", `No turn at index ${parsed.data.turnIndex}`)
  if (turn.role !== "assistant") {
    return errorJson(404, "not_assistant_turn", `Turn ${parsed.data.turnIndex} is not an assistant turn`)
  }

  let stream: ReadableStream<Uint8Array>
  try {
    stream = await synthesizeSpeech(turn.text)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown TTS error"
    return errorJson(502, "tts_upstream", message)
  }

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store, max-age=0",
      "Content-Disposition": "inline",
    },
  })
}
