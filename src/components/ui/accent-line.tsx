import type * as React from "react"

import { cn } from "@/lib/utils"

interface AccentLineProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Width of the apricot leading segment, in pixels. Defaults to 32 to match
   * the handoff.
   */
  width?: number
}

/**
 * AccentLine — section divider used throughout the Iris layout. A thin
 * apricot segment on the left, followed by the default subtle border to the
 * end of the row.
 */
function AccentLine({ width = 32, className, style, ...props }: AccentLineProps) {
  return (
    <div role="presentation" className={cn("flex w-full items-center", className)} {...props}>
      <span aria-hidden className="block h-[1.5px] bg-accent" style={{ width }} />
      <span aria-hidden className="block h-px flex-1 bg-border-default" style={style} />
    </div>
  )
}

export { AccentLine }
export type { AccentLineProps }
