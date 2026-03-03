import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/date-utils"
import { ROLE_TYPE_LABELS } from "@/lib/constants"
import type { EmployeeWithDetails } from "@/types/employees"

export function EmployeeDetailCard({ employee }: { employee: EmployeeWithDetails }) {
  const isActive = !employee.terminationDate || employee.terminationDate >= new Date()
  const currentRoles = employee.functionRoles.filter((r) => !r.endDate)
  const currentPositions = employee.positions.filter((p) => !p.endDate)
  const currentGroups = employee.groups.filter((g) => !g.endDate)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">{employee.name}</CardTitle>
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "在籍中" : "退職済"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div className="col-span-2">
            <dt className="text-muted-foreground">従業員ID</dt>
            <dd className="font-mono text-xs">{employee.id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">カナ</dt>
            <dd className="font-medium">{employee.nameKana ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">グループ</dt>
            <dd className="font-medium">
              {currentGroups.length === 0 ? (
                "-"
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {currentGroups.map((g) => (
                    <Badge key={g.id} variant="outline">
                      {g.group.name}
                    </Badge>
                  ))}
                </div>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">入社日</dt>
            <dd className="font-medium">{formatDate(employee.hireDate)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">退職日</dt>
            <dd className="font-medium">{formatDate(employee.terminationDate)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground mb-1">現在の役職</dt>
            <dd className="font-medium">
              {currentPositions.length === 0 ? (
                <span className="text-muted-foreground">-</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {currentPositions.map((p) => (
                    <Badge key={p.id} variant="outline">
                      {p.position.positionName}
                    </Badge>
                  ))}
                </div>
              )}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground mb-1">現在の役割</dt>
            <dd className="font-medium">
              {currentRoles.length === 0 ? (
                <span className="text-muted-foreground">-</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {currentRoles.map((r) => (
                    <Badge key={r.id} variant="outline">
                      {r.functionRole?.roleName ?? "-"}
                      {r.isPrimary && (
                        <span className="ml-1 text-xs text-primary">(主)</span>
                      )}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {ROLE_TYPE_LABELS[r.roleType] ?? r.roleType}
                      </span>
                    </Badge>
                  ))}
                </div>
              )}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
