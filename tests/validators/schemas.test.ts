import { describe, it, expect } from "vitest"
import {
  groupSchema,
  employeeSchema,
  shiftSchema,
  shiftBulkSchema,
  functionRoleSchema,
  roleAssignmentSchema,
} from "@/lib/validators"

describe("Zod Validation Schemas", () => {
  describe("groupSchema", () => {
    it("should accept valid group data", () => {
      const result = groupSchema.safeParse({ name: "開発部" })
      expect(result.success).toBe(true)
    })

    it("should reject empty name", () => {
      const result = groupSchema.safeParse({ name: "" })
      expect(result.success).toBe(false)
    })

    it("should reject name over 50 characters", () => {
      const result = groupSchema.safeParse({ name: "あ".repeat(51) })
      expect(result.success).toBe(false)
    })

    it("should accept name at 50 characters", () => {
      const result = groupSchema.safeParse({ name: "あ".repeat(50) })
      expect(result.success).toBe(true)
    })
  })

  describe("employeeSchema", () => {
    it("should accept valid employee data", () => {
      const result = employeeSchema.safeParse({
        name: "田中太郎",
        nameKana: "タナカタロウ",
        groupId: 1,
        assignmentDate: "2026-01-01",
        terminationDate: null,
      })
      expect(result.success).toBe(true)
    })

    it("should reject empty name", () => {
      const result = employeeSchema.safeParse({ name: "" })
      expect(result.success).toBe(false)
    })

    it("should reject name over 100 characters", () => {
      const result = employeeSchema.safeParse({ name: "あ".repeat(101) })
      expect(result.success).toBe(false)
    })

    it("should accept nullable nameKana", () => {
      const result = employeeSchema.safeParse({ name: "田中太郎", nameKana: null })
      expect(result.success).toBe(true)
    })

    it("should reject nameKana over 100 characters", () => {
      const result = employeeSchema.safeParse({
        name: "田中太郎",
        nameKana: "ア".repeat(101),
      })
      expect(result.success).toBe(false)
    })

    it("should accept nullable groupId", () => {
      const result = employeeSchema.safeParse({ name: "田中太郎", groupId: null })
      expect(result.success).toBe(true)
    })

    it("should accept optional fields omitted", () => {
      const result = employeeSchema.safeParse({ name: "田中太郎" })
      expect(result.success).toBe(true)
    })
  })

  describe("shiftSchema", () => {
    it("should accept valid shift data", () => {
      const result = shiftSchema.safeParse({
        employeeId: 1,
        shiftDate: "2026-01-15",
        shiftCode: "A",
        startTime: "09:00",
        endTime: "18:00",
        isHoliday: false,
        isPaidLeave: false,
        isRemote: false,
      })
      expect(result.success).toBe(true)
    })

    it("should require employeeId", () => {
      const result = shiftSchema.safeParse({
        shiftDate: "2026-01-15",
      })
      expect(result.success).toBe(false)
    })

    it("should require shiftDate", () => {
      const result = shiftSchema.safeParse({
        employeeId: 1,
        shiftDate: "",
      })
      expect(result.success).toBe(false)
    })

    it("should default boolean fields to false", () => {
      const result = shiftSchema.safeParse({
        employeeId: 1,
        shiftDate: "2026-01-15",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isHoliday).toBe(false)
        expect(result.data.isPaidLeave).toBe(false)
        expect(result.data.isRemote).toBe(false)
      }
    })

    it("should accept nullable optional fields", () => {
      const result = shiftSchema.safeParse({
        employeeId: 1,
        shiftDate: "2026-01-15",
        shiftCode: null,
        startTime: null,
        endTime: null,
      })
      expect(result.success).toBe(true)
    })
  })

  describe("shiftBulkSchema", () => {
    it("should accept valid bulk update data", () => {
      const result = shiftBulkSchema.safeParse({
        shiftIds: [1, 2, 3],
        shiftCode: "A",
      })
      expect(result.success).toBe(true)
    })

    it("should reject empty shiftIds array", () => {
      const result = shiftBulkSchema.safeParse({
        shiftIds: [],
        shiftCode: "A",
      })
      expect(result.success).toBe(false)
    })
  })

  describe("functionRoleSchema", () => {
    it("should accept valid role data", () => {
      const result = functionRoleSchema.safeParse({
        roleCode: "MANAGER",
        roleName: "マネージャー",
        roleType: "FUNCTION",
        isActive: true,
      })
      expect(result.success).toBe(true)
    })

    it("should reject empty roleCode", () => {
      const result = functionRoleSchema.safeParse({
        roleCode: "",
        roleName: "マネージャー",
        roleType: "FUNCTION",
      })
      expect(result.success).toBe(false)
    })

    it("should reject lowercase roleCode", () => {
      const result = functionRoleSchema.safeParse({
        roleCode: "manager",
        roleName: "マネージャー",
        roleType: "FUNCTION",
      })
      expect(result.success).toBe(false)
    })

    it("should reject roleCode with numbers", () => {
      const result = functionRoleSchema.safeParse({
        roleCode: "ROLE123",
        roleName: "マネージャー",
        roleType: "FUNCTION",
      })
      expect(result.success).toBe(false)
    })

    it("should accept roleCode with underscores", () => {
      const result = functionRoleSchema.safeParse({
        roleCode: "TEAM_LEADER",
        roleName: "チームリーダー",
        roleType: "FUNCTION",
      })
      expect(result.success).toBe(true)
    })

    it("should reject invalid roleType", () => {
      const result = functionRoleSchema.safeParse({
        roleCode: "MANAGER",
        roleName: "マネージャー",
        roleType: "INVALID",
      })
      expect(result.success).toBe(false)
    })

    it("should accept all valid roleType values", () => {
      for (const roleType of ["FUNCTION", "AUTHORITY", "POSITION"]) {
        const result = functionRoleSchema.safeParse({
          roleCode: "MANAGER",
          roleName: "マネージャー",
          roleType,
        })
        expect(result.success).toBe(true)
      }
    })

    it("should default isActive to true", () => {
      const result = functionRoleSchema.safeParse({
        roleCode: "MANAGER",
        roleName: "マネージャー",
        roleType: "FUNCTION",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isActive).toBe(true)
      }
    })

    it("should reject roleCode over 20 characters", () => {
      const result = functionRoleSchema.safeParse({
        roleCode: "A".repeat(21),
        roleName: "マネージャー",
        roleType: "FUNCTION",
      })
      expect(result.success).toBe(false)
    })

    it("should reject roleName over 50 characters", () => {
      const result = functionRoleSchema.safeParse({
        roleCode: "MANAGER",
        roleName: "あ".repeat(51),
        roleType: "FUNCTION",
      })
      expect(result.success).toBe(false)
    })
  })

  describe("roleAssignmentSchema", () => {
    it("should accept valid assignment data", () => {
      const result = roleAssignmentSchema.safeParse({
        employeeId: 1,
        functionRoleId: 1,
        isPrimary: true,
        startDate: "2026-01-01",
        endDate: null,
      })
      expect(result.success).toBe(true)
    })

    it("should coerce string numbers", () => {
      const result = roleAssignmentSchema.safeParse({
        employeeId: "1",
        functionRoleId: "2",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.employeeId).toBe(1)
        expect(result.data.functionRoleId).toBe(2)
      }
    })

    it("should default isPrimary to false", () => {
      const result = roleAssignmentSchema.safeParse({
        employeeId: 1,
        functionRoleId: 1,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isPrimary).toBe(false)
      }
    })

    it("should accept optional date fields", () => {
      const result = roleAssignmentSchema.safeParse({
        employeeId: 1,
        functionRoleId: 1,
      })
      expect(result.success).toBe(true)
    })
  })
})
