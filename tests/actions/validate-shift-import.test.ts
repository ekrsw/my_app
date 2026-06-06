import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"
import { auth } from "@/auth"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})
vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "1", name: "admin" } }),
}))

const { validateShiftImport } = await import("@/lib/actions/shift-actions")

function row(overrides: Partial<{ rowIndex: number; shiftDate: string; employeeId: string; employeeName?: string }>) {
  return {
    rowIndex: 2,
    shiftDate: "2026-01-15",
    employeeId: "",
    shiftCode: "A",
    startTime: "09:00",
    endTime: "18:00",
    isHoliday: false,
    isRemote: false,
    ...overrides,
  }
}

describe("validateShiftImport", () => {
  let employeeId: string

  beforeEach(async () => {
    await cleanupDatabase()
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", name: "admin" } } as never)
    const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
    employeeId = emp.id
  })

  it("全行有効な場合、エラーは空・failed=false", async () => {
    const res = await validateShiftImport([
      row({ rowIndex: 2, employeeId }),
      row({ rowIndex: 3, employeeId: "", employeeName: "田中太郎" }),
    ])
    expect(res.failed).toBe(false)
    expect(res.errors).toHaveLength(0)
  })

  it("存在しない従業員名は『見つかりません』エラー", async () => {
    const res = await validateShiftImport([
      row({ rowIndex: 5, employeeId: "", employeeName: "存在しない名前" }),
    ])
    expect(res.failed).toBe(false)
    expect(res.errors).toHaveLength(1)
    expect(res.errors[0].rowIndex).toBe(5)
    expect(res.errors[0].error).toContain("存在しない名前")
    expect(res.errors[0].error).toContain("見つかりません")
  })

  it("同名が複数存在する場合は『複数存在』エラー", async () => {
    await prisma.employee.create({ data: { name: "田中太郎" } })
    const res = await validateShiftImport([
      row({ rowIndex: 4, employeeId: "", employeeName: "田中太郎" }),
    ])
    expect(res.errors).toHaveLength(1)
    expect(res.errors[0].error).toContain("複数存在")
  })

  it("存在しない従業員IDは『存在しません』エラー", async () => {
    const res = await validateShiftImport([
      row({ rowIndex: 7, employeeId: "00000000-0000-0000-0000-000000000000" }),
    ])
    expect(res.errors).toHaveLength(1)
    expect(res.errors[0].rowIndex).toBe(7)
    expect(res.errors[0].error).toContain("存在しません")
  })

  it("有効行と無効行が混在する場合、無効行だけエラーになる", async () => {
    const res = await validateShiftImport([
      row({ rowIndex: 2, employeeId }),
      row({ rowIndex: 3, employeeId: "", employeeName: "存在しない名前" }),
    ])
    expect(res.errors).toHaveLength(1)
    expect(res.errors[0].rowIndex).toBe(3)
  })

  it("未認証では拒否される", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never)
    await expect(
      validateShiftImport([row({ rowIndex: 2, employeeId })])
    ).rejects.toThrow()
  })
})
