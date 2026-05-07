import { db } from "@/db/drizzle"
import { jobs } from "@/db/schema"

import { JobsView } from "./_components/jobs-view"

/**
 * Per-slug enrichment for the magazine cards. Our DB schema deliberately
 * keeps presentation-only fields out of the row; we layer them in here so
 * designers can tweak copy without a migration. Adding a new seed slug
 * without an entry here falls back to a generic preset.
 */
const COMPANY_BY_SLUG: Record<string, { company: string; duration: string; skills: string[] }> = {
  "frontend-engineer": {
    company: "Aperture Studio",
    duration: "20–25 min",
    skills: ["React", "TypeScript", "Accessibility"],
  },
  "backend-engineer": {
    company: "Northwind Systems",
    duration: "20–25 min",
    skills: ["APIs", "Postgres", "Distributed"],
  },
  "product-manager": {
    company: "Cadence Labs",
    duration: "15–20 min",
    skills: ["Strategy", "Research", "Analytics"],
  },
}

const FALLBACK_PRESET = {
  company: "Iris Practice",
  duration: "15–20 min",
  skills: ["Communication", "Reasoning", "Craft"],
}

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

  const enriched = rows.map((row) => {
    const preset = COMPANY_BY_SLUG[row.slug] ?? FALLBACK_PRESET
    return { ...row, ...preset }
  })

  return <JobsView jobs={enriched} />
}
