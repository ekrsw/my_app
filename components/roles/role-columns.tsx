"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { RoleForm, RoleDeleteButton } from "./role-form"

const ROLE_TYPE_LABELS: Record<string, string> = {
  FUNCTION: "業務役割",
  AUTHORITY: "監督権限",
  POSITION: "役職",
}

const ROLE_TYPE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  FUNCTION: "default",
  AUTHORITY: "secondary",
  POSITION: "outline",
}

type FunctionRoleWithCount = {
  id: number
  roleCode: string
  roleName: string
  roleType: string
  isActive: boolean | null
  _count: { employeeRoles: number }
}

export const roleColumns: ColumnDef<FunctionRoleWithCount>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "roleCode",
    header: "コード",
    cell: ({ getValue }) => (
      <code className="rounded bg-muted px-1.5 py-0.5 text-sm">{getValue<string>()}</code>
    ),
  },
  {
    accessorKey: "roleName",
    header: "役割名",
  },
  {
    accessorKey: "roleType",
    header: "分類",
    cell: ({ getValue }) => {
      const type = getValue<string>()
      return (
        <Badge variant={ROLE_TYPE_VARIANTS[type] ?? "default"}>
          {ROLE_TYPE_LABELS[type] ?? type}
        </Badge>
      )
    },
  },
  {
    accessorKey: "isActive",
    header: "状態",
    cell: ({ getValue }) => (
      <Badge variant={getValue<boolean>() ? "default" : "secondary"}>
        {getValue<boolean>() ? "有効" : "無効"}
      </Badge>
    ),
  },
  {
    accessorFn: (row) => row._count.employeeRoles,
    id: "assignedCount",
    header: "割当数",
    cell: ({ getValue }) => `${getValue<number>()}名`,
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <RoleForm role={row.original} />
        <RoleDeleteButton id={row.original.id} />
      </div>
    ),
  },
]
