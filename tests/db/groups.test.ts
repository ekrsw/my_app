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

      await prisma.employee.createMany({
        data: [
          { name: "田中太郎", groupId: group1.id },
          { name: "佐藤花子", groupId: group1.id },
          { name: "鈴木一郎", groupId: group2.id },
        ],
      })

      const result = await getGroups()

      expect(result).toHaveLength(2)

      const dev = result.find((g) => g.name === "開発部")!
      expect(dev._count.employees).toBe(2)

      const sales = result.find((g) => g.name === "営業部")!
      expect(sales._count.employees).toBe(1)
    })
  })

  describe("getGroupById", () => {
    it("should return a group with employee count", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })
      await prisma.employee.create({
        data: { name: "田中太郎", groupId: group.id },
      })

      const result = await getGroupById(group.id)

      expect(result).not.toBeNull()
      expect(result!.name).toBe("開発部")
      expect(result!._count.employees).toBe(1)
    })

    it("should return null for non-existent id", async () => {
      const result = await getGroupById(99999)
      expect(result).toBeNull()
    })
  })
})
