import { describe, it, expect } from "vitest"
import {
  groupSchema,
  employeeSchema,
  shiftSchema,
  shiftBulkSchema,
  functionRoleSchema,
  roleAssignmentSchema,
  shiftCodeSchema,
  dutyAssignmentSchema,
  dutyTypeSchema,
  roleCsvRowSchema,
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
        hireDate: "2026-01-01",
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

    it("should accept optional fields omitted", () => {
      const result = employeeSchema.safeParse({ name: "田中太郎" })
      expect(result.success).toBe(true)
    })
  })

  describe("shiftSchema", () => {
    it("should accept valid shift data", () => {
      const result = shiftSchema.safeParse({
        employeeId: "550e8400-e29b-41d4-a716-446655440000",
        shiftDate: "2026-01-15",
        shiftCode: "A",
        startTime: "09:00",
        endTime: "18:00",
        isHoliday: false,

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
        employeeId: "550e8400-e29b-41d4-a716-446655440000",
        shiftDate: "",
      })
      expect(result.success).toBe(false)
    })

    it("should default boolean fields to false", () => {
      const result = shiftSchema.safeParse({
        employeeId: "550e8400-e29b-41d4-a716-446655440000",
        shiftDate: "2026-01-15",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isHoliday).toBe(false)
        expect(result.data.isRemote).toBe(false)
      }
    })

    it("should accept nullable optional fields", () => {
      const result = shiftSchema.safeParse({
        employeeId: "550e8400-e29b-41d4-a716-446655440000",
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

    it("should reject empty roleType", () => {
      const result = functionRoleSchema.safeParse({
        roleCode: "MANAGER",
        roleName: "マネージャー",
        roleType: "",
      })
      expect(result.success).toBe(false)
    })

    it("should accept any non-empty roleType string", () => {
      for (const roleType of ["FUNCTION", "AUTHORITY", "業務", "カスタム"]) {
        const result = functionRoleSchema.safeParse({
          roleCode: "MANAGER",
          roleName: "マネージャー",
          roleType,
        })
        expect(result.success).toBe(true)
      }
    })

    it("should reject roleType over 20 characters", () => {
      const result = functionRoleSchema.safeParse({
        roleCode: "MANAGER",
        roleName: "マネージャー",
        roleType: "あ".repeat(21),
      })
      expect(result.success).toBe(false)
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
        employeeId: "550e8400-e29b-41d4-a716-446655440000",
        functionRoleId: 1,
        isPrimary: true,
        startDate: "2026-01-01",
        endDate: null,
      })
      expect(result.success).toBe(true)
    })

    it("should coerce functionRoleId from string", () => {
      const result = roleAssignmentSchema.safeParse({
        employeeId: "550e8400-e29b-41d4-a716-446655440000",
        functionRoleId: "2",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.employeeId).toBe("550e8400-e29b-41d4-a716-446655440000")
        expect(result.data.functionRoleId).toBe(2)
      }
    })

    it("should default isPrimary to false", () => {
      const result = roleAssignmentSchema.safeParse({
        employeeId: "550e8400-e29b-41d4-a716-446655440000",
        functionRoleId: 1,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isPrimary).toBe(false)
      }
    })

    it("should accept optional date fields", () => {
      const result = roleAssignmentSchema.safeParse({
        employeeId: "550e8400-e29b-41d4-a716-446655440000",
        functionRoleId: 1,
      })
      expect(result.success).toBe(true)
    })
  })

  describe("shiftCodeSchema", () => {
    it("should accept valid shift code data", () => {
      const result = shiftCodeSchema.safeParse({
        code: "A",

        defaultStartTime: "09:00",
        defaultEndTime: "18:00",
        defaultIsHoliday: false,

        isActive: true,
        sortOrder: 0,
      })
      expect(result.success).toBe(true)
    })

    it("should reject empty code", () => {
      const result = shiftCodeSchema.safeParse({
        code: "",

      })
      expect(result.success).toBe(false)
    })

    it("should reject code over 20 characters", () => {
      const result = shiftCodeSchema.safeParse({
        code: "A".repeat(21),

      })
      expect(result.success).toBe(false)
    })

    it("should default boolean fields to false", () => {
      const result = shiftCodeSchema.safeParse({
        code: "A",

      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.defaultIsHoliday).toBe(false)
      }
    })

    it("should default isActive to true", () => {
      const result = shiftCodeSchema.safeParse({
        code: "A",

      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isActive).toBe(true)
      }
    })

    it("should default sortOrder to 0", () => {
      const result = shiftCodeSchema.safeParse({
        code: "A",

      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sortOrder).toBe(0)
      }
    })

    it("should coerce sortOrder from string", () => {
      const result = shiftCodeSchema.safeParse({
        code: "A",

        sortOrder: "5",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sortOrder).toBe(5)
      }
    })

    it("should reject negative sortOrder", () => {
      const result = shiftCodeSchema.safeParse({
        code: "A",

        sortOrder: -1,
      })
      expect(result.success).toBe(false)
    })

    it("should accept nullable time fields", () => {
      const result = shiftCodeSchema.safeParse({
        code: "H",
        defaultStartTime: null,
        defaultEndTime: null,
      })
      expect(result.success).toBe(true)
    })

    it("should accept color field", () => {
      const result = shiftCodeSchema.safeParse({
        code: "A",
        color: "blue",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.color).toBe("blue")
      }
    })

    it("should accept null color", () => {
      const result = shiftCodeSchema.safeParse({
        code: "A",
        color: null,
      })
      expect(result.success).toBe(true)
    })

    it("should accept omitted color", () => {
      const result = shiftCodeSchema.safeParse({
        code: "A",
      })
      expect(result.success).toBe(true)
    })

    it("should reject color over 20 characters", () => {
      const result = shiftCodeSchema.safeParse({
        code: "A",
        color: "a".repeat(21),
      })
      expect(result.success).toBe(false)
    })
  })

  describe("dutyAssignmentSchema", () => {
    const validData = {
      employeeId: "550e8400-e29b-41d4-a716-446655440000",
      dutyTypeId: 1,
      dutyDate: "2026-04-01",
      startTime: "09:00",
      endTime: "17:00",
    }

    it("通常の業務割当を受け入れる", () => {
      const result = dutyAssignmentSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it("深夜跨ぎの業務割当を受け入れる（例: 22:00〜08:00）", () => {
      const result = dutyAssignmentSchema.safeParse({
        ...validData,
        startTime: "22:00",
        endTime: "08:00",
      })
      expect(result.success).toBe(true)
    })

    it("開始時刻と終了時刻が同じ場合は拒否する", () => {
      const result = dutyAssignmentSchema.safeParse({
        ...validData,
        startTime: "09:00",
        endTime: "09:00",
      })
      expect(result.success).toBe(false)
    })

    it("開始時刻が空の場合は拒否する", () => {
      const result = dutyAssignmentSchema.safeParse({
        ...validData,
        startTime: "",
      })
      expect(result.success).toBe(false)
    })

    it("終了時刻が空の場合は拒否する", () => {
      const result = dutyAssignmentSchema.safeParse({
        ...validData,
        endTime: "",
      })
      expect(result.success).toBe(false)
    })

    it("noteはオプション", () => {
      const result = dutyAssignmentSchema.safeParse({
        ...validData,
        note: "テスト備考",
      })
      expect(result.success).toBe(true)
    })

    it("reducesCapacity=false を受け入れる", () => {
      const result = dutyAssignmentSchema.safeParse({
        ...validData,
        reducesCapacity: false,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.reducesCapacity).toBe(false)
      }
    })

    it("reducesCapacity 省略時はデフォルトtrue", () => {
      const result = dutyAssignmentSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.reducesCapacity).toBe(true)
      }
    })

    it("titleを受け入れる", () => {
      const result = dutyAssignmentSchema.safeParse({
        ...validData,
        title: "A社訪問",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe("A社訪問")
      }
    })

    it("title省略時はundefined", () => {
      const result = dutyAssignmentSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBeUndefined()
      }
    })

    it("title空文字はundefinedに変換", () => {
      const result = dutyAssignmentSchema.safeParse({
        ...validData,
        title: "",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBeUndefined()
      }
    })

    it("title 100文字は受け入れる", () => {
      const result = dutyAssignmentSchema.safeParse({
        ...validData,
        title: "あ".repeat(100),
      })
      expect(result.success).toBe(true)
    })

    it("title 101文字は拒否する", () => {
      const result = dutyAssignmentSchema.safeParse({
        ...validData,
        title: "あ".repeat(101),
      })
      expect(result.success).toBe(false)
    })
  })

  describe("roleCsvRowSchema", () => {
    const validData = {
      employeeName: "山田太郎",
      roleCode: "LEADER",
      isPrimary: true,
      startDate: "2026-04-01",
      endDate: null,
    }

    it("should accept valid role CSV data", () => {
      const result = roleCsvRowSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it("should reject empty employeeName", () => {
      const result = roleCsvRowSchema.safeParse({ ...validData, employeeName: "" })
      expect(result.success).toBe(false)
    })

    it("should reject empty roleCode", () => {
      const result = roleCsvRowSchema.safeParse({ ...validData, roleCode: "" })
      expect(result.success).toBe(false)
    })

    it("should reject roleCode over 20 characters", () => {
      const result = roleCsvRowSchema.safeParse({ ...validData, roleCode: "A".repeat(21) })
      expect(result.success).toBe(false)
    })

    it("should accept null dates", () => {
      const result = roleCsvRowSchema.safeParse({ ...validData, startDate: null, endDate: null })
      expect(result.success).toBe(true)
    })

    it("should accept string dates", () => {
      const result = roleCsvRowSchema.safeParse({ ...validData, startDate: "2026-04-01", endDate: "2027-03-31" })
      expect(result.success).toBe(true)
    })
  })

  describe("dutyTypeSchema", () => {
    const validData = {
      name: "電話対応",
      isActive: true,
      sortOrder: 0,
      defaultReducesCapacity: true,
    }

    it("should accept valid data without default times", () => {
      const result = dutyTypeSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it("should accept valid data with default times and note", () => {
      const result = dutyTypeSchema.safeParse({
        ...validData,
        defaultStartTime: "09:00",
        defaultEndTime: "17:00",
        defaultNote: "メモ",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.defaultStartTime).toBe("09:00")
        expect(result.data.defaultEndTime).toBe("17:00")
        expect(result.data.defaultNote).toBe("メモ")
      }
    })

    it("should transform empty string to null for defaultStartTime", () => {
      const result = dutyTypeSchema.safeParse({
        ...validData,
        defaultStartTime: "",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.defaultStartTime).toBeNull()
      }
    })

    it("should transform empty string to null for defaultEndTime", () => {
      const result = dutyTypeSchema.safeParse({
        ...validData,
        defaultEndTime: "",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.defaultEndTime).toBeNull()
      }
    })

    it("should transform empty string to null for defaultNote", () => {
      const result = dutyTypeSchema.safeParse({
        ...validData,
        defaultNote: "",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.defaultNote).toBeNull()
      }
    })

    it("should reject invalid time format (25:00)", () => {
      const result = dutyTypeSchema.safeParse({
        ...validData,
        defaultStartTime: "25:00",
      })
      expect(result.success).toBe(false)
    })

    it("should reject invalid time format (9:00 - missing leading zero)", () => {
      const result = dutyTypeSchema.safeParse({
        ...validData,
        defaultStartTime: "9:00",
      })
      expect(result.success).toBe(false)
    })

    it("should reject invalid time format (abc)", () => {
      const result = dutyTypeSchema.safeParse({
        ...validData,
        defaultStartTime: "abc",
      })
      expect(result.success).toBe(false)
    })

    it("should reject invalid minute (09:60)", () => {
      const result = dutyTypeSchema.safeParse({
        ...validData,
        defaultEndTime: "09:60",
      })
      expect(result.success).toBe(false)
    })

    it("should accept boundary time values (00:00 and 23:59)", () => {
      const result = dutyTypeSchema.safeParse({
        ...validData,
        defaultStartTime: "00:00",
        defaultEndTime: "23:59",
      })
      expect(result.success).toBe(true)
    })

    it("should accept start time only (no end time)", () => {
      const result = dutyTypeSchema.safeParse({
        ...validData,
        defaultStartTime: "09:00",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.defaultStartTime).toBe("09:00")
        expect(result.data.defaultEndTime).toBeUndefined()
      }
    })

    it("should accept end time only (no start time)", () => {
      const result = dutyTypeSchema.safeParse({
        ...validData,
        defaultEndTime: "17:00",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.defaultStartTime).toBeUndefined()
        expect(result.data.defaultEndTime).toBe("17:00")
      }
    })

    it("should reject empty name", () => {
      const result = dutyTypeSchema.safeParse({ ...validData, name: "" })
      expect(result.success).toBe(false)
    })

    it("should reject name over 50 characters", () => {
      const result = dutyTypeSchema.safeParse({ ...validData, name: "あ".repeat(51) })
      expect(result.success).toBe(false)
    })

    it("should accept defaultTitle", () => {
      const result = dutyTypeSchema.safeParse({
        ...validData,
        defaultTitle: "A社訪問",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.defaultTitle).toBe("A社訪問")
      }
    })

    it("should transform empty string to null for defaultTitle", () => {
      const result = dutyTypeSchema.safeParse({
        ...validData,
        defaultTitle: "",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.defaultTitle).toBeNull()
      }
    })

    it("should reject defaultTitle over 100 characters", () => {
      const result = dutyTypeSchema.safeParse({
        ...validData,
        defaultTitle: "あ".repeat(101),
      })
      expect(result.success).toBe(false)
    })
  })
})
