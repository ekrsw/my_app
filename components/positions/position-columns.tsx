"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { PositionForm, PositionDeleteButton } from "./position-form"

type PositionWithCount = {
  id: number
  positionCode: string
  positionName: string
  isActive: boolean | null
  sortOrder: number
  _count: { employeePositions: number }
}

export const positionColumns: ColumnDef<PositionWithCount>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "positionCode",
    header: "コード",
    cell: ({ getValue }) => (
      <code className="rounded bg-muted px-1.5 py-0.5 text-sm">{getValue<string>()}</code>
    ),
  },
  {
    accessorKey: "positionName",
    header: "役職名",
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
    accessorFn: (row) => row._count.employeePositions,
    id: "assignedCount",
    header: "割当数",
    cell: ({ getValue }) => `${getValue<number>()}名`,
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <PositionForm position={row.original} />
        <PositionDeleteButton id={row.original.id} />
      </div>
    ),
  },
]
