"use client"

import { useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import { ShiftDailyFilters } from "@/components/shifts/shift-daily-filters"
import { ShiftBadge } from "@/components/shifts/shift-badge"
import { ShiftForm } from "@/components/shifts/shift-form"
import { useQueryParams } from "@/hooks/use-query-params"
import { formatTime } from "@/lib/date-utils"
import type { ShiftDailyRow } from "@/types/shifts"
import { Circle, Check } from "lucide-react"

type Group = { id: number; name: string }
type ShiftCodeOption = {
  id: number
  code: string
  color: string | null
  defaultStartTime: Date | null
  defaultEndTime: Date | null
  defaultIsHoliday: boolean
  isActive: boolean | null
  sortOrder: number
}

type ShiftDailyViewProps = {
  data: ShiftDailyRow[]
  total: number
  page: number
  totalPages: number
  dailyDate: string
  groups: Group[]
  shiftCodes: ShiftCodeOption[]
  groupIds: number[]
  unassigned: boolean
  selectedShiftCodes: string[]
  search: string
  startTimeFrom: string
  endTimeTo: string
}

const columns: ColumnDef<ShiftDailyRow>[] = [
  {
    accessorKey: "employeeName",
    header: "従業員名",
  },
  {
    accessorKey: "groupName",
    header: "グループ",
    cell: ({ row }) => row.original.groupName ?? "-",
  },
  {
    accessorKey: "shiftCode",
    header: "シフトコード",
    cell: ({ row }) => <ShiftBadge code={row.original.shiftCode} />,
  },
  {
    accessorKey: "startTime",
    header: "開始時刻",
    cell: ({ row }) => formatTime(row.original.startTime),
  },
  {
    accessorKey: "endTime",
    header: "終了時刻",
    cell: ({ row }) => formatTime(row.original.endTime),
  },
  {
    accessorKey: "isHoliday",
    header: "休日",
    cell: ({ row }) =>
      row.original.isHoliday ? (
        <Check className="h-4 w-4 text-red-500" />
      ) : null,
  },
  {
    accessorKey: "isRemote",
    header: "テレワーク",
    cell: ({ row }) =>
      row.original.isRemote ? (
        <Circle className="h-4 w-4 text-sky-500 fill-sky-500" />
      ) : null,
  },
]

export function ShiftDailyView({
  data,
  total,
  page,
  totalPages,
  dailyDate,
  groups,
  shiftCodes,
  groupIds,
  unassigned,
  selectedShiftCodes,
  search,
  startTimeFrom,
  endTimeTo,
}: ShiftDailyViewProps) {
  const { setParams } = useQueryParams()
  const [editOpen, setEditOpen] = useState(false)
  const [editRow, setEditRow] = useState<ShiftDailyRow | null>(null)

  const handleRowClick = (row: ShiftDailyRow) => {
    setEditRow(row)
    setEditOpen(true)
  }

  const handlePageChange = (newPage: number) => {
    setParams({ dailyPage: newPage === 1 ? null : newPage })
  }

  const editShift = editRow?.shiftId
    ? {
        id: editRow.shiftId,
        employeeId: editRow.employeeId,
        shiftDate: new Date(dailyDate),
        shiftCode: editRow.shiftCode,
        startTime: editRow.startTime,
        endTime: editRow.endTime,
        isHoliday: editRow.isHoliday,
        isRemote: editRow.isRemote,
      }
    : undefined

  return (
    <div>
      <ShiftDailyFilters
        groups={groups}
        shiftCodes={shiftCodes.map((sc) => ({ code: sc.code, color: sc.color }))}
        dailyDate={dailyDate}
        groupIds={groupIds}
        unassigned={unassigned}
        selectedShiftCodes={selectedShiftCodes}
        search={search}
        startTimeFrom={startTimeFrom}
        endTimeTo={endTimeTo}
      />

      <p className="text-sm text-muted-foreground mb-2">
        {total}件の従業員
      </p>

      <DataTable
        columns={columns}
        data={data}
        pageCount={totalPages}
        page={page}
        onPageChange={handlePageChange}
        onRowClick={handleRowClick}
      />

      <ShiftForm
        key={`${editRow?.shiftId ?? "new"}-${editRow?.employeeId}-${dailyDate}`}
        open={editOpen}
        onOpenChange={setEditOpen}
        shift={editShift}
        employeeId={editRow?.employeeId}
        date={dailyDate}
        shiftCodes={shiftCodes}
      />
    </div>
  )
}
