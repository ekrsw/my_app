"use client"

import { DataTable } from "@/components/data-table"
import { roleColumns } from "./role-columns"

type FunctionRoleWithCount = {
  id: number
  roleCode: string
  roleName: string
  roleType: string
  isActive: boolean | null
  _count: { employeeRoles: number }
}

export function RoleTable({ data }: { data: FunctionRoleWithCount[] }) {
  return <DataTable columns={roleColumns} data={data} clientPagination pageSize={10} />
}
