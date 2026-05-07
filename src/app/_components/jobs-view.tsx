import { Logo } from "@/components/brand/logo"
import { AccentLine } from "@/components/ui/accent-line"

import { JobCard, type JobCardJob } from "./job-card"

interface JobsViewProps {
  jobs: JobCardJob[]
}

/**
 * JobsView — editorial home shell. Logo, mono eyebrow, display-serif headline
 * with one italicised accent and an apricot full-stop, an AccentLine divider,
 * and the magazine-style 2-column grid of role cards. The first card is
 * featured (taller, larger title) to anchor the layout.
 */
export function JobsView({ jobs }: JobsViewProps) {
  return (
    <main className="relative mx-auto w-full max-w-6xl px-8 py-14">
      {/* Top bar — wordmark */}
      <div className="iris-fade-in mb-10">
        <Logo size="sm" />
      </div>

      {/* Editorial header */}
      <header className="iris-fade-in mb-10 flex flex-col gap-4">
        <div className="inline-flex items-center gap-3">
          <span className="eyebrow">Open practice rooms · {jobs.length} roles</span>
          <AccentLine width={36} className="max-w-[120px]" />
        </div>
        <h1 className="m-0 font-display text-5xl leading-[1.05] text-fg-1 sm:text-6xl">
          Pick a role.
          <br />
          <span className="italic-accent">Step inside</span>
          <span className="text-accent">.</span>
        </h1>
        <p className="m-0 max-w-xl text-base leading-[1.55] text-fg-2">
          Iris will ask you 6–8 questions tailored to the role. Speak out loud. She listens, follows up, and writes you
          a private debrief at the end.
        </p>
      </header>

      {/* AccentLine divider above the grid */}
      <AccentLine className="mb-10" />

      {/* Grid */}
      {jobs.length > 0 ? (
        <ul className="iris-stagger grid list-none grid-cols-1 gap-x-10 gap-y-6 p-0 lg:grid-cols-2">
          {jobs.map((job, i) => (
            <li key={job.id} className={i === 0 ? "lg:row-span-2" : undefined}>
              <JobCard job={job} featured={i === 0} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-border-default p-12 text-center font-ui text-sm text-fg-3">
          No roles available — run <code className="font-mono text-fg-2">pnpm db:seed</code> to load the catalog.
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
  )
}
