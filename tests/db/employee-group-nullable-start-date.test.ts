import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"
import { vi } from "vitest"

vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const { getEmployees, getEmployeeById, getAllEmployees } = await import(
  "@/lib/db/employees"
)

describe("Employee Group - nullable startDate (DB queries)", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  describe("getEmployees", () => {
    it("startDate=null のグループが現在所属として表示される", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })

      await prisma.employeeGroup.create({
        data: {
          employeeId: emp.id,
          groupId: group.id,
          startDate: null,
          endDate: null,
        },
      })

      const result = await getEmployees({})

      expect(result.data).toHaveLength(1)
      expect(result.data[0].groups).toHaveLength(1)
      expect(result.data[0].groups[0].group.name).toBe("開発部")
    })

    it("startDate=null のグループでグループフィルタが正常動作する", async () => {
      const group1 = await prisma.group.create({ data: { name: "開発部" } })
      const group2 = await prisma.group.create({ data: { name: "営業部" } })

      const emp1 = await prisma.employee.create({ data: { name: "田中太郎" } })
      const emp2 = await prisma.employee.create({ data: { name: "佐藤花子" } })

      // startDate=null で所属
      await prisma.employeeGroup.create({
        data: { employeeId: emp1.id, groupId: group1.id, startDate: null },
      })
      // startDate あり（過去日）で所属
      await prisma.employeeGroup.create({
        data: {
          employeeId: emp2.id,
          groupId: group2.id,
          startDate: new Date("2020-01-01"),
        },
      })

      const result = await getEmployees({ groupIds: [group1.id] })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe("田中太郎")
    })

    it("startDate=null と startDate あり が混在するケース", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })

      const emp1 = await prisma.employee.create({ data: { name: "田中太郎" } })
      const emp2 = await prisma.employee.create({ data: { name: "佐藤花子" } })
      const emp3 = await prisma.employee.create({ data: { name: "鈴木一郎" } })

      // startDate=null
      await prisma.employeeGroup.create({
        data: { employeeId: emp1.id, groupId: group.id, startDate: null },
      })
      // startDate=過去日
      await prisma.employeeGroup.create({
        data: {
          employeeId: emp2.id,
          groupId: group.id,
          startDate: new Date("2020-01-01"),
        },
      })
      // startDate=未来日（まだ所属開始していない）
      await prisma.employeeGroup.create({
        data: {
          employeeId: emp3.id,
          groupId: group.id,
          startDate: new Date("2030-12-31"),
        },
      })

      const result = await getEmployees({ groupIds: [group.id] })

      // startDate=null と startDate=過去日 の2件のみ
      expect(result.data).toHaveLength(2)
      const names = result.data.map((e) => e.name).sort()
      expect(names).toEqual(["佐藤花子", "田中太郎"])
    })

    it("noGroup フィルタで startDate=null のグループ所属者は除外される", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })

      const emp1 = await prisma.employee.create({ data: { name: "田中太郎" } })
      const emp2 = await prisma.employee.create({ data: { name: "佐藤花子" } })

      // startDate=null で所属
      await prisma.employeeGroup.create({
        data: { employeeId: emp1.id, groupId: group.id, startDate: null },
      })
      // emp2 はグループ未所属

      const result = await getEmployees({ noGroup: true })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe("佐藤花子")
    })
  })

  describe("getAllEmployees", () => {
    it("startDate=null のグループが含まれる", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })

      await prisma.employeeGroup.create({
        data: { employeeId: emp.id, groupId: group.id, startDate: null },
      })

      const result = await getAllEmployees()

      expect(result).toHaveLength(1)
      expect(result[0].groups).toHaveLength(1)
      expect(result[0].groups[0].group.name).toBe("開発部")
    })
  })

  describe("getEmployeeById", () => {
    it("startDate=null のグループ履歴が取得される", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })

      await prisma.employeeGroup.create({
        data: { employeeId: emp.id, groupId: group.id, startDate: null },
      })

      const result = await getEmployeeById(emp.id)

      expect(result).not.toBeNull()
      expect(result!.groups).toHaveLength(1)
      expect(result!.groups[0].startDate).toBeNull()
      expect(result!.groups[0].group.name).toBe("開発部")
    })
  })
})
