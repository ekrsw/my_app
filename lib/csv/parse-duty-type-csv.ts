import Papa from "papaparse"
import { dutyTypeCsvRowSchema, type DutyTypeCsvRow } from "@/lib/validators"

const HEADER_MAP: Record<string, keyof DutyTypeCsvRow> = {
  "業務名": "name",
  "色": "color",
  "有効": "isActive",
  "表示順": "sortOrder",
  "キャパシティ減少": "defaultReducesCapacity",
  "デフォルト開始時刻": "defaultStartTime",
  "デフォルト終了時刻": "defaultEndTime",
  "デフォルトタイトル": "defaultTitle",
  "デフォルトメモ": "defaultNote",
}

const REQUIRED_HEADERS = ["業務名"]

export type ParsedDutyTypeRow = {
  rowIndex: number
  data: DutyTypeCsvRow
  valid: boolean
  error?: string
}

export type DutyTypeCsvParseResult = {
  rows: ParsedDutyTypeRow[]
  headerValid: boolean
  headerError?: string
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

export function parseDutyTypeCsv(csvText: string): DutyTypeCsvParseResult {
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

  const rows: ParsedDutyTypeRow[] = []

  for (let i = 1; i < result.data.length; i++) {
    const row = result.data[i]
    const rowIndex = i + 1

    const rawName = row[headerIndexMap.name]?.trim() || ""
    const rawColor = headerIndexMap.color !== undefined ? row[headerIndexMap.color]?.trim() || "" : ""
    const rawIsActive = headerIndexMap.isActive !== undefined ? row[headerIndexMap.isActive]?.trim() || "" : "true"
    const rawSortOrder = headerIndexMap.sortOrder !== undefined ? row[headerIndexMap.sortOrder]?.trim() || "0" : "0"
    const rawReducesCapacity = headerIndexMap.defaultReducesCapacity !== undefined ? row[headerIndexMap.defaultReducesCapacity]?.trim() || "" : "true"
    const rawStartTime = headerIndexMap.defaultStartTime !== undefined ? row[headerIndexMap.defaultStartTime]?.trim() || "" : ""
    const rawEndTime = headerIndexMap.defaultEndTime !== undefined ? row[headerIndexMap.defaultEndTime]?.trim() || "" : ""
    const rawTitle = headerIndexMap.defaultTitle !== undefined ? row[headerIndexMap.defaultTitle]?.trim() || "" : ""
    const rawNote = headerIndexMap.defaultNote !== undefined ? row[headerIndexMap.defaultNote]?.trim() || "" : ""

    const data = {
      name: rawName,
      color: rawColor === "" ? null : rawColor,
      isActive: parseBool(rawIsActive),
      sortOrder: rawSortOrder === "" ? 0 : Number(rawSortOrder),
      defaultReducesCapacity: parseBool(rawReducesCapacity),
      defaultStartTime: convertTime(rawStartTime),
      defaultEndTime: convertTime(rawEndTime),
      defaultTitle: rawTitle === "" ? null : rawTitle,
      defaultNote: rawNote === "" ? null : rawNote,
    }

    const parsed = dutyTypeCsvRowSchema.safeParse(data)

    if (parsed.success) {
      rows.push({ rowIndex, data: parsed.data, valid: true })
    } else {
      const errorMsg = parsed.error.issues.map((issue) => issue.message).join(", ")
      rows.push({ rowIndex, data: data as DutyTypeCsvRow, valid: false, error: errorMsg })
    }

    if (rawStartTime && rawStartTime !== "-" && !convertTime(rawStartTime)) {
      const existing = rows[rows.length - 1]
      existing.valid = false
      existing.error = (existing.error ? existing.error + ", " : "") + "デフォルト開始時刻の形式が不正です（HH:mm）"
    }

    if (rawEndTime && rawEndTime !== "-" && !convertTime(rawEndTime)) {
      const existing = rows[rows.length - 1]
      existing.valid = false
      existing.error = (existing.error ? existing.error + ", " : "") + "デフォルト終了時刻の形式が不正です（HH:mm）"
    }
  }

  return { rows, headerValid: true }
}
