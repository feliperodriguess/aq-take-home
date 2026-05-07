# 02 — Jobs Catalog & Session Bootstrap

> **Design reference:** `iris-ai-ui-handoff/project/interviewer/JobsView.jsx`. Magazine-grid 2 columns, first card featured (taller, larger title). Eyebrow + display-serif headline ("Pick a role. *Step inside*.") + apricot full-stop. See CLAUDE.md → "UI handoff" for tokens, fonts, and component map.

## Goal
Render the home page as a list of selectable jobs, and turn a click into a live interview session — creating the DB row and redirecting to the Interview Room.

## Out of scope
- Interview UI itself (spec 03).
- Server-side LLM calls (spec 04).
- Question pack content (spec 01).

## Surface

### Page: `/` (Server Component)
- Title + 1-line tagline.
- Grid/list of `JobCard`s, one per row in `jobs`.
- Each card shows `title` + `shortDescription`, hover state, and a primary CTA "Start interview".

### Form/Action: Start an interview
- Each `JobCard` wraps a `<form action={startSessionAction}>` with a hidden `jobId` input and a submit button.
- The Server Action does the work: insert session, redirect. No cookie, no client JavaScript required for the happy path.

## Files

```
src/
  app/
    page.tsx                       # RSC: lists jobs
    _components/
      job-card.tsx                 # presentational + form wrapper
  actions/
    start-session.ts               # 'use server' — Server Action
```

## Data fetching

`page.tsx` reads jobs through Drizzle. RSC, so it runs at request time (the route is uncached the moment it touches the DB; do not add `export const dynamic`).

```ts
// src/app/page.tsx
import { db } from "@/db/drizzle"
import { jobs } from "@/db/schema"
import { JobCard } from "./_components/JobCard"

export default async function HomePage() {
  const list = await db.select({
    id: jobs.id,
    slug: jobs.slug,
    title: jobs.title,
    shortDescription: jobs.shortDescription,
  }).from(jobs).orderBy(jobs.title)

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Practice an AI interview</h1>
      <p className="mt-2 text-muted-foreground">
        Pick a role. You'll talk to an AI interviewer that adapts to your answers.
      </p>
      <ul className="mt-8 grid gap-4">
        {list.map(job => <JobCard key={job.id} job={job} />)}
      </ul>
    </main>
  )
}
```

> Component identifier `JobCard` (PascalCase) lives in `_components/job-card.tsx` (kebab-case file) — see spec 00.

## Server Action

```ts
// src/actions/start-session.ts
"use server"
import { redirect } from "next/navigation"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/db/drizzle"
import { sessions, jobs } from "@/db/schema"

const InputSchema = z.object({ jobId: z.string().uuid() })

export async function startSessionAction(formData: FormData) {
  const { jobId } = InputSchema.parse({ jobId: formData.get("jobId") })

  // Confirm the job exists (defends against stale DOM / tampered IDs).
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, jobId)).limit(1)
  if (!job) throw new Error("Unknown job")

  const [session] = await db.insert(sessions)
    .values({ jobId })
    .returning({ id: sessions.id })

  redirect(`/interview/${session.id}`)
}
```

> `redirect()` throws a special error that Next.js intercepts; never wrap the call in a try/catch that swallows it.

The session UUID (122 bits of entropy) is the only identifier — the URL itself is the credential. Anyone with the link can interact; acceptable for a 4-hour take-home demo.

## JobCard

```tsx
// src/app/_components/job-card.tsx
import { startSessionAction } from "@/actions/start-session"

type Props = { job: { id: string; slug: string; title: string; shortDescription: string } }

export function JobCard({ job }: Props) {
  return (
    <li className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">{job.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{job.shortDescription}</p>
        </div>
        <form action={startSessionAction}>
          <input type="hidden" name="jobId" value={job.id} />
          <button type="submit" className="btn-primary">Start interview</button>
        </form>
      </div>
    </li>
  )
}
```

`btn-primary` resolves to a shadcn button — use the existing `src/components/ui/button.tsx` pattern (with `<Button asChild>` if needed for form submit).

## Empty / error states
- **No jobs in DB:** Render a simple "No roles available — run `pnpm db:seed`" message. This only happens in misconfigured envs.
- **Action throws:** Errors bubble up to the nearest `error.tsx`; add `src/app/error.tsx` showing a friendly message + "Try again" button.

## Accessibility
- Each card's CTA is a real `<button>` inside a `<form>` — keyboard accessible by default.
- Headings: `<h1>` on page, `<h2>` per job.
- `aria-label="Start interview for {title}"` on each submit.

## Open questions
- Want a seed of more than three jobs to reduce repetition during demo? Defer; three meets the requirement and packs are the bigger content lift.

## Acceptance checklist
- [ ] `/` renders ≥3 jobs from the DB after seed.
- [ ] Clicking a job's CTA inserts a session row and lands on `/interview/[id]`.
- [ ] Refreshing `/` does not re-trigger session creation.
- [ ] Submitting with a tampered `jobId` returns a clean error, not a 500.
