# History View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `/history` page that lists every session (completed / active / abandoned) with a status pill, and wire the previously non-functional `History` nav button to it. Each row routes to the most-useful destination per status: results for completed/abandoned, interview-room resume for active.

**Architecture:** RSC page reads sessions joined with jobs and evaluations in a single Drizzle query, plus a per-session assistant-turn count. Sticky header chrome (Logo + nav) is extracted from the existing `JobsView` into a shared `<SiteHeader>` so both pages share it and `usePathname()` drives the active-nav state. A small `linkForRow()` helper centralises the status→route mapping. Pure-presentational `<HistoryRow>` keeps the view dumb.

**Tech Stack:** Next.js 16 (App Router, RSC), Drizzle ORM, Tailwind v4, existing shadcn-derived `Pill` primitive, Phosphor icons, Biome.

**Spec:** `docs/superpowers/specs/2026-05-07-history-view-design.md`.

**Verification contract (per `CLAUDE.md`):** every task ends with `pnpm biome check --write` clean and `pnpm tsc --noEmit` clean. Browser-flow verification via Playwright MCP runs once at the end (Task 7).

---

## Task 1: Hoist `presetForSlug` to a shared module (refactor — no behavior change)

**Files:**
- Create: `src/lib/jobs-presentation.ts`
- Modify: `src/app/page.tsx` (drops the inline `COMPANY_BY_SLUG` / `FALLBACK_PRESET` block, lines 11–37 of the current file)

**Why first:** History needs the same enrichment data. Hoisting it now means Task 4 imports it cleanly; doing it later would force a churn-y diff into the History commits.

- [ ] **Step 1: Create the shared module**

Write `src/lib/jobs-presentation.ts`:

```ts
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
```

- [ ] **Step 2: Update `src/app/page.tsx` to use the helper**

Replace the inline `COMPANY_BY_SLUG` / `FALLBACK_PRESET` definitions and the `enriched` mapping. The new file should look like:

```tsx
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
```

- [ ] **Step 3: Verify**

```bash
pnpm biome check --write src/lib/jobs-presentation.ts src/app/page.tsx
pnpm tsc --noEmit
```

Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/jobs-presentation.ts src/app/page.tsx
git commit -m "lib: hoist jobs presentation preset to shared module

History view (next) needs the same per-slug enrichment as the
jobs grid. Pulling it into src/lib so both call sites share one
source of truth.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Extract sticky chrome into `<SiteHeader>` and wire `History` as a real link

**Files:**
- Create: `src/app/_components/site-header.tsx`
- Modify: `src/app/_components/jobs-view.tsx` (replace the inline `<header>` and the local `NavButton` helper with `<SiteHeader />`)

After this task the `History` button in the top bar becomes a real `<Link>` pointing to `/history`. That route doesn't exist yet — clicking it will 404 until Task 6. This is acceptable per `CLAUDE.md` ("each commit must compile and biome-clean on its own; intermediate commits don't have to render the full app end-to-end").

- [ ] **Step 1: Create `<SiteHeader>`**

Write `src/app/_components/site-header.tsx`:

```tsx
"use client"

import { ClockCounterClockwise, List } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Logo } from "@/components/brand/logo"
import { cn } from "@/lib/utils"

/**
 * Sticky top chrome shared by `/` (jobs) and `/history`. Wordmark + tagline on
 * the left, two nav links on the right. Active state is derived from the
 * current pathname so we don't have to thread props down every page.
 */
export function SiteHeader() {
  const pathname = usePathname()
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border-subtle bg-bg-canvas px-10 py-5">
      <div className="flex items-center gap-3.5">
        <Logo size="sm" />
        <span className="font-mono text-[11px] leading-none tracking-[0.04em] text-fg-4">
          ai · interview practice
        </span>
      </div>
      <nav className="flex items-center gap-2">
        <NavLink href="/" active={pathname === "/"} icon={<List size={13} weight="bold" />}>
          Roles
        </NavLink>
        <NavLink
          href="/history"
          active={pathname === "/history" || pathname.startsWith("/history/")}
          icon={<ClockCounterClockwise size={13} weight="bold" />}
        >
          History
        </NavLink>
      </nav>
    </header>
  )
}

interface NavLinkProps {
  href: string
  active: boolean
  icon: React.ReactNode
  children: React.ReactNode
}

function NavLink({ href, active, icon, children }: NavLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-2 rounded-[7px] border px-3 py-2 font-ui text-[12px] font-medium leading-none transition-colors duration-150",
        active
          ? "border-[rgba(244,162,97,0.20)] bg-accent-soft text-accent"
          : "border-transparent text-fg-2 hover:bg-bg-raised hover:text-fg-1",
      )}
    >
      {icon}
      {children}
    </Link>
  )
}
```

- [ ] **Step 2: Update `jobs-view.tsx` to render `<SiteHeader>`**

In `src/app/_components/jobs-view.tsx`:

a) Add the import alongside the existing `Logo` / `AccentLine` imports:

```tsx
import { SiteHeader } from "./site-header"
```

b) Remove the now-unused imports `ClockCounterClockwise`, `List` from the `@phosphor-icons/react/dist/ssr` import (keep `MagnifyingGlass`).

c) Remove `Logo` from the imports (it's now only used inside `SiteHeader`).

d) Replace the entire `<header>…</header>` block (lines 64–77 of the current file) with:

```tsx
<SiteHeader />
```

e) Delete the local `NavButton` function and its `NavButtonProps` interface (lines 161–188 of the current file). The shared one in `<SiteHeader>` replaces it.

- [ ] **Step 3: Verify**

```bash
pnpm biome check --write src/app/_components/site-header.tsx src/app/_components/jobs-view.tsx
pnpm tsc --noEmit
```

Expected: both clean. (The `usePathname` import requires `"use client"` at the top of `site-header.tsx` — already present.)

- [ ] **Step 4: Commit**

```bash
git add src/app/_components/site-header.tsx src/app/_components/jobs-view.tsx
git commit -m "ui: extract SiteHeader, wire History as a real link

Lifts the sticky top-bar chrome out of JobsView so /history can
share it. usePathname drives the active-nav state. The History
link will 404 until the route lands in a follow-up commit.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Add a relative-date helper

**Files:**
- Create: `src/lib/format-date.ts`

- [ ] **Step 1: Write the helper**

```ts
/**
 * Relative date formatter for editorial UI surfaces (history list, etc).
 *
 * Buckets:
 *   - <1 min  → "just now"
 *   - <1 h    → "N min ago"
 *   - <24 h   → "N h ago"
 *   - <7 d    → "N d ago"
 *   - same year → "MMM D"        (e.g. "May 7")
 *   - else    → "MMM D, YYYY"    (e.g. "Dec 12, 2024")
 *
 * Computed against `now` (defaults to `Date.now()`). Both inputs are coerced
 * to Date so callers can pass a string from a JSON payload.
 */

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const

export function formatRelativeDate(input: Date | string | number, now: Date | number = Date.now()): string {
  const then = typeof input === "string" || typeof input === "number" ? new Date(input) : input
  const nowMs = typeof now === "number" ? now : now.getTime()
  const diffMs = nowMs - then.getTime()

  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < minute) return "just now"
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} min ago`
  if (diffMs < day) return `${Math.floor(diffMs / hour)} h ago`
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)} d ago`

  const month = MONTHS_SHORT[then.getMonth()]
  const dayOfMonth = then.getDate()
  const sameYear = then.getFullYear() === new Date(nowMs).getFullYear()
  return sameYear ? `${month} ${dayOfMonth}` : `${month} ${dayOfMonth}, ${then.getFullYear()}`
}
```

- [ ] **Step 2: Verify**

```bash
pnpm biome check --write src/lib/format-date.ts
pnpm tsc --noEmit
```

Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/format-date.ts
git commit -m "lib: add formatRelativeDate helper

Editorial date buckets (just now / N min / N h / N d / MMM D)
for the history list and any future timestamp surface.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Add the history loader (Drizzle query + row shape + `linkForRow`)

**Files:**
- Create: `src/lib/history-loader.ts`

- [ ] **Step 1: Write the loader**

```ts
/**
 * History list loader for `/history`. One Drizzle query joins sessions ↔
 * jobs ↔ evaluations and counts assistant turns per session in the same shot.
 * Rows are enriched with the slug-based company preset so the view layer
 * stays presentational.
 *
 * No filtering by user / status — single-tenant demo, all sessions surface.
 */

import { count, desc, eq, sql } from "drizzle-orm"

import { db } from "@/db/drizzle"
import { evaluations, jobs, sessions, turns } from "@/db/schema"
import type { Session } from "@/db/schema"
import { presetForSlug } from "@/lib/jobs-presentation"

export interface HistoryRow {
  sessionId: string
  status: Session["status"]
  startedAt: Date
  endedAt: Date | null
  jobSlug: string
  jobTitle: string
  company: string
  /** Null for sessions without an evaluations row (active, abandoned, or pre-eval race). */
  overallScore: number | null
  /** Count of assistant turns asked so far — the "N Q" detail pill. */
  questionCount: number
}

export async function loadHistory(): Promise<HistoryRow[]> {
  const rows = await db
    .select({
      sessionId: sessions.id,
      status: sessions.status,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      jobSlug: jobs.slug,
      jobTitle: jobs.title,
      overallScore: evaluations.overallScore,
      questionCount: sql<number>`count(${turns.id}) filter (where ${turns.role} = 'assistant')`.mapWith(Number),
    })
    .from(sessions)
    .innerJoin(jobs, eq(sessions.jobId, jobs.id))
    .leftJoin(evaluations, eq(evaluations.sessionId, sessions.id))
    .leftJoin(turns, eq(turns.sessionId, sessions.id))
    .groupBy(sessions.id, jobs.id, evaluations.id)
    .orderBy(desc(sessions.startedAt))

  return rows.map((row) => ({
    ...row,
    company: presetForSlug(row.jobSlug).company,
  }))
}

/**
 * Where each row links. `active` resumes the room (the interview page
 * rehydrates initialTurns and only redirects on `completed`); the other
 * statuses go to the results page.
 */
export function linkForRow(row: Pick<HistoryRow, "sessionId" | "status">): string {
  if (row.status === "active") return `/interview/${row.sessionId}`
  return `/sessions/${row.sessionId}`
}
```

> **Drizzle note:** `count(... filter (where ...))` is a Postgres aggregate. Using `sql<number>` with `.mapWith(Number)` gives us a typed `number` instead of the raw string Postgres returns for counts. The `groupBy` includes `evaluations.id` because we joined that table.

- [ ] **Step 2: Verify**

```bash
pnpm biome check --write src/lib/history-loader.ts
pnpm tsc --noEmit
```

Expected: both clean. If `tsc` complains about the `groupBy` columns, the `evaluations.id` entry is what postgres requires for the leftJoin — keep it.

- [ ] **Step 3: Commit**

```bash
git add src/lib/history-loader.ts
git commit -m "lib: add history loader (sessions + jobs + eval + turn count)

Single Drizzle query covers the row shape the /history page
needs. linkForRow centralises the status->route mapping so the
view stays presentational.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Build `<HistoryRow>`

**Files:**
- Create: `src/app/history/_components/history-row.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { CaretRight } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"

import { Pill } from "@/components/ui/pill"
import { formatRelativeDate } from "@/lib/format-date"
import type { HistoryRow as HistoryRowData } from "@/lib/history-loader"
import { linkForRow } from "@/lib/history-loader"
import { cn } from "@/lib/utils"

interface HistoryRowProps {
  row: HistoryRowData
}

/**
 * Single history list row. Editorial card with title + company + date on the
 * left, status + detail pills + chevron on the right. Whole row is a Link to
 * the right destination per `linkForRow`.
 */
export function HistoryRow({ row }: HistoryRowProps) {
  const status = statusPresentation(row.status)
  const detail = detailPresentation(row)

  return (
    <Link
      href={linkForRow(row)}
      className={cn(
        "grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-x-5 gap-y-1 rounded-[10px]",
        "border border-border-default bg-bg-raised px-5 py-4 transition-colors",
        "hover:bg-bg-hover hover:border-border-strong",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
      )}
    >
      <span className="font-ui text-[14px] font-medium leading-[1.3] text-fg-1">{row.jobTitle}</span>
      <span className="font-mono text-[12px] leading-none text-fg-3">{row.company}</span>
      <span className="font-mono text-[11px] uppercase leading-none tracking-[0.04em] text-fg-4">
        {formatRelativeDate(row.startedAt)}
      </span>
      <Pill tone={status.tone} dot size="sm">
        {status.label}
      </Pill>
      {detail ? (
        <Pill tone={detail.tone} size="sm">
          {detail.label}
        </Pill>
      ) : (
        <span aria-hidden />
      )}
      <CaretRight size={14} weight="bold" className="text-fg-3" />
    </Link>
  )
}

/* ---------------- Helpers ---------------- */

type Tone = "neutral" | "accent" | "info" | "pass" | "fail" | "warn"

function statusPresentation(status: HistoryRowData["status"]): { tone: Tone; label: string } {
  if (status === "completed") return { tone: "pass", label: "Completed" }
  if (status === "active") return { tone: "info", label: "In progress" }
  return { tone: "fail", label: "Abandoned" }
}

function detailPresentation(row: HistoryRowData): { tone: Tone; label: string } | null {
  if (row.status === "completed") {
    if (row.overallScore != null) {
      return { tone: "accent", label: String(Math.round(row.overallScore * 10)) }
    }
    return row.questionCount > 0 ? { tone: "neutral", label: `${row.questionCount} Q` } : null
  }
  if (row.status === "active") {
    return { tone: "neutral", label: row.questionCount > 0 ? "Resume →" : "Resume" }
  }
  // abandoned
  return row.questionCount > 0 ? { tone: "neutral", label: `${row.questionCount} Q` } : null
}
```

> **Score scale note:** the `evaluations.overallScore` column is a `real` on a 0–10 scale (per `src/lib/evaluator/prompt.ts`). The handoff and existing results page render scores as a 0–100 integer, so we multiply by 10 and round.

- [ ] **Step 2: Verify**

```bash
pnpm biome check --write src/app/history/_components/history-row.tsx
pnpm tsc --noEmit
```

Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/history/_components/history-row.tsx
git commit -m "history: add HistoryRow editorial list item

Title + company + relative date on the left, status pill +
detail pill (score / Resume / Q-count) + chevron on the right.
Whole row is a Link routed via linkForRow.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Build the `/history` page + `<HistoryView>`

**Files:**
- Create: `src/app/history/_components/history-view.tsx`
- Create: `src/app/history/page.tsx`

- [ ] **Step 1: Write `<HistoryView>`**

```tsx
import { SiteHeader } from "@/app/_components/site-header"
import { AccentLine } from "@/components/ui/accent-line"
import type { HistoryRow as HistoryRowData } from "@/lib/history-loader"

import { HistoryRow } from "./history-row"

interface HistoryViewProps {
  rows: HistoryRowData[]
}

/**
 * History view — editorial list of every past + ongoing session, newest
 * first. Sticky chrome is shared with `/`; layout is the narrower 880px
 * column from the handoff so individual rows read as cards rather than a
 * full-width table.
 */
export function HistoryView({ rows }: HistoryViewProps) {
  return (
    <>
      <SiteHeader />
      <main className="relative mx-auto w-full max-w-[880px] px-10 pt-12 pb-20">
        <div className="iris-fade-in mb-10 flex flex-col gap-[18px]">
          <div className="inline-flex items-center gap-3">
            <span className="eyebrow">
              History · {rows.length} {rows.length === 1 ? "session" : "sessions"}
            </span>
            <AccentLine width={36} className="max-w-[120px]" />
          </div>
          <h1 className="m-0 font-display text-[48px] leading-[1.05] text-fg-1">
            Your past <span className="italic-accent">debriefs</span>
            <span className="text-accent">.</span>
          </h1>
        </div>

        {rows.length > 0 ? (
          <ul className="iris-stagger flex list-none flex-col gap-3 p-0">
            {rows.map((row) => (
              <li key={row.sessionId}>
                <HistoryRow row={row} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-[10px] border border-dashed border-border-default p-12 text-center font-ui text-sm text-fg-3">
            No sessions yet. Pick a role to start your first interview.
          </div>
        )}
      </main>
    </>
  )
}
```

- [ ] **Step 2: Write the page**

```tsx
import { loadHistory } from "@/lib/history-loader"

import { HistoryView } from "./_components/history-view"

/**
 * `/history` — editorial list of every session in the DB. RSC; no client
 * state. Active sessions resume into the room, completed/abandoned land on
 * the results page (which already handles the pending wrap-up state).
 */
export default async function HistoryPage() {
  const rows = await loadHistory()
  return <HistoryView rows={rows} />
}
```

- [ ] **Step 3: Verify**

```bash
pnpm biome check --write src/app/history/_components/history-view.tsx src/app/history/page.tsx
pnpm tsc --noEmit
```

Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/history/page.tsx src/app/history/_components/history-view.tsx
git commit -m "history: add /history route and editorial list view

RSC page reads loadHistory() and renders the editorial list.
Empty state mirrors the home grid's dashed box. Headline: 'Your
past debriefs.' with the apricot full-stop.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Browser verification via Playwright MCP

No file changes. This is a one-shot smoke pass before declaring the feature done. Per `CLAUDE.md`, never `git add` the screenshots Playwright drops at the repo root.

- [ ] **Step 1: Make sure dev server is running**

```bash
pnpm dev
```

If a previous server is already up, reuse it. Wait for `Ready on http://localhost:3000`.

- [ ] **Step 2: Open `/history`**

Use `mcp__playwright__browser_navigate` to load `http://localhost:3000/history`. Take a snapshot.

Expected outcomes (one of these is true depending on DB state):
- DB has no sessions → editorial empty state ("No sessions yet. Pick a role to start your first interview.")
- DB has sessions → list of rows newest-first, each with title + company + date + status pill + detail pill + chevron.

- [ ] **Step 3: Verify nav active state**

From `/history`, the `History` nav button should be in the active state (apricot soft background, accent text). The `Roles` button should be neutral. Click `Roles` and confirm it routes to `/` and the active state flips.

- [ ] **Step 4: If no sessions exist, seed one of each kind for full coverage**

If the DB is empty:

```bash
# Start one interview to create an `active` row.
# Use the home page → click any role → the room loads.
# Refresh /history; the row should show "In progress" + "Resume".
# Click it → lands back in the interview room with prior turns visible.
```

Then complete an interview through to evaluation to verify the `Completed` + score pill path.

- [ ] **Step 5: Clean up debug screenshots**

```bash
ls *.png 2>/dev/null && rm -f *.png || true
git status   # confirm no PNGs are staged
```

- [ ] **Step 6: Final pre-commit gate**

```bash
pnpm biome check --write
pnpm tsc --noEmit
```

Expected: both clean.

- [ ] **Step 7: Push**

```bash
git push origin master
```

---

## Self-review notes

- **Spec coverage check:** every section of `2026-05-07-history-view-design.md` maps to a task — `presetForSlug` hoist (T1), `<SiteHeader>` extraction (T2), `formatRelativeDate` (T3), `loadHistory` + `linkForRow` (T4), `<HistoryRow>` with the pill mapping table (T5), `<HistoryView>` editorial layout + empty state + `/history` route (T6), Playwright verification (T7).
- **Type consistency:** `HistoryRow` (the data shape) is exported from `history-loader.ts` and re-imported as `HistoryRowData` in `history-row.tsx` to avoid colliding with the component name. `linkForRow` takes a `Pick<HistoryRow, "sessionId" | "status">` so it can be called with anything that has those two fields.
- **Score scale:** the codebase stores `overallScore` on a 0–10 scale; the existing results UI renders 0–100. Task 5 explicitly multiplies by 10 + rounds to match.
- **Score-null path:** completed rows without an `evaluations` row (e.g., evaluator failed) fall back to the `{N} Q` neutral pill rather than a missing slot.
- **Pill `tone` types:** the `Tone` alias in `history-row.tsx` mirrors the variants on `pillVariants` in `src/components/ui/pill.tsx` exactly; if a tone is added there in the future this will surface as a TS error rather than a silent miss.
- **Header cost:** `<SiteHeader>` is a client component because it uses `usePathname()`. That's fine — it's tiny and contains no heavy children. Server pages can render client components freely.
- **`groupBy` SQL gotcha:** the loader query left-joins the `turns` table for the count and the `evaluations` table for the score, then groups by `sessions.id`, `jobs.id`, and `evaluations.id`. Postgres requires every non-aggregated select column to be in `GROUP BY` or wrapped in an aggregate; the three IDs cover the joined rows.
