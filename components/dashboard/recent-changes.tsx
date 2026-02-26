import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/date-utils"
import { ShiftBadge } from "@/components/shifts/shift-badge"
import { ArrowRight } from "lucide-react"
import type { ShiftChangeHistory, Employee, EmployeeGroup, Group } from "@/app/generated/prisma/client"

type RecentChange = ShiftChangeHistory & {
  employee: (Employee & { groups: (EmployeeGroup & { group: Group })[] }) | null
}

export function RecentChanges({ changes }: { changes: RecentChange[] }) {
  if (changes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>最近の変更</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">変更履歴がありません</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>最近の変更</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {changes.map((change) => (
            <div
              key={change.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {change.employee?.name ?? "不明"}
                  </span>
                  <Badge
                    variant={change.changeType === "DELETE" ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {change.changeType}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{formatDate(change.shiftDate)}</span>
                  <ShiftBadge code={change.shiftCode} />
                  {change.changeType === "UPDATE" && change.newShiftCode !== null && change.shiftCode !== change.newShiftCode && (
                    <>
                      <ArrowRight className="h-3 w-3" />
                      <ShiftBadge code={change.newShiftCode} />
                    </>
                  )}
                  {change.changeType === "DELETE" && (
                    <span className="text-destructive text-xs">削除</span>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDate(change.changedAt, "MM/dd HH:mm")}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
