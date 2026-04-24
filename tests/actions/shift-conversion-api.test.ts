import { describe, it, expect, beforeEach, vi } from "vitest"
import ExcelJS from "exceljs"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})
const authMock = vi.hoisted(() => vi.fn().mockResolvedValue({ user: { id: "1", name: "admin" } }))
vi.mock("@/auth", () => ({ auth: authMock }))

const { POST } = await import("@/app/api/data/shift-conversion/route")

async function buildXlsxBuffer(
  headerA1: string,
  headerDates: Array<Date | string>,
  rows: Array<(string | null)[]>,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Sheet1")
  ws.addRow([headerA1, ...headerDates])
  for (const r of rows) ws.addRow(r)
  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf as ArrayBuffer)
}

function buildRequest(formData: FormData | null, headers: Record<string, string> = {}): Request {
  const init: RequestInit = {
    method: "POST",
    headers,
  }
  if (formData) {
    init.body = formData
  }
  return new Request("http://localhost/api/data/shift-conversion", init)
}

async function setupMasters() {
  const shiftCode = await prisma.shiftCode.create({
    data: {
      code: "9_1730",
      defaultStartTime: new Date("1970-01-01T09:00:00Z"),
      defaultEndTime: new Date("1970-01-01T17:30:00Z"),
      defaultIsHoliday: false,
      isActive: true,
    },
  })
  const holiday = await prisma.shiftCode.create({
    data: {
      code: "土祝",
      defaultIsHoliday: true,
      isActive: true,
    },
  })
  const emp = await prisma.employee.create({
    data: { name: "田中太郎" },
  })
  return { shiftCode, holiday, emp }
}

describe("POST /api/data/shift-conversion", () => {
  beforeEach(async () => {
    authMock.mockResolvedValue({ user: { id: "1", name: "admin" } })
    await cleanupDatabase()
  })

  it("未認証は 401", async () => {
    authMock.mockResolvedValueOnce(null)
    const fd = new FormData()
    const req = buildRequest(fd) as unknown as import("next/server").NextRequest
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("file フィールドなしは 400", async () => {
    const fd = new FormData()
    const req = buildRequest(fd) as unknown as import("next/server").NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it(".xlsm 拡張子は 400", async () => {
    const fd = new FormData()
    fd.append("file", new File([new Uint8Array([80, 75])], "shifts.xlsm"))
    const req = buildRequest(fd) as unknown as import("next/server").NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("xlsm")
  })

  it("拡張子 .xlsx 以外は 400", async () => {
    const fd = new FormData()
    fd.append("file", new File([new Uint8Array([1])], "shifts.csv"))
    const req = buildRequest(fd) as unknown as import("next/server").NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("Content-Length > 5MB で 413 (早期拒否)", async () => {
    const fd = new FormData()
    fd.append("file", new File([new Uint8Array([1])], "shifts.xlsx"))
    const req = buildRequest(fd, {
      "content-length": String(10 * 1024 * 1024),
    }) as unknown as import("next/server").NextRequest
    const res = await POST(req)
    expect(res.status).toBe(413)
  })

  it("空ファイルは 400", async () => {
    const fd = new FormData()
    fd.append("file", new File([], "shifts.xlsx"))
    const req = buildRequest(fd) as unknown as import("next/server").NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("不正なxlsxバイナリは 422 (XlsxParseError)", async () => {
    await setupMasters()
    const fd = new FormData()
    const bytes = new TextEncoder().encode("not an xlsx")
    fd.append("file", new File([bytes], "shifts.xlsx"))
    const req = buildRequest(fd) as unknown as import("next/server").NextRequest
    const res = await POST(req)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it("検証OKなら 200 + csvContent", async () => {
    await setupMasters()
    const buf = await buildXlsxBuffer(
      "従業員名",
      [new Date(Date.UTC(2026, 4, 1))],
      [["田中太郎", "9_1730"]],
    )
    const fd = new FormData()
    fd.append("file", new File([new Uint8Array(buf)], "test.xlsx"))
    const req = buildRequest(fd) as unknown as import("next/server").NextRequest
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.validation.canProceed).toBe(true)
    expect(body.validation.recordCount).toBe(1)
    expect(body.csvContent).toContain("田中太郎")
    expect(body.csvContent).toContain("9_1730")
    expect(body.filename).toBe("test.csv")
  })

  it("未知shift_codeを含むと 422 + validation", async () => {
    await setupMasters()
    const buf = await buildXlsxBuffer(
      "従業員名",
      [new Date(Date.UTC(2026, 4, 1))],
      [["田中太郎", "UNKNOWN"]],
    )
    const fd = new FormData()
    fd.append("file", new File([new Uint8Array(buf)], "test.xlsx"))
    const req = buildRequest(fd) as unknown as import("next/server").NextRequest
    const res = await POST(req)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.validation.canProceed).toBe(false)
    expect(body.validation.unknownCodes).toHaveLength(1)
    expect(body.csvContent).toBeUndefined()
  })

  it("未一致従業員名を含むと 422", async () => {
    await setupMasters()
    const buf = await buildXlsxBuffer(
      "従業員名",
      [new Date(Date.UTC(2026, 4, 1))],
      [["未登録太郎", "9_1730"]],
    )
    const fd = new FormData()
    fd.append("file", new File([new Uint8Array(buf)], "test.xlsx"))
    const req = buildRequest(fd) as unknown as import("next/server").NextRequest
    const res = await POST(req)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.validation.unknownNames).toHaveLength(1)
  })

  it("退職済み従業員はマスタ突合から除外される", async () => {
    await setupMasters()
    await prisma.employee.create({
      data: { name: "退職者", terminationDate: new Date("2025-01-01") },
    })
    const buf = await buildXlsxBuffer(
      "従業員名",
      [new Date(Date.UTC(2026, 4, 1))],
      [["退職者", "9_1730"]],
    )
    const fd = new FormData()
    fd.append("file", new File([new Uint8Array(buf)], "test.xlsx"))
    const req = buildRequest(fd) as unknown as import("next/server").NextRequest
    const res = await POST(req)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.validation.unknownNames.map((n: { value: string }) => n.value)).toContain("退職者")
  })

  it("ラウンドトリップ: 生成CSVが既存 parseShiftCsv で valid になる", async () => {
    await setupMasters()
    const { parseShiftCsv } = await import("@/lib/csv/parse-shift-csv")
    const buf = await buildXlsxBuffer(
      "従業員名",
      [new Date(Date.UTC(2026, 4, 1)), new Date(Date.UTC(2026, 4, 2))],
      [["田中太郎", "9_1730", "土祝"]],
    )
    const fd = new FormData()
    fd.append("file", new File([new Uint8Array(buf)], "test.xlsx"))
    const req = buildRequest(fd) as unknown as import("next/server").NextRequest
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    const csv = body.csvContent as string
    const stripped = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv
    const parsed = parseShiftCsv(stripped)
    expect(parsed.headerValid).toBe(true)
    expect(parsed.rows).toHaveLength(2)
    for (const row of parsed.rows) {
      expect(row.valid).toBe(true)
    }
  })
})
