import { prisma } from "@/lib/prisma"
import type { ShiftImportRow } from "@/lib/actions/shift-actions"

export type ImportRowError = { rowIndex: number; error: string }

export type ResolveImportResult = {
  // 従業員が解決・存在確認できた行（employeeId は解決済みの実IDに置換済み）
  validRows: Array<ShiftImportRow & { rowIndex: number }>
  // 従業員名が見つからない / 複数該当 / 従業員IDが存在しない 行のエラー
  errors: ImportRowError[]
}

/**
 * インポート行の従業員を解決・存在確認する共有ロジック。
 *
 *   rows ──▶ 名前→ID解決 ──▶ ID存在チェック ──▶ { validRows, errors }
 *             │ 複数該当 → error      │ 不存在 → error
 *             └ 見つからない → error
 *
 * importShifts（本実行）と validateShiftImport（プレビュー事前検証）の両方が
 * この関数を使うことで、「プレビューで出るエラー」と「実行後に出るエラー」が一致する。
 * インフラ障害（DB接続等）は例外として呼び出し側に伝播する。
 */
export async function resolveImportShiftRows(
  rows: Array<ShiftImportRow & { rowIndex: number }>
): Promise<ResolveImportResult> {
  const errors: ImportRowError[] = []

  // 従業員名→ID解決
  const nameOnlyRows = rows.filter((r) => r.employeeId === "" && r.employeeName)
  const uniqueNames = [...new Set(nameOnlyRows.map((r) => r.employeeName!))]
  const nameToIdMap = new Map<string, string>()
  const duplicateNames = new Set<string>()

  if (uniqueNames.length > 0) {
    const employeesByName = await prisma.employee.findMany({
      where: { name: { in: uniqueNames } },
      select: { id: true, name: true },
    })

    const nameCountMap = new Map<string, Array<{ id: string }>>()
    for (const emp of employeesByName) {
      const list = nameCountMap.get(emp.name) || []
      list.push({ id: emp.id })
      nameCountMap.set(emp.name, list)
    }

    for (const [name, emps] of nameCountMap) {
      if (emps.length === 1) {
        nameToIdMap.set(name, emps[0].id)
      } else {
        duplicateNames.add(name)
      }
    }
  }

  // 従業員名でID解決し、解決済み行を構築
  const resolvedRows: Array<ShiftImportRow & { rowIndex: number }> = []
  for (const row of rows) {
    if (row.employeeId === "" && row.employeeName) {
      if (duplicateNames.has(row.employeeName)) {
        errors.push({
          rowIndex: row.rowIndex,
          error: `従業員名 '${row.employeeName}' に該当する従業員が複数存在します。従業員IDを指定してください`,
        })
        continue
      }
      const resolvedId = nameToIdMap.get(row.employeeName)
      if (!resolvedId) {
        errors.push({
          rowIndex: row.rowIndex,
          error: `従業員名 '${row.employeeName}' に該当する従業員が見つかりません`,
        })
        continue
      }
      resolvedRows.push({ ...row, employeeId: resolvedId })
    } else {
      resolvedRows.push(row)
    }
  }

  // 従業員IDの存在チェック
  const employeeIds = [...new Set(resolvedRows.map((r) => r.employeeId))]
  const existingEmployees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true },
  })
  const existingEmployeeIds = new Set(existingEmployees.map((e) => e.id))

  const validRows: Array<ShiftImportRow & { rowIndex: number }> = []
  for (const row of resolvedRows) {
    if (!existingEmployeeIds.has(row.employeeId)) {
      errors.push({ rowIndex: row.rowIndex, error: `従業員ID ${row.employeeId} が存在しません` })
    } else {
      validRows.push(row)
    }
  }

  return { validRows, errors }
}
