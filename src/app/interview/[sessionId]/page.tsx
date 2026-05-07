import { notFound, redirect } from "next/navigation"

import { loadInterview } from "@/lib/interview-loader"

import { InterviewRoom } from "./_components/interview-room"

interface InterviewPageProps {
  params: Promise<{ sessionId: string }>
}

export default async function InterviewPage({ params }: InterviewPageProps) {
  const { sessionId } = await params
  const data = await loadInterview(sessionId)
  if (!data) notFound()
  if (data.session.status === "completed") redirect(`/sessions/${sessionId}`)

  return (
    <InterviewRoom
      sessionId={data.session.id}
      job={{ id: data.job.id, title: data.job.title }}
      initialTurns={data.turns.map((t) => ({
        index: t.index,
        role: t.role,
        text: t.text,
      }))}
    />
  )
}
