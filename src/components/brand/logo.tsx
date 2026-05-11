import type * as React from "react"

import { cn } from "@/lib/utils"

type LogoSize = "sm" | "md" | "lg"

interface LogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: LogoSize
}

const sizeMap: Record<LogoSize, { orb: number; text: number }> = {
  sm: { orb: 12, text: 14 },
  md: { orb: 16, text: 18 },
  lg: { orb: 22, text: 26 },
}

/**
 * Iris wordmark — pulse-free marigold orb (radial gradient with soft glow)
 * paired with the "Iris" wordmark in the display serif. The trailing `s` is
 * italicised per the brand guideline.
 */
function Logo({ size = "md", className, ...props }: LogoProps) {
  const { orb, text } = sizeMap[size]
  return (
    <span
      data-slot="logo"
      className={cn("inline-flex items-center gap-2 leading-none text-fg-1", className)}
      {...props}
    >
      <span
        aria-hidden
        className="inline-block rounded-full"
        style={{
          width: orb,
          height: orb,
          background:
            "radial-gradient(circle at 30% 30%, var(--color-marigold-300), var(--color-marigold-500) 70%, var(--color-marigold-600))",
          boxShadow: "0 0 12px rgba(251, 191, 36, 0.4)",
        }}
      />
      <span className="font-display tracking-[-0.01em]" style={{ fontSize: text }}>
        Iri<span className="italic">s</span>
      </span>
    </span>
  )
}

export { Logo }
export type { LogoProps }
