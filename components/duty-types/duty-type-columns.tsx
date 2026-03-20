"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { COLOR_PALETTE } from "@/lib/constants"
import { cn } from "@/lib/utils"

export type DutyTypeRow = {
  id: number
  code: string
  name: string
  color: string | null
  isActive: boolean | null
  sortOrder: number
}

export const dutyTypeColumns: ColumnDef<DutyTypeRow>[] = [
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
    accessorKey: "name",
    header: "当番名",
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
    accessorKey: "isActive",
    header: "状態",
    cell: ({ getValue }) => (
      <Badge variant={getValue<boolean>() ? "default" : "secondary"}>
        {getValue<boolean>() ? "有効" : "無効"}
      </Badge>
    ),
  },
]
