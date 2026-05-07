/**
 * Per-slug presentation enrichment for jobs — company, duration, skill chips.
 *
 * Kept out of the DB schema deliberately so designers can iterate on copy
 * without a migration. Both the home page (`/`) and the history page
 * (`/history`) layer this on top of the row data.
 */

interface JobPreset {
  company: string
  duration: string
  skills: string[]
}

const PRESETS: Record<string, JobPreset> = {
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

const FALLBACK: JobPreset = {
  company: "Iris Practice",
  duration: "15–20 min",
  skills: ["Communication", "Reasoning", "Craft"],
}

/** Look up the preset for a job slug, falling back to a generic "Iris Practice" preset. */
export function presetForSlug(slug: string): JobPreset {
  return PRESETS[slug] ?? FALLBACK
}

export type { JobPreset }
