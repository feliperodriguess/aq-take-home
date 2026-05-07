"use client"

import { CaretRightIcon, TargetIcon } from "@phosphor-icons/react"

import { Pill } from "@/components/ui/pill"
import type { PhaseKind } from "@/lib/interview-room/types"
import { cn } from "@/lib/utils"
import type { Signals } from "@/types/interview"

interface DecisionPanelProps {
  signals: Signals | null
  phase: PhaseKind
  open: boolean
  onToggle: () => void
}

export function DecisionPanel({ signals, phase, open, onToggle }: DecisionPanelProps) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "absolute right-0 top-1/2 z-30 hidden -translate-y-1/2 -translate-x-px items-center gap-1.5 rounded-l-md border border-border-default bg-bg-raised px-2 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-3 transition-colors hover:text-fg-1 lg:inline-flex",
          open && "right-[340px]",
        )}
        aria-expanded={open}
        aria-controls="decision-panel"
      >
        <TargetIcon className="size-3" />
        {open ? "hide" : "panel"}
      </button>
      <aside
        id="decision-panel"
        aria-hidden={!open}
        className={cn(
          "fixed inset-y-[60px] right-0 z-20 hidden w-[340px] flex-col gap-6 overflow-y-auto border-l border-border-subtle bg-bg-raised px-5 py-6 transition-transform duration-300 ease-out lg:flex",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Decision panel</span>
          <span className="font-ui text-[12px] leading-[1.5] text-fg-3">
            What Iris is tracking, and why she chose this question.
          </span>
        </div>

        <Section label="Why this question">
          <div
            className={cn(
              "rounded-lg border border-border-subtle bg-bg-canvas px-3.5 py-3 font-ui text-[12.5px] leading-[1.55] text-fg-2 italic",
              phase === "thinking" && "iris-pulse",
            )}
          >
            {signals?.rationale ?? "Calibrating against the role rubric. Waiting for the first response."}
          </div>
        </Section>

        <Section label={`Skills detected · ${signals?.skillsDetected.length ?? 0}`}>
          {signals && signals.skillsDetected.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {[...signals.skillsDetected]
                .sort((a, b) => b.confidence - a.confidence)
                .map((s) => (
                  <SkillBar key={s.skill} label={s.skill} value={s.confidence} />
                ))}
            </div>
          ) : (
            <Empty>No signals yet. Iris listens before scoring.</Empty>
          )}
        </Section>

        <Section label="Topics covered">
          {signals && signals.topicsCovered.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {signals.topicsCovered.map((t) => (
                <Pill key={t} tone="info" size="sm">
                  <CaretRightIcon className="size-2.5" /> {t}
                </Pill>
              ))}
            </div>
          ) : (
            <Empty>None yet.</Empty>
          )}
        </Section>

        <Section label="Open gaps">
          {signals && signals.gaps.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {signals.gaps.map((g) => (
                <Pill key={g} tone="fail" size="sm" className="opacity-80">
                  {g}
                </Pill>
              ))}
            </div>
          ) : (
            <Empty>No open gaps detected.</Empty>
          )}
        </Section>
      </aside>
    </>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <span className="eyebrow">{label}</span>
      <div>{children}</div>
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="font-ui text-[12px] leading-[1.5] text-fg-4 italic">{children}</p>
}

function SkillBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0.04, Math.min(1, value))
  const tone = pct > 0.65 ? "bg-pass" : pct > 0.3 ? "bg-accent" : "bg-fg-4"
  return (
    <div className="grid grid-cols-[1fr_36px] items-center gap-3">
      <div>
        <div className="mb-1.5 flex justify-between">
          <span className="font-ui text-[11.5px] leading-tight text-fg-2">{label}</span>
        </div>
        <div className="h-1 overflow-hidden rounded-sm bg-bg-canvas">
          <div
            className={cn("h-full transition-[width,background-color] duration-500 ease-out", tone)}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      </div>
      <span className="text-right font-mono text-[11px] tabular-nums text-fg-3">{Math.round(pct * 100)}</span>
    </div>
  )
}
