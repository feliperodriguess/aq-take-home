"use client"

import { useEffect } from "react"

import { Logo } from "@/components/brand/logo"
import { AccentLine } from "@/components/ui/accent-line"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Root error boundary. Renders the same editorial frame as the home page so
 * the surface stays in-brand even when a Server Action throws (e.g. a stale
 * job id submitted from a tampered DOM).
 */
export default function GlobalError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Log to the browser console so devs can see the stack while debugging.
    // In production this is also picked up by Next's error reporter.
    console.error("[iris] route error", error)
  }, [error])

  return (
    <main className="relative mx-auto flex w-full max-w-3xl flex-col gap-6 px-8 py-24">
      <Logo size="sm" />

      <div className="flex flex-col gap-4">
        <div className="inline-flex items-center gap-3">
          <span className="eyebrow">Something snapped</span>
          <AccentLine width={36} className="max-w-[120px]" />
        </div>
        <h1 className="m-0 font-display text-5xl leading-[1.05] text-fg-1 sm:text-6xl">
          That didn’t take.
          <br />
          <span className="italic-accent">Try again</span>
          <span className="text-accent">.</span>
        </h1>
        <p className="m-0 max-w-xl text-base leading-[1.55] text-fg-2">
          Iris hit an unexpected error before the room could open. Refresh, or pick a role again — your previous
          sessions are safe.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="md" onClick={() => reset()}>
          Try again
        </Button>
        <a
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border-default bg-bg-raised px-4 font-ui text-sm font-medium text-fg-1 transition-colors hover:bg-bg-hover"
        >
          Back to roles
        </a>
      </div>

      {error.digest ? (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-4">ref · {error.digest}</p>
      ) : null}
    </main>
  )
}
