"use client"

import { ClockCounterClockwise, List } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Logo } from "@/components/brand/logo"
import { cn } from "@/lib/utils"

/**
 * Sticky top chrome shared by `/` (jobs) and `/history`. Wordmark + tagline on
 * the left, two nav links on the right. Active state is derived from the
 * current pathname so we don't have to thread props down every page.
 */
export function SiteHeader() {
  const pathname = usePathname()
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border-subtle bg-bg-canvas px-10 py-5">
      <div className="flex items-center gap-3.5">
        <Logo size="sm" />
        <span className="font-mono text-[11px] leading-none tracking-[0.04em] text-fg-4">ai · interview practice</span>
      </div>
      <nav className="flex items-center gap-2">
        <NavLink href="/" active={pathname === "/"} icon={<List size={13} weight="bold" />}>
          Roles
        </NavLink>
        <NavLink
          href="/history"
          active={pathname === "/history" || pathname.startsWith("/history/")}
          icon={<ClockCounterClockwise size={13} weight="bold" />}
        >
          History
        </NavLink>
      </nav>
    </header>
  )
}

interface NavLinkProps {
  href: string
  active: boolean
  icon: React.ReactNode
  children: React.ReactNode
}

function NavLink({ href, active, icon, children }: NavLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-2 rounded-[7px] border px-3 py-2 font-ui text-[12px] font-medium leading-none transition-colors duration-150",
        active
          ? "border-[rgba(251,191,36,0.20)] bg-accent-soft text-accent"
          : "border-transparent text-fg-2 hover:bg-bg-raised hover:text-fg-1",
      )}
    >
      {icon}
      {children}
    </Link>
  )
}
