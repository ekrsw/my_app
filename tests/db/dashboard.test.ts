import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

// getTodayJST をモックして固定日付を返す
const MOCK_TODAY = new Date("2025-06-15T00:00:00.000Z") // UTC midnight

vi.mock("@/lib/date-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/date-utils")>()
  return {
    ...original,
    getTodayJST: () => MOCK_TODAY,
  }
})

const { getTodayOverview, getDashboardFilterOptions } = await import(
  "@/lib/db/dashboard"
)

// ヘルパー: 日付を UTC midnight Date として生成
function utcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

// ヘルパー: 出勤シフトの基本データ
function shiftData(employeeId: string, overrides: Record<string, unknown> = {}) {
  return {
    employeeId,
    shiftDate: MOCK_TODAY,
    shiftCode: "A",
    startTime: new Date("1970-01-01T09:00:00Z"),
    endTime: new Date("1970-01-01T17:00:00Z"),
    isHoliday: false,
    ...overrides,
  }
}

describe("Dashboard DB Queries - 日付範囲フィルタリング", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  describe("getTodayOverview - グループの日付フィルタ", () => {
    it("startDate <= today かつ endDate が null のグループは表示される", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      await prisma.employeeGroup.create({
        data: {
          employeeId: emp.id,
          groupId: group.id,
          startDate: utcDate("2025-01-01"),
          endDate: null,
        },
      })
      await prisma.shift.create({ data: shiftData(emp.id) })

      const result = await getTodayOverview()

      expect(result).toHaveLength(1)
      expect(result[0].employee!.groups).toHaveLength(1)
      expect(result[0].employee!.groups[0].group.name).toBe("開発部")
    })

    it("startDate が未来のグループは表示されない", async () => {
      const group = await prisma.group.create({ data: { name: "未来部署" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      await prisma.employeeGroup.create({
        data: {
          employeeId: emp.id,
          groupId: group.id,
          startDate: utcDate("2025-07-01"), // 未来
          endDate: null,
        },
      })
      await prisma.shift.create({ data: shiftData(emp.id) })

      const result = await getTodayOverview()

      expect(result).toHaveLength(1)
      expect(result[0].employee!.groups).toHaveLength(0)
    })

    it("endDate が過去のグループは表示されない", async () => {
      const group = await prisma.group.create({ data: { name: "旧部署" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      await prisma.employeeGroup.create({
        data: {
          employeeId: emp.id,
          groupId: group.id,
          startDate: utcDate("2025-01-01"),
          endDate: utcDate("2025-06-14"), // 昨日
        },
      })
      await prisma.shift.create({ data: shiftData(emp.id) })

      const result = await getTodayOverview()

      expect(result).toHaveLength(1)
      expect(result[0].employee!.groups).toHaveLength(0)
    })

    it("endDate が未来のグループは表示される", async () => {
      const group = await prisma.group.create({ data: { name: "期限付き部署" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      await prisma.employeeGroup.create({
        data: {
          employeeId: emp.id,
          groupId: group.id,
          startDate: utcDate("2025-01-01"),
          endDate: utcDate("2025-12-31"), // 未来
        },
      })
      await prisma.shift.create({ data: shiftData(emp.id) })

      const result = await getTodayOverview()

      expect(result).toHaveLength(1)
      expect(result[0].employee!.groups).toHaveLength(1)
    })

    it("endDate が今日のグループは表示される（境界値）", async () => {
      const group = await prisma.group.create({ data: { name: "本日終了部署" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      await prisma.employeeGroup.create({
        data: {
          employeeId: emp.id,
          groupId: group.id,
          startDate: utcDate("2025-01-01"),
          endDate: utcDate("2025-06-15"), // 今日
        },
      })
      await prisma.shift.create({ data: shiftData(emp.id) })

      const result = await getTodayOverview()

      expect(result).toHaveLength(1)
      expect(result[0].employee!.groups).toHaveLength(1)
    })

    it("startDate が今日のグループは表示される（境界値）", async () => {
      const group = await prisma.group.create({ data: { name: "本日開始部署" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      await prisma.employeeGroup.create({
        data: {
          employeeId: emp.id,
          groupId: group.id,
          startDate: utcDate("2025-06-15"), // 今日
          endDate: null,
        },
      })
      await prisma.shift.create({ data: shiftData(emp.id) })

      const result = await getTodayOverview()

      expect(result).toHaveLength(1)
      expect(result[0].employee!.groups).toHaveLength(1)
    })
  })

  describe("getTodayOverview - ロールの日付フィルタ", () => {
    it("startDate <= today かつ endDate が null のロールは表示される", async () => {
      const role = await prisma.functionRole.create({
        data: { roleCode: "SV", roleName: "SV", roleType: "権限" },
      })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      await prisma.employeeFunctionRole.create({
        data: {
          employeeId: emp.id,
          functionRoleId: role.id,
          startDate: utcDate("2025-01-01"),
          endDate: null,
        },
      })
      await prisma.shift.create({ data: shiftData(emp.id) })

      const result = await getTodayOverview()

      expect(result).toHaveLength(1)
      expect(result[0].employee!.functionRoles).toHaveLength(1)
      expect(result[0].employee!.functionRoles[0].functionRole!.roleName).toBe("SV")
    })

    it("startDate が未来のロールは表示されない", async () => {
      const role = await prisma.functionRole.create({
        data: { roleCode: "SV", roleName: "SV", roleType: "権限" },
      })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      await prisma.employeeFunctionRole.create({
        data: {
          employeeId: emp.id,
          functionRoleId: role.id,
          startDate: utcDate("2025-07-01"), // 未来
          endDate: null,
        },
      })
      await prisma.shift.create({ data: shiftData(emp.id) })

      const result = await getTodayOverview()

      expect(result).toHaveLength(1)
      expect(result[0].employee!.functionRoles).toHaveLength(0)
    })

    it("endDate が過去のロールは表示されない", async () => {
      const role = await prisma.functionRole.create({
        data: { roleCode: "SV", roleName: "SV", roleType: "権限" },
      })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      await prisma.employeeFunctionRole.create({
        data: {
          employeeId: emp.id,
          functionRoleId: role.id,
          startDate: utcDate("2025-01-01"),
          endDate: utcDate("2025-06-14"), // 昨日
        },
      })
      await prisma.shift.create({ data: shiftData(emp.id) })

      const result = await getTodayOverview()

      expect(result).toHaveLength(1)
      expect(result[0].employee!.functionRoles).toHaveLength(0)
    })

    it("endDate が未来のロールは表示される", async () => {
      const role = await prisma.functionRole.create({
        data: { roleCode: "SV", roleName: "SV", roleType: "権限" },
      })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      await prisma.employeeFunctionRole.create({
        data: {
          employeeId: emp.id,
          functionRoleId: role.id,
          startDate: utcDate("2025-01-01"),
          endDate: utcDate("2025-12-31"), // 未来
        },
      })
      await prisma.shift.create({ data: shiftData(emp.id) })

      const result = await getTodayOverview()

      expect(result).toHaveLength(1)
      expect(result[0].employee!.functionRoles).toHaveLength(1)
    })

    it("startDate が null のロール（旧データ）は表示される", async () => {
      const role = await prisma.functionRole.create({
        data: { roleCode: "SV", roleName: "SV", roleType: "権限" },
      })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      await prisma.employeeFunctionRole.create({
        data: {
          employeeId: emp.id,
          functionRoleId: role.id,
          startDate: null,
          endDate: null,
        },
      })
      await prisma.shift.create({ data: shiftData(emp.id) })

      const result = await getTodayOverview()

      expect(result).toHaveLength(1)
      expect(result[0].employee!.functionRoles).toHaveLength(1)
    })

    it("現在有効なロールのみが返され、期限切れ・未来のロールは除外される", async () => {
      // (employee_id, role_type) のユニーク制約があるため、異なる従業員で検証
      const svRole = await prisma.functionRole.create({
        data: { roleCode: "SV", roleName: "SV", roleType: "監督" },
      })
      const opRole = await prisma.functionRole.create({
        data: { roleCode: "OP", roleName: "OP", roleType: "業務" },
      })

      const emp1 = await prisma.employee.create({ data: { name: "田中太郎" } })
      const emp2 = await prisma.employee.create({ data: { name: "佐藤花子" } })
      const emp3 = await prisma.employee.create({ data: { name: "鈴木一郎" } })

      // emp1: 現在有効な SV ロール
      await prisma.employeeFunctionRole.create({
        data: {
          employeeId: emp1.id,
          functionRoleId: svRole.id,
          startDate: utcDate("2025-01-01"),
          endDate: null,
        },
      })

      // emp2: 期限切れの OP ロール
      await prisma.employeeFunctionRole.create({
        data: {
          employeeId: emp2.id,
          functionRoleId: opRole.id,
          startDate: utcDate("2024-01-01"),
          endDate: utcDate("2025-03-31"), // 過去
        },
      })

      // emp3: 未来の SV ロール
      await prisma.employeeFunctionRole.create({
        data: {
          employeeId: emp3.id,
          functionRoleId: svRole.id,
          startDate: utcDate("2025-08-01"), // 未来
          endDate: null,
        },
      })

      await prisma.shift.create({ data: shiftData(emp1.id) })
      await prisma.shift.create({ data: shiftData(emp2.id) })
      await prisma.shift.create({ data: shiftData(emp3.id) })

      const result = await getTodayOverview()

      expect(result).toHaveLength(3)

      const r1 = result.find((s) => s.employee!.name === "田中太郎")!
      expect(r1.employee!.functionRoles).toHaveLength(1)
      expect(r1.employee!.functionRoles[0].functionRole!.roleName).toBe("SV")

      const r2 = result.find((s) => s.employee!.name === "佐藤花子")!
      expect(r2.employee!.functionRoles).toHaveLength(0)

      const r3 = result.find((s) => s.employee!.name === "鈴木一郎")!
      expect(r3.employee!.functionRoles).toHaveLength(0)
    })
  })

  describe("getDashboardFilterOptions - 日付フィルタ", () => {
    it("現在有効なロールのみがフィルタオプションに含まれる", async () => {
      // getRoleTypes は asc ソート: "業務"(U+696D) < "監督"(U+76E3) → roleTypes[0]="業務", roleTypes[1]="監督"
      const svRole = await prisma.functionRole.create({
        data: { roleCode: "SV", roleName: "SV", roleType: "監督" },
      })
      const opRole = await prisma.functionRole.create({
        data: { roleCode: "OP", roleName: "OP", roleType: "業務" },
      })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })

      // 現在有効な監督ロール
      await prisma.employeeFunctionRole.create({
        data: {
          employeeId: emp.id,
          functionRoleId: svRole.id,
          startDate: utcDate("2025-01-01"),
          endDate: null,
        },
      })

      // 期限切れの業務ロール
      await prisma.employeeFunctionRole.create({
        data: {
          employeeId: emp.id,
          functionRoleId: opRole.id,
          startDate: utcDate("2024-01-01"),
          endDate: utcDate("2025-05-31"), // 過去
        },
      })

      await prisma.shift.create({ data: shiftData(emp.id) })

      const options = await getDashboardFilterOptions()

      // 現在有効な SV は表示される、期限切れの OP は表示されない
      const allRoleNames = [...options.supervisorRoleNames, ...options.businessRoleNames]
      expect(allRoleNames).toContain("SV")
      expect(allRoleNames).not.toContain("OP")
    })

    it("現在有効なグループのみがフィルタオプションに含まれる", async () => {
      const group1 = await prisma.group.create({ data: { name: "開発部" } })
      const group2 = await prisma.group.create({ data: { name: "旧部署" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })

      // 現在有効
      await prisma.employeeGroup.create({
        data: {
          employeeId: emp.id,
          groupId: group1.id,
          startDate: utcDate("2025-01-01"),
          endDate: null,
        },
      })

      // 期限切れ
      await prisma.employeeGroup.create({
        data: {
          employeeId: emp.id,
          groupId: group2.id,
          startDate: utcDate("2024-01-01"),
          endDate: utcDate("2025-05-31"), // 過去
        },
      })

      await prisma.shift.create({ data: shiftData(emp.id) })

      const options = await getDashboardFilterOptions()

      expect(options.groups).toHaveLength(1)
      expect(options.groups[0].name).toBe("開発部")
    })

    it("現在有効なグループがない従業員は未所属として扱われる", async () => {
      const group = await prisma.group.create({ data: { name: "旧部署" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })

      // 期限切れのグループのみ
      await prisma.employeeGroup.create({
        data: {
          employeeId: emp.id,
          groupId: group.id,
          startDate: utcDate("2024-01-01"),
          endDate: utcDate("2025-05-31"), // 過去
        },
      })

      await prisma.shift.create({ data: shiftData(emp.id) })

      const options = await getDashboardFilterOptions()

      expect(options.groups).toHaveLength(0)
      expect(options.hasUnassigned).toBe(true)
    })
  })
})
