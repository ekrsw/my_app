"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
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
  const { data: session } = useSession()
  const isAuthenticated = !!session?.user
  const [selectedRole, setSelectedRole] = useState<FunctionRoleWithCount | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <DataTable
        columns={roleColumns}
        data={data}
        clientPagination
        pageSize={10}
        onRowClick={isAuthenticated ? (row) => {
          setSelectedRole(row)
          setDialogOpen(true)
        } : undefined}
      />
      {isAuthenticated && <RoleForm
        role={selectedRole ?? undefined}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setSelectedRole(null)
        }}
      />}
    </>
  )
}
