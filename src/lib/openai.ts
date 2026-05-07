/**
 * Lazy singleton wrapper around the OpenAI SDK.
 *
 * Why lazy: `OPENAI_API_KEY` is optional at boot (drizzle-kit / db:seed run
 * without it). We only require it the first time something actually calls the
 * API, so importing `@/lib/openai` from a module that is loaded during DB
 * tooling does not crash.
 *
 * Two ways to use this module:
 *   1. `import { getOpenAI } from "@/lib/openai"` — explicit, recommended in
 *      route handlers and library code.
 *   2. `import { openai } from "@/lib/openai"` — Proxy that forwards property
 *      access to the lazily-constructed client, for callers that prefer the
 *      `openai.responses.parse(...)` ergonomics from the spec sketches.
 */

import OpenAI from "openai"
import { requireEnv } from "@/lib/env"

let _client: OpenAI | null = null

/** Returns the shared OpenAI client, constructing it on first call. */
export function getOpenAI(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") })
  }
  return _client
}

/**
 * Proxy facade so `openai.responses.parse(...)` works without callers having
 * to remember the `getOpenAI()` indirection. All property reads forward to
 * the lazily-constructed singleton.
 */
export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    const client = getOpenAI() as unknown as Record<PropertyKey, unknown>
    const value = Reflect.get(client, prop, receiver)
    return typeof value === "function" ? value.bind(client) : value
  },
})
