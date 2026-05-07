/**
 * Quick dev sanity-check: prints the public-schema tables and the seeded
 * jobs from the connected Neon DB. Not wired into any script — invoke with
 * `tsx --env-file=.env.local src/db/verify.ts` when migrate / dashboard
 * disagree.
 */
import { sql } from "drizzle-orm"

import { db } from "@/db/drizzle"
import { jobs } from "@/db/schema"

async function main() {
  const tables = await db.execute(
    sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
  )
  // neon-http returns { rows, rowCount, ... } whereas pg returns an array.
  const tableRows = Array.isArray(tables) ? tables : (tables as unknown as { rows: { table_name: string }[] }).rows
  console.log("Tables on Neon (public):")
  for (const row of tableRows) console.log("  -", row.table_name)

  const jobRows = await db.select().from(jobs)
  console.log(`\nJobs (${jobRows.length}):`)
  for (const j of jobRows) console.log(`  - ${j.slug}: ${j.title}`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
