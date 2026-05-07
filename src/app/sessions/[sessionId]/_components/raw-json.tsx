import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr"

import type { Evaluation } from "@/types/interview"

interface RawJsonProps {
  evaluation: Evaluation
}

/**
 * Native `<details>` collapsible — no client JS needed. Satisfies the
 * take-home's "expose the JSON evaluation" requirement directly.
 */
export function RawJson({ evaluation }: RawJsonProps) {
  return (
    <details className="group/raw overflow-hidden rounded-lg border border-border-default bg-bg-raised">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-bg-hover">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-3">Raw evaluation JSON</span>
          <span className="font-mono text-[11px] text-fg-4">for the take-home rubric</span>
        </div>
        <CaretRightIcon size={14} weight="bold" className="text-fg-3 transition-transform group-open/raw:rotate-90" />
      </summary>
      <pre className="overflow-x-auto border-t border-border-subtle bg-bg-code px-6 py-4 font-mono text-[11px] leading-relaxed text-fg-3">
        {JSON.stringify(evaluation, null, 2)}
      </pre>
    </details>
  )
}
