import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { formatDate, formatTime } from "@/lib/date-utils"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const year = Number(searchParams.get("year")) || new Date().getFullYear()
  const month = Number(searchParams.get("month")) || new Date().getMonth() + 1
  const groupIdsParam = searchParams.get("groupIds") || searchParams.get("groupId")
  const groupIds = groupIdsParam
    ? groupIdsParam.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
    : []
  const unassigned = searchParams.get("unassigned") === "true"
  const roleIdsParam = searchParams.get("roleIds")
  const roleIds = roleIdsParam
    ? roleIdsParam.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
    : []
  const roleUnassigned = searchParams.get("roleUnassigned") === "true"

  // @db.Date カラムとの比較は UTC 基準のため UTC midnight で生成
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    shiftDate: {
      gte: startDate,
      lte: endDate,
    },
  }

  const empGroupConditions = []
  if (groupIds.length > 0) {
    empGroupConditions.push({ groups: { some: { groupId: { in: groupIds }, endDate: null } } })
  }
  if (unassigned) {
    empGroupConditions.push({ groups: { none: { endDate: null } } })
  }
  if (empGroupConditions.length > 0) {
    where.employee = { OR: empGroupConditions }
  }

  const empRoleConditions = []
  if (roleIds.length > 0) {
    empRoleConditions.push({ functionRoles: { some: { functionRoleId: { in: roleIds }, endDate: null } } })
  }
  if (roleUnassigned) {
    empRoleConditions.push({ functionRoles: { none: { endDate: null } } })
  }
  if (empRoleConditions.length > 0) {
    where.employee = {
      ...(where.employee ?? {}),
      AND: [...(where.employee?.AND ?? []), empRoleConditions.length === 1 ? empRoleConditions[0] : { OR: empRoleConditions }],
    }
  }

  const shifts = await prisma.shift.findMany({
    where,
    include: {
      employee: {
        include: {
          groups: {
            include: { group: true },
            where: { endDate: null },
          },
        },
      },
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
    "テレワーク",
  ]

  const rows = shifts.map((s) => [
    formatDate(s.shiftDate),
    s.employeeId ?? "",
    s.employee?.name ?? "",
    s.employee?.groups?.[0]?.group?.name ?? "",
    s.shiftCode ?? "",
    formatTime(s.startTime),
    formatTime(s.endTime),
    s.isHoliday ? "t" : "f",
    s.isRemote ? "t" : "f",
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
