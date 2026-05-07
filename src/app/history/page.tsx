import { loadHistory } from "@/lib/history-loader"

import { HistoryView } from "./_components/history-view"

export const dynamic = "force-dynamic"

/**
 * `/history` — editorial list of every session in the DB. RSC; no client
 * state. Active sessions resume into the room, completed/abandoned land on
 * the results page (which already handles the pending wrap-up state).
 */
export default async function HistoryPage() {
  const rows = await loadHistory()
  return <HistoryView rows={rows} />
}
