"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { DataTable } from "@/components/data-table"
import { dutyTypeColumns, type DutyTypeRow } from "./duty-type-columns"
import { DutyTypeForm } from "./duty-type-form"

export function DutyTypeTable({ data }: { data: DutyTypeRow[] }) {
  const { data: session } = useSession()
  const isAuthenticated = !!session?.user
  const [selectedDutyType, setSelectedDutyType] = useState<DutyTypeRow | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <DataTable
        columns={dutyTypeColumns}
        data={data}
        clientPagination
        pageSize={10}
        onRowClick={isAuthenticated ? (row) => {
          setSelectedDutyType(row)
          setDialogOpen(true)
        } : undefined}
      />
      {isAuthenticated && <DutyTypeForm
        dutyType={selectedDutyType ?? undefined}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setSelectedDutyType(null)
        }}
      />}
    </>
  )
}
