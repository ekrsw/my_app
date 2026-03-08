"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"

type GroupWithCount = {
  id: number
  name: string
  _count: { employeeGroups: number }
}

export const groupColumns: ColumnDef<GroupWithCount>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "name",
    header: "グループ名",
  },
  {
    accessorFn: (row) => row._count.employeeGroups,
    id: "employeeCount",
    header: "従業員数",
    cell: ({ getValue }) => (
      <Badge variant="secondary">{getValue<number>()}名</Badge>
    ),
  },
]
