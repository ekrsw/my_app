import { NextRequest, NextResponse } from "next/server"
import { getRoleAssignmentsForExport } from "@/lib/db/roles"
import { formatDate } from "@/lib/date-utils"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const activeOnly = searchParams.get("activeOnly") === "true"

  const assignments = await getRoleAssignmentsForExport({ activeOnly })

  const headers = ["従業員名", "ロールコード", "主担当", "開始日", "終了日"]

  const rows = assignments.map((a) => [
    a.employee!.name,
    a.functionRole!.roleCode,
    a.isPrimary ? "true" : "false",
    a.startDate ? formatDate(a.startDate) : "",
    a.endDate ? formatDate(a.endDate) : "",
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  const bom = "\uFEFF"
  const now = new Date()
  const filename = `role_assignments_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}.csv`

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
