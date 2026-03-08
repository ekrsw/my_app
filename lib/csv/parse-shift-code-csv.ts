import Papa from "papaparse"
import { shiftCodeCsvRowSchema, type ShiftCodeCsvRow } from "@/lib/validators"

const HEADER_MAP: Record<string, keyof ShiftCodeCsvRow> = {
  "シフトコード": "code",
  "カラー": "color",
  "開始時刻": "defaultStartTime",
  "終了時刻": "defaultEndTime",
  "休日": "defaultIsHoliday",
  "有効": "isActive",
  "表示順": "sortOrder",
}

const REQUIRED_HEADERS = ["シフトコード"]

export type ParsedShiftCodeRow = {
  rowIndex: number
  data: ShiftCodeCsvRow
  valid: boolean
  error?: string
}

export type ShiftCodeCsvParseResult = {
  rows: ParsedShiftCodeRow[]
  headerValid: boolean
  headerError?: string
}

function parseBoolean(value: string, defaultValue: boolean): boolean {
  const v = value.trim().toLowerCase()
  if (v === "true" || v === "○") return true
  if (v === "false" || v === "×") return false
  if (v === "") return defaultValue
  return defaultValue
}

function validateTime(value: string): string | null {
  if (!value || value.trim() === "") return null
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function parseShiftCodeCsv(csvText: string): ShiftCodeCsvParseResult {
  const result = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
  })

  if (result.data.length === 0) {
    return { rows: [], headerValid: false, headerError: "CSVが空です" }
  }

  // Validate headers
  const headers = result.data[0].map((h) => h.trim())
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h))
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

  const rows: ParsedShiftCodeRow[] = []

  for (let i = 1; i < result.data.length; i++) {
    const row = result.data[i]
    const rowIndex = i + 1

    const rawCode = row[headerIndexMap.code]?.trim() || ""
    const rawColor = headerIndexMap.color !== undefined ? row[headerIndexMap.color]?.trim() || "" : ""
    const rawStartTime = headerIndexMap.defaultStartTime !== undefined ? row[headerIndexMap.defaultStartTime]?.trim() || "" : ""
    const rawEndTime = headerIndexMap.defaultEndTime !== undefined ? row[headerIndexMap.defaultEndTime]?.trim() || "" : ""
    const rawIsHoliday = headerIndexMap.defaultIsHoliday !== undefined ? row[headerIndexMap.defaultIsHoliday]?.trim() || "" : ""
    const rawIsActive = headerIndexMap.isActive !== undefined ? row[headerIndexMap.isActive]?.trim() || "" : ""
    const rawSortOrder = headerIndexMap.sortOrder !== undefined ? row[headerIndexMap.sortOrder]?.trim() || "" : ""

    // Time format validation
    let timeError = ""
    if (rawStartTime && !validateTime(rawStartTime)) {
      timeError += "開始時刻の形式が不正です（HH:mm）"
    }
    if (rawEndTime && !validateTime(rawEndTime)) {
      if (timeError) timeError += ", "
      timeError += "終了時刻の形式が不正です（HH:mm）"
    }

    const data = {
      code: rawCode,
      color: rawColor === "" ? null : rawColor,
      defaultStartTime: validateTime(rawStartTime),
      defaultEndTime: validateTime(rawEndTime),
      defaultIsHoliday: parseBoolean(rawIsHoliday, false),
      isActive: parseBoolean(rawIsActive, true),
      sortOrder: rawSortOrder === "" ? 0 : Number(rawSortOrder),
    }

    if (timeError) {
      rows.push({ rowIndex, data: data as ShiftCodeCsvRow, valid: false, error: timeError })
      continue
    }

    const parsed = shiftCodeCsvRowSchema.safeParse(data)

    if (parsed.success) {
      rows.push({ rowIndex, data: parsed.data, valid: true })
    } else {
      const errorMsg = parsed.error.issues.map((issue) => issue.message).join(", ")
      rows.push({ rowIndex, data: data as ShiftCodeCsvRow, valid: false, error: errorMsg })
    }
  }

  return { rows, headerValid: true }
}
