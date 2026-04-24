import ExcelJS from "exceljs"
import Papa from "papaparse"
import type {
  ParseResult,
  ShiftCodeMasterRow,
  ShiftConversionSuccessResponse,
  ShiftRecord,
  UnknownCount,
  ValidationResult,
} from "@/types/shift-conversion"

const ALLOWED_NAME_HEADERS = ["従業員名", "氏名", "名前", "Name", "従業員"]

/** sheet.rowCount × sheet.columnCount がこの数を超えたら reject (zip bomb / 暴走セル対策) */
const MAX_SHEET_CELLS = 1_000_000

/** Excel formula 系エラーセルの文字列表現 */
const EXCEL_ERROR_TOKENS = new Set([
  "#NULL!",
  "#DIV/0!",
  "#VALUE!",
  "#REF!",
  "#NAME?",
  "#NUM!",
  "#N/A",
  "#GETTING_DATA",
])

// CSV出力列 (既存 lib/csv/parse-shift-csv.ts の HEADER_MAP キーと一致)
const CSV_HEADERS = [
  "日付",
  "従業員ID",
  "従業員名",
  "シフトコード",
  "開始時刻",
  "終了時刻",
  "昼休み開始",
  "昼休み終了",
  "休日",
  "テレワーク",
] as const

/**
 * 区切り行判定: A列 trim+NFKC 正規化後に "-", "", スペース等なら区切り行。
 */
function isSeparator(rawName: unknown): boolean {
  if (rawName == null) return true
  const s = String(rawName).normalize("NFKC").trim()
  if (s === "") return true
  // "-" / "−" (U+2212 minus) / "—" (em dash) / "ー" (katakana long sound) 等を広く拾う
  if (/^[-\u2212\u2014\u30fc_]+$/.test(s)) return true
  return false
}

/**
 * Excelセルの値を日付 (YYYY-MM-DD in JST) に正規化する。
 * - Date型 → JSTで YYYY-MM-DD を生成
 * - 数値 (Excelシリアル) → 1900-01-01基準で Date 化し JST 日付
 * - 文字列 "2026/5/1" or "2026-05-01" 等 → 正規化
 * - それ以外 → null
 */
function normalizeDateCell(value: unknown, date1904 = false): string | null {
  if (value == null || value === "") return null

  // Date型
  if (value instanceof Date) {
    // exceljs は Excel のシリアル日付を UTC 基準の Date で返す (例: 2026-05-01 00:00:00 UTC)。
    // 実際にユーザーが意図する日付は getUTC* を参照すれば得られる。
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, "0")
    const d = String(value.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }

  // 数値 (Excelシリアル値): exceljs が文字列セルとして渡してきた場合
  if (typeof value === "number" && isFinite(value)) {
    // 1900 date system: epoch offset 25569. 1904 date system: 24107 (macOS系)。
    const offset = date1904 ? 24107 : 25569
    const ms = Math.round((value - offset) * 86400 * 1000)
    const d = new Date(ms)
    if (isNaN(d.getTime())) return null
    const y = d.getUTCFullYear()
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0")
    const da = String(d.getUTCDate()).padStart(2, "0")
    return `${y}-${mo}-${da}`
  }

  // 文字列
  if (typeof value === "string") {
    const s = value.trim()
    const m = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/)
    if (m) {
      return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
    }
    return null
  }

  // exceljs の RichText / Formula 等
  if (typeof value === "object" && value !== null) {
    const v = value as { result?: unknown; text?: unknown; richText?: unknown }
    if (v.result !== undefined) return normalizeDateCell(v.result, date1904)
    if (typeof v.text === "string") return normalizeDateCell(v.text, date1904)
  }

  return null
}

/**
 * セル値を見て Excel formula エラー (#N/A 等) かを判定。
 * parseShiftXlsx ではこれを warnings に積む。
 */
function isFormulaError(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === "string") {
    const s = value.trim()
    return EXCEL_ERROR_TOKENS.has(s) ? s : null
  }
  if (typeof value === "object") {
    const v = value as { error?: unknown; result?: unknown }
    if (typeof v.error === "string" && EXCEL_ERROR_TOKENS.has(v.error)) return v.error
    if (typeof v.result === "string" && EXCEL_ERROR_TOKENS.has(v.result)) return v.result
  }
  return null
}

/**
 * セル値 → トリムされた文字列。object (RichText) も拾う。
 */
function cellToString(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number") return String(value).trim()
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "object") {
    const v = value as { result?: unknown; text?: unknown; richText?: Array<{ text: string }> }
    if (v.result !== undefined) return cellToString(v.result)
    if (typeof v.text === "string") return v.text.trim()
    if (Array.isArray(v.richText)) {
      return v.richText.map((r) => r.text).join("").trim()
    }
  }
  return ""
}

export class XlsxParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "XlsxParseError"
  }
}

/**
 * Excel バイナリを読み取り、シフトレコードに展開する。
 * ブロック対象のフォーマット違反は XlsxParseError を投げる。
 */
export async function parseShiftXlsx(buffer: ArrayBuffer | Buffer): Promise<ParseResult> {
  const warnings: string[] = []

  const workbook = new ExcelJS.Workbook()
  try {
    // exceljs 4.4 の load() は型定義で Buffer のみ受理だが、実装は ArrayBuffer も
    // そのまま受理する。Node 20+ の Buffer<ArrayBufferLike> と exceljs の古い
    // Buffer 型宣言のズレを1箇所で吸収する。
    // @ts-expect-error exceljs type definition is narrower than runtime behavior
    await workbook.xlsx.load(buffer)
  } catch (e) {
    throw new XlsxParseError(
      `Excelファイルを読み込めません: ${e instanceof Error ? e.message : "不正なファイル形式です"}`,
    )
  }

  const worksheets = workbook.worksheets
  if (worksheets.length === 0) {
    throw new XlsxParseError("ワークシートが見つかりません")
  }
  if (worksheets.length > 1) {
    const names = worksheets.slice(1).map((w) => w.name).join(", ")
    warnings.push(`2枚目以降のシート (${names}) は無視されました`)
  }

  const sheet = worksheets[0]

  // date1904 モード (macOS Excel の旧エポック) をワークブックから読む。
  // 1904 モードのシリアル日付はオフセットが 4 年 +1 日ずれるので日付解釈時に補正する。
  const date1904 = Boolean(
    (workbook.properties as { date1904?: boolean } | undefined)?.date1904,
  )

  // sheet bounds cap: 暴走セル / zip bomb 展開で rowCount × columnCount が巨大になった場合に拒否
  const cellCount = sheet.rowCount * sheet.columnCount
  if (cellCount > MAX_SHEET_CELLS) {
    throw new XlsxParseError(
      `シートのセル数が上限 (${MAX_SHEET_CELLS.toLocaleString()}) を超えています: ${sheet.rowCount}行 × ${sheet.columnCount}列`,
    )
  }

  // ヘッダー行 (1行目) を読む
  const headerRow = sheet.getRow(1)
  const a1 = cellToString(headerRow.getCell(1).value).normalize("NFKC").trim()
  if (!ALLOWED_NAME_HEADERS.includes(a1)) {
    throw new XlsxParseError(
      `A1セルが許容ヘッダーではありません: '${a1}' (許容: ${ALLOWED_NAME_HEADERS.join(", ")})`,
    )
  }

  // 2列目以降の日付ヘッダー
  const dateColumns: Array<{ colIndex: number; date: string }> = []
  const lastCol = sheet.columnCount
  if (lastCol < 2) {
    throw new XlsxParseError("日付列が見つかりません")
  }
  for (let c = 2; c <= lastCol; c++) {
    const raw = headerRow.getCell(c).value
    if (raw == null || raw === "") continue
    const normalized = normalizeDateCell(raw, date1904)
    if (!normalized) {
      throw new XlsxParseError(
        `ヘッダーの${c}列目の日付を解釈できません: ${cellToString(raw)}`,
      )
    }
    dateColumns.push({ colIndex: c, date: normalized })
  }
  if (dateColumns.length === 0) {
    throw new XlsxParseError("有効な日付ヘッダー列が1つも見つかりません")
  }

  // データ行のイテレーション
  const records: ShiftRecord[] = []
  const lastRow = sheet.rowCount
  // formula エラー (#N/A 等) を検出した場合は warning に積む (silent corruption 防止)。
  // 代表値1件だけ保持して警告メッセージに入れる。
  let firstFormulaError: { row: number; col: number; token: string } | null = null
  for (let r = 2; r <= lastRow; r++) {
    const row = sheet.getRow(r)
    const nameCell = row.getCell(1).value
    if (isSeparator(nameCell)) continue

    const employeeName = cellToString(nameCell).normalize("NFKC")
    if (!employeeName) continue

    for (const { colIndex, date } of dateColumns) {
      const codeCell = row.getCell(colIndex).value
      const formulaErr = isFormulaError(codeCell)
      if (formulaErr) {
        if (!firstFormulaError) {
          firstFormulaError = { row: r, col: colIndex, token: formulaErr }
        }
        continue
      }
      const shiftCode = cellToString(codeCell)
      if (shiftCode === "") continue
      records.push({
        employeeName,
        shiftDate: date,
        shiftCode,
      })
    }
  }

  if (firstFormulaError) {
    warnings.push(
      `Excel内に壊れた数式セル (${firstFormulaError.token}) が見つかりました: ${firstFormulaError.row}行目の${firstFormulaError.col}列目。該当セルはシフト無しとして扱いました。ExcelでVLOOKUP等の参照が壊れていないか確認してください。`,
    )
  }

  return { records, warnings }
}

/**
 * records を shift_codes / employees マスタと突き合わせて検証する。
 * ブロック条件のどれか1つでも引っかかれば canProceed=false。
 */
export function validateRecords(
  records: ShiftRecord[],
  shiftCodes: ShiftCodeMasterRow[],
  employeeNames: string[],
  warnings: string[] = [],
): ValidationResult {
  const codeSet = new Set(shiftCodes.map((c) => c.code))
  // 従業員名はそのままのマッチ (importShifts がDB側の重複も処理するが、ここは完全一致)
  const nameSet = new Set(employeeNames)

  const unknownCodeMap = new Map<string, number>()
  const unknownNameMap = new Map<string, number>()
  const dupMap = new Map<string, number>()

  for (const r of records) {
    if (!codeSet.has(r.shiftCode)) {
      unknownCodeMap.set(r.shiftCode, (unknownCodeMap.get(r.shiftCode) ?? 0) + 1)
    }
    if (!nameSet.has(r.employeeName)) {
      unknownNameMap.set(r.employeeName, (unknownNameMap.get(r.employeeName) ?? 0) + 1)
    }
    const key = `${r.employeeName}\u0001${r.shiftDate}`
    dupMap.set(key, (dupMap.get(key) ?? 0) + 1)
  }

  const unknownCodes: UnknownCount[] = [...unknownCodeMap.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value))

  const unknownNames: UnknownCount[] = [...unknownNameMap.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value))

  const duplicateKeys = [...dupMap.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => {
      const [employeeName, shiftDate] = key.split("\u0001")
      return { employeeName, shiftDate, count }
    })
    .sort((a, b) => {
      if (a.employeeName !== b.employeeName) {
        return a.employeeName.localeCompare(b.employeeName)
      }
      return a.shiftDate.localeCompare(b.shiftDate)
    })

  const canProceed =
    unknownCodes.length === 0 && unknownNames.length === 0 && duplicateKeys.length === 0

  return {
    canProceed,
    recordCount: records.length,
    unknownCodes,
    unknownNames,
    duplicateKeys,
    warnings,
  }
}

/**
 * "HH:MM:SS" / "HH:MM" / Date を "HH:mm" に正規化する。null はそのまま。
 */
function normalizeTime(value: string | null): string {
  if (!value) return ""
  const m = value.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return ""
  return `${m[1].padStart(2, "0")}:${m[2]}`
}

/**
 * ISO 日付 (YYYY-MM-DD) を "yyyy/MM/dd" に変換。既存 parseShiftCsv は両形式を受理するが、
 * 既存エクスポートの慣例 (formatDate pattern) に合わせてスラッシュ区切りで出力する。
 */
function formatDateSlash(isoDate: string): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return isoDate
  return `${m[1]}/${m[2]}/${m[3]}`
}

/**
 * CSV Injection 防御: 先頭が式トリガ文字の場合、`'` をプレフィックスして Excel が
 * 式として解釈しないようにする。OWASP Formula Injection 対策。
 * 対象: `=` `+` `-` `@` TAB `\r`
 */
function escapeFormulaInjection(value: string): string {
  if (value.length === 0) return value
  const first = value.charCodeAt(0)
  if (
    first === 0x3d /* = */ ||
    first === 0x2b /* + */ ||
    first === 0x2d /* - */ ||
    first === 0x40 /* @ */ ||
    first === 0x09 /* TAB */ ||
    first === 0x0d /* CR */
  ) {
    return `'${value}`
  }
  return value
}

/**
 * records を既存 parseShiftCsv 互換の日本語ヘッダーCSV文字列に変換する。
 * BOM付きUTF-8、CRLF改行、(従業員名, 日付) 辞書順ソート。
 */
export function generateCsv(records: ShiftRecord[], shiftCodes: ShiftCodeMasterRow[]): string {
  const codeMap = new Map<string, ShiftCodeMasterRow>()
  for (const c of shiftCodes) codeMap.set(c.code, c)

  const sorted = [...records].sort((a, b) => {
    if (a.employeeName !== b.employeeName) {
      return a.employeeName.localeCompare(b.employeeName)
    }
    return a.shiftDate.localeCompare(b.shiftDate)
  })

  const rows: string[][] = sorted.map((r) => {
    const codeRow = codeMap.get(r.shiftCode)
    const startTime = codeRow ? normalizeTime(codeRow.defaultStartTime) : ""
    const endTime = codeRow ? normalizeTime(codeRow.defaultEndTime) : ""
    const lunchStart = codeRow ? normalizeTime(codeRow.defaultLunchBreakStart) : ""
    const lunchEnd = codeRow ? normalizeTime(codeRow.defaultLunchBreakEnd) : ""
    const isHoliday = codeRow?.defaultIsHoliday ? "t" : "f"
    return [
      formatDateSlash(r.shiftDate),
      "", // 従業員ID は空: importShifts が従業員名で解決
      escapeFormulaInjection(r.employeeName),
      escapeFormulaInjection(r.shiftCode),
      startTime,
      endTime,
      lunchStart,
      lunchEnd,
      isHoliday,
      "f", // テレワーク: shift_codes にマスタ情報がないので false 固定
    ]
  })

  const csvBody = Papa.unparse([Array.from(CSV_HEADERS), ...rows], {
    newline: "\r\n",
  })

  // BOM付きUTF-8
  return `\ufeff${csvBody}`
}

/**
 * Excel → (parse → validate → generate) を一括実行。
 * 成功時は csvContent を含むレスポンス。
 * 検証NG時は validation のみ返す。
 */
export async function convertShiftXlsx(
  buffer: ArrayBuffer | Buffer,
  shiftCodes: ShiftCodeMasterRow[],
  employeeNames: string[],
  filenameBase: string,
): Promise<
  | { ok: true; body: ShiftConversionSuccessResponse }
  | { ok: false; validation: ValidationResult }
> {
  const { records, warnings } = await parseShiftXlsx(buffer)
  const validation = validateRecords(records, shiftCodes, employeeNames, warnings)
  if (!validation.canProceed) {
    return { ok: false, validation }
  }
  const csvContent = generateCsv(records, shiftCodes)
  return {
    ok: true,
    body: {
      validation,
      csvContent,
      filename: `${filenameBase}.csv`,
    },
  }
}
