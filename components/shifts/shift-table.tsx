"use client"

import { DataTable } from "@/components/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { ShiftBadge } from "./shift-badge"
import { formatDate, formatTime } from "@/lib/date-utils"
import { useQueryParams } from "@/hooks/use-query-params"
import type { ShiftWithEmployee } from "@/types/shifts"
import Link from "next/link"

const columns: ColumnDef<ShiftWithEmployee>[] = [
  {
    accessorKey: "shiftDate",
    header: "日付",
    cell: ({ getValue }) => formatDate(getValue<Date>()),
  },
  {
    accessorFn: (row) => row.employee?.name,
    id: "employeeName",
    header: "従業員",
    cell: ({ row }) => {
      const emp = row.original.employee
      return emp ? (
        <Link href={`/employees/${emp.id}`} className="hover:underline">
          {emp.name}
        </Link>
      ) : (
        "-"
      )
    },
  },
  {
    accessorFn: (row) => row.employee?.groups?.[0]?.group?.name,
    id: "groupName",
    header: "グループ",
    cell: ({ getValue }) => {
      const name = getValue<string | undefined>()
      return name ? <Badge variant="outline">{name}</Badge> : "-"
    },
  },
  {
    accessorKey: "shiftCode",
    header: "シフト",
    cell: ({ getValue }) => <ShiftBadge code={getValue<string | null>()} />,
  },
  {
    accessorKey: "startTime",
    header: "開始",
    cell: ({ getValue }) => formatTime(getValue<Date | null>()),
  },
  {
    accessorKey: "endTime",
    header: "終了",
    cell: ({ getValue }) => formatTime(getValue<Date | null>()),
  },
  {
    id: "flags",
    header: "状態",
    cell: ({ row }) => {
      const s = row.original
      return (
        <div className="flex gap-1">
          {s.isHoliday && <Badge variant="destructive">休日</Badge>}
          {s.isRemote && (
            <Badge className="bg-sky-100 text-sky-800 border-0">テレワーク</Badge>
          )}
        </div>
      )
    },
  },
]

type ShiftTableProps = {
  data: ShiftWithEmployee[]
  pageCount: number
  page: number
}

export function ShiftTable({ data, pageCount, page }: ShiftTableProps) {
  const { setParams } = useQueryParams()

  return (
    <DataTable
      columns={columns}
      data={data}
      pageCount={pageCount}
      page={page}
      onPageChange={(p) => setParams({ page: p })}
    />
  )
}
