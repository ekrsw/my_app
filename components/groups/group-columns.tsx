"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { GroupForm, GroupDeleteButton } from "./group-form"

type GroupWithCount = {
  id: number
  name: string
  _count: { employees: number }
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
    accessorFn: (row) => row._count.employees,
    id: "employeeCount",
    header: "従業員数",
    cell: ({ getValue }) => (
      <Badge variant="secondary">{getValue<number>()}名</Badge>
    ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <GroupForm group={row.original} />
        <GroupDeleteButton id={row.original.id} />
      </div>
    ),
  },
]
