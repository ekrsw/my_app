"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { DataTable } from "@/components/data-table"
import { dutyAssignmentColumns } from "./duty-assignment-columns"
import { DutyAssignmentForm } from "./duty-assignment-form"
import type { DutyAssignmentWithDetails } from "@/types/duties"

type Employee = { id: string; name: string }
type DutyType = { id: number; code: string; name: string; defaultReducesCapacity: boolean }

type Props = {
  data: DutyAssignmentWithDetails[]
  employees: Employee[]
  dutyTypes: DutyType[]
  defaultDate: string
}

export function DutyAssignmentTable({ data, employees, dutyTypes, defaultDate }: Props) {
  const { data: session } = useSession()
  const isAuthenticated = !!session?.user
  const [selectedRow, setSelectedRow] = useState<DutyAssignmentWithDetails | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <DataTable
        columns={dutyAssignmentColumns}
        data={data}
        clientPagination
        pageSize={20}
        onRowClick={isAuthenticated ? (row) => {
          setSelectedRow(row)
          setDialogOpen(true)
        } : undefined}
      />
      {isAuthenticated && (
        <DutyAssignmentForm
          employees={employees}
          dutyTypes={dutyTypes}
          defaultDate={defaultDate}
          dutyAssignment={selectedRow ?? undefined}
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) setSelectedRow(null)
          }}
        />
      )}
    </>
  )
}
