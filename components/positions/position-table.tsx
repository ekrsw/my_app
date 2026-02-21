"use client"

import { DataTable } from "@/components/data-table"
import { positionColumns } from "./position-columns"

type PositionWithCount = {
  id: number
  positionCode: string
  positionName: string
  isActive: boolean | null
  sortOrder: number
  _count: { employeePositions: number }
}

export function PositionTable({ data }: { data: PositionWithCount[] }) {
  return <DataTable columns={positionColumns} data={data} clientPagination pageSize={10} />
}
