import { NextResponse } from "next/server"
import { getShiftCodes } from "@/lib/db/shift-codes"

function formatTime(date: Date | null): string {
  if (!date) return ""
  const h = String(date.getUTCHours()).padStart(2, "0")
  const m = String(date.getUTCMinutes()).padStart(2, "0")
  return `${h}:${m}`
}

export async function GET() {
  const shiftCodes = await getShiftCodes()

  const headers = ["シフトコード", "カラー", "開始時刻", "終了時刻", "休日", "有効", "表示順"]

  const rows = shiftCodes.map((sc) => [
    sc.code,
    sc.color ?? "",
    formatTime(sc.defaultStartTime),
    formatTime(sc.defaultEndTime),
    sc.defaultIsHoliday ? "○" : "×",
    sc.isActive ? "○" : "×",
    sc.sortOrder,
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  const bom = "\uFEFF"
  const now = new Date()
  const filename = `shift_codes_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}.csv`

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
