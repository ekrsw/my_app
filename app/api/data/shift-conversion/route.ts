import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { convertShiftXlsx, XlsxParseError } from "@/lib/excel/parse-shift-xlsx"
import {
  SHIFT_CONVERSION_MAX_BYTES,
  SHIFT_CONVERSION_MAX_MB,
  type ShiftCodeMasterRow,
} from "@/types/shift-conversion"
import { formatTime } from "@/lib/date-utils"

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  // 認証ガード
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  // Content-Length 先読みで早期拒否 (信頼できない入力なので後続の byteLength チェックも併用)
  const contentLengthHeader = request.headers.get("content-length")
  if (contentLengthHeader) {
    const cl = Number(contentLengthHeader)
    if (Number.isFinite(cl) && cl > SHIFT_CONVERSION_MAX_BYTES) {
      return NextResponse.json(
        { error: `ファイルサイズが上限 (${SHIFT_CONVERSION_MAX_MB}MB) を超えています` },
        { status: 413 },
      )
    }
  }

  // multipart/form-data のパース
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: "リクエストを解析できませんでした (multipart/form-data 形式で送信してください)" },
      { status: 400 },
    )
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "file フィールドにExcelファイルを添付してください" },
      { status: 400 },
    )
  }

  // 拡張子チェック (MIME は古いブラウザで不安定なので拡張子で一次判定)
  const fileName = file.name ?? ""
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".xlsm")) {
    return NextResponse.json(
      { error: "マクロ付きExcel (.xlsm) は受け付けていません。.xlsx で保存してください" },
      { status: 400 },
    )
  }
  if (!lower.endsWith(".xlsx")) {
    return NextResponse.json(
      { error: ".xlsx 形式のファイルを選択してください" },
      { status: 400 },
    )
  }

  // MIME も一応確認 (空文字は許容 - 一部ブラウザが送らない)
  if (file.type && file.type !== XLSX_MIME && file.type !== "application/octet-stream") {
    return NextResponse.json(
      { error: `想定外のMIMEタイプです: ${file.type}` },
      { status: 400 },
    )
  }

  // バイナリ受信 + サイズ再検証 (偽装された Content-Length 対策)
  const arrayBuffer = await file.arrayBuffer()
  if (arrayBuffer.byteLength > SHIFT_CONVERSION_MAX_BYTES) {
    return NextResponse.json(
      { error: `ファイルサイズが上限 (${SHIFT_CONVERSION_MAX_MB}MB) を超えています` },
      { status: 413 },
    )
  }
  if (arrayBuffer.byteLength === 0) {
    return NextResponse.json({ error: "空のファイルです" }, { status: 400 })
  }

  // マスタを並列取得
  const [codeRows, employees] = await Promise.all([
    prisma.shiftCode.findMany({
      where: { isActive: true },
      select: {
        code: true,
        defaultStartTime: true,
        defaultEndTime: true,
        defaultIsHoliday: true,
        defaultLunchBreakStart: true,
        defaultLunchBreakEnd: true,
      },
    }),
    prisma.employee.findMany({
      where: { terminationDate: null },
      select: { name: true },
    }),
  ])

  const shiftCodes: ShiftCodeMasterRow[] = codeRows.map((c) => ({
    code: c.code,
    defaultStartTime: formatTimeOrNull(c.defaultStartTime),
    defaultEndTime: formatTimeOrNull(c.defaultEndTime),
    defaultIsHoliday: c.defaultIsHoliday,
    defaultLunchBreakStart: formatTimeOrNull(c.defaultLunchBreakStart),
    defaultLunchBreakEnd: formatTimeOrNull(c.defaultLunchBreakEnd),
  }))
  // NFKC 正規化は parse-shift-xlsx.ts で Excel 側にも適用されている。
  // DB 側も同じ方法で正規化して比較することで、全角/半角スペースなどの
  // 表記ゆれで一致が崩れるのを防ぐ。
  const employeeNames = employees.map((e) => e.name.normalize("NFKC"))

  // ファイル名 (拡張子なし) からベース名を抽出
  const filenameBase = stripExt(fileName) || "shifts"

  // パース→検証→(OKならCSV生成)
  try {
    const result = await convertShiftXlsx(arrayBuffer, shiftCodes, employeeNames, filenameBase)
    if (result.ok) {
      return NextResponse.json(result.body, { status: 200 })
    }
    return NextResponse.json({ validation: result.validation }, { status: 422 })
  } catch (e) {
    if (e instanceof XlsxParseError) {
      return NextResponse.json({ error: e.message }, { status: 422 })
    }
    console.error("shift-conversion error:", e)
    return NextResponse.json(
      { error: "変換処理中に予期せぬエラーが発生しました" },
      { status: 500 },
    )
  }
}

function formatTimeOrNull(t: Date | null): string | null {
  if (!t) return null
  return formatTime(t)
}

function stripExt(name: string): string {
  const i = name.lastIndexOf(".")
  return i > 0 ? name.substring(0, i) : name
}
