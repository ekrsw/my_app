import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/date-utils"
import { ShiftBadge } from "@/components/shifts/shift-badge"
import type { ShiftChangeHistory, Shift, Employee, Group } from "@/app/generated/prisma/client"

type RecentChange = ShiftChangeHistory & {
  shift: Shift & {
    employee: (Employee & { group: Group | null }) | null
  }
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
                    {change.shift.employee?.name ?? "不明"}
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
