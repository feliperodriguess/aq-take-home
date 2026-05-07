/**
 * One-shot dev reset: drop the orphan `todo` table left by the original
 * Next-template scaffolding, then drop drizzle's migration-tracking schema
 * so `pnpm db:migrate` re-applies our 0000_marvelous_blur from scratch.
 *
 * Use this only when the local Neon dev branch is out of sync with the
 * checked-in migrations. Production should never run this.
 */
import { sql } from "drizzle-orm"

import { db } from "@/db/drizzle"

async function main() {
  console.log("Dropping orphan `todo` table…")
  await db.execute(sql`DROP TABLE IF EXISTS "todo" CASCADE`)

  console.log("Resetting drizzle migration tracking…")
  await db.execute(sql`DROP SCHEMA IF EXISTS "drizzle" CASCADE`)

  console.log("Done. Run `pnpm db:migrate` to apply the current schema.")
  process.exit(0)
}

main().catch((err) => {
  console.error("Reset failed:", err)
  process.exit(1)
})
