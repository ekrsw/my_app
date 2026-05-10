import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})
vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "1", name: "admin" } }),
}))

const { importShiftCodes } = await import("@/lib/actions/shift-code-actions")

type ImportRow = {
  rowIndex: number
  code: string
  color: string | null
  defaultStartTime: string | null
  defaultEndTime: string | null
  defaultIsHoliday: boolean
  isActive: boolean
  sortOrder: number
  defaultLunchBreakStart: string | null
  defaultLunchBreakEnd: string | null
}

function makeRow(overrides: Partial<ImportRow> & { code: string }): ImportRow {
  return {
    rowIndex: 2,
    color: null,
    defaultStartTime: null,
    defaultEndTime: null,
    defaultIsHoliday: false,
    isActive: true,
    sortOrder: 0,
    defaultLunchBreakStart: null,
    defaultLunchBreakEnd: null,
    ...overrides,
  }
}

describe("importShiftCodes", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  it("新規作成: 昼休憩値あり → 4時刻全部永続化", async () => {
    const result = await importShiftCodes(
      [
        makeRow({
          code: "9_18",
          defaultStartTime: "09:00",
          defaultEndTime: "18:00",
          defaultLunchBreakStart: "12:00",
          defaultLunchBreakEnd: "13:00",
        }),
      ],
      false
    )

    expect(result.success).toBe(true)
    expect(result.created).toBe(1)
    expect(result.updated).toBe(0)

    const created = await prisma.shiftCode.findUnique({ where: { code: "9_18" } })
    expect(created).not.toBeNull()
    expect(created!.defaultStartTime).not.toBeNull()
    expect(created!.defaultEndTime).not.toBeNull()
    expect(created!.defaultLunchBreakStart).not.toBeNull()
    expect(created!.defaultLunchBreakEnd).not.toBeNull()
  })

  it("既存更新: 昼休憩値あり → 全時刻フィールド上書き", async () => {
    await prisma.shiftCode.create({
      data: {
        code: "A",
        defaultStartTime: new Date("1970-01-01T08:00:00Z"),
        defaultEndTime: new Date("1970-01-01T17:00:00Z"),
        defaultLunchBreakStart: new Date("1970-01-01T11:30:00Z"),
        defaultLunchBreakEnd: new Date("1970-01-01T12:30:00Z"),
      },
    })

    const result = await importShiftCodes(
      [
        makeRow({
          code: "A",
          defaultStartTime: "09:00",
          defaultEndTime: "18:00",
          defaultLunchBreakStart: "12:00",
          defaultLunchBreakEnd: "13:00",
        }),
      ],
      false
    )

    expect(result.success).toBe(true)
    expect(result.updated).toBe(1)
    expect(result.created).toBe(0)

    const updated = await prisma.shiftCode.findUnique({ where: { code: "A" } })
    const lunchStart = updated!.defaultLunchBreakStart!.toISOString().substring(11, 16)
    expect(lunchStart).toBe("12:00")
  })

  it("昼休憩 null (空欄) で新規作成 → DB null", async () => {
    const result = await importShiftCodes(
      [
        makeRow({
          code: "OFF",
          defaultLunchBreakStart: null,
          defaultLunchBreakEnd: null,
        }),
      ],
      false
    )

    expect(result.success).toBe(true)
    const created = await prisma.shiftCode.findUnique({ where: { code: "OFF" } })
    expect(created!.defaultLunchBreakStart).toBeNull()
    expect(created!.defaultLunchBreakEnd).toBeNull()
  })

  it("[CRITICAL REGRESSION] lunchBreakColumnsMissing=true で既存更新 → 既存昼休憩値は保持", async () => {
    const existingLunchStart = new Date("1970-01-01T11:30:00Z")
    const existingLunchEnd = new Date("1970-01-01T12:30:00Z")
    await prisma.shiftCode.create({
      data: {
        code: "A",
        color: "blue",
        defaultStartTime: new Date("1970-01-01T08:00:00Z"),
        defaultEndTime: new Date("1970-01-01T17:00:00Z"),
        defaultLunchBreakStart: existingLunchStart,
        defaultLunchBreakEnd: existingLunchEnd,
      },
    })

    const result = await importShiftCodes(
      [
        makeRow({
          code: "A",
          color: "red",
          defaultStartTime: "09:00",
          defaultEndTime: "18:00",
          defaultLunchBreakStart: null,
          defaultLunchBreakEnd: null,
        }),
      ],
      true
    )

    expect(result.success).toBe(true)
    expect(result.updated).toBe(1)

    const updated = await prisma.shiftCode.findUnique({ where: { code: "A" } })
    expect(updated!.color).toBe("red")
    expect(updated!.defaultLunchBreakStart!.toISOString()).toBe(existingLunchStart.toISOString())
    expect(updated!.defaultLunchBreakEnd!.toISOString()).toBe(existingLunchEnd.toISOString())
  })

  it("lunchBreakColumnsMissing=true で新規作成 → 昼休憩 null", async () => {
    const result = await importShiftCodes(
      [
        makeRow({
          code: "NEW",
          defaultStartTime: "09:00",
          defaultEndTime: "18:00",
        }),
      ],
      true
    )

    expect(result.success).toBe(true)
    expect(result.created).toBe(1)

    const created = await prisma.shiftCode.findUnique({ where: { code: "NEW" } })
    expect(created!.defaultLunchBreakStart).toBeNull()
    expect(created!.defaultLunchBreakEnd).toBeNull()
  })

  it("複数行の同時インポート (新規 + 更新の混在)", async () => {
    await prisma.shiftCode.create({ data: { code: "EXISTING" } })

    const result = await importShiftCodes(
      [
        makeRow({ code: "EXISTING", defaultLunchBreakStart: "12:00", defaultLunchBreakEnd: "13:00" }),
        makeRow({ code: "NEW1", defaultLunchBreakStart: "11:30", defaultLunchBreakEnd: "12:30" }),
        makeRow({ code: "NEW2" }),
      ],
      false
    )

    expect(result.success).toBe(true)
    expect(result.created).toBe(2)
    expect(result.updated).toBe(1)
    expect(result.errors).toHaveLength(0)
  })
})
