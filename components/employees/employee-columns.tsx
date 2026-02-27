"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import type { EmployeeWithGroups } from "@/types/employees"
import { formatDate } from "@/lib/date-utils"

export const employeeColumns: ColumnDef<EmployeeWithGroups>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.id}</span>
    ),
  },
  {
    accessorKey: "name",
    header: "氏名",
    cell: ({ row }) => row.original.name,
  },
  {
    accessorKey: "nameKana",
    header: "カナ",
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue<string>() ?? "-"}</span>
    ),
  },
  {
    id: "groupName",
    header: "グループ",
    cell: ({ row }) => {
      const groups = row.original.groups
      if (!groups || groups.length === 0) return "-"
      return (
        <div className="flex flex-wrap gap-1">
          {groups.map((g) => (
            <Badge key={g.id} variant="outline">{g.group.name}</Badge>
          ))}
        </div>
      )
    },
  },
  {
    accessorKey: "hireDate",
    header: "入社日",
    cell: ({ getValue }) => formatDate(getValue<Date | null>()),
  },
  {
    accessorKey: "terminationDate",
    header: "退職日",
    cell: ({ getValue }) => {
      const date = getValue<Date | null>()
      if (!date) return <Badge variant="secondary">在籍中</Badge>
      return <span className="text-muted-foreground">{formatDate(date)}</span>
    },
  },
]
