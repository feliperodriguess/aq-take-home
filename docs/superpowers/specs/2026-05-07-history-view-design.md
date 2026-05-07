# History view — design

**Date:** 2026-05-07
**Status:** Approved (pending plan)
**Spec context:** stretch goal #4, deferred from `specs/00-architecture.md` (referenced in `CLAUDE.md` "Out of scope" list as `HistoryView in App.jsx`)

## Problem

The top-bar `History` nav entry in `src/app/_components/jobs-view.tsx:75` is a non-functional placeholder. There is no way for a user to see past interviews — every session disappears from view once they leave the room or the results page.

## Goal

Ship a `/history` page that lists every session in the database — completed, in-progress, and abandoned — newest first, with a status pill. Each row routes to the most-useful destination for its state: results page for completed, interview room (resume) for active, results page for abandoned.

## Non-goals (YAGNI)

- Delete / archive
- Search, filter, pagination
- Per-user scoping (no auth in v1; DB is single-tenant)
- Light theme
- Auto-marking long-idle `active` sessions as `abandoned` (out of scope; resume just works on whatever's `active`)

## Architecture

### Routes

| Path | Type | Purpose |
|---|---|---|
| `/history` | RSC page | Fetches sessions and renders `<HistoryView>` |

The existing `/`, `/interview/[id]`, and `/sessions/[id]` are unchanged in behavior — only the shared chrome moves into a new component.

### Files

```
src/
  app/
    _components/
      site-header.tsx        # NEW — extracted sticky chrome (Logo + nav)
      jobs-view.tsx          # EDIT — replace inline header with <SiteHeader>
    history/
      page.tsx               # NEW — RSC, fetches data
      _components/
        history-view.tsx     # NEW — editorial list UI
        history-row.tsx      # NEW — single row Link (split if history-view nears 250 lines)
    page.tsx                 # EDIT — import preset from new shared module
  lib/
    jobs-presentation.ts     # NEW — hoisted COMPANY_BY_SLUG + FALLBACK_PRESET
    history-loader.ts        # NEW — Drizzle query + row shape
```

The 250-line component cap (per `CLAUDE.md`) governs whether `history-row.tsx` is split out at the start or only if needed.

## Data flow

### Query (`src/lib/history-loader.ts`)

One Drizzle query, server-side, in the RSC page:

```ts
// Pseudo — final shape determined during plan
db.select({
  sessionId: sessions.id,
  status: sessions.status,
  startedAt: sessions.startedAt,
  jobSlug: jobs.slug,
  jobTitle: jobs.title,
  overallScore: evaluations.overallScore,         // null when no evaluation row
  questionCount: sql<number>`count(${turns.id}) filter (where ${turns.role} = 'assistant')`,
})
.from(sessions)
.innerJoin(jobs, eq(sessions.jobId, jobs.id))
.leftJoin(evaluations, eq(evaluations.sessionId, sessions.id))
.leftJoin(turns, eq(turns.sessionId, sessions.id))
.groupBy(sessions.id, jobs.id, evaluations.id)
.orderBy(desc(sessions.startedAt))
```

Returned rows are enriched in the loader with `company` from `jobs-presentation.ts` so the view stays presentational.

### Shared presentation module (`src/lib/jobs-presentation.ts`)

Hoist the existing `COMPANY_BY_SLUG` and `FALLBACK_PRESET` from `src/app/page.tsx` (currently lines 11–37) into a single exported helper:

```ts
export function presetForSlug(slug: string): { company: string; duration: string; skills: string[] }
```

`src/app/page.tsx` and `src/lib/history-loader.ts` both call it. No behavior change for the home page.

## UI

### `<SiteHeader>` (`src/app/_components/site-header.tsx`)

Client component (uses `usePathname`). Sticky top chrome identical to today's `jobs-view.tsx:64–77` block, with two changes:

1. The `Roles` and `History` nav entries become `<Link>` elements pointing to `/` and `/history`.
2. Active state is derived from `usePathname()` — `Roles` active on `/`, `History` active on `/history`.

The existing `NavButton` helper moves with the chrome and is restyled as a link-rendered button (no `<button type="button">`). Its `aria-current` logic is preserved.

`jobs-view.tsx` drops its inline header + `NavButton` and renders `<SiteHeader />` instead.

### `<HistoryView>` (`src/app/history/_components/history-view.tsx`)

Server component. Layout:

- `<SiteHeader />`
- `<main className="mx-auto w-full max-w-[880px] px-10 pt-12 pb-20">` (matches handoff's 880px max-width)
  - Editorial title block:
    - Eyebrow: `History · {N} sessions` + `<AccentLine />`
    - Display headline: `Your past <span class="italic-accent">debriefs</span><span class="text-accent">.</span>`
  - Empty state OR list

### Empty state

```
No sessions yet. Pick a role to start your first interview.
```

Rendered inside the same dashed editorial box used in `jobs-view.tsx:132–142`.

### Row (`<HistoryRow>`)

Each row is a `<Link>` whose destination depends on `status`:

| `status` | Destination | Rationale |
|---|---|---|
| `completed` | `/sessions/[id]` | Results / debrief |
| `active` | `/interview/[id]` | Resume the room — `interview/[sessionId]/page.tsx` already rehydrates `initialTurns` and only redirects on `completed`, so resume is free |
| `abandoned` | `/sessions/[id]` | Lands on the existing `PendingState`; acceptable dead-end |

A small helper `linkForRow(row): string` centralises this mapping in `history-loader.ts` so the view stays presentational.

The row uses a 4-column grid:

```
┌─────────────────────────────────────────────────────────────────┐
│ Job title                Company    relative-date  [pill][pill] ›│
└─────────────────────────────────────────────────────────────────┘
```

| Column | Content | Style |
|---|---|---|
| 1 | `jobTitle` | `font-ui text-[14px]/[1.3] font-medium text-fg-1` |
| 2 | `company` | `font-mono text-[12px] text-fg-3` |
| 3 | relative date (`startedAt`) | `font-mono text-[11px] uppercase tracking-[0.04em] text-fg-4` |
| 4 | status pill + detail pill + chevron | gap-2, items-center |

Container: `block rounded-[10px] border border-border-default bg-bg-raised px-5 py-4 transition-colors hover:bg-bg-hover`.

### Pill mapping

| `status` | Status pill (`<Pill tone>`) | Detail pill |
|---|---|---|
| `completed` | `tone="pass" dot` → `Completed` | `tone="accent"` → `{overallScore}` (rounded to int) when `overallScore != null`, else `tone="neutral"` → `{N} Q` |
| `active` | `tone="info" dot` → `In progress` | `tone="neutral"` → `Resume` (with subtle `→` glyph), or `{N} Q` if no turns yet |
| `abandoned` | `tone="fail" dot` → `Abandoned` | `tone="neutral"` → `{N} Q` (omitted if 0) |

The `Pill` primitive already supports `tone` and `dot` (`src/components/ui/pill.tsx`).

### Relative date

Use `Intl.RelativeTimeFormat` for buckets (`today`, `yesterday`, `N days ago`, then `MMM D` for >7 days, `MMM D YYYY` for past year). Implemented as a small helper in `src/lib/format-date.ts` if one doesn't exist; otherwise extend the existing one.

## Error handling

- Query errors propagate to Next's nearest `error.tsx` (root already has one at `src/app/error.tsx`). No special-casing.
- Empty result set → empty state, not an error.
- Rows reference `sessionId`s that always resolve (FK guarantees `jobId`); `/sessions/[id]` already handles the `notFound()` and pending paths.

## Testing

Manual verification via Playwright MCP after implementation:

1. Seeded DB with no sessions → `/history` shows empty state.
2. Start one interview, answer a couple of turns, navigate to `/history` → row appears with `In progress` pill + `Resume`, click → lands back in the interview room with prior turns visible.
3. Complete one interview → row shows `Completed` + score pill, click → lands on results.
4. Header: clicking `Roles` from `/history` returns to `/`; `History` is active on `/history`, `Roles` on `/`.

No new unit tests — UI is presentational, data layer is one Drizzle query covered transitively by the manual flow.

## Risks / open questions

- **`questionCount` cost:** the `count(... filter ...)` over all sessions × turns is fine at demo scale (single-digit sessions). If we ever ship multi-tenant we'd cache or denormalize, but that's out of scope.
- **`relativeDate` SSR/CSR drift:** computed server-side from `Date.now()`. For a 4h take-home this is acceptable; if the page is cached we'd see stale labels. RSCs are dynamic by default in this app, so no action needed.
