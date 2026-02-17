import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/date-utils"
import type { EmployeeWithDetails } from "@/types/employees"

export function EmployeeDetailCard({ employee }: { employee: EmployeeWithDetails }) {
  const isActive = !employee.terminationDate || employee.terminationDate >= new Date()

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
          <div>
            <dt className="text-muted-foreground">カナ</dt>
            <dd className="font-medium">{employee.nameKana ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">グループ</dt>
            <dd className="font-medium">
              {employee.group ? (
                <Badge variant="outline">{employee.group.name}</Badge>
              ) : (
                "-"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">配属日</dt>
            <dd className="font-medium">{formatDate(employee.assignmentDate)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">退職日</dt>
            <dd className="font-medium">{formatDate(employee.terminationDate)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
