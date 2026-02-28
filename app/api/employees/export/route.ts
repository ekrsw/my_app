import { NextRequest, NextResponse } from "next/server"
import { getEmployeesForExport } from "@/lib/db/employees"
import { formatDate } from "@/lib/date-utils"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const groupId = searchParams.get("groupId") ? Number(searchParams.get("groupId")) : undefined
  const activeOnly = searchParams.get("activeOnly") === "true"

  const employees = await getEmployeesForExport({ groupId, activeOnly })

  const headers = ["従業員ID", "従業員名", "フリガナ", "入社日", "退職日", "グループ"]

  const rows = employees.map((e) => [
    e.id,
    e.name,
    e.nameKana ?? "",
    e.hireDate ? formatDate(e.hireDate) : "",
    e.terminationDate ? formatDate(e.terminationDate) : "",
    e.groups.map((g) => g.group.name).join("|"),
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  const bom = "\uFEFF"
  const now = new Date()
  const filename = `employees_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}.csv`

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
