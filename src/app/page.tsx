import { db } from "@/db/drizzle"
import { jobs } from "@/db/schema"
import { presetForSlug } from "@/lib/jobs-presentation"

import { JobsView } from "./_components/jobs-view"

export default async function HomePage() {
  const rows = await db
    .select({
      id: jobs.id,
      slug: jobs.slug,
      title: jobs.title,
      shortDescription: jobs.shortDescription,
    })
    .from(jobs)
    .orderBy(jobs.title)

  const enriched = rows.map((row) => ({ ...row, ...presetForSlug(row.slug) }))

  return <JobsView jobs={enriched} />
}
