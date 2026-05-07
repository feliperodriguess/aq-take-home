import { ArrowRight } from "@phosphor-icons/react/dist/ssr"

import { startSessionAction } from "@/actions/start-session"
import { Pill } from "@/components/ui/pill"
import { cn } from "@/lib/utils"

type JobCardJob = {
  id: string
  slug: string
  title: string
  shortDescription: string
  company: string
  duration: string
  skills: string[]
}

interface JobCardProps {
  job: JobCardJob
}

/**
 * JobCard — magazine-style card for the home grid. Wraps a Server Action form
 * so the entire card (via the submit button) is keyboard-accessible without
 * any client JavaScript. Cards are uniform height so the grid stays calm.
 */
export function JobCard({ job }: JobCardProps) {
  return (
    <form
      action={startSessionAction}
      className={cn(
        "group relative grid h-full min-h-[220px] grid-rows-[auto_1fr_auto] gap-[18px] overflow-hidden rounded-xl border border-border-default bg-bg-raised p-6 text-left",
        "transition-all duration-200 ease-out hover:border-border-strong hover:bg-bg-hover",
        "focus-within:border-border-strong focus-within:bg-bg-hover",
      )}
    >
      <input type="hidden" name="jobId" value={job.id} />

      {/* Top: company + duration */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-fg-3">{job.company}</span>
          <span className="font-mono text-[11px] leading-tight text-fg-4">Remote · Live mock</span>
        </div>
        <Pill tone="accent" size="sm">
          ~{job.duration}
        </Pill>
      </div>

      {/* Title + blurb */}
      <div className="flex flex-col gap-2.5">
        <h3 className="m-0 font-display text-[30px] leading-[1.05] text-fg-1">{job.title}</h3>
        <p className="m-0 text-[13.5px] leading-[1.55] text-fg-2">{job.shortDescription}</p>
      </div>

      {/* Bottom: skill chips + CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {job.skills.slice(0, 3).map((skill) => (
            <span
              key={skill}
              className="rounded border border-border-subtle bg-bg-canvas px-2 py-[3px] font-mono text-[10.5px] leading-none text-fg-3"
            >
              {skill}
            </span>
          ))}
        </div>
        <button
          type="submit"
          aria-label={`Start interview for ${job.title}`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md bg-transparent px-1 py-1 font-mono text-xs font-medium tracking-[0.04em] text-fg-3 transition-colors duration-150",
            "group-hover:text-accent group-focus-within:text-accent hover:text-accent focus-visible:text-accent",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          )}
        >
          Begin
          <ArrowRight
            size={12}
            weight="bold"
            className="transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-focus-within:translate-x-0.5"
          />
        </button>
      </div>
    </form>
  )
}

export type { JobCardJob }
