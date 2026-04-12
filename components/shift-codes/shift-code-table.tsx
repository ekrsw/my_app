"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { DataTable } from "@/components/data-table"
import { shiftCodeColumns } from "./shift-code-columns"
import { ShiftCodeForm } from "./shift-code-form"

type ShiftCodeRow = {
  id: number
  code: string
  color: string | null
  defaultStartTime: Date | null
  defaultEndTime: Date | null
  defaultIsHoliday: boolean
  isActive: boolean | null
  sortOrder: number
  defaultLunchBreakStart: Date | null
  defaultLunchBreakEnd: Date | null
}

export function ShiftCodeTable({ data }: { data: ShiftCodeRow[] }) {
  const { data: session } = useSession()
  const isAuthenticated = !!session?.user
  const [selectedShiftCode, setSelectedShiftCode] = useState<ShiftCodeRow | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <DataTable
        columns={shiftCodeColumns}
        data={data}
        clientPagination
        pageSize={10}
        onRowClick={isAuthenticated ? (row) => {
          setSelectedShiftCode(row)
          setDialogOpen(true)
        } : undefined}
      />
      {isAuthenticated && <ShiftCodeForm
        shiftCode={selectedShiftCode ?? undefined}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setSelectedShiftCode(null)
        }}
      />}
    </>
  )
}
