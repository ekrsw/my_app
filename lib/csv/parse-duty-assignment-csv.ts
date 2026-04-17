import Papa from "papaparse"
import { dutyAssignmentCsvRowSchema, type DutyAssignmentCsvRow } from "@/lib/validators"

const HEADER_MAP: Record<string, keyof DutyAssignmentCsvRow> = {
  "日付": "dutyDate",
  "従業員名": "employeeName",
  "業務種別": "dutyTypeName",
  "開始時刻": "startTime",
  "終了時刻": "endTime",
  "タイトル": "title",
  "メモ": "note",
  "キャパシティ減少": "reducesCapacity",
}

const REQUIRED_HEADERS = ["日付", "従業員名", "業務種別", "開始時刻", "終了時刻"]

export type ParsedDutyAssignmentRow = {
  rowIndex: number
  data: DutyAssignmentCsvRow
  valid: boolean
  error?: string
}

export type DutyAssignmentCsvParseResult = {
  rows: ParsedDutyAssignmentRow[]
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

function parseBool(value: string): boolean {
  const v = value.trim().toLowerCase()
  return v === "true" || v === "1" || v === "○" || v === "t"
}

export function parseDutyAssignmentCsv(csvText: string): DutyAssignmentCsvParseResult {
  const result = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
  })

  if (result.data.length === 0) {
    return { rows: [], headerValid: false, headerError: "CSVが空です" }
  }

  const headers = result.data[0].map((h) => h.trim())
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h))
  if (missingHeaders.length > 0) {
    return {
      rows: [],
      headerValid: false,
      headerError: `必須ヘッダーがありません: ${missingHeaders.join(", ")}`,
    }
  }

  const headerIndexMap: Record<string, number> = {}
  headers.forEach((h, i) => {
    const mapped = HEADER_MAP[h]
    if (mapped) {
      headerIndexMap[mapped] = i
    }
  })

  const rows: ParsedDutyAssignmentRow[] = []

  for (let i = 1; i < result.data.length; i++) {
    const row = result.data[i]
    const rowIndex = i + 1

    const rawDate = row[headerIndexMap.dutyDate]?.trim() || ""
    const rawEmployeeName = row[headerIndexMap.employeeName]?.trim() || ""
    const rawDutyTypeName = row[headerIndexMap.dutyTypeName]?.trim() || ""
    const rawStartTime = row[headerIndexMap.startTime]?.trim() || ""
    const rawEndTime = row[headerIndexMap.endTime]?.trim() || ""
    const rawTitle = headerIndexMap.title !== undefined ? row[headerIndexMap.title]?.trim() || "" : ""
    const rawNote = headerIndexMap.note !== undefined ? row[headerIndexMap.note]?.trim() || "" : ""
    const rawReducesCapacity = headerIndexMap.reducesCapacity !== undefined ? row[headerIndexMap.reducesCapacity]?.trim() || "" : "true"

    const convertedDate = convertDate(rawDate)

    const data = {
      dutyDate: convertedDate || "",
      employeeName: rawEmployeeName,
      dutyTypeName: rawDutyTypeName,
      startTime: convertTime(rawStartTime) || "",
      endTime: convertTime(rawEndTime) || "",
      title: rawTitle === "" ? null : rawTitle,
      note: rawNote === "" ? null : rawNote,
      reducesCapacity: parseBool(rawReducesCapacity),
    }

    const parsed = dutyAssignmentCsvRowSchema.safeParse(data)

    if (parsed.success) {
      rows.push({ rowIndex, data: parsed.data, valid: true })
    } else {
      const errorMsg = parsed.error.issues.map((issue) => issue.message).join(", ")
      rows.push({ rowIndex, data: data as DutyAssignmentCsvRow, valid: false, error: errorMsg })
    }

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
