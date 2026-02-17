import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/date-utils"
import { ROLE_TYPE_LABELS } from "@/lib/constants"
import type { EmployeeWithDetails } from "@/types/employees"

export function EmployeeRolesTab({ employee }: { employee: EmployeeWithDetails }) {
  const { functionRoles } = employee

  if (functionRoles.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">役割が割り当てられていません</p>
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>役割名</TableHead>
            <TableHead>分類</TableHead>
            <TableHead>主担当</TableHead>
            <TableHead>開始日</TableHead>
            <TableHead>終了日</TableHead>
            <TableHead>状態</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {functionRoles.map((role) => (
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
              <TableCell>{formatDate(role.endDate)}</TableCell>
              <TableCell>
                <Badge variant={role.endDate ? "secondary" : "default"}>
                  {role.endDate ? "終了" : "現行"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
