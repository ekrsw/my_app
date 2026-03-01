import Papa from "papaparse"
import { shiftCsvRowSchema, type ShiftCsvRow } from "@/lib/validators"

const HEADER_MAP: Record<string, string> = {
  "日付": "shiftDate",
  "従業員ID": "employeeId",
  "従業員名": "_employeeName",
  "グループ": "_groupName",
  "シフトコード": "shiftCode",
  "開始時刻": "startTime",
  "終了時刻": "endTime",
  "休日": "isHoliday",
  "テレワーク": "isRemote",
}

const REQUIRED_HEADERS = ["日付", "従業員ID", "シフトコード", "開始時刻", "終了時刻", "休日", "テレワーク"]

export type ParsedShiftRow = {
  rowIndex: number
  data: ShiftCsvRow & { _employeeName?: string; _groupName?: string }
  valid: boolean
  error?: string
}

export type ShiftCsvParseResult = {
  rows: ParsedShiftRow[]
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

function convertTime(value: string): string | null {
  if (!value || value.trim() === "" || value.trim() === "-") return null
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  return `${match[1].padStart(2, "0")}:${match[2]}`
}

function convertBoolean(value: string): boolean {
  const v = value.trim().toLowerCase()
  return v === "○" || v === "t"
}

export function parseShiftCsv(csvText: string): ShiftCsvParseResult {
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
    const mapped = HEADER_MAP[h]
    if (mapped) {
      headerIndexMap[mapped] = i
    }
  })

  const rows: ParsedShiftRow[] = []

  for (let i = 1; i < result.data.length; i++) {
    const row = result.data[i]
    const rowIndex = i + 1

    const rawDate = row[headerIndexMap.shiftDate]?.trim() || ""
    const rawEmployeeId = row[headerIndexMap.employeeId]?.trim() || ""
    const rawEmployeeName = headerIndexMap._employeeName !== undefined ? row[headerIndexMap._employeeName]?.trim() || "" : ""
    const rawGroupName = headerIndexMap._groupName !== undefined ? row[headerIndexMap._groupName]?.trim() || "" : ""
    const rawShiftCode = row[headerIndexMap.shiftCode]?.trim() || ""
    const rawStartTime = row[headerIndexMap.startTime]?.trim() || ""
    const rawEndTime = row[headerIndexMap.endTime]?.trim() || ""
    const rawIsHoliday = row[headerIndexMap.isHoliday]?.trim() || ""
    const rawIsRemote = row[headerIndexMap.isRemote]?.trim() || ""

    const convertedDate = convertDate(rawDate)

    const data = {
      shiftDate: convertedDate || "",
      employeeId: rawEmployeeId === "" ? 0 : Number(rawEmployeeId),
      _employeeName: rawEmployeeName,
      _groupName: rawGroupName,
      shiftCode: rawShiftCode === "" ? null : rawShiftCode,
      startTime: convertTime(rawStartTime),
      endTime: convertTime(rawEndTime),
      isHoliday: convertBoolean(rawIsHoliday),
      isRemote: convertBoolean(rawIsRemote),
    }

    const parsed = shiftCsvRowSchema.safeParse(data)

    if (parsed.success) {
      rows.push({
        rowIndex,
        data: { ...parsed.data, _employeeName: rawEmployeeName, _groupName: rawGroupName },
        valid: true,
      })
    } else {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ")
      rows.push({
        rowIndex,
        data: data as ShiftCsvRow & { _employeeName?: string; _groupName?: string },
        valid: false,
        error: errorMsg,
      })
    }

    // Additional validation
    if (rawDate && !convertedDate) {
      const existing = rows[rows.length - 1]
      existing.valid = false
      existing.error = (existing.error ? existing.error + ", " : "") + "日付の形式が不正です（yyyy/MM/dd）"
    }

    if (rawStartTime && rawStartTime !== "-" && !convertTime(rawStartTime)) {
      const existing = rows[rows.length - 1]
      existing.valid = false
      existing.error = (existing.error ? existing.error + ", " : "") + "開始時刻の形式が不正です（HH:mm）"
    }

    if (rawEndTime && rawEndTime !== "-" && !convertTime(rawEndTime)) {
      const existing = rows[rows.length - 1]
      existing.valid = false
      existing.error = (existing.error ? existing.error + ", " : "") + "終了時刻の形式が不正です（HH:mm）"
    }
  }

  return { rows, headerValid: true }
}
