/**
 * Pending state — shown when the session row exists but the evaluation hasn't
 * been written yet (rare race; spec 05 guarantees the end route is
 * synchronous). Uses meta-refresh so this stays a pure Server Component.
 */
export function PendingState() {
  return (
    <>
      <meta httpEquiv="refresh" content="2" />
      <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-8 px-6 py-24 text-center">
        <div
          aria-hidden
          className="iris-pulse h-16 w-16 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, var(--color-marigold-300), var(--color-marigold-500) 60%, var(--color-marigold-600))",
            boxShadow: "0 0 24px rgba(251,191,36,0.45)",
          }}
        />
        <div className="flex flex-col items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-3">Hold tight</span>
          <h1 className="font-display text-4xl text-fg-1 sm:text-5xl">
            Wrapping up the <span className="italic text-paper-300">evaluation</span>
            <span className="text-accent">…</span>
          </h1>
          <p className="max-w-md font-ui text-sm text-fg-3">
            Iris is closing out the rubric and writing your debrief. This usually takes a few seconds, then the page
            will refresh automatically.
          </p>
        </div>
      </main>
    </>
  )
}
