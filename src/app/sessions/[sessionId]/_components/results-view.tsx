import { ArrowLeft } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"

import { Logo } from "@/components/brand/logo"
import { AccentLine } from "@/components/ui/accent-line"
import type { Job, Session, Turn } from "@/db/schema"
import type { Evaluation, QuestionPack } from "@/types/interview"

import { CompetencyTable } from "./competency-table"
import { RawJson } from "./raw-json"
import { ScoreHeader } from "./score-header"
import { StrengthsConcerns } from "./strengths-concerns"
import { SummaryCard } from "./summary-card"
import { TalkRatioBar } from "./talk-ratio-bar"
import { TranscriptList } from "./transcript-list"

interface ResultsViewProps {
  session: Session
  job: Job
  pack: QuestionPack
  turns: Turn[]
  evaluation: Evaluation
  overallScore: number
}

/**
 * Editorial composition for the results page. Shell only — every block is its
 * own component to keep this file at-a-glance readable.
 */
export function ResultsView({
  session: _session,
  job,
  pack: _pack,
  turns,
  evaluation,
  overallScore,
}: ResultsViewProps) {
  return (
    <main className="mx-auto w-full min-w-0 max-w-5xl space-y-12 bg-bg-canvas px-6 py-12">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-3">{job.title}</span>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-accent transition-colors hover:text-marigold-300"
        >
          <ArrowLeft size={12} weight="bold" />
          Back to roles
        </Link>
      </header>

      {/* Editorial headline */}
      <section className="iris-fade-in flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-3">Debrief</span>
          <AccentLine width={32} className="max-w-[160px]" />
        </div>
        <h1 className="font-display text-5xl leading-[1.05] text-fg-1 sm:text-6xl">
          How it went, with <span className="italic text-paper-300">candor</span>
          <span className="text-accent">.</span>
        </h1>
      </section>

      {/* Score + summary hero row */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <ScoreHeader score={overallScore} recommendation={evaluation.recommendation} />
        <SummaryCard summary={evaluation.summary} />
      </section>

      {/* Strengths / concerns */}
      <StrengthsConcerns strengths={evaluation.strengths} concerns={evaluation.concerns} />

      {/* Per-rubric competency table */}
      <CompetencyTable items={evaluation.perCompetency} />

      {/* Talk ratio */}
      <TalkRatioBar turns={turns} />

      {/* Full transcript */}
      <TranscriptList turns={turns} />

      {/* Raw evaluation JSON for the take-home grader */}
      <RawJson evaluation={evaluation} />
    </main>
  )
}
