"use client"

import { useRouter } from "next/navigation"
import { DataTable } from "@/components/data-table"
import { employeeColumns } from "./employee-columns"
import type { EmployeeWithGroups } from "@/types/employees"
import { useQueryParams } from "@/hooks/use-query-params"
import { employeeDetail } from "@/lib/routes"

type EmployeeTableProps = {
  data: EmployeeWithGroups[]
  pageCount: number
  page: number
}

export function EmployeeTable({ data, pageCount, page }: EmployeeTableProps) {
  const router = useRouter()
  const { setParams } = useQueryParams()

  return (
    <DataTable
      columns={employeeColumns}
      data={data}
      pageCount={pageCount}
      page={page}
      onPageChange={(p) => setParams({ page: p })}
      onRowClick={(row) => router.push(employeeDetail(row.id))}
    />
  )
}
