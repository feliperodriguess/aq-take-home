import { notFound } from "next/navigation"

import { loadResults } from "@/lib/results-loader"

import { PendingState } from "./_components/pending-state"
import { ResultsView } from "./_components/results-view"

interface ResultsPageProps {
  params: Promise<{ sessionId: string }>
}

/**
 * Public-read results page (spec 05). Renders the editorial debrief once the
 * session is completed; otherwise shows a small "Wrapping up…" pending state
 * with a meta-refresh so we stay 100% RSC.
 */
export default async function ResultsPage({ params }: ResultsPageProps) {
  const { sessionId } = await params
  const data = await loadResults(sessionId)
  if (!data) notFound()

  if (data.session.status !== "completed" || !data.evaluation) {
    return <PendingState />
  }

  return (
    <ResultsView
      session={data.session}
      job={data.job}
      pack={data.pack}
      turns={data.turns}
      evaluation={data.evaluation}
      overallScore={data.evaluationOverallScore ?? data.evaluation.overallScore}
    />
  )
}
