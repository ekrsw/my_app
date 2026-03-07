import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getShiftCodeInfo } from "@/lib/constants"
import { formatTime } from "@/lib/date-utils"
import type { Shift, Employee, Group, EmployeeGroup } from "@/app/generated/prisma/client"

type TodayShift = Shift & {
  employee: (Employee & { groups: (EmployeeGroup & { group: Group })[] }) | null
}

export function TodayOverviewTable({ shifts }: { shifts: TodayShift[] }) {
  // Group by group name
  const grouped = new Map<string, TodayShift[]>()
  for (const shift of shifts) {
    const key = shift.employee?.groups?.[0]?.group?.name ?? "未所属"
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(shift)
  }

  return (
    <div className="rounded-md border max-h-96 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>グループ</TableHead>
            <TableHead>従業員</TableHead>
            <TableHead>シフト</TableHead>
            <TableHead>時間</TableHead>
            <TableHead>状態</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from(grouped.entries()).map(([groupName, groupShifts]) =>
            groupShifts.map((shift, idx) => {
              const info = getShiftCodeInfo(shift.shiftCode)
              return (
                <TableRow key={shift.id}>
                  {idx === 0 && (
                    <TableCell rowSpan={groupShifts.length} className="font-medium align-top">
                      <Badge variant="outline">{groupName}</Badge>
                    </TableCell>
                  )}
                  <TableCell>{shift.employee?.name ?? "-"}</TableCell>
                  <TableCell>
                    <Badge className={`${info.bgColor} ${info.color} border-0`}>
                      {info.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {shift.startTime
                      ? `${formatTime(shift.startTime)}-${formatTime(shift.endTime)}`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {shift.isRemote && (
                        <Badge className="bg-sky-100 text-sky-800 border-0 text-xs">
                          テレワーク
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
