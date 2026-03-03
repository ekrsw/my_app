import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const {
  createFunctionRole,
  updateFunctionRole,
  deleteFunctionRole,
  assignRole,
  updateEmployeeRole,
  unassignRole,
} = await import("@/lib/actions/role-actions")

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value)
  }
  return fd
}

describe("Role Actions", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  describe("createFunctionRole", () => {
    it("should create a role successfully", async () => {
      const result = await createFunctionRole(
        makeFormData({
          roleCode: "MANAGER",
          roleName: "マネージャー",
          roleType: "FUNCTION",
          isActive: "true",
        })
      )

      expect(result).toEqual({ success: true })

      const roles = await prisma.functionRole.findMany()
      expect(roles).toHaveLength(1)
      expect(roles[0].roleCode).toBe("MANAGER")
    })

    it("should return error for duplicate role code (P2002)", async () => {
      await prisma.functionRole.create({
        data: {
          roleCode: "MANAGER",
          roleName: "マネージャー",
          roleType: "FUNCTION",
        },
      })

      const result = await createFunctionRole(
        makeFormData({
          roleCode: "MANAGER",
          roleName: "別のマネージャー",
          roleType: "FUNCTION",
          isActive: "true",
        })
      )

      expect(result.error).toBeDefined()
      expect(result.error).toContain("既に使用されています")
    })
  })

  describe("updateFunctionRole", () => {
    it("should update a role successfully", async () => {
      const role = await prisma.functionRole.create({
        data: {
          roleCode: "MANAGER",
          roleName: "マネージャー",
          roleType: "FUNCTION",
        },
      })

      const result = await updateFunctionRole(
        role.id,
        makeFormData({
          roleCode: "MANAGER",
          roleName: "シニアマネージャー",
          roleType: "FUNCTION",
          isActive: "true",
        })
      )

      expect(result).toEqual({ success: true })

      const updated = await prisma.functionRole.findUnique({
        where: { id: role.id },
      })
      expect(updated!.roleName).toBe("シニアマネージャー")
    })
  })

  describe("deleteFunctionRole", () => {
    it("should delete a role with no assignments", async () => {
      const role = await prisma.functionRole.create({
        data: {
          roleCode: "MANAGER",
          roleName: "マネージャー",
          roleType: "FUNCTION",
        },
      })

      const result = await deleteFunctionRole(role.id)

      expect(result).toEqual({ success: true })
    })
  })

  describe("assignRole", () => {
    it("should assign a role to an employee", async () => {
      const employee = await prisma.employee.create({
        data: { name: "田中太郎" },
      })
      const role = await prisma.functionRole.create({
        data: {
          roleCode: "MANAGER",
          roleName: "マネージャー",
          roleType: "FUNCTION",
        },
      })

      const result = await assignRole({
        employeeId: employee.id,
        functionRoleId: role.id,
        isPrimary: true,
        startDate: "2026-01-01",
      })

      expect(result).toEqual({ success: true })

      const assignments = await prisma.employeeFunctionRole.findMany()
      expect(assignments).toHaveLength(1)
      expect(assignments[0].employeeId).toBe(employee.id)
      expect(assignments[0].isPrimary).toBe(true)
    })

    it("should return error for duplicate role type assignment (P2002)", async () => {
      const employee = await prisma.employee.create({
        data: { name: "田中太郎" },
      })
      const role1 = await prisma.functionRole.create({
        data: {
          roleCode: "MANAGER",
          roleName: "マネージャー",
          roleType: "FUNCTION",
        },
      })
      const role2 = await prisma.functionRole.create({
        data: {
          roleCode: "LEADER",
          roleName: "リーダー",
          roleType: "FUNCTION",
        },
      })

      // First assignment
      await assignRole({
        employeeId: employee.id,
        functionRoleId: role1.id,
      })

      // Second assignment with same roleType should fail
      const result = await assignRole({
        employeeId: employee.id,
        functionRoleId: role2.id,
      })

      expect(result.error).toBeDefined()
    })
  })

  describe("updateEmployeeRole", () => {
    it("should update a role assignment", async () => {
      const employee = await prisma.employee.create({
        data: { name: "田中太郎" },
      })
      const role = await prisma.functionRole.create({
        data: {
          roleCode: "MANAGER",
          roleName: "マネージャー",
          roleType: "FUNCTION",
        },
      })

      await assignRole({
        employeeId: employee.id,
        functionRoleId: role.id,
        isPrimary: false,
      })

      const assignment = await prisma.employeeFunctionRole.findFirst()

      const result = await updateEmployeeRole(assignment!.id, {
        isPrimary: true,
        startDate: "2026-02-01",
      })

      expect(result).toEqual({ success: true })

      const updated = await prisma.employeeFunctionRole.findUnique({
        where: { id: assignment!.id },
      })
      expect(updated!.isPrimary).toBe(true)
    })
  })

  describe("unassignRole", () => {
    it("should set endDate on role assignment", async () => {
      const employee = await prisma.employee.create({
        data: { name: "田中太郎" },
      })
      const role = await prisma.functionRole.create({
        data: {
          roleCode: "MANAGER",
          roleName: "マネージャー",
          roleType: "FUNCTION",
        },
      })

      await assignRole({
        employeeId: employee.id,
        functionRoleId: role.id,
      })

      const assignment = await prisma.employeeFunctionRole.findFirst()

      const result = await unassignRole(assignment!.id)

      expect(result).toEqual({ success: true })

      const updated = await prisma.employeeFunctionRole.findUnique({
        where: { id: assignment!.id },
      })
      expect(updated!.endDate).not.toBeNull()
    })
  })
})
