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

const {
  addEmployeePosition,
  updateEmployeePosition,
  updateEmployeeWithRoles,
} = await import("@/lib/actions/employee-actions")

describe("Employee Position Actions - nullable startDate", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  describe("addEmployeePosition", () => {
    it("startDate 未指定で追加すると null で保存される（今日を補完しない）", async () => {
      const position = await prisma.position.create({
        data: { positionCode: "CHIEF", positionName: "主任" },
      })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })

      const result = await addEmployeePosition({
        employeeId: emp.id,
        positionId: position.id,
      })

      expect(result).toEqual({ success: true })

      const ep = await prisma.employeePosition.findFirst({
        where: { employeeId: emp.id },
      })
      expect(ep).not.toBeNull()
      expect(ep!.startDate).toBeNull()
    })

    it("startDate=null を明示的に渡して追加すると null で保存される", async () => {
      const position = await prisma.position.create({
        data: { positionCode: "CHIEF", positionName: "主任" },
      })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })

      const result = await addEmployeePosition({
        employeeId: emp.id,
        positionId: position.id,
        startDate: null,
      })

      expect(result).toEqual({ success: true })

      const ep = await prisma.employeePosition.findFirst({
        where: { employeeId: emp.id },
      })
      expect(ep!.startDate).toBeNull()
    })

    it("startDate を指定して追加すると日付が保存される", async () => {
      const position = await prisma.position.create({
        data: { positionCode: "CHIEF", positionName: "主任" },
      })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })

      const result = await addEmployeePosition({
        employeeId: emp.id,
        positionId: position.id,
        startDate: "2025-04-01",
      })

      expect(result).toEqual({ success: true })

      const ep = await prisma.employeePosition.findFirst({
        where: { employeeId: emp.id },
      })
      expect(ep!.startDate).not.toBeNull()
    })
  })

  describe("updateEmployeePosition", () => {
    it("startDate を日付から null に更新できる", async () => {
      const position = await prisma.position.create({
        data: { positionCode: "CHIEF", positionName: "主任" },
      })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      const ep = await prisma.employeePosition.create({
        data: {
          employeeId: emp.id,
          positionId: position.id,
          startDate: new Date("2025-04-01"),
        },
      })

      const result = await updateEmployeePosition(ep.id, { startDate: null })

      expect(result).toEqual({ success: true })

      const updated = await prisma.employeePosition.findUnique({
        where: { id: ep.id },
      })
      expect(updated!.startDate).toBeNull()
    })

    it("startDate=null のレコードに日付を設定できる", async () => {
      const position = await prisma.position.create({
        data: { positionCode: "CHIEF", positionName: "主任" },
      })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      const ep = await prisma.employeePosition.create({
        data: { employeeId: emp.id, positionId: position.id, startDate: null },
      })

      const result = await updateEmployeePosition(ep.id, { startDate: "2025-04-01" })

      expect(result).toEqual({ success: true })

      const updated = await prisma.employeePosition.findUnique({
        where: { id: ep.id },
      })
      expect(updated!.startDate).not.toBeNull()
    })

    it("startDate を渡さない更新（undefined）では既存の startDate が保持される", async () => {
      const position = await prisma.position.create({
        data: { positionCode: "CHIEF", positionName: "主任" },
      })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      const ep = await prisma.employeePosition.create({
        data: {
          employeeId: emp.id,
          positionId: position.id,
          startDate: new Date("2025-04-01"),
        },
      })

      // startDate を省略し endDate のみ更新（undefined はフィールドをスキップ）
      const result = await updateEmployeePosition(ep.id, { endDate: "2025-12-31" })

      expect(result).toEqual({ success: true })

      const updated = await prisma.employeePosition.findUnique({
        where: { id: ep.id },
      })
      // 既存の startDate は維持される（null にクリアされない）
      expect(updated!.startDate).not.toBeNull()
      expect(updated!.endDate).not.toBeNull()
    })
  })

  describe("updateEmployeeWithRoles (position changes)", () => {
    it("役職新規追加で startDate 未指定なら null になる（今日を補完しない）", async () => {
      const position = await prisma.position.create({
        data: { positionCode: "CHIEF", positionName: "主任" },
      })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })

      const result = await updateEmployeeWithRoles(
        emp.id,
        { name: "田中太郎", nameKana: null, hireDate: null, terminationDate: null },
        [],
        [{ status: "added" as const, positionId: position.id }],
        []
      )

      expect(result).toEqual({ success: true })

      const eps = await prisma.employeePosition.findMany({
        where: { employeeId: emp.id },
      })
      expect(eps).toHaveLength(1)
      expect(eps[0].startDate).toBeNull()
    })

    it("役職更新で startDate を null に変更できる", async () => {
      const position = await prisma.position.create({
        data: { positionCode: "CHIEF", positionName: "主任" },
      })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      const ep = await prisma.employeePosition.create({
        data: {
          employeeId: emp.id,
          positionId: position.id,
          startDate: new Date("2025-04-01"),
        },
      })

      const result = await updateEmployeeWithRoles(
        emp.id,
        { name: "田中太郎", nameKana: null, hireDate: null, terminationDate: null },
        [],
        [{ status: "modified" as const, id: ep.id, startDate: null }],
        []
      )

      expect(result).toEqual({ success: true })

      const updated = await prisma.employeePosition.findUnique({
        where: { id: ep.id },
      })
      expect(updated!.startDate).toBeNull()
    })
  })
})
