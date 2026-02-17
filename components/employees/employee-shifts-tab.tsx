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
import { formatDate, formatTime } from "@/lib/date-utils"
import { prisma } from "@/lib/prisma"

export async function EmployeeShiftsTab({ employeeId }: { employeeId: number }) {
  const shifts = await prisma.shift.findMany({
    where: { employeeId },
    orderBy: { shiftDate: "desc" },
    take: 50,
  })

  if (shifts.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">シフトデータがありません</p>
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>日付</TableHead>
            <TableHead>シフト</TableHead>
            <TableHead>開始</TableHead>
            <TableHead>終了</TableHead>
            <TableHead>状態</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shifts.map((shift) => {
            const codeInfo = getShiftCodeInfo(shift.shiftCode)
            return (
              <TableRow key={shift.id}>
                <TableCell>{formatDate(shift.shiftDate)}</TableCell>
                <TableCell>
                  <Badge className={`${codeInfo.bgColor} ${codeInfo.color} border-0`}>
                    {codeInfo.label}
                  </Badge>
                </TableCell>
                <TableCell>{formatTime(shift.startTime)}</TableCell>
                <TableCell>{formatTime(shift.endTime)}</TableCell>
                <TableCell className="flex gap-1">
                  {shift.isHoliday && <Badge variant="destructive">休日</Badge>}
                  {shift.isPaidLeave && (
                    <Badge className="bg-green-100 text-green-800 border-0">有給</Badge>
                  )}
                  {shift.isRemote && (
                    <Badge className="bg-sky-100 text-sky-800 border-0">テレワーク</Badge>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
