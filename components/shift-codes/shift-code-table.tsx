"use client"

import { DataTable } from "@/components/data-table"
import { shiftCodeColumns } from "./shift-code-columns"

type ShiftCodeRow = {
  id: number
  code: string
  defaultStartTime: Date | null
  defaultEndTime: Date | null
  defaultIsHoliday: boolean
  defaultIsPaidLeave: boolean
  isActive: boolean | null
  sortOrder: number
}

export function ShiftCodeTable({ data }: { data: ShiftCodeRow[] }) {
  return <DataTable columns={shiftCodeColumns} data={data} clientPagination pageSize={10} />
}
