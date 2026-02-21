import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const { createGroup, updateGroup, deleteGroup } = await import(
  "@/lib/actions/group-actions"
)

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value)
  }
  return fd
}

describe("Group Actions", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  describe("createGroup", () => {
    it("should create a group successfully", async () => {
      const result = await createGroup(makeFormData({ name: "開発部" }))

      expect(result).toEqual({ success: true })

      const groups = await prisma.group.findMany()
      expect(groups).toHaveLength(1)
      expect(groups[0].name).toBe("開発部")
    })

    it("should return error for duplicate group name (P2002)", async () => {
      await prisma.group.create({ data: { name: "開発部" } })

      const result = await createGroup(makeFormData({ name: "開発部" }))

      expect(result.error).toBeDefined()
      expect(result.error).toContain("既に使用されています")
    })

    it("should return validation error for empty name", async () => {
      const result = await createGroup(makeFormData({ name: "" }))

      expect(result.error).toBeDefined()
    })
  })

  describe("updateGroup", () => {
    it("should update a group successfully", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })

      const result = await updateGroup(
        group.id,
        makeFormData({ name: "技術部" })
      )

      expect(result).toEqual({ success: true })

      const updated = await prisma.group.findUnique({
        where: { id: group.id },
      })
      expect(updated!.name).toBe("技術部")
    })

    it("should return error for duplicate name on update", async () => {
      await prisma.group.create({ data: { name: "営業部" } })
      const group = await prisma.group.create({ data: { name: "開発部" } })

      const result = await updateGroup(
        group.id,
        makeFormData({ name: "営業部" })
      )

      expect(result.error).toBeDefined()
      expect(result.error).toContain("既に使用されています")
    })
  })

  describe("deleteGroup", () => {
    it("should delete a group with no employees", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })

      const result = await deleteGroup(group.id)

      expect(result).toEqual({ success: true })

      const found = await prisma.group.findUnique({ where: { id: group.id } })
      expect(found).toBeNull()
    })

    it("should return error when group has employees", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })
      const emp = await prisma.employee.create({
        data: { name: "田中太郎" },
      })
      await prisma.employeeGroup.create({
        data: {
          employeeId: emp.id,
          groupId: group.id,
          startDate: new Date(),
        },
      })

      const result = await deleteGroup(group.id)

      expect(result.error).toBeDefined()
    })
  })
})
