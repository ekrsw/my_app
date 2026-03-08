"use client"

import { useState } from "react"
import { DataTable } from "@/components/data-table"
import { roleColumns } from "./role-columns"
import { RoleForm } from "./role-form"

type FunctionRoleWithCount = {
  id: number
  roleCode: string
  roleName: string
  roleType: string
  isActive: boolean | null
  _count: { employeeRoles: number }
}

export function RoleTable({ data }: { data: FunctionRoleWithCount[] }) {
  const [selectedRole, setSelectedRole] = useState<FunctionRoleWithCount | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <DataTable
        columns={roleColumns}
        data={data}
        clientPagination
        pageSize={10}
        onRowClick={(row) => {
          setSelectedRole(row)
          setDialogOpen(true)
        }}
      />
      <RoleForm
        role={selectedRole ?? undefined}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setSelectedRole(null)
        }}
      />
    </>
  )
}
