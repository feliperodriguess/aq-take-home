import { readFileSync } from "node:fs"
import { join } from "node:path"
import { type QuestionPack, QuestionPackSchema } from "@/types/interview"

export type { QuestionPack }

// Resolve relative to this source file so Node + Next bundling both work.
// __dirname isn't available in ESM; use process.cwd() + a stable relative path.
const PACKS_DIR = join(process.cwd(), "src", "data", "question-packs")

const cache = new Map<string, QuestionPack>()

function readAndValidate(slug: string): QuestionPack {
  const filePath = join(PACKS_DIR, `${slug}.json`)
  const raw = readFileSync(filePath, "utf8")
  const parsed: unknown = JSON.parse(raw)
  const pack = QuestionPackSchema.parse(parsed)

  // Cross-check: every item competency must exist in the rubric.
  const rubricCompetencies = new Set(pack.rubric.map((r) => r.competency))
  for (const item of pack.items) {
    if (!rubricCompetencies.has(item.competency)) {
      throw new Error(`Pack ${slug}: item ${item.id} references unknown competency "${item.competency}"`)
    }
  }
  return pack
}

export function loadPack(slug: string): QuestionPack {
  const cached = cache.get(slug)
  if (cached) return cached
  const pack = readAndValidate(slug)
  cache.set(slug, pack)
  return pack
}

const KNOWN_SLUGS = ["frontend-engineer", "backend-engineer", "product-manager"] as const

export function listPackSlugs(): readonly string[] {
  return KNOWN_SLUGS
}
