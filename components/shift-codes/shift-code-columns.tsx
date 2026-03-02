"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { ShiftCodeForm, ShiftCodeDeleteButton } from "./shift-code-form"
import { COLOR_PALETTE } from "@/lib/constants"
import { cn } from "@/lib/utils"

type ShiftCodeRow = {
  id: number
  code: string
  color: string | null
  defaultStartTime: Date | null
  defaultEndTime: Date | null
  defaultIsHoliday: boolean
  isActive: boolean | null
  sortOrder: number
}

function formatTime(d: Date | string | null): string {
  if (!d) return "-"
  const iso = typeof d === "string" ? d : d.toISOString()
  return iso.substring(11, 16)
}

export const shiftCodeColumns: ColumnDef<ShiftCodeRow>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "code",
    header: "コード",
    cell: ({ getValue }) => (
      <code className="rounded bg-muted px-1.5 py-0.5 text-sm">{getValue<string>()}</code>
    ),
  },
  {
    accessorKey: "color",
    header: "色",
    cell: ({ getValue }) => {
      const colorKey = getValue<string | null>()
      if (!colorKey) return <span className="text-muted-foreground">-</span>
      const palette = COLOR_PALETTE[colorKey]
      if (!palette) return <span className="text-muted-foreground">{colorKey}</span>
      return (
        <div className="flex items-center gap-1.5">
          <span className={cn("inline-block h-4 w-4 rounded-full", palette.swatch)} />
          <span className="text-xs text-muted-foreground">{palette.label}</span>
        </div>
      )
    },
  },
  {
    id: "defaultTime",
    header: "デフォルト時刻",
    cell: ({ row }) => {
      const start = formatTime(row.original.defaultStartTime)
      const end = formatTime(row.original.defaultEndTime)
      if (start === "-" && end === "-") return "-"
      return `${start} - ${end}`
    },
  },
  {
    id: "flags",
    header: "フラグ",
    cell: ({ row }) => (
      <div className="flex gap-1">
        {row.original.defaultIsHoliday && (
          <Badge variant="outline" className="text-red-600 border-red-200">休日</Badge>
        )}
        {!row.original.defaultIsHoliday && "-"}
      </div>
    ),
  },
  {
    accessorKey: "sortOrder",
    header: "表示順",
  },
  {
    accessorKey: "isActive",
    header: "状態",
    cell: ({ getValue }) => (
      <Badge variant={getValue<boolean>() ? "default" : "secondary"}>
        {getValue<boolean>() ? "有効" : "無効"}
      </Badge>
    ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <ShiftCodeForm shiftCode={row.original} />
        <ShiftCodeDeleteButton id={row.original.id} />
      </div>
    ),
  },
]
