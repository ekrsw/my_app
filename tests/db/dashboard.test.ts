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

const { getDailyOverview, getDailyFilterOptions, getPreviousDayOvernightShifts } = await import(
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

  describe("getDailyOverview - グループの日付フィルタ", () => {
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

      const result = await getDailyOverview(MOCK_TODAY)

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

      const result = await getDailyOverview(MOCK_TODAY)

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

      const result = await getDailyOverview(MOCK_TODAY)

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

      const result = await getDailyOverview(MOCK_TODAY)

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

      const result = await getDailyOverview(MOCK_TODAY)

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

      const result = await getDailyOverview(MOCK_TODAY)

      expect(result).toHaveLength(1)
      expect(result[0].employee!.groups).toHaveLength(1)
    })
  })

  describe("getDailyOverview - ロールの日付フィルタ", () => {
    it("startDate <= today かつ endDate が null のロールは表示される", async () => {
      const role = await prisma.functionRole.create({
        data: { roleCode: "SV", roleName: "SV", roleType: "監督", kind: "SUPERVISOR" },
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

      const result = await getDailyOverview(MOCK_TODAY)

      expect(result).toHaveLength(1)
      expect(result[0].employee!.functionRoles).toHaveLength(1)
      expect(result[0].employee!.functionRoles[0].functionRole!.roleName).toBe("SV")
    })

    it("startDate が未来のロールは表示されない", async () => {
      const role = await prisma.functionRole.create({
        data: { roleCode: "SV", roleName: "SV", roleType: "監督", kind: "SUPERVISOR" },
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

      const result = await getDailyOverview(MOCK_TODAY)

      expect(result).toHaveLength(1)
      expect(result[0].employee!.functionRoles).toHaveLength(0)
    })

    it("endDate が過去のロールは表示されない", async () => {
      const role = await prisma.functionRole.create({
        data: { roleCode: "SV", roleName: "SV", roleType: "監督", kind: "SUPERVISOR" },
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

      const result = await getDailyOverview(MOCK_TODAY)

      expect(result).toHaveLength(1)
      expect(result[0].employee!.functionRoles).toHaveLength(0)
    })

    it("endDate が未来のロールは表示される", async () => {
      const role = await prisma.functionRole.create({
        data: { roleCode: "SV", roleName: "SV", roleType: "監督", kind: "SUPERVISOR" },
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

      const result = await getDailyOverview(MOCK_TODAY)

      expect(result).toHaveLength(1)
      expect(result[0].employee!.functionRoles).toHaveLength(1)
    })

    it("startDate が null のロール（旧データ）は表示される", async () => {
      const role = await prisma.functionRole.create({
        data: { roleCode: "SV", roleName: "SV", roleType: "監督", kind: "SUPERVISOR" },
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

      const result = await getDailyOverview(MOCK_TODAY)

      expect(result).toHaveLength(1)
      expect(result[0].employee!.functionRoles).toHaveLength(1)
    })

    it("現在有効なロールのみが返され、期限切れ・未来のロールは除外される", async () => {
      // (employee_id, role_type) のユニーク制約があるため、異なる従業員で検証
      const svRole = await prisma.functionRole.create({
        data: { roleCode: "SV", roleName: "SV", roleType: "監督", kind: "SUPERVISOR" },
      })
      const opRole = await prisma.functionRole.create({
        data: { roleCode: "OP", roleName: "OP", roleType: "業務", kind: "BUSINESS" },
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

      const result = await getDailyOverview(MOCK_TODAY)

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

  describe("getDailyFilterOptions - 日付フィルタ", () => {
    it("現在有効なロールのみがフィルタオプションに含まれる", async () => {
      // 意味論は kind enum で判定（SUPERVISOR / BUSINESS）。role_type 文字列は表示ラベル専用。
      const svRole = await prisma.functionRole.create({
        data: { roleCode: "SV", roleName: "SV", roleType: "監督", kind: "SUPERVISOR" },
      })
      const opRole = await prisma.functionRole.create({
        data: { roleCode: "OP", roleName: "OP", roleType: "業務", kind: "BUSINESS" },
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

      const options = await getDailyFilterOptions(MOCK_TODAY)

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

      const options = await getDailyFilterOptions(MOCK_TODAY)

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

      const options = await getDailyFilterOptions(MOCK_TODAY)

      expect(options.groups).toHaveLength(0)
      expect(options.hasUnassigned).toBe(true)
    })
  })

  describe("getPreviousDayOvernightShifts - フィルター適用", () => {
    const MOCK_YESTERDAY = new Date(MOCK_TODAY.getTime() - 24 * 60 * 60 * 1000)

    // 夜勤シフト: startTime > endTime (HH:mm) = 日跨ぎ
    function overnightShiftData(employeeId: string, overrides: Record<string, unknown> = {}) {
      return {
        employeeId,
        shiftDate: MOCK_YESTERDAY,
        shiftCode: "N",
        startTime: new Date("1970-01-01T22:00:00Z"),
        endTime: new Date("1970-01-01T06:00:00Z"),
        isHoliday: false,
        ...overrides,
      }
    }

    it("フィルターなしで夜勤シフトが返される（後方互換）", async () => {
      const emp = await prisma.employee.create({ data: { name: "夜勤太郎" } })
      await prisma.shift.create({ data: overnightShiftData(emp.id) })

      const result = await getPreviousDayOvernightShifts(MOCK_TODAY)

      expect(result).toHaveLength(1)
      expect(result[0].employeeId).toBe(emp.id)
    })

    it("日跨ぎでないシフトは返されない", async () => {
      const emp = await prisma.employee.create({ data: { name: "日勤太郎" } })
      // 日勤: startTime < endTime
      await prisma.shift.create({
        data: overnightShiftData(emp.id, {
          startTime: new Date("1970-01-01T09:00:00Z"),
          endTime: new Date("1970-01-01T17:00:00Z"),
        }),
      })

      const result = await getPreviousDayOvernightShifts(MOCK_TODAY)

      expect(result).toHaveLength(0)
    })

    it("SVフィルター適用時、現在SVロールがない夜勤従業員は除外される", async () => {
      const svRole = await prisma.functionRole.create({
        data: { roleCode: "SV", roleName: "SV", roleType: "監督", kind: "SUPERVISOR" },
      })

      const svEmp = await prisma.employee.create({ data: { name: "SV夜勤" } })
      const nonSvEmp = await prisma.employee.create({ data: { name: "非SV夜勤" } })

      // svEmp: 現在有効なSVロール
      await prisma.employeeFunctionRole.create({
        data: {
          employeeId: svEmp.id,
          functionRoleId: svRole.id,
          startDate: utcDate("2025-01-01"),
          endDate: null,
        },
      })

      // nonSvEmp: 期限切れのSVロール（過去SVだったが現在は違う）
      await prisma.employeeFunctionRole.create({
        data: {
          employeeId: nonSvEmp.id,
          functionRoleId: svRole.id,
          startDate: utcDate("2024-01-01"),
          endDate: utcDate("2025-05-31"), // 過去
        },
      })

      await prisma.shift.create({ data: overnightShiftData(svEmp.id) })
      await prisma.shift.create({ data: overnightShiftData(nonSvEmp.id) })

      const result = await getPreviousDayOvernightShifts(MOCK_TODAY, {
        supervisorRoleNames: ["SV"],
      })

      expect(result).toHaveLength(1)
      expect(result[0].employee!.name).toBe("SV夜勤")
    })

    it("グループフィルター適用時、別グループの夜勤従業員は除外される", async () => {
      const groupA = await prisma.group.create({ data: { name: "グループA" } })
      const groupB = await prisma.group.create({ data: { name: "グループB" } })

      const empA = await prisma.employee.create({ data: { name: "A所属夜勤" } })
      const empB = await prisma.employee.create({ data: { name: "B所属夜勤" } })

      await prisma.employeeGroup.create({
        data: {
          employeeId: empA.id,
          groupId: groupA.id,
          startDate: utcDate("2025-01-01"),
          endDate: null,
        },
      })
      await prisma.employeeGroup.create({
        data: {
          employeeId: empB.id,
          groupId: groupB.id,
          startDate: utcDate("2025-01-01"),
          endDate: null,
        },
      })

      await prisma.shift.create({ data: overnightShiftData(empA.id) })
      await prisma.shift.create({ data: overnightShiftData(empB.id) })

      const result = await getPreviousDayOvernightShifts(MOCK_TODAY, {
        groupIds: [groupA.id],
      })

      expect(result).toHaveLength(1)
      expect(result[0].employee!.name).toBe("A所属夜勤")
    })

    it("シフトコードフィルター適用時、夜勤データも絞り込まれる", async () => {
      const emp1 = await prisma.employee.create({ data: { name: "N勤務" } })
      const emp2 = await prisma.employee.create({ data: { name: "X勤務" } })

      await prisma.shift.create({ data: overnightShiftData(emp1.id, { shiftCode: "N" }) })
      await prisma.shift.create({ data: overnightShiftData(emp2.id, { shiftCode: "X" }) })

      const result = await getPreviousDayOvernightShifts(MOCK_TODAY, {
        shiftCodes: ["N"],
      })

      expect(result).toHaveLength(1)
      expect(result[0].employee!.name).toBe("N勤務")
    })
  })

  describe("任意日付対応 - リファクタの検証", () => {
    it("getDailyOverview は引数の date のシフトのみ返す(過去日)", async () => {
      const emp = await prisma.employee.create({ data: { name: "過去出勤" } })
      const PAST_DATE = utcDate("2025-03-10")

      // 過去日に出勤、today(MOCK_TODAY=2025-06-15)にも出勤
      await prisma.shift.create({
        data: {
          employeeId: emp.id,
          shiftDate: PAST_DATE,
          shiftCode: "A",
          startTime: new Date("1970-01-01T09:00:00Z"),
          endTime: new Date("1970-01-01T17:00:00Z"),
          isHoliday: false,
        },
      })
      await prisma.shift.create({ data: shiftData(emp.id) })

      const pastResult = await getDailyOverview(PAST_DATE)
      expect(pastResult).toHaveLength(1)
      expect(pastResult[0].shiftDate.toISOString().substring(0, 10)).toBe("2025-03-10")

      const todayResult = await getDailyOverview(MOCK_TODAY)
      expect(todayResult).toHaveLength(1)
      expect(todayResult[0].shiftDate.toISOString().substring(0, 10)).toBe("2025-06-15")
    })

    it("getDailyOverview の group 日付ウィンドウは引数 date で評価される", async () => {
      const emp = await prisma.employee.create({ data: { name: "田中" } })
      const group = await prisma.group.create({ data: { name: "旧部署" } })

      // 2025-04-01 から 2025-05-31 まで所属(過去日)
      await prisma.employeeGroup.create({
        data: {
          employeeId: emp.id,
          groupId: group.id,
          startDate: utcDate("2025-04-01"),
          endDate: utcDate("2025-05-31"),
        },
      })

      // 2025-05-15 と 2025-06-15(MOCK_TODAY) 両方にシフト
      await prisma.shift.create({
        data: {
          employeeId: emp.id,
          shiftDate: utcDate("2025-05-15"),
          shiftCode: "A",
          startTime: new Date("1970-01-01T09:00:00Z"),
          endTime: new Date("1970-01-01T17:00:00Z"),
          isHoliday: false,
        },
      })
      await prisma.shift.create({ data: shiftData(emp.id) })

      // 2025-05-15 では group はアクティブ → 所属表示あり
      const activeResult = await getDailyOverview(utcDate("2025-05-15"))
      expect(activeResult).toHaveLength(1)
      expect(activeResult[0].employee!.groups).toHaveLength(1)

      // MOCK_TODAY(2025-06-15)では group 期限切れ → 所属なし
      const expiredResult = await getDailyOverview(MOCK_TODAY)
      expect(expiredResult).toHaveLength(1)
      expect(expiredResult[0].employee!.groups).toHaveLength(0)
    })

    it("getPreviousDayOvernightShifts の前日は引数 date を基準とする", async () => {
      const emp = await prisma.employee.create({ data: { name: "夜勤者" } })

      // 2025-03-09 に夜勤(22:00-08:00)を作成
      await prisma.shift.create({
        data: {
          employeeId: emp.id,
          shiftDate: utcDate("2025-03-09"),
          shiftCode: "22_8",
          startTime: new Date("1970-01-01T22:00:00Z"),
          endTime: new Date("1970-01-01T08:00:00Z"),
          isHoliday: false,
        },
      })

      // date=2025-03-10 を渡すと前日(2025-03-09)の夜勤が取得される
      const pastResult = await getPreviousDayOvernightShifts(utcDate("2025-03-10"))
      expect(pastResult).toHaveLength(1)
      expect(pastResult[0].shiftDate.toISOString().substring(0, 10)).toBe("2025-03-09")

      // date=2025-03-11 を渡すと前日=2025-03-10 → 該当なし
      const otherResult = await getPreviousDayOvernightShifts(utcDate("2025-03-11"))
      expect(otherResult).toHaveLength(0)
    })

    it("getDailyFilterOptions は引数 date のシフトからオプションを構築", async () => {
      const emp1 = await prisma.employee.create({ data: { name: "過去者" } })
      const emp2 = await prisma.employee.create({ data: { name: "今日者" } })

      await prisma.shift.create({
        data: {
          employeeId: emp1.id,
          shiftDate: utcDate("2025-03-10"),
          shiftCode: "A",
          startTime: new Date("1970-01-01T09:00:00Z"),
          endTime: new Date("1970-01-01T17:00:00Z"),
          isHoliday: false,
        },
      })
      await prisma.shift.create({ data: shiftData(emp2.id, { shiftCode: "B" }) })

      const pastOptions = await getDailyFilterOptions(utcDate("2025-03-10"))
      expect(pastOptions.employees.map((e) => e.name)).toEqual(["過去者"])
      expect(pastOptions.shiftCodes).toEqual(["A"])

      const todayOptions = await getDailyFilterOptions(MOCK_TODAY)
      expect(todayOptions.employees.map((e) => e.name)).toEqual(["今日者"])
      expect(todayOptions.shiftCodes).toEqual(["B"])
    })
  })
})
