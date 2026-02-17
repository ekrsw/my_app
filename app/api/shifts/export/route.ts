import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { formatDate, formatTime } from "@/lib/date-utils"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const year = Number(searchParams.get("year")) || new Date().getFullYear()
  const month = Number(searchParams.get("month")) || new Date().getMonth() + 1
  const groupId = searchParams.get("groupId") ? Number(searchParams.get("groupId")) : undefined

  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    shiftDate: {
      gte: startDate,
      lte: endDate,
    },
  }

  if (groupId) {
    where.employee = { groupId }
  }

  const shifts = await prisma.shift.findMany({
    where,
    include: {
      employee: { include: { group: true } },
    },
    orderBy: [{ shiftDate: "asc" }, { employee: { name: "asc" } }],
  })

  const headers = [
    "日付",
    "従業員ID",
    "従業員名",
    "グループ",
    "シフトコード",
    "開始時刻",
    "終了時刻",
    "休日",
    "有給",
    "テレワーク",
  ]

  const rows = shifts.map((s) => [
    formatDate(s.shiftDate),
    s.employeeId ?? "",
    s.employee?.name ?? "",
    s.employee?.group?.name ?? "",
    s.shiftCode ?? "",
    formatTime(s.startTime),
    formatTime(s.endTime),
    s.isHoliday ? "○" : "",
    s.isPaidLeave ? "○" : "",
    s.isRemote ? "○" : "",
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  const bom = "\uFEFF"
  const filename = `shifts_${year}${String(month).padStart(2, "0")}.csv`

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
