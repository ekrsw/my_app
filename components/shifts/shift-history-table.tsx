"use client"

import { useState } from "react"
import { DataTable } from "@/components/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ShiftBadge } from "./shift-badge"
import { ShiftVersionCompare } from "./shift-version-compare"
import { formatDate } from "@/lib/date-utils"
import { useQueryParams } from "@/hooks/use-query-params"
import { History, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { deleteShiftHistory } from "@/lib/actions/shift-actions"
import { toast } from "sonner"
import type { ShiftHistoryEntry } from "@/types/shifts"

function ShiftHistoryDeleteButton({ id }: { id: number }) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const result = await deleteShiftHistory(id)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("変更履歴を削除しました")
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>変更履歴の削除</AlertDialogTitle>
          <AlertDialogDescription>
            この変更履歴を削除してもよろしいですか？この操作は取り消せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={loading}>
            {loading ? "削除中..." : "削除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ActionsCell({ row }: { row: ShiftHistoryEntry }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <History className="h-3 w-3 mr-1" />
        履歴
      </Button>
      <ShiftHistoryDeleteButton id={row.id} />
      <ShiftVersionCompare
        open={open}
        onOpenChange={setOpen}
        shiftId={row.shiftId}
        employeeName={row.employee?.name ?? "不明"}
      />
    </div>
  )
}

const columns: ColumnDef<ShiftHistoryEntry>[] = [
  {
    accessorKey: "changedAt",
    header: "変更日時",
    cell: ({ getValue }) => formatDate(getValue<Date>(), "yyyy/MM/dd HH:mm"),
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
      if (entry.newShiftCode === null) {
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
