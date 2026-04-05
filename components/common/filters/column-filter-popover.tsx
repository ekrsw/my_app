"use client"

import { ReactNode } from "react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Filter } from "lucide-react"
import { cn } from "@/lib/utils"

type ColumnFilterPopoverProps = {
  isActive: boolean
  activeCount?: number
  children: ReactNode
  label: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ColumnFilterPopover({
  isActive,
  activeCount,
  children,
  label,
  open,
  onOpenChange,
}: ColumnFilterPopoverProps) {
  return (
    <div className="flex items-center gap-1">
      <span>{label}</span>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center h-5 w-5 rounded-sm hover:bg-accent relative",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Filter className={cn("h-3 w-3", isActive && "fill-primary")} />
            {isActive && activeCount && activeCount > 0 && (
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-3"
          align="start"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </PopoverContent>
      </Popover>
    </div>
  )
}
