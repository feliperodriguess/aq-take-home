import { z } from "zod"

// .env is auto-loaded by Next.js (runtime) and by drizzle-kit (CLI),
// so we don't need dotenv here.

const envSchema = z.object({
  DATABASE_URL: z.url("DATABASE_URL must be a valid URL").startsWith("postgresql://"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", z.treeifyError(parsed.error))
  throw new Error("Invalid environment variables")
}

export const env = parsed.data
