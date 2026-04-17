import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const activeOnly = searchParams.get("activeOnly") === "true"

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (activeOnly) {
    where.isActive = true
  }

  const dutyTypes = await prisma.dutyType.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })

  const headers = [
    "業務名",
    "色",
    "有効",
    "表示順",
    "キャパシティ減少",
    "デフォルト開始時刻",
    "デフォルト終了時刻",
    "デフォルトタイトル",
    "デフォルトメモ",
  ]

  const rows = dutyTypes.map((dt) => [
    dt.name,
    dt.color ?? "",
    dt.isActive ? "true" : "false",
    dt.sortOrder,
    dt.defaultReducesCapacity ? "true" : "false",
    dt.defaultStartTime ?? "",
    dt.defaultEndTime ?? "",
    dt.defaultTitle ?? "",
    dt.defaultNote ?? "",
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  const bom = "\uFEFF"
  const now = new Date()
  const filename = `duty_types_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}.csv`

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
