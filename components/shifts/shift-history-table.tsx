"use client"

import { useState } from "react"
import { DataTable } from "@/components/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShiftBadge } from "./shift-badge"
import { ShiftVersionCompare } from "./shift-version-compare"
import { formatDate } from "@/lib/date-utils"
import { useQueryParams } from "@/hooks/use-query-params"
import { ArrowRight, History } from "lucide-react"
import type { ShiftHistoryEntry } from "@/types/shifts"

function ActionsCell({ row }: { row: ShiftHistoryEntry }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <History className="h-3 w-3 mr-1" />
        履歴
      </Button>
      <ShiftVersionCompare
        open={open}
        onOpenChange={setOpen}
        shiftId={row.shiftId}
        employeeName={row.employee?.name ?? "不明"}
      />
    </>
  )
}

const columns: ColumnDef<ShiftHistoryEntry>[] = [
  {
    accessorKey: "changedAt",
    header: "変更日時",
    cell: ({ getValue }) => formatDate(getValue<Date>(), "yyyy/MM/dd HH:mm"),
  },
  {
    accessorKey: "changeType",
    header: "種別",
    cell: ({ getValue }) => {
      const type = getValue<string>()
      return (
        <Badge variant={type === "DELETE" ? "destructive" : "secondary"}>
          {type}
        </Badge>
      )
    },
  },
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
    accessorKey: "shiftCode",
    header: "変更前シフト",
    cell: ({ getValue }) => <ShiftBadge code={getValue<string | null>()} />,
  },
  {
    id: "newShiftCode",
    header: "変更後シフト",
    cell: ({ row }) => {
      const entry = row.original
      if (entry.changeType === "DELETE") {
        return <span className="text-xs text-muted-foreground">削除</span>
      }
      return <ShiftBadge code={entry.newShiftCode} />
    },
  },
  {
    accessorKey: "version",
    header: "Ver",
    cell: ({ getValue }) => `v${getValue<number>()}`,
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => <ActionsCell row={row.original} />,
  },
]

type ShiftHistoryTableProps = {
  data: ShiftHistoryEntry[]
  pageCount: number
  page: number
}

export function ShiftHistoryTable({ data, pageCount, page }: ShiftHistoryTableProps) {
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
