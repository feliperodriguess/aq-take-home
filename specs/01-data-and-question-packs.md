# 01 — Data Model & Question Packs

## Goal
Define the persistence layer (Drizzle/Postgres schema, migrations, seed) and the structure + content of per-role question packs. This spec is the data foundation everything else builds on.

## Out of scope
- LLM prompt design (spec 04).
- UI rendering (specs 02, 03, 05).

## Schema

All tables in the default `public` schema. Use `gen_random_uuid()` (pgcrypto) for IDs — the migration enables it via `CREATE EXTENSION IF NOT EXISTS pgcrypto;` (Neon has it available out of the box).

```ts
// src/db/schema.ts
import { sql } from "drizzle-orm"
import {
  jsonb, pgEnum, pgTable, text, timestamp, uuid, integer, real, uniqueIndex, index,
} from "drizzle-orm/pg-core"

export const turnRoleEnum = pgEnum("turn_role", ["assistant", "candidate"])
export const sessionStatusEnum = pgEnum("session_status", ["active", "completed", "abandoned"])

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),         // "frontend-engineer"
  title: text("title").notNull(),                // "Frontend Engineer"
  shortDescription: text("short_description").notNull(),
  longDescription: text("long_description").notNull(),
  // Reference to a question pack file by slug. Packs live in src/data/question-packs/.
  // Stored by slug (not FK) so designers can iterate on JSON without DB changes.
  questionPackSlug: text("question_pack_slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "restrict" }),
  status: sessionStatusEnum("status").notNull().default("active"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
})

export const turns = pgTable("turns", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  // Monotonic order within the session. Use integer index (0,1,2,...).
  // The unique composite below acts as the lock against double-submits.
  index: integer("index").notNull(),
  role: turnRoleEnum("role").notNull(),
  text: text("text").notNull(),
  // For assistant turns: { signals, packItemId, rationale, isFollowUp, modelOutput }.
  // For candidate turns: { durationSec, mimeType } (optional).
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  sessionIndexIdx: uniqueIndex("turns_session_index_idx").on(t.sessionId, t.index),
}))

export const evaluations = pgTable("evaluations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").notNull().unique().references(() => sessions.id, { onDelete: "cascade" }),
  overallScore: real("overall_score").notNull(),    // 0..10
  payload: jsonb("payload").notNull(),              // full Evaluation object (see schema below)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})
```

### Drop the existing `todo` table
The scaffolded `todo` table is unused. Remove it from `schema.ts` in the same migration that adds the new tables — keeps the schema clean.

### Why JSONB for `meta` and `payload`?
- `turns.meta`: signals shape will iterate during demo polish. JSONB lets the engine spec (spec 04) evolve without migrations.
- `evaluations.payload`: the full evaluation object (strengths, concerns, etc.) is read as a blob by the results page; we don't query into it.

## Shared Zod schemas

Live in `src/types/interview.ts` and are imported by both API routes and components.

```ts
// src/types/interview.ts
import { z } from "zod"

export const SignalsSchema = z.object({
  // Skills the model believes are demonstrated, with confidence 0..1.
  skillsDetected: z.array(z.object({
    skill: z.string(),
    confidence: z.number().min(0).max(1),
    // Index of the candidate turn that supplied evidence; null if not specific.
    evidenceTurnIndex: z.number().int().nonnegative().optional().nullable(),
  })),
  // Pack rubric competency names with at least weak evidence.
  topicsCovered: z.array(z.string()),
  // Pack rubric competency names without evidence yet.
  gaps: z.array(z.string()),
  // Why the model chose THIS next question. Surfaced verbatim in the decision panel.
  rationale: z.string().min(1).max(500),
})
export type Signals = z.infer<typeof SignalsSchema>

export const TurnRequestSchema = z.object({
  sessionId: z.string().uuid(),
  // Empty/undefined on the very first call — the engine asks the opening question.
  candidateUtterance: z.string().optional().nullable(),
})
export type TurnRequest = z.infer<typeof TurnRequestSchema>

export const TurnResponseSchema = z.object({
  // Assistant's next question text.
  question: z.string(),
  // Optional id from the question pack if this turn picked from it. Null when a follow-up.
  packItemId: z.string().nullable(),
  signals: SignalsSchema,
  // True when the engine + server guardrails agree the interview is complete.
  isFinal: z.boolean(),
  turnIndex: z.number().int().nonnegative(),
})
export type TurnResponse = z.infer<typeof TurnResponseSchema>

export const EvaluationSchema = z.object({
  overallScore: z.number().min(0).max(10),
  summary: z.string().min(1).max(800),
  strengths: z.array(z.string().min(1)).min(1).max(8),
  concerns: z.array(z.string().min(1)).max(8),
  perCompetency: z.array(z.object({
    competency: z.string(),
    score: z.number().min(0).max(10),
    notes: z.string(),
  })).max(10),
  recommendation: z.enum(["strong_hire", "hire", "lean_hire", "lean_no_hire", "no_hire"]),
})
export type Evaluation = z.infer<typeof EvaluationSchema>
```

> **OpenAI Structured Outputs caveat:** every optional Zod field passed into `zodTextFormat()` MUST be `.optional().nullable()` (not just `.optional()`). The schemas above mirror that.

## Question pack format

Stored as static JSON in `src/data/question-packs/<slug>.json`, loaded with a typed import helper. Not in the DB — designers can edit JSON and ship via deploy.

```ts
// src/types/question-pack.ts
import { z } from "zod"

export const QuestionPackSchema = z.object({
  slug: z.string(),
  role: z.string(),
  rubric: z.array(z.object({
    competency: z.string(),               // "System design", "Communication"
    weight: z.number().min(0).max(1),
    description: z.string(),
  })).min(3),
  items: z.array(z.object({
    id: z.string(),                       // stable id, used in TurnResponse.packItemId
    category: z.enum(["behavioral", "technical"]),
    competency: z.string(),               // must match a rubric competency
    prompt: z.string(),                   // canonical question text
    followUpHints: z.array(z.string()).default([]),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  })).min(8),                             // pack must have >=8 items so engine has slack
})
export type QuestionPack = z.infer<typeof QuestionPackSchema>
```

## Seed content

`src/db/seed.ts` populates three jobs and references three packs:

| Slug | Title | Pack file |
|---|---|---|
| `frontend-engineer` | Frontend Engineer | `frontend-engineer.json` |
| `backend-engineer` | Backend Engineer | `backend-engineer.json` |
| `product-manager` | Product Manager | `product-manager.json` |

Each pack ships with:
- A 4–5 competency rubric (e.g., for FE: "Component design", "State management", "Performance", "Communication", "Product sense").
- 10–12 items across `behavioral` and `technical`, each with 2–3 `followUpHints`.

Seed is idempotent: `INSERT INTO jobs ... ON CONFLICT (slug) DO UPDATE SET ...`.

Run via `pnpm db:seed`. Add to `package.json`:
```json
"db:seed": "tsx src/db/seed.ts"
```
(Adds `tsx` as a devDependency.)

### Suggested rubric per role (starting point)

**Frontend Engineer**
- Component design (0.25), State management (0.20), Performance (0.20), Communication (0.15), Product sense (0.20)

**Backend Engineer**
- API design (0.25), Data modeling (0.20), Reliability/observability (0.20), Communication (0.15), Systems thinking (0.20)

**Product Manager**
- Problem framing (0.25), Prioritization (0.20), Stakeholder communication (0.20), Metrics literacy (0.15), Execution (0.20)

Pack authors keep ~6 technical + ~4–6 behavioral items per role.

## File layout
```
src/
  db/
    schema.ts          # tables above (drops `todo`)
    seed.ts            # idempotent seed
    migrations/
      0001_initial.sql # generated; includes pgcrypto extension + drops todo
  data/
    question-packs/
      index.ts         # typed loader (below)
      frontend-engineer.json
      backend-engineer.json
      product-manager.json
  types/
    interview.ts       # shared zod schemas (Signals, TurnRequest/Response, Evaluation)
    question-pack.ts   # QuestionPackSchema
```

## Pack loader

```ts
// src/data/question-packs/index.ts
import { QuestionPackSchema, type QuestionPack } from "@/types/question-pack"
import frontendEngineer from "./frontend-engineer.json" with { type: "json" }
import backendEngineer from "./backend-engineer.json" with { type: "json" }
import productManager from "./product-manager.json" with { type: "json" }

const RAW: Record<string, unknown> = {
  "frontend-engineer": frontendEngineer,
  "backend-engineer": backendEngineer,
  "product-manager": productManager,
}

// Validate once at module load — fail fast on bad pack content.
const PACKS: Record<string, QuestionPack> = Object.fromEntries(
  Object.entries(RAW).map(([slug, raw]) => [slug, QuestionPackSchema.parse(raw)])
)

export function loadPack(slug: string): QuestionPack {
  const pack = PACKS[slug]
  if (!pack) throw new Error(`Unknown question pack: ${slug}`)
  return pack
}

export function listPackSlugs(): string[] {
  return Object.keys(PACKS)
}
```

If JSON import attributes (`with { type: "json" }`) cause issues with the current Turbopack version, fall back to importing without the attribute — Next.js's bundler handles `.json` imports natively.

## Open questions
- Do we want to capture audio durations on candidate turns for stretch analytics? Easy to add to `turns.meta` later — defer.
- Soft-delete? Not for v1.

## Acceptance checklist
- [ ] Migration created and runs cleanly against a fresh Neon DB; the legacy `todo` table is dropped.
- [ ] `pnpm db:seed` is idempotent (run twice → no errors, no duplicates).
- [ ] All three packs validate against `QuestionPackSchema` at module load (the loader throws on mismatch).
- [ ] Each pack has ≥8 items, ≥2 categories, ≥4 competencies; `items[*].competency` is always one of `rubric[*].competency`.
- [ ] `TurnRequest`, `TurnResponse`, `Evaluation` schemas import cleanly into route files (specs 04, 05) and components (spec 03).
- [ ] `(session_id, index)` index on `turns` is created and unique.
