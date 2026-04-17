import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { formatDate, formatTime } from "@/lib/date-utils"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const year = Number(searchParams.get("year")) || new Date().getFullYear()
  const month = Number(searchParams.get("month")) || new Date().getMonth() + 1
  const dutyTypeIdsParam = searchParams.get("dutyTypeIds")
  const dutyTypeIds = dutyTypeIdsParam
    ? dutyTypeIdsParam.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
    : []

  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    dutyDate: {
      gte: startDate,
      lte: endDate,
    },
  }

  if (dutyTypeIds.length > 0) {
    where.dutyTypeId = { in: dutyTypeIds }
  }

  const assignments = await prisma.dutyAssignment.findMany({
    where,
    include: {
      employee: true,
      dutyType: true,
    },
    orderBy: [{ dutyDate: "asc" }, { employee: { name: "asc" } }, { startTime: "asc" }],
  })

  const headers = [
    "日付",
    "従業員名",
    "業務種別",
    "開始時刻",
    "終了時刻",
    "タイトル",
    "メモ",
    "キャパシティ減少",
  ]

  const rows = assignments.map((a) => [
    formatDate(a.dutyDate),
    a.employee?.name ?? "",
    a.dutyType?.name ?? "",
    formatTime(a.startTime),
    formatTime(a.endTime),
    a.title ?? "",
    a.note ?? "",
    a.reducesCapacity ? "true" : "false",
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  const bom = "\uFEFF"
  const filename = `duty_assignments_${year}${String(month).padStart(2, "0")}.csv`

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
