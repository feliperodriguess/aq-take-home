import { z } from "zod"

// .env is auto-loaded by Next.js (runtime) and by drizzle-kit (CLI),
// so we don't need dotenv here.
//
// API keys (OpenAI, ElevenLabs) are intentionally optional at boot so that
// drizzle-kit / db:seed can run without them. The lib clients (`@/lib/openai`,
// `@/lib/elevenlabs`) throw a clear error at first use if the key is missing.

const envSchema = z.object({
  DATABASE_URL: z.url("DATABASE_URL must be a valid URL").startsWith("postgresql://"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // OpenAI — interview brain + final evaluator (Responses API + Structured Outputs)
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_INTERVIEW_MODEL: z.string().default("gpt-4.1"),
  OPENAI_EVAL_MODEL: z.string().default("gpt-4.1"),

  // ElevenLabs — STT (Scribe v2) + TTS (eleven_flash_v2_5)
  ELEVENLABS_API_KEY: z.string().min(1).optional(),
  ELEVENLABS_VOICE_ID: z.string().default("JBFqnCBsd6RMkjVDRZzb"),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", z.treeifyError(parsed.error))
  throw new Error("Invalid environment variables")
}

export const env = parsed.data

/** Throws if a required runtime env var is missing. Use inside lib clients. */
export function requireEnv<K extends keyof typeof env>(key: K): NonNullable<(typeof env)[K]> {
  const value = env[key]
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required env var: ${String(key)}`)
  }
  return value as NonNullable<(typeof env)[K]>
}
