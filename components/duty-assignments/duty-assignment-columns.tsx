"use client"

import { ColumnDef } from "@tanstack/react-table"
import { COLOR_PALETTE } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { DutyAssignmentWithDetails } from "@/types/duties"

function formatTime(d: Date | string | null): string {
  if (!d) return "-"
  const iso = typeof d === "string" ? d : d.toISOString()
  return iso.substring(11, 16)
}

function formatDate(d: Date | string | null): string {
  if (!d) return "-"
  const iso = typeof d === "string" ? d : d.toISOString()
  return iso.substring(0, 10)
}

export const dutyAssignmentColumns: ColumnDef<DutyAssignmentWithDetails>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    id: "employeeName",
    header: "従業員",
    cell: ({ row }) => row.original.employee.name,
  },
  {
    id: "group",
    header: "グループ",
    cell: ({ row }) => {
      const groups = row.original.employee.groups
      if (groups.length === 0) return <span className="text-muted-foreground">-</span>
      return groups.map((g) => g.group.name).join(", ")
    },
  },
  {
    id: "dutyType",
    header: "当番種別",
    cell: ({ row }) => {
      const dt = row.original.dutyType
      const colorKey = dt.color
      const palette = colorKey ? COLOR_PALETTE[colorKey] : null
      return (
        <div className="flex items-center gap-1.5">
          {palette && (
            <span className={cn("inline-block h-3 w-3 rounded-full", palette.swatch)} />
          )}
          <span>{dt.name}</span>
        </div>
      )
    },
  },
  {
    id: "dutyDate",
    header: "日付",
    cell: ({ row }) => formatDate(row.original.dutyDate),
  },
  {
    id: "timeRange",
    header: "時間帯",
    cell: ({ row }) => {
      const start = formatTime(row.original.startTime)
      const end = formatTime(row.original.endTime)
      return `${start} 〜 ${end}`
    },
  },
]
