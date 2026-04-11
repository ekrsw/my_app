"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { DataTable } from "@/components/data-table"
import { groupColumns } from "./group-columns"
import { GroupForm } from "./group-form"

type GroupWithCount = {
  id: number
  name: string
  abbreviatedName: string | null
  _count: { employeeGroups: number }
}

export function GroupTable({ data }: { data: GroupWithCount[] }) {
  const { data: session } = useSession()
  const isAuthenticated = !!session?.user
  const [selectedGroup, setSelectedGroup] = useState<GroupWithCount | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <DataTable
        columns={groupColumns}
        data={data}
        clientPagination
        pageSize={10}
        onRowClick={isAuthenticated ? (row) => {
          setSelectedGroup(row)
          setDialogOpen(true)
        } : undefined}
      />
      {isAuthenticated && <GroupForm
        group={selectedGroup ?? undefined}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setSelectedGroup(null)
        }}
      />}
    </>
  )
}
