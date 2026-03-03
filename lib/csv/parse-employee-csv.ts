import Papa from "papaparse"
import { employeeCsvRowSchema, type EmployeeCsvRow } from "@/lib/validators"

const HEADER_MAP: Record<string, keyof EmployeeCsvRow> = {
  "従業員ID": "employeeId",
  "従業員名": "name",
  "フリガナ": "nameKana",
  "入社日": "hireDate",
  "退職日": "terminationDate",
  "グループ": "groupNames",
}

// グループは任意列（後方互換性のため）
const OPTIONAL_HEADERS = new Set(["グループ"])
const EXPECTED_HEADERS = Object.keys(HEADER_MAP).filter((h) => !OPTIONAL_HEADERS.has(h))

export type ParsedEmployeeRow = {
  rowIndex: number
  data: EmployeeCsvRow
  valid: boolean
  error?: string
}

export type EmployeeCsvParseResult = {
  rows: ParsedEmployeeRow[]
  headerValid: boolean
  headerError?: string
}

function convertDate(value: string): string | null {
  if (!value || value.trim() === "") return null
  // yyyy/MM/dd → yyyy-MM-dd
  const match = value.trim().match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (!match) return null
  const [, y, m, d] = match
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
}

export function parseEmployeeCsv(csvText: string): EmployeeCsvParseResult {
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

  const rows: ParsedEmployeeRow[] = []

  for (let i = 1; i < result.data.length; i++) {
    const row = result.data[i]
    const rowIndex = i + 1 // 1-based, including header

    const rawEmployeeId = row[headerIndexMap.employeeId]?.trim() || ""
    const rawName = row[headerIndexMap.name]?.trim() || ""
    const rawNameKana = row[headerIndexMap.nameKana]?.trim() || ""
    const rawHireDate = row[headerIndexMap.hireDate]?.trim() || ""
    const rawTerminationDate = row[headerIndexMap.terminationDate]?.trim() || ""
    const rawGroupNames = headerIndexMap.groupNames !== undefined
      ? row[headerIndexMap.groupNames]?.trim() || ""
      : ""

    const data = {
      employeeId: rawEmployeeId === "" ? null : rawEmployeeId,
      name: rawName,
      nameKana: rawNameKana === "" ? null : rawNameKana,
      hireDate: convertDate(rawHireDate),
      terminationDate: convertDate(rawTerminationDate),
      groupNames: rawGroupNames === "" ? null : rawGroupNames,
    }

    const parsed = employeeCsvRowSchema.safeParse(data)

    if (parsed.success) {
      rows.push({ rowIndex, data: parsed.data, valid: true })
    } else {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ")
      rows.push({ rowIndex, data: data as EmployeeCsvRow, valid: false, error: errorMsg })
    }

    // Additional validation: date format check
    if (rawHireDate && !convertDate(rawHireDate)) {
      const existing = rows[rows.length - 1]
      existing.valid = false
      existing.error = (existing.error ? existing.error + ", " : "") + "入社日の形式が不正です（yyyy/MM/dd）"
    }
    if (rawTerminationDate && !convertDate(rawTerminationDate)) {
      const existing = rows[rows.length - 1]
      existing.valid = false
      existing.error = (existing.error ? existing.error + ", " : "") + "退職日の形式が不正です（yyyy/MM/dd）"
    }
  }

  return { rows, headerValid: true }
}
