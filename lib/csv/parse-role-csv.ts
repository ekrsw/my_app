import Papa from "papaparse"
import { roleCsvRowSchema, type RoleCsvRow } from "@/lib/validators"

const HEADER_MAP: Record<string, keyof RoleCsvRow> = {
  "従業員名": "employeeName",
  "ロールコード": "roleCode",
  "主担当": "isPrimary",
  "開始日": "startDate",
  "終了日": "endDate",
}

const EXPECTED_HEADERS = Object.keys(HEADER_MAP)

export type ParsedRoleRow = {
  rowIndex: number
  data: RoleCsvRow
  valid: boolean
  error?: string
}

export type RoleCsvParseResult = {
  rows: ParsedRoleRow[]
  headerValid: boolean
  headerError?: string
}

function convertDate(value: string): string | null {
  if (!value || value.trim() === "") return null
  const match = value.trim().match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (!match) return null
  const [, y, m, d] = match
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
}

function parseBool(value: string): boolean {
  const v = value.trim().toLowerCase()
  return v === "true" || v === "1"
}

export function parseRoleCsv(csvText: string): RoleCsvParseResult {
  const result = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
  })

  if (result.data.length === 0) {
    return { rows: [], headerValid: false, headerError: "CSVが空です" }
  }

  // Validate headers
  const headers = result.data[0].map((h) => h.trim())
  const missingHeaders = EXPECTED_HEADERS.filter((h) => !headers.includes(h))
  if (missingHeaders.length > 0) {
    return {
      rows: [],
      headerValid: false,
      headerError: `必須ヘッダーがありません: ${missingHeaders.join(", ")}`,
    }
  }

  // Map header positions
  const headerIndexMap: Record<string, number> = {}
  headers.forEach((h, i) => {
    if (HEADER_MAP[h]) {
      headerIndexMap[HEADER_MAP[h]] = i
    }
  })

  const rows: ParsedRoleRow[] = []

  for (let i = 1; i < result.data.length; i++) {
    const row = result.data[i]
    const rowIndex = i + 1

    const rawEmployeeName = row[headerIndexMap.employeeName]?.trim() || ""
    const rawRoleCode = row[headerIndexMap.roleCode]?.trim() || ""
    const rawIsPrimary = row[headerIndexMap.isPrimary]?.trim() || ""
    const rawStartDate = row[headerIndexMap.startDate]?.trim() || ""
    const rawEndDate = row[headerIndexMap.endDate]?.trim() || ""

    const data = {
      employeeName: rawEmployeeName,
      roleCode: rawRoleCode.toUpperCase(),
      isPrimary: parseBool(rawIsPrimary),
      startDate: convertDate(rawStartDate),
      endDate: convertDate(rawEndDate),
    }

    const parsed = roleCsvRowSchema.safeParse(data)

    if (parsed.success) {
      rows.push({ rowIndex, data: parsed.data, valid: true })
    } else {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ")
      rows.push({ rowIndex, data: data as RoleCsvRow, valid: false, error: errorMsg })
    }

    if (rawStartDate && !convertDate(rawStartDate)) {
      const existing = rows[rows.length - 1]
      existing.valid = false
      existing.error = (existing.error ? existing.error + ", " : "") + "開始日の形式が不正です（yyyy/MM/dd）"
    }
    if (rawEndDate && !convertDate(rawEndDate)) {
      const existing = rows[rows.length - 1]
      existing.valid = false
      existing.error = (existing.error ? existing.error + ", " : "") + "終了日の形式が不正です（yyyy/MM/dd）"
    }
  }

  return { rows, headerValid: true }
}
