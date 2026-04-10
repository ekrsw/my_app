"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { COLOR_PALETTE } from "@/lib/constants"
import { cn } from "@/lib/utils"

export type DutyTypeRow = {
  id: number
  name: string
  color: string | null
  isActive: boolean | null
  sortOrder: number
  defaultReducesCapacity: boolean
  defaultStartTime: string | null
  defaultEndTime: string | null
  defaultNote: string | null
  defaultTitle: string | null
}

export const dutyTypeColumns: ColumnDef<DutyTypeRow>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "name",
    header: "業務名",
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
    accessorKey: "sortOrder",
    header: "表示順",
  },
  {
    id: "defaultTime",
    header: "デフォルト時刻",
    cell: ({ row }) => {
      const start = row.original.defaultStartTime
      const end = row.original.defaultEndTime
      if (!start && !end) return <span className="text-muted-foreground">-</span>
      return <span className="text-sm">{start ?? ""}〜{end ?? ""}</span>
    },
  },
  {
    accessorKey: "defaultReducesCapacity",
    header: "控除（初期値）",
    cell: ({ getValue }) => (
      <Badge variant={getValue<boolean>() ? "default" : "outline"}>
        {getValue<boolean>() ? "控除" : "対応可"}
      </Badge>
    ),
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
]
