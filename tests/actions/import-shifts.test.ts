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

const { importShifts } = await import("@/lib/actions/shift-actions")

describe("importShifts - 従業員名による紐づけ", () => {
  let employeeId1: string
  let employeeId2: string

  beforeEach(async () => {
    await cleanupDatabase()
    const emp1 = await prisma.employee.create({ data: { name: "田中太郎" } })
    const emp2 = await prisma.employee.create({ data: { name: "佐藤花子" } })
    employeeId1 = emp1.id
    employeeId2 = emp2.id
  })

  it("従業員IDによる従来のインポートが動作する", async () => {
    const result = await importShifts([
      {
        rowIndex: 2,
        shiftDate: "2026-01-15",
        employeeId: employeeId1,
        shiftCode: "A",
        startTime: "09:00",
        endTime: "18:00",
        isHoliday: false,
        isRemote: false,
      },
    ])

    expect(result.created).toBe(1)
    expect(result.errors).toHaveLength(0)

    const shifts = await prisma.shift.findMany()
    expect(shifts).toHaveLength(1)
    expect(shifts[0].employeeId).toBe(employeeId1)
  })

  it("従業員名で一意に紐づけできる場合、正常にインポートされる", async () => {
    const result = await importShifts([
      {
        rowIndex: 2,
        shiftDate: "2026-01-15",
        employeeId: "",
        employeeName: "田中太郎",
        shiftCode: "A",
        startTime: "09:00",
        endTime: "18:00",
        isHoliday: false,
        isRemote: false,
      },
    ])

    expect(result.created).toBe(1)
    expect(result.errors).toHaveLength(0)

    const shifts = await prisma.shift.findMany()
    expect(shifts).toHaveLength(1)
    expect(shifts[0].employeeId).toBe(employeeId1)
  })

  it("複数行で異なる従業員名を使ってインポートできる", async () => {
    const result = await importShifts([
      {
        rowIndex: 2,
        shiftDate: "2026-01-15",
        employeeId: "",
        employeeName: "田中太郎",
        shiftCode: "A",
        startTime: "09:00",
        endTime: "18:00",
        isHoliday: false,
        isRemote: false,
      },
      {
        rowIndex: 3,
        shiftDate: "2026-01-15",
        employeeId: "",
        employeeName: "佐藤花子",
        shiftCode: "B",
        startTime: "10:00",
        endTime: "19:00",
        isHoliday: false,
        isRemote: false,
      },
    ])

    expect(result.created).toBe(2)
    expect(result.errors).toHaveLength(0)

    const shifts = await prisma.shift.findMany({ orderBy: { shiftCode: "asc" } })
    expect(shifts[0].employeeId).toBe(employeeId1)
    expect(shifts[1].employeeId).toBe(employeeId2)
  })

  it("IDと名前の混在行でインポートできる", async () => {
    const result = await importShifts([
      {
        rowIndex: 2,
        shiftDate: "2026-01-15",
        employeeId: employeeId1,
        shiftCode: "A",
        startTime: "09:00",
        endTime: "18:00",
        isHoliday: false,
        isRemote: false,
      },
      {
        rowIndex: 3,
        shiftDate: "2026-01-15",
        employeeId: "",
        employeeName: "佐藤花子",
        shiftCode: "B",
        startTime: "10:00",
        endTime: "19:00",
        isHoliday: false,
        isRemote: false,
      },
    ])

    expect(result.created).toBe(2)
    expect(result.errors).toHaveLength(0)
  })

  it("存在しない従業員名の場合エラーになる", async () => {
    const result = await importShifts([
      {
        rowIndex: 2,
        shiftDate: "2026-01-15",
        employeeId: "",
        employeeName: "存在しない名前",
        shiftCode: "A",
        startTime: "09:00",
        endTime: "18:00",
        isHoliday: false,
        isRemote: false,
      },
    ])

    expect(result.created).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].error).toContain("存在しない名前")
    expect(result.errors[0].error).toContain("見つかりません")
  })

  it("同名の従業員が複数存在する場合エラーになる", async () => {
    // 同名の従業員を追加
    await prisma.employee.create({ data: { name: "田中太郎" } })

    const result = await importShifts([
      {
        rowIndex: 2,
        shiftDate: "2026-01-15",
        employeeId: "",
        employeeName: "田中太郎",
        shiftCode: "A",
        startTime: "09:00",
        endTime: "18:00",
        isHoliday: false,
        isRemote: false,
      },
    ])

    expect(result.created).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].error).toContain("田中太郎")
    expect(result.errors[0].error).toContain("複数存在")
  })

  it("同名エラーと正常行が混在する場合、正常行はインポートされる", async () => {
    // 同名の田中太郎を追加
    await prisma.employee.create({ data: { name: "田中太郎" } })

    const result = await importShifts([
      {
        rowIndex: 2,
        shiftDate: "2026-01-15",
        employeeId: "",
        employeeName: "田中太郎",
        shiftCode: "A",
        startTime: "09:00",
        endTime: "18:00",
        isHoliday: false,
        isRemote: false,
      },
      {
        rowIndex: 3,
        shiftDate: "2026-01-15",
        employeeId: "",
        employeeName: "佐藤花子",
        shiftCode: "B",
        startTime: "10:00",
        endTime: "19:00",
        isHoliday: false,
        isRemote: false,
      },
    ])

    expect(result.created).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].rowIndex).toBe(2)

    const shifts = await prisma.shift.findMany()
    expect(shifts).toHaveLength(1)
    expect(shifts[0].employeeId).toBe(employeeId2)
  })

  it("存在しないemployeeIdの場合は従来通りエラーになる", async () => {
    const result = await importShifts([
      {
        rowIndex: 2,
        shiftDate: "2026-01-15",
        employeeId: "00000000-0000-0000-0000-000000000000",
        shiftCode: "A",
        startTime: "09:00",
        endTime: "18:00",
        isHoliday: false,
        isRemote: false,
      },
    ])

    expect(result.created).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].error).toContain("存在しません")
  })
})
