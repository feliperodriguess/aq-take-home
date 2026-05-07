"use client"

import { CaretLeftIcon } from "@phosphor-icons/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface HomeLinkProps {
  /** Whether the user has spoken at least one turn — gates the confirm dialog. */
  interviewActive: boolean
}

/**
 * Discreet "← Home" affordance for the top bar. If the interview has any
 * turns yet, we ask first — leaving abandons the in-flight session without
 * triggering evaluation. With no turns, it navigates straight away (cmd-click
 * still works because the trigger is a real anchor).
 */
export function HomeLink({ interviewActive }: HomeLinkProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleConfirm = () => {
    setOpen(false)
    router.push("/")
  }

  if (!interviewActive) {
    return (
      <Link
        href="/"
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-3 transition-colors hover:bg-bg-hover hover:text-fg-1"
      >
        <CaretLeftIcon className="size-3" weight="bold" /> Home
      </Link>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-3 transition-colors hover:bg-bg-hover hover:text-fg-1"
      >
        <CaretLeftIcon className="size-3" weight="bold" /> Home
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave this interview?</DialogTitle>
          <DialogDescription>
            Your progress so far stays saved, but Iris won't generate an evaluation. Use "End interview" instead if you
            want a debrief.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" size="sm" />}>Stay</DialogClose>
          <Button variant="secondary" size="sm" onClick={handleConfirm}>
            Leave to home
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
