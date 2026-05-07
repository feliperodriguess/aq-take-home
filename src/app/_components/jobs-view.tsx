"use client"

import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr"
import { useMemo, useState } from "react"

import { AccentLine } from "@/components/ui/accent-line"
import { cn } from "@/lib/utils"

import { JobCard, type JobCardJob } from "./job-card"
import { SiteHeader } from "./site-header"

interface JobsViewProps {
  jobs: JobCardJob[]
}

type FilterKey = "all" | "engineering" | "design" | "product"

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "engineering", label: "Engineering" },
  { key: "design", label: "Design" },
  { key: "product", label: "Product" },
]

/**
 * Map our seed slugs to the handoff's coarse role categories. Slugs we don't
 * know yet fall into "all" only — so a freshly-added job stays visible under
 * the default filter without any code change here.
 */
function categoryFor(slug: string): Exclude<FilterKey, "all">[] {
  if (["frontend-engineer", "backend-engineer"].includes(slug)) return ["engineering"]
  if (slug === "product-manager") return ["product"]
  return []
}

function matchesFilter(slug: string, filter: FilterKey): boolean {
  if (filter === "all") return true
  return categoryFor(slug).includes(filter as Exclude<FilterKey, "all">)
}

function matchesQuery(job: JobCardJob, query: string): boolean {
  if (query === "") return true
  const haystack = `${job.title} ${job.company} ${job.skills.join(" ")}`.toLowerCase()
  return haystack.includes(query.toLowerCase())
}

/**
 * JobsView — editorial home shell. Sticky chrome (logo + nav), tightened
 * editorial header, segmented filter + search strip, then a uniform 2-column
 * magazine grid of role cards.
 */
export function JobsView({ jobs }: JobsViewProps) {
  const [filter, setFilter] = useState<FilterKey>("all")
  const [query, setQuery] = useState("")

  const visible = useMemo(
    () => jobs.filter((j) => matchesFilter(j.slug, filter) && matchesQuery(j, query)),
    [jobs, filter, query],
  )

  return (
    <>
      <SiteHeader />

      <main className="relative mx-auto w-full max-w-[1080px] px-10 pt-12 pb-20">
        {/* Editorial header */}
        <div className="iris-fade-in mb-10 flex flex-col gap-[18px]">
          <div className="inline-flex items-center gap-3">
            <span className="eyebrow">Open practice rooms · {jobs.length} roles</span>
            <AccentLine width={36} className="max-w-[120px]" />
          </div>
          <h1 className="m-0 font-display text-[64px] leading-[1.05] text-fg-1">
            Pick a role.
            <br />
            <span className="italic-accent">Step inside</span>
            <span className="text-accent">.</span>
          </h1>
          <p className="m-0 max-w-[560px] text-base leading-[1.55] text-fg-2">
            Iris will ask you 6–8 questions tailored to the role. Speak out loud. She listens, follows up, and writes
            you a private debrief at the end.
          </p>
        </div>

        {/* Filter strip — segmented control + search + visible-count */}
        <div className="iris-fade-in mb-6 flex flex-wrap items-center gap-3">
          <SegFilter value={filter} onChange={setFilter} />
          <label className="relative min-w-[240px] max-w-[320px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 inline-flex -translate-y-1/2 text-fg-3">
              <MagnifyingGlass size={14} weight="bold" />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search role, company, skill…"
              aria-label="Search roles"
              className={cn(
                "h-9 w-full rounded-lg border border-border-default bg-bg-raised pl-9 pr-3 font-mono text-[13px] leading-none text-fg-1 outline-none",
                "placeholder:text-fg-4 focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-ring/30",
                "transition-colors",
              )}
            />
          </label>
          <span className="ml-auto font-mono text-[11px] font-medium uppercase leading-none tracking-[0.06em] text-fg-3">
            {visible.length} {visible.length === 1 ? "role" : "roles"}
          </span>
        </div>

        {/* Grid */}
        {visible.length > 0 ? (
          <ul className="iris-stagger grid list-none grid-cols-1 gap-[18px] p-0 lg:grid-cols-2">
            {visible.map((job) => (
              <li key={job.id}>
                <JobCard job={job} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-[10px] border border-dashed border-border-default p-12 text-center font-ui text-sm text-fg-3">
            {jobs.length === 0 ? (
              <>
                No roles available — run <code className="font-mono text-fg-2">pnpm db:seed</code> to load the catalog.
              </>
            ) : (
              "No matches. Try a different filter."
            )}
          </div>
        )}

        {/* Editorial footer */}
        <footer className="mt-16 flex flex-wrap items-baseline justify-between gap-3 border-t border-border-subtle pt-6">
          <p className="m-0 max-w-[540px] font-ui text-[13px] leading-[1.5] text-fg-3">
            Sessions are recorded locally for your review. Nothing is shared without your permission. Iris is built on
            small, focused models — no surveillance, no scoring against other candidates.
          </p>
          <span className="font-mono text-[10px] font-medium uppercase leading-none tracking-[0.16em] text-fg-4">
            v0.4 · private preview
          </span>
        </footer>
      </main>
    </>
  )
}

/* ---------------- Local sub-components ---------------- */

interface SegFilterProps {
  value: FilterKey
  onChange: (v: FilterKey) => void
}

/**
 * Segmented control for role categories. Mirrors the handoff's `SegFilter`
 * — pill-shaped surface with a recessed selection chip rather than the
 * shadcn-tabs look so it reads as part of the editorial chrome.
 */
function SegFilter({ value, onChange }: SegFilterProps) {
  return (
    <div className="inline-flex gap-0.5 rounded-lg border border-border-default bg-bg-raised p-[3px]">
      {FILTERS.map((f) => {
        const isActive = value === f.key
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => onChange(f.key)}
            aria-pressed={isActive}
            className={cn(
              "h-7 rounded-[5px] border px-3.5 font-ui text-[12px] font-medium leading-none transition-colors duration-150",
              isActive
                ? "border-border-default bg-bg-canvas text-fg-1"
                : "border-transparent text-fg-3 hover:text-fg-2",
            )}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}
