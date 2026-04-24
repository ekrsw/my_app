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

const { importRoleAssignments } = await import("@/lib/actions/role-actions")

async function createEmployee(name: string, terminationDate?: Date) {
  return prisma.employee.create({
    data: { name, terminationDate },
  })
}

async function createRole(
  roleCode: string,
  roleType = "FUNCTION",
  isActive = true,
  kind: "SUPERVISOR" | "BUSINESS" | "OTHER" = "OTHER"
) {
  return prisma.functionRole.create({
    data: { roleCode, roleName: roleCode, roleType, kind, isActive },
  })
}

describe("importRoleAssignments", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  describe("正常系", () => {
    it("複数行を一括登録できる", async () => {
      const emp1 = await createEmployee("山田太郎")
      const emp2 = await createEmployee("田中花子")
      const role1 = await createRole("LEADER")
      const role2 = await createRole("OPERATOR")

      const result = await importRoleAssignments([
        { rowIndex: 2, employeeName: "山田太郎", roleCode: "LEADER", isPrimary: true, startDate: "2026-04-01", endDate: null },
        { rowIndex: 3, employeeName: "田中花子", roleCode: "OPERATOR", isPrimary: false, startDate: "2026-04-01", endDate: null },
      ])

      expect(result.success).toBe(true)
      expect(result.created).toBe(2)
      expect(result.errors).toHaveLength(0)

      const assignments = await prisma.employeeFunctionRole.findMany()
      expect(assignments).toHaveLength(2)

      const yamaAssign = assignments.find((a) => a.employeeId === emp1.id)
      expect(yamaAssign).toBeDefined()
      expect(yamaAssign!.functionRoleId).toBe(role1.id)
      expect(yamaAssign!.isPrimary).toBe(true)

      const tanaAssign = assignments.find((a) => a.employeeId === emp2.id)
      expect(tanaAssign).toBeDefined()
      expect(tanaAssign!.functionRoleId).toBe(role2.id)
      expect(tanaAssign!.isPrimary).toBe(false)
    })

    it("roleTypeがFunctionRoleから自動設定される", async () => {
      await createEmployee("山田太郎")
      await createRole("NIGHT_SHIFT", "NIGHT")

      const result = await importRoleAssignments([
        { rowIndex: 2, employeeName: "山田太郎", roleCode: "NIGHT_SHIFT", isPrimary: false, startDate: null, endDate: null },
      ])

      expect(result.success).toBe(true)

      const assignment = await prisma.employeeFunctionRole.findFirst()
      expect(assignment!.roleType).toBe("NIGHT")
    })

    it("startDate/endDateがnullの場合はnullで登録される", async () => {
      await createEmployee("山田太郎")
      await createRole("LEADER")

      const result = await importRoleAssignments([
        { rowIndex: 2, employeeName: "山田太郎", roleCode: "LEADER", isPrimary: false, startDate: null, endDate: null },
      ])

      expect(result.success).toBe(true)
      const assignment = await prisma.employeeFunctionRole.findFirst()
      expect(assignment!.startDate).toBeNull()
      expect(assignment!.endDate).toBeNull()
    })
  })

  describe("エラー系: 従業員", () => {
    it("存在しない従業員名はエラー", async () => {
      await createRole("LEADER")

      const result = await importRoleAssignments([
        { rowIndex: 2, employeeName: "存在しない人", roleCode: "LEADER", isPrimary: false, startDate: null, endDate: null },
      ])

      expect(result.created).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toContain("従業員が見つかりません")
    })

    it("同姓同名の従業員はエラー", async () => {
      await createEmployee("山田太郎")
      await createEmployee("山田太郎")
      await createRole("LEADER")

      const result = await importRoleAssignments([
        { rowIndex: 2, employeeName: "山田太郎", roleCode: "LEADER", isPrimary: false, startDate: null, endDate: null },
      ])

      expect(result.created).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toContain("同名の従業員が複数います")
    })

    it("退職済み従業員はマッチしない", async () => {
      await createEmployee("山田太郎", new Date("2025-12-31"))
      await createRole("LEADER")

      const result = await importRoleAssignments([
        { rowIndex: 2, employeeName: "山田太郎", roleCode: "LEADER", isPrimary: false, startDate: null, endDate: null },
      ])

      expect(result.created).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toContain("従業員が見つかりません")
    })
  })

  describe("エラー系: ロール", () => {
    it("存在しないロールコードはエラー", async () => {
      await createEmployee("山田太郎")

      const result = await importRoleAssignments([
        { rowIndex: 2, employeeName: "山田太郎", roleCode: "UNKNOWN", isPrimary: false, startDate: null, endDate: null },
      ])

      expect(result.created).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toContain("存在しないロールコード")
    })

    it("非アクティブロールはエラー", async () => {
      await createEmployee("山田太郎")
      await createRole("INACTIVE_ROLE", "FUNCTION", false)

      const result = await importRoleAssignments([
        { rowIndex: 2, employeeName: "山田太郎", roleCode: "INACTIVE_ROLE", isPrimary: false, startDate: null, endDate: null },
      ])

      expect(result.created).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toContain("存在しないロールコード")
    })
  })

  describe("エラー系: 重複", () => {
    it("既存アクティブ割当と同じroleTypeはエラー", async () => {
      const emp = await createEmployee("山田太郎")
      const role1 = await createRole("LEADER")
      const role2 = await createRole("SUB_LEADER")

      // 既存のアクティブ割当を作成
      await prisma.employeeFunctionRole.create({
        data: {
          employeeId: emp.id,
          functionRoleId: role1.id,
          roleType: "FUNCTION",
          isPrimary: true,
          endDate: null,
        },
      })

      const result = await importRoleAssignments([
        { rowIndex: 2, employeeName: "山田太郎", roleCode: "SUB_LEADER", isPrimary: false, startDate: null, endDate: null },
      ])

      expect(result.created).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toContain("既に同カテゴリのロールが割当済み")
    })

    it("CSV内で同一従業員×同一roleTypeが重複した場合、後の行がエラー", async () => {
      await createEmployee("山田太郎")
      await createRole("LEADER")
      await createRole("SUB_LEADER")

      const result = await importRoleAssignments([
        { rowIndex: 2, employeeName: "山田太郎", roleCode: "LEADER", isPrimary: true, startDate: null, endDate: null },
        { rowIndex: 3, employeeName: "山田太郎", roleCode: "SUB_LEADER", isPrimary: false, startDate: null, endDate: null },
      ])

      expect(result.created).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].rowIndex).toBe(3)
      expect(result.errors[0].error).toContain("CSV内で重複")
    })
  })

  describe("エラー行と正常行の混在", () => {
    it("エラー行をスキップして正常行のみインポートする", async () => {
      await createEmployee("山田太郎")
      await createEmployee("田中花子")
      await createRole("LEADER")

      const result = await importRoleAssignments([
        { rowIndex: 2, employeeName: "山田太郎", roleCode: "LEADER", isPrimary: true, startDate: null, endDate: null },
        { rowIndex: 3, employeeName: "存在しない人", roleCode: "LEADER", isPrimary: false, startDate: null, endDate: null },
        { rowIndex: 4, employeeName: "田中花子", roleCode: "UNKNOWN", isPrimary: false, startDate: null, endDate: null },
      ])

      expect(result.created).toBe(1)
      expect(result.errors).toHaveLength(2)
    })
  })
})
