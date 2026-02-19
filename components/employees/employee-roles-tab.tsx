"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/date-utils"
import { ROLE_TYPE_LABELS } from "@/lib/constants"
import { EmployeeRoleForm } from "@/components/employees/employee-role-form"
import { EmployeeRoleEditForm } from "@/components/employees/employee-role-edit-form"
import { unassignRole } from "@/lib/actions/role-actions"
import { toast } from "sonner"
import { XCircle } from "lucide-react"
import type { EmployeeWithDetails } from "@/types/employees"
import type { FunctionRole } from "@/app/generated/prisma/client"

type EmployeeRolesTabProps = {
  employee: EmployeeWithDetails
  allRoles: FunctionRole[]
}

export function EmployeeRolesTab({ employee, allRoles }: EmployeeRolesTabProps) {
  const { functionRoles } = employee

  async function handleEndRole(roleId: number, roleName: string) {
    if (!confirm(`「${roleName}」の割当を終了しますか？`)) {
      return
    }
    const result = await unassignRole(roleId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("役割の割当を終了しました")
    }
  }

  // Separate current and past roles
  const currentRoles = functionRoles.filter((role) => !role.endDate)
  const pastRoles = functionRoles.filter((role) => role.endDate)

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">現在の役割</h3>
          <EmployeeRoleForm employeeId={employee.id} roles={allRoles} />
        </div>
        {currentRoles.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">役割が割り当てられていません</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>役割名</TableHead>
                  <TableHead>分類</TableHead>
                  <TableHead>主担当</TableHead>
                  <TableHead>開始日</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      {role.functionRole?.roleName ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ROLE_TYPE_LABELS[role.roleType] ?? role.roleType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {role.isPrimary ? <Badge>主担当</Badge> : "-"}
                    </TableCell>
                    <TableCell>{formatDate(role.startDate)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EmployeeRoleEditForm employeeRole={role} />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEndRole(role.id, role.functionRole?.roleName ?? "役割")}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {pastRoles.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">役割変更履歴</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>役割名</TableHead>
                  <TableHead>分類</TableHead>
                  <TableHead>主担当</TableHead>
                  <TableHead>開始日</TableHead>
                  <TableHead>終了日</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium text-muted-foreground">
                      {role.functionRole?.roleName ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ROLE_TYPE_LABELS[role.roleType] ?? role.roleType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {role.isPrimary ? <Badge variant="outline">主担当</Badge> : "-"}
                    </TableCell>
                    <TableCell>{formatDate(role.startDate)}</TableCell>
                    <TableCell>{formatDate(role.endDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
