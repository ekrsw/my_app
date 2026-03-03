"use client"

import { DataTable } from "@/components/data-table"
import { groupColumns } from "./group-columns"

type GroupWithCount = {
  id: number
  name: string
  _count: { employeeGroups: number }
}

export function GroupTable({ data }: { data: GroupWithCount[] }) {
  return <DataTable columns={groupColumns} data={data} clientPagination pageSize={10} />
}
