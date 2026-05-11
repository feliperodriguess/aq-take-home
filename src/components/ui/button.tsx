import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-transparent bg-clip-padding font-ui font-medium whitespace-nowrap transition-all duration-200 ease-out outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Iris kinds (handoff)
        primary: "bg-accent text-accent-fg border-transparent hover:bg-marigold-600",
        secondary: "bg-bg-raised text-fg-1 border-border-default hover:bg-bg-hover",
        ghost: "bg-transparent text-fg-2 border-transparent hover:text-fg-1 hover:bg-bg-hover",
        danger: "bg-fail/15 text-fail border-fail/30 hover:bg-fail/25",
        soft: "bg-accent-soft text-accent border-accent/20 hover:bg-accent/15",

        // Backwards-compat shadcn variants — keep so previously-installed
        // primitives that defaulted into these still render sanely.
        default: "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent",
        outline: "border-border-default bg-transparent text-fg-1 hover:bg-bg-hover",
        destructive: "bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/25",
        link: "text-accent underline-offset-4 hover:underline border-transparent bg-transparent",
      },
      size: {
        // Iris sizes (handoff)
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",

        // Backwards-compat shadcn sizes
        default: "h-8 gap-1.5 px-2.5 text-xs",
        xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
)

function Button({ className, variant, size, ...props }: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return <ButtonPrimitive data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
