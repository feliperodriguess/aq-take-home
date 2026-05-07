"use client"

import { PhoneSlashIcon } from "@phosphor-icons/react"
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
  DialogTrigger,
} from "@/components/ui/dialog"

interface EndButtonProps {
  disabled?: boolean
  onConfirm: () => void
}

export function EndButton({ disabled, onConfirm }: EndButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="danger" size="sm" disabled={disabled}>
            <PhoneSlashIcon className="size-3.5" /> End interview
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>End the interview?</DialogTitle>
          <DialogDescription>
            Iris will close out and generate your evaluation. You can't resume after this.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" size="sm" />}>Keep going</DialogClose>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              setOpen(false)
              onConfirm()
            }}
          >
            End interview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
