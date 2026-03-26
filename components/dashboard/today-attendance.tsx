import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/date-utils"
import { ShiftBadge } from "@/components/shifts/shift-badge"
import { ArrowRight } from "lucide-react"
import type { ShiftChangeHistory, Employee, EmployeeGroup, Group } from "@/app/generated/prisma/client"

type TodayChange = ShiftChangeHistory & {
  employee: (Employee & { groups: (EmployeeGroup & { group: Group })[] }) | null
}

export function TodayAttendance({ changes }: { changes: TodayChange[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>本日の勤怠 ({changes.length}件)</CardTitle>
      </CardHeader>
      <CardContent>
        {changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">本日の変更はありません</p>
        ) : (
          <div className="max-h-96 overflow-auto space-y-3">
            {changes.map((change) => (
              <div
                key={change.id}
                className="flex items-start justify-between rounded-md border p-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {change.employee?.name ?? "不明"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{formatDate(change.shiftDate)}</span>
                    <ShiftBadge code={change.shiftCode} />
                    {change.isRemote && <span className="text-xs text-sky-600 font-medium">TW</span>}
                    {change.newShiftCode !== null && (change.shiftCode !== change.newShiftCode || change.isRemote !== change.newIsRemote) && (
                      <>
                        <ArrowRight className="h-3 w-3" />
                        <ShiftBadge code={change.newShiftCode} />
                        {change.newIsRemote && <span className="text-xs text-sky-600 font-medium">TW</span>}
                      </>
                    )}
                    {change.newShiftCode === null && (
                      <span className="text-destructive text-xs">削除</span>
                    )}
                  </div>
                  {change.note && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                      備考: {change.note}
                    </p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {formatDate(change.changedAt, "HH:mm")}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
