"use client"

import { Button } from "@/components/ui/button"
import { Calendar, TableIcon } from "lucide-react"

type ShiftViewToggleProps = {
  view: "calendar" | "table"
  onChange: (view: "calendar" | "table") => void
}

export function ShiftViewToggle({ view, onChange }: ShiftViewToggleProps) {
  return (
    <div className="flex items-center rounded-md border">
      <Button
        variant={view === "calendar" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("calendar")}
        className="rounded-r-none"
      >
        <Calendar className="mr-1 h-4 w-4" />
        カレンダー
      </Button>
      <Button
        variant={view === "table" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("table")}
        className="rounded-l-none"
      >
        <TableIcon className="mr-1 h-4 w-4" />
        テーブル
      </Button>
    </div>
  )
}
