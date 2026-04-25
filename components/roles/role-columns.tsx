"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import type { FunctionRoleKind } from "@/lib/validators"

type FunctionRoleWithCount = {
  id: number
  roleCode: string
  roleName: string
  roleType: string
  kind: FunctionRoleKind
  isActive: boolean | null
  _count: { employeeRoles: number }
}

const KIND_LABEL: Record<FunctionRoleKind, string> = {
  SUPERVISOR: "監督",
  BUSINESS: "業務",
  OTHER: "その他",
}

const KIND_VARIANT: Record<FunctionRoleKind, "default" | "secondary" | "outline"> = {
  SUPERVISOR: "default",
  BUSINESS: "secondary",
  OTHER: "outline",
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
    header: "ロール名",
  },
  {
    accessorKey: "roleType",
    header: "ロールタイプ",
    cell: ({ getValue }) => {
      const type = getValue<string>()
      return (
        <Badge variant="outline">
          {type}
        </Badge>
      )
    },
  },
  {
    accessorKey: "kind",
    header: "カテゴリ",
    cell: ({ getValue }) => {
      const k = getValue<FunctionRoleKind>()
      return (
        <Badge variant={KIND_VARIANT[k]}>
          {KIND_LABEL[k]}
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
]
