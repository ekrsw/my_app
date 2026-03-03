"use client"

import { useRouter } from "next/navigation"
import { DataTable } from "@/components/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { ShiftBadge } from "./shift-badge"
import { formatDate } from "@/lib/date-utils"
import { useQueryParams } from "@/hooks/use-query-params"
import type { ShiftHistoryEntry } from "@/types/shifts"

const columns: ColumnDef<ShiftHistoryEntry>[] = [
  {
    accessorFn: (row) => row.employee?.name,
    id: "employeeName",
    header: "従業員",
  },
  {
    accessorKey: "shiftDate",
    header: "シフト日",
    cell: ({ getValue }) => formatDate(getValue<Date>()),
  },
  {
    id: "changeContent",
    header: "変更内容",
    cell: ({ row }) => {
      const entry = row.original
      return (
        <div className="flex items-center gap-1.5">
          <ShiftBadge code={entry.shiftCode} />
          <span className="text-muted-foreground">→</span>
          {entry.newShiftCode === null ? (
            <span className="text-xs text-muted-foreground">削除</span>
          ) : (
            <ShiftBadge code={entry.newShiftCode} />
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "note",
    header: "備考",
    cell: ({ getValue }) => {
      const note = getValue<string | null>()
      return note ? (
        <span className="text-sm">{note}</span>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      )
    },
  },
  {
    accessorKey: "changedAt",
    header: "変更日時",
    cell: ({ getValue }) => formatDate(getValue<Date>(), "yyyy/MM/dd HH:mm"),
  },
]

type ShiftHistoryTableProps = {
  data: ShiftHistoryEntry[]
  pageCount: number
  page: number
}

export function ShiftHistoryTable({ data, pageCount, page }: ShiftHistoryTableProps) {
  const { setParams } = useQueryParams()
  const router = useRouter()

  return (
    <DataTable
      columns={columns}
      data={data}
      pageCount={pageCount}
      page={page}
      onPageChange={(p) => setParams({ page: p })}
      onRowClick={(row) => router.push(`/shifts/history/${row.id}`)}
    />
  )
}
