import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Pill — small mono microcopy chip with semantic tone.
 *
 * Mirrors the handoff `Pill` primitive: uppercase-spaced mono label, optional
 * 5px tone-coloured dot prefix, fully rounded.
 */
const pillVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full font-mono font-medium tracking-[0.04em] whitespace-nowrap leading-none",
  {
    variants: {
      tone: {
        neutral: "bg-bg-raised text-fg-2",
        accent: "bg-accent-soft text-accent",
        info: "bg-info/10 text-info",
        pass: "bg-pass/10 text-pass",
        fail: "bg-fail/10 text-fail",
        warn: "bg-warn/10 text-warn",
      },
      size: {
        sm: "px-2 py-[2px] text-[10px]",
        md: "px-2.5 py-[3px] text-[11px]",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "md",
    },
  },
)

const dotToneClass: Record<NonNullable<VariantProps<typeof pillVariants>["tone"]>, string> = {
  neutral: "bg-fg-2",
  accent: "bg-accent",
  info: "bg-info",
  pass: "bg-pass",
  fail: "bg-fail",
  warn: "bg-warn",
}

interface PillProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof pillVariants> {
  dot?: boolean
}

function Pill({ tone = "neutral", size = "md", dot = false, className, children, ...props }: PillProps) {
  const dotClass = dotToneClass[tone ?? "neutral"]
  return (
    <span data-slot="pill" className={cn(pillVariants({ tone, size }), className)} {...props}>
      {dot && <span aria-hidden className={cn("inline-block size-[5px] rounded-full", dotClass)} />}
      {children}
    </span>
  )
}

export { Pill, pillVariants }
export type { PillProps }
