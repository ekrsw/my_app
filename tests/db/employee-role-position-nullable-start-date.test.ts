import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"
import { isCurrentRecord } from "@/lib/date-utils"

vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const { getEmployees, getEmployeeById } = await import("@/lib/db/employees")

describe("Employee Role / Position - nullable startDate (DB queries)", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  describe("ロール: startDate=null", () => {
    it("startDate=null のロールでロールフィルタに含まれる", async () => {
      const role = await prisma.functionRole.create({
        data: { roleCode: "MGR", roleName: "マネージャー" },
      })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })

      await prisma.employeeFunctionRole.create({
        data: { employeeId: emp.id, functionRoleId: role.id, startDate: null, endDate: null },
      })

      const result = await getEmployees({ roleIds: [role.id] })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe("田中太郎")
    })

    it("startDate=null / 過去 / 未来 が混在する場合、未来開始のみ除外される", async () => {
      const role = await prisma.functionRole.create({
        data: { roleCode: "MGR", roleName: "マネージャー" },
      })
      const emp1 = await prisma.employee.create({ data: { name: "田中太郎" } })
      const emp2 = await prisma.employee.create({ data: { name: "佐藤花子" } })
      const emp3 = await prisma.employee.create({ data: { name: "鈴木一郎" } })

      await prisma.employeeFunctionRole.create({
        data: { employeeId: emp1.id, functionRoleId: role.id, startDate: null },
      })
      await prisma.employeeFunctionRole.create({
        data: { employeeId: emp2.id, functionRoleId: role.id, startDate: new Date("2020-01-01") },
      })
      await prisma.employeeFunctionRole.create({
        data: { employeeId: emp3.id, functionRoleId: role.id, startDate: new Date("2030-12-31") },
      })

      const result = await getEmployees({ roleIds: [role.id] })

      const names = result.data.map((e) => e.name).sort()
      expect(names).toEqual(["佐藤花子", "田中太郎"])
    })

    it("roleUnassigned フィルタで startDate=null のロール保持者は除外される", async () => {
      const role = await prisma.functionRole.create({
        data: { roleCode: "MGR", roleName: "マネージャー" },
      })
      const emp1 = await prisma.employee.create({ data: { name: "田中太郎" } })
      await prisma.employee.create({ data: { name: "佐藤花子" } })

      await prisma.employeeFunctionRole.create({
        data: { employeeId: emp1.id, functionRoleId: role.id, startDate: null },
      })

      const result = await getEmployees({ roleUnassigned: true })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe("佐藤花子")
    })

    it("getEmployeeById で startDate=null のロールが取得される", async () => {
      const role = await prisma.functionRole.create({
        data: { roleCode: "MGR", roleName: "マネージャー" },
      })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      await prisma.employeeFunctionRole.create({
        data: { employeeId: emp.id, functionRoleId: role.id, startDate: null },
      })

      const result = await getEmployeeById(emp.id)

      expect(result).not.toBeNull()
      expect(result!.functionRoles).toHaveLength(1)
      expect(result!.functionRoles[0].startDate).toBeNull()
      expect(isCurrentRecord(result!.functionRoles[0])).toBe(true)
    })
  })

  describe("役職: startDate=null", () => {
    it("startDate=null の役職が永続化され、getEmployeeById で取得・current 判定される", async () => {
      const position = await prisma.position.create({
        data: { positionCode: "CHIEF", positionName: "主任" },
      })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })

      // 開始日未入力（null）で役職を割り当て
      await prisma.employeePosition.create({
        data: { employeeId: emp.id, positionId: position.id, startDate: null, endDate: null },
      })

      const result = await getEmployeeById(emp.id)

      expect(result).not.toBeNull()
      expect(result!.positions).toHaveLength(1)
      expect(result!.positions[0].startDate).toBeNull()
      expect(result!.positions[0].position.positionName).toBe("主任")
      // 開始日が入っていなくても「現在の役職」として判定される
      expect(isCurrentRecord(result!.positions[0])).toBe(true)
    })

    it("startDate=null の役職は no-overlap 制約により同一従業員で二重登録できない", async () => {
      const position = await prisma.position.create({
        data: { positionCode: "CHIEF", positionName: "主任" },
      })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })

      await prisma.employeePosition.create({
        data: { employeeId: emp.id, positionId: position.id, startDate: null, endDate: null },
      })

      // 同一従業員に重複する役職期間（開始日 null = 過去から無限）は制約違反
      await expect(
        prisma.employeePosition.create({
          data: { employeeId: emp.id, positionId: position.id, startDate: null, endDate: null },
        })
      ).rejects.toThrow()
    })

    it("startDate=null と endDate=過去 の役職は current ではない", async () => {
      const position = await prisma.position.create({
        data: { positionCode: "CHIEF", positionName: "主任" },
      })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })

      await prisma.employeePosition.create({
        data: { employeeId: emp.id, positionId: position.id, startDate: null, endDate: new Date("2020-01-01") },
      })

      const result = await getEmployeeById(emp.id)

      expect(result!.positions).toHaveLength(1)
      expect(isCurrentRecord(result!.positions[0])).toBe(false)
    })
  })
})
