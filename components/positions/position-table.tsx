"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { DataTable } from "@/components/data-table"
import { positionColumns } from "./position-columns"
import { PositionForm } from "./position-form"

type PositionWithCount = {
  id: number
  positionCode: string
  positionName: string
  isActive: boolean | null
  sortOrder: number
  _count: { employeePositions: number }
}

export function PositionTable({ data }: { data: PositionWithCount[] }) {
  const { data: session } = useSession()
  const isAuthenticated = !!session?.user
  const [selectedPosition, setSelectedPosition] = useState<PositionWithCount | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <DataTable
        columns={positionColumns}
        data={data}
        clientPagination
        pageSize={10}
        onRowClick={isAuthenticated ? (row) => {
          setSelectedPosition(row)
          setDialogOpen(true)
        } : undefined}
      />
      {isAuthenticated && <PositionForm
        position={selectedPosition ?? undefined}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setSelectedPosition(null)
        }}
      />}
    </>
  )
}
