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
  updateGroupHistory,
  deleteGroupHistory,
  updateRoleHistory,
  deleteRoleHistory,
  updatePositionHistory,
  deletePositionHistory,
} = await import("@/lib/actions/employee-actions")

async function createEmployee(name = "田中太郎") {
  return prisma.employee.create({ data: { name } })
}

describe("Employee history edit/delete actions", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  describe("updateGroupHistory", () => {
    it("開始日・終了日を更新できる", async () => {
      const emp = await createEmployee()
      const group = await prisma.group.create({ data: { name: "開発部" } })
      const hist = await prisma.employeeGroupHistory.create({
        data: {
          employeeId: emp.id,
          groupId: group.id,
          startDate: new Date("2026-01-01"),
          endDate: null,
          changeType: "CREATE",
          version: 1,
        },
      })

      const result = await updateGroupHistory(hist.id, {
        startDate: "2026-02-01",
        endDate: "2026-03-31",
      })

      expect(result).toEqual({ success: true })
      const updated = await prisma.employeeGroupHistory.findUnique({ where: { id: hist.id } })
      expect(updated!.startDate?.toISOString().slice(0, 10)).toBe("2026-02-01")
      expect(updated!.endDate?.toISOString().slice(0, 10)).toBe("2026-03-31")
    })

    it("startDate を空文字→null にクリアできる", async () => {
      const emp = await createEmployee()
      const hist = await prisma.employeeGroupHistory.create({
        data: {
          employeeId: emp.id,
          startDate: new Date("2026-01-01"),
          changeType: "CREATE",
          version: 1,
        },
      })

      const result = await updateGroupHistory(hist.id, { startDate: null })

      expect(result).toEqual({ success: true })
      const updated = await prisma.employeeGroupHistory.findUnique({ where: { id: hist.id } })
      expect(updated!.startDate).toBeNull()
    })

    it("不正な groupId はバリデーションエラー", async () => {
      const result = await updateGroupHistory(1, { groupId: -5 })
      expect(result).toHaveProperty("error")
    })

    it("存在しない id はエラーを返す", async () => {
      const result = await updateGroupHistory(999999, { startDate: "2026-01-01" })
      expect(result).toHaveProperty("error")
    })
  })

  describe("deleteGroupHistory", () => {
    it("所属履歴を削除できる", async () => {
      const emp = await createEmployee()
      const hist = await prisma.employeeGroupHistory.create({
        data: { employeeId: emp.id, changeType: "CREATE", version: 1 },
      })

      const result = await deleteGroupHistory(hist.id)

      expect(result).toEqual({ success: true })
      expect(
        await prisma.employeeGroupHistory.findUnique({ where: { id: hist.id } })
      ).toBeNull()
    })

    it("存在しない id はエラーを返す", async () => {
      const result = await deleteGroupHistory(999999)
      expect(result).toHaveProperty("error")
    })
  })

  describe("updateRoleHistory", () => {
    it("roleType・isPrimary・期間を更新できる", async () => {
      const emp = await createEmployee()
      const hist = await prisma.employeeFunctionRoleHistory.create({
        data: {
          employeeId: emp.id,
          roleType: "FUNCTION",
          isPrimary: false,
          changeType: "CREATE",
          version: 1,
        },
      })

      const result = await updateRoleHistory(hist.id, {
        roleType: "ADMIN",
        isPrimary: true,
        startDate: "2026-04-01",
      })

      expect(result).toEqual({ success: true })
      const updated = await prisma.employeeFunctionRoleHistory.findUnique({
        where: { id: hist.id },
      })
      expect(updated!.roleType).toBe("ADMIN")
      expect(updated!.isPrimary).toBe(true)
      expect(updated!.startDate?.toISOString().slice(0, 10)).toBe("2026-04-01")
    })

    it("存在しない id はエラーを返す", async () => {
      const result = await updateRoleHistory(999999, { roleType: "ADMIN" })
      expect(result).toHaveProperty("error")
    })
  })

  describe("deleteRoleHistory", () => {
    it("ロール履歴を削除できる", async () => {
      const emp = await createEmployee()
      const hist = await prisma.employeeFunctionRoleHistory.create({
        data: { employeeId: emp.id, changeType: "CREATE", version: 1 },
      })

      const result = await deleteRoleHistory(hist.id)

      expect(result).toEqual({ success: true })
      expect(
        await prisma.employeeFunctionRoleHistory.findUnique({ where: { id: hist.id } })
      ).toBeNull()
    })

    it("存在しない id はエラーを返す", async () => {
      const result = await deleteRoleHistory(999999)
      expect(result).toHaveProperty("error")
    })
  })

  describe("updatePositionHistory", () => {
    it("positionId・期間を更新できる", async () => {
      const emp = await createEmployee()
      const position = await prisma.position.create({
        data: { positionCode: "KACHO", positionName: "課長" },
      })
      const hist = await prisma.employeePositionHistory.create({
        data: {
          employeeId: emp.id,
          startDate: new Date("2026-01-01"),
          changeType: "CREATE",
          version: 1,
        },
      })

      const result = await updatePositionHistory(hist.id, {
        positionId: position.id,
        endDate: "2026-12-31",
      })

      expect(result).toEqual({ success: true })
      const updated = await prisma.employeePositionHistory.findUnique({
        where: { id: hist.id },
      })
      expect(updated!.positionId).toBe(position.id)
      expect(updated!.endDate?.toISOString().slice(0, 10)).toBe("2026-12-31")
    })

    it("不正な positionId はバリデーションエラー", async () => {
      const result = await updatePositionHistory(1, { positionId: 0 })
      expect(result).toHaveProperty("error")
    })

    it("存在しない id はエラーを返す", async () => {
      const result = await updatePositionHistory(999999, { endDate: "2026-12-31" })
      expect(result).toHaveProperty("error")
    })
  })

  describe("deletePositionHistory", () => {
    it("役職履歴を削除できる", async () => {
      const emp = await createEmployee()
      const hist = await prisma.employeePositionHistory.create({
        data: { employeeId: emp.id, changeType: "CREATE", version: 1 },
      })

      const result = await deletePositionHistory(hist.id)

      expect(result).toEqual({ success: true })
      expect(
        await prisma.employeePositionHistory.findUnique({ where: { id: hist.id } })
      ).toBeNull()
    })

    it("存在しない id はエラーを返す", async () => {
      const result = await deletePositionHistory(999999)
      expect(result).toHaveProperty("error")
    })
  })
})
