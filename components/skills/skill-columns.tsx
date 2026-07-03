"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"

export type SkillRow = {
  id: number
  skillCode: string
  skillName: string
  isActive: boolean | null
  sortOrder: number
  holderCount: number
}

export const skillColumns: ColumnDef<SkillRow>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "skillCode",
    header: "コード",
    cell: ({ getValue }) => (
      <code className="rounded bg-muted px-1.5 py-0.5 text-sm">{getValue<string>()}</code>
    ),
  },
  {
    accessorKey: "skillName",
    header: "スキル名",
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
    accessorKey: "holderCount",
    header: "保有者数",
    cell: ({ getValue }) => `${getValue<number>()}名`,
  },
]
