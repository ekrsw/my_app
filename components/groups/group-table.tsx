"use client"

import { useState } from "react"
import { DataTable } from "@/components/data-table"
import { groupColumns } from "./group-columns"
import { GroupForm } from "./group-form"

type GroupWithCount = {
  id: number
  name: string
  _count: { employeeGroups: number }
}

export function GroupTable({ data }: { data: GroupWithCount[] }) {
  const [selectedGroup, setSelectedGroup] = useState<GroupWithCount | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <DataTable
        columns={groupColumns}
        data={data}
        clientPagination
        pageSize={10}
        onRowClick={(row) => {
          setSelectedGroup(row)
          setDialogOpen(true)
        }}
      />
      <GroupForm
        group={selectedGroup ?? undefined}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setSelectedGroup(null)
        }}
      />
    </>
  )
}
