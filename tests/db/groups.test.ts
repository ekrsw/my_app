import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"
import { vi } from "vitest"

vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const { getGroups, getGroupById } = await import("@/lib/db/groups")

describe("Group DB Queries", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  describe("getGroups", () => {
    it("should return all groups with employee counts", async () => {
      const group1 = await prisma.group.create({ data: { name: "開発部" } })
      const group2 = await prisma.group.create({ data: { name: "営業部" } })

      const emp1 = await prisma.employee.create({ data: { name: "田中太郎" } })
      const emp2 = await prisma.employee.create({ data: { name: "佐藤花子" } })
      const emp3 = await prisma.employee.create({ data: { name: "鈴木一郎" } })

      await prisma.employeeGroup.createMany({
        data: [
          { employeeId: emp1.id, groupId: group1.id, startDate: new Date() },
          { employeeId: emp2.id, groupId: group1.id, startDate: new Date() },
          { employeeId: emp3.id, groupId: group2.id, startDate: new Date() },
        ],
      })

      const result = await getGroups()

      expect(result).toHaveLength(2)

      const dev = result.find((g) => g.name === "開発部")!
      expect(dev._count.employeeGroups).toBe(2)

      const sales = result.find((g) => g.name === "営業部")!
      expect(sales._count.employeeGroups).toBe(1)
    })
  })

  describe("getGroupById", () => {
    it("should return a group with employee count", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })

      await prisma.employeeGroup.create({
        data: {
          employeeId: emp.id,
          groupId: group.id,
          startDate: new Date(),
        },
      })

      const result = await getGroupById(group.id)

      expect(result).not.toBeNull()
      expect(result!.name).toBe("開発部")
      expect(result!._count.employeeGroups).toBe(1)
    })

    it("should return null for non-existent id", async () => {
      const result = await getGroupById(99999)
      expect(result).toBeNull()
    })
  })
})
