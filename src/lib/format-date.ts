/**
 * Relative date formatter for editorial UI surfaces (history list, etc).
 *
 * Buckets:
 *   - <1 min  → "just now"
 *   - <1 h    → "N min ago"
 *   - <24 h   → "N h ago"
 *   - <7 d    → "N d ago"
 *   - same year → "MMM D"        (e.g. "May 7")
 *   - else    → "MMM D, YYYY"    (e.g. "Dec 12, 2024")
 *
 * Computed against `now` (defaults to `Date.now()`). Both inputs are coerced
 * to Date so callers can pass a string from a JSON payload.
 */

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const

export function formatRelativeDate(input: Date | string | number, now: Date | number = Date.now()): string {
  const then = typeof input === "string" || typeof input === "number" ? new Date(input) : input
  const nowMs = typeof now === "number" ? now : now.getTime()
  const diffMs = nowMs - then.getTime()

  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < minute) return "just now"
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} min ago`
  if (diffMs < day) return `${Math.floor(diffMs / hour)} h ago`
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)} d ago`

  const month = MONTHS_SHORT[then.getMonth()]
  const dayOfMonth = then.getDate()
  const sameYear = then.getFullYear() === new Date(nowMs).getFullYear()
  return sameYear ? `${month} ${dayOfMonth}` : `${month} ${dayOfMonth}, ${then.getFullYear()}`
}
