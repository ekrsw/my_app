"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import type { EmployeeWithGroup } from "@/types/employees"
import { formatDate } from "@/lib/date-utils"

export const employeeColumns: ColumnDef<EmployeeWithGroup>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => (
      <Link href={`/employees/${row.original.id}`} className="font-medium text-primary hover:underline">
        {row.original.id}
      </Link>
    ),
  },
  {
    accessorKey: "name",
    header: "氏名",
    cell: ({ row }) => (
      <Link href={`/employees/${row.original.id}`} className="hover:underline">
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "nameKana",
    header: "カナ",
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue<string>() ?? "-"}</span>
    ),
  },
  {
    accessorFn: (row) => row.group?.name,
    id: "groupName",
    header: "グループ",
    cell: ({ getValue }) => {
      const name = getValue<string | undefined>()
      return name ? <Badge variant="outline">{name}</Badge> : "-"
    },
  },
  {
    accessorKey: "assignmentDate",
    header: "配属日",
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
