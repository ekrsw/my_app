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

const { importEmployees } = await import("@/lib/actions/employee-actions")

describe("importEmployees", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  describe("新規作成", () => {
    it("従業員IDがnullの場合、新規従業員を作成する", async () => {
      const result = await importEmployees([
        {
          rowIndex: 2,
          employeeId: null,
          name: "田中太郎",
          nameKana: "タナカタロウ",
          hireDate: "2020-04-01",
          terminationDate: null,
          groupNames: null,
        },
      ])

      expect(result.success).toBe(true)
      expect(result.created).toBe(1)
      expect(result.updated).toBe(0)
      expect(result.errors).toHaveLength(0)

      const employees = await prisma.employee.findMany()
      expect(employees).toHaveLength(1)
      expect(employees[0].name).toBe("田中太郎")
      expect(employees[0].nameKana).toBe("タナカタロウ")
    })

    it("存在しない従業員IDの場合も新規作成する", async () => {
      const result = await importEmployees([
        {
          rowIndex: 2,
          employeeId: "00000000-0000-0000-0000-000000000099",
          name: "佐藤花子",
          nameKana: null,
          hireDate: null,
          terminationDate: null,
          groupNames: null,
        },
      ])

      expect(result.success).toBe(true)
      expect(result.created).toBe(1)
      expect(result.updated).toBe(0)
    })
  })

  describe("更新", () => {
    it("既存従業員IDと一致する場合、名前を更新する", async () => {
      const emp = await prisma.employee.create({
        data: { name: "旧名前", nameKana: "キュウナマエ" },
      })

      const result = await importEmployees([
        {
          rowIndex: 2,
          employeeId: emp.id,
          name: "新名前",
          nameKana: "シンナマエ",
          hireDate: "2020-04-01",
          terminationDate: null,
          groupNames: null,
        },
      ])

      expect(result.success).toBe(true)
      expect(result.created).toBe(0)
      expect(result.updated).toBe(1)

      const updated = await prisma.employee.findUnique({ where: { id: emp.id } })
      expect(updated!.name).toBe("新名前")
      expect(updated!.nameKana).toBe("シンナマエ")
    })
  })

  describe("グループ割当", () => {
    it("新規従業員にグループを割り当てる", async () => {
      const group = await prisma.group.create({ data: { name: "営業部" } })

      const result = await importEmployees([
        {
          rowIndex: 2,
          employeeId: null,
          name: "田中太郎",
          nameKana: null,
          hireDate: null,
          terminationDate: null,
          groupNames: "営業部",
        },
      ])

      expect(result.success).toBe(true)
      expect(result.created).toBe(1)

      const employees = await prisma.employee.findMany({
        include: { groups: true },
      })
      expect(employees[0].groups).toHaveLength(1)
      expect(employees[0].groups[0].groupId).toBe(group.id)
    })

    it("複数グループ（|区切り）を正しく割り当てる", async () => {
      const group1 = await prisma.group.create({ data: { name: "営業部" } })
      const group2 = await prisma.group.create({ data: { name: "開発部" } })

      const result = await importEmployees([
        {
          rowIndex: 2,
          employeeId: null,
          name: "田中太郎",
          nameKana: null,
          hireDate: null,
          terminationDate: null,
          groupNames: "営業部|開発部",
        },
      ])

      expect(result.success).toBe(true)

      const employees = await prisma.employee.findMany({
        include: { groups: true },
      })
      const groupIds = employees[0].groups.map((g) => g.groupId).sort()
      expect(groupIds).toEqual([group1.id, group2.id].sort())
    })

    it("既存従業員のグループを変更する（旧グループ終了、新グループ追加）", async () => {
      const groupOld = await prisma.group.create({ data: { name: "旧部署" } })
      const groupNew = await prisma.group.create({ data: { name: "新部署" } })

      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      await prisma.employeeGroup.create({
        data: { employeeId: emp.id, groupId: groupOld.id, startDate: null },
      })

      const result = await importEmployees([
        {
          rowIndex: 2,
          employeeId: emp.id,
          name: "田中太郎",
          nameKana: null,
          hireDate: null,
          terminationDate: null,
          groupNames: "新部署",
        },
      ])

      expect(result.success).toBe(true)
      expect(result.updated).toBe(1)

      const groups = await prisma.employeeGroup.findMany({
        where: { employeeId: emp.id },
        orderBy: { groupId: "asc" },
      })
      // 旧グループは endDate が設定される
      const oldGroup = groups.find((g) => g.groupId === groupOld.id)
      expect(oldGroup!.endDate).not.toBeNull()
      // 新グループが追加される
      const newGroup = groups.find((g) => g.groupId === groupNew.id)
      expect(newGroup).toBeDefined()
      expect(newGroup!.endDate).toBeNull()
    })

    it("groupNamesがnullの場合、グループは変更しない", async () => {
      const group = await prisma.group.create({ data: { name: "営業部" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      await prisma.employeeGroup.create({
        data: { employeeId: emp.id, groupId: group.id, startDate: null },
      })

      const result = await importEmployees([
        {
          rowIndex: 2,
          employeeId: emp.id,
          name: "田中太郎更新",
          nameKana: null,
          hireDate: null,
          terminationDate: null,
          groupNames: null,
        },
      ])

      expect(result.success).toBe(true)

      const groups = await prisma.employeeGroup.findMany({
        where: { employeeId: emp.id },
      })
      expect(groups).toHaveLength(1)
      expect(groups[0].endDate).toBeNull()
    })
  })

  describe("エラーハンドリング", () => {
    it("存在しないグループ名の場合はエラーを返す", async () => {
      const result = await importEmployees([
        {
          rowIndex: 2,
          employeeId: null,
          name: "田中太郎",
          nameKana: null,
          hireDate: null,
          terminationDate: null,
          groupNames: "存在しない部署",
        },
      ])

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toContain("存在しないグループ")
      expect(result.errors[0].rowIndex).toBe(2)
    })

    it("エラー行はスキップし、有効行は正常にインポートする", async () => {
      await prisma.group.create({ data: { name: "営業部" } })

      const result = await importEmployees([
        {
          rowIndex: 2,
          employeeId: null,
          name: "田中太郎",
          nameKana: null,
          hireDate: null,
          terminationDate: null,
          groupNames: "営業部",
        },
        {
          rowIndex: 3,
          employeeId: null,
          name: "佐藤花子",
          nameKana: null,
          hireDate: null,
          terminationDate: null,
          groupNames: "存在しない部署",
        },
      ])

      expect(result.created).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].rowIndex).toBe(3)

      const employees = await prisma.employee.findMany()
      expect(employees).toHaveLength(1)
      expect(employees[0].name).toBe("田中太郎")
    })

    it("複数行を一度にインポートできる", async () => {
      const result = await importEmployees([
        {
          rowIndex: 2,
          employeeId: null,
          name: "田中太郎",
          nameKana: "タナカタロウ",
          hireDate: "2020-04-01",
          terminationDate: null,
          groupNames: null,
        },
        {
          rowIndex: 3,
          employeeId: null,
          name: "佐藤花子",
          nameKana: "サトウハナコ",
          hireDate: "2021-04-01",
          terminationDate: null,
          groupNames: null,
        },
      ])

      expect(result.success).toBe(true)
      expect(result.created).toBe(2)
      expect(result.errors).toHaveLength(0)
    })
  })
})
