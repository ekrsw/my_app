import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

// Import the functions under test using the test prisma client
// We need to mock the prisma import used by the db functions
import { vi } from "vitest"

vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const { getEmployees, getEmployeeById, getAllEmployees } = await import(
  "@/lib/db/employees"
)

describe("Employee DB Queries", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  describe("getEmployees", () => {
    it("should return paginated employees", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })
      await prisma.employee.createMany({
        data: [
          { name: "田中太郎", groupId: group.id },
          { name: "佐藤花子", groupId: group.id },
          { name: "鈴木一郎", groupId: group.id },
        ],
      })

      const result = await getEmployees({}, { page: 1, pageSize: 2 })

      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(3)
      expect(result.totalPages).toBe(2)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(2)
    })

    it("should filter by search (name)", async () => {
      await prisma.employee.createMany({
        data: [
          { name: "田中太郎", nameKana: "タナカタロウ" },
          { name: "佐藤花子", nameKana: "サトウハナコ" },
          { name: "田中次郎", nameKana: "タナカジロウ" },
        ],
      })

      const result = await getEmployees({ search: "田中" })

      expect(result.data).toHaveLength(2)
      expect(result.data.every((e) => e.name.includes("田中"))).toBe(true)
    })

    it("should filter by search (nameKana)", async () => {
      await prisma.employee.createMany({
        data: [
          { name: "田中太郎", nameKana: "タナカタロウ" },
          { name: "佐藤花子", nameKana: "サトウハナコ" },
        ],
      })

      const result = await getEmployees({ search: "サトウ" })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe("佐藤花子")
    })

    it("should filter by groupId", async () => {
      const group1 = await prisma.group.create({ data: { name: "開発部" } })
      const group2 = await prisma.group.create({ data: { name: "営業部" } })
      await prisma.employee.createMany({
        data: [
          { name: "田中太郎", groupId: group1.id },
          { name: "佐藤花子", groupId: group2.id },
          { name: "鈴木一郎", groupId: group1.id },
        ],
      })

      const result = await getEmployees({ groupId: group1.id })

      expect(result.data).toHaveLength(2)
      expect(result.data.every((e) => e.groupId === group1.id)).toBe(true)
    })

    it("should filter active employees only", async () => {
      // Use dates far from today to avoid timezone boundary issues
      const pastDate = new Date("2020-01-01")
      const futureDate = new Date("2030-12-31")

      await prisma.employee.createMany({
        data: [
          { name: "在籍者A", terminationDate: null },
          { name: "在籍者B", terminationDate: futureDate },
          { name: "退職者", terminationDate: pastDate },
        ],
      })

      const result = await getEmployees({ activeOnly: true })

      expect(result.data).toHaveLength(2)
      expect(result.data.map((e) => e.name).sort()).toEqual(["在籍者A", "在籍者B"])
    })
  })

  describe("getEmployeeById", () => {
    it("should return employee with all relations", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })
      const employee = await prisma.employee.create({
        data: { name: "田中太郎", nameKana: "タナカタロウ", groupId: group.id },
      })

      const result = await getEmployeeById(employee.id)

      expect(result).not.toBeNull()
      expect(result!.name).toBe("田中太郎")
      expect(result!.group).not.toBeNull()
      expect(result!.group!.name).toBe("開発部")
      expect(result!.functionRoles).toBeDefined()
      expect(result!.nameHistory).toBeDefined()
      expect(result!.groupHistory).toBeDefined()
    })

    it("should return null for non-existent id", async () => {
      const result = await getEmployeeById(99999)
      expect(result).toBeNull()
    })
  })

  describe("getAllEmployees", () => {
    it("should return all employees with group", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })
      await prisma.employee.createMany({
        data: [
          { name: "田中太郎", groupId: group.id },
          { name: "佐藤花子", groupId: null },
        ],
      })

      const result = await getAllEmployees()

      expect(result).toHaveLength(2)
    })
  })
})
