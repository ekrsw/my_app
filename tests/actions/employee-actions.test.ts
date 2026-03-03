import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const { createEmployee, updateEmployee, deleteEmployee } = await import(
  "@/lib/actions/employee-actions"
)

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value)
  }
  return fd
}

describe("Employee Actions", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  describe("createEmployee", () => {
    it("should create an employee successfully", async () => {
      const result = await createEmployee(
        makeFormData({ name: "田中太郎", nameKana: "タナカタロウ" })
      )

      expect(result).toEqual({ success: true })

      const employees = await prisma.employee.findMany()
      expect(employees).toHaveLength(1)
      expect(employees[0].name).toBe("田中太郎")
    })

    it("should return validation error for empty name", async () => {
      const result = await createEmployee(makeFormData({ name: "" }))

      expect(result.error).toBeDefined()
      expect(result).not.toHaveProperty("success")
    })

    it("should handle groupId assignment via junction table", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })

      const result = await createEmployee(
        makeFormData({ name: "田中太郎", groupId: String(group.id) })
      )

      expect(result).toEqual({ success: true })

      const employee = await prisma.employee.findFirst({
        include: { groups: true },
      })
      expect(employee!.groups).toHaveLength(1)
      expect(employee!.groups[0].groupId).toBe(group.id)
    })
  })

  describe("updateEmployee", () => {
    it("should update an employee successfully", async () => {
      const employee = await prisma.employee.create({
        data: { name: "田中太郎" },
      })

      const result = await updateEmployee(
        employee.id,
        makeFormData({ name: "佐藤太郎" })
      )

      expect(result).toEqual({ success: true })

      const updated = await prisma.employee.findUnique({
        where: { id: employee.id },
      })
      expect(updated!.name).toBe("佐藤太郎")
    })

  })

  describe("deleteEmployee", () => {
    it("should delete an employee successfully", async () => {
      const employee = await prisma.employee.create({
        data: { name: "田中太郎" },
      })

      const result = await deleteEmployee(employee.id)

      expect(result).toEqual({ success: true })

      const found = await prisma.employee.findUnique({
        where: { id: employee.id },
      })
      expect(found).toBeNull()
    })

    it("should cascade delete employee with related data", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })

      const employee = await prisma.employee.create({
        data: { name: "田中太郎" },
      })

      // Create group assignment (which triggers history via DB trigger)
      await prisma.employeeGroup.create({
        data: {
          employeeId: employee.id,
          groupId: group.id,
          startDate: new Date(),
        },
      })

      const result = await deleteEmployee(employee.id)

      expect(result).toEqual({ success: true })

      // 従業員が削除されていること
      const found = await prisma.employee.findUnique({
        where: { id: employee.id },
      })
      expect(found).toBeNull()

      // 関連するジャンクションテーブルのレコードも削除されていること
      const groups = await prisma.employeeGroup.findMany({
        where: { employeeId: employee.id },
      })
      expect(groups).toHaveLength(0)

      // 関連する履歴レコードも削除されていること
      const history = await prisma.employeeGroupHistory.findMany({
        where: { employeeId: employee.id },
      })
      expect(history).toHaveLength(0)
    })
  })
})
