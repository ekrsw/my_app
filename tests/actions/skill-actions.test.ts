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

const {
  assignSkillLevel,
  deleteEmployeeSkill,
  createSkill,
  deleteSkill,
} = await import("@/lib/actions/skill-actions")
const { getEmployeeCurrentSkills } = await import("@/lib/db/skills")

async function seed() {
  const skill = await prisma.skill.create({
    data: { skillCode: "EXCEL", skillName: "Excel操作" },
  })
  const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
  return { skill, emp }
}

function fd(obj: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(obj)) f.set(k, v)
  return f
}

describe("skill-actions", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  describe("assignSkillLevel（追記専用）", () => {
    it("レベルを付与すると1行追記される", async () => {
      const { skill, emp } = await seed()
      const result = await assignSkillLevel({
        employeeId: emp.id,
        skillId: skill.id,
        level: 2,
        startDate: "2025-04-01",
      })
      expect(result).toEqual({ success: true })

      const rows = await prisma.employeeSkill.findMany({ where: { employeeId: emp.id } })
      expect(rows).toHaveLength(1)
      expect(rows[0].level).toBe(2)
    })

    it("startDate 省略時は本日（getTodayJST）が入る", async () => {
      const { skill, emp } = await seed()
      await assignSkillLevel({ employeeId: emp.id, skillId: skill.id, level: 1 })

      const row = await prisma.employeeSkill.findFirst({ where: { employeeId: emp.id } })
      expect(row!.startDate).not.toBeNull()
    })

    it("レベルアップは過去行を書き換えず追記する（現レベルは最新）", async () => {
      const { skill, emp } = await seed()
      await assignSkillLevel({ employeeId: emp.id, skillId: skill.id, level: 1, startDate: "2025-01-01" })
      await assignSkillLevel({ employeeId: emp.id, skillId: skill.id, level: 3, startDate: "2026-01-01" })

      const rows = await prisma.employeeSkill.findMany({ where: { employeeId: emp.id } })
      expect(rows).toHaveLength(2)

      const current = await getEmployeeCurrentSkills(emp.id)
      expect(current[0].level).toBe(3)
    })

    it("現在の最新レベルと同値の付与はソフトガードで弾く", async () => {
      const { skill, emp } = await seed()
      await assignSkillLevel({ employeeId: emp.id, skillId: skill.id, level: 2, startDate: "2025-01-01" })

      const result = await assignSkillLevel({
        employeeId: emp.id,
        skillId: skill.id,
        level: 2,
        startDate: "2026-01-01",
      })
      expect(result.error).toBeDefined()

      const rows = await prisma.employeeSkill.findMany({ where: { employeeId: emp.id } })
      expect(rows).toHaveLength(1)
    })

    it("レベル範囲外（0）はバリデーションで弾く", async () => {
      const { skill, emp } = await seed()
      const result = await assignSkillLevel({ employeeId: emp.id, skillId: skill.id, level: 0 })
      expect(result.error).toBeDefined()
    })
  })

  describe("deleteEmployeeSkill（物理削除）", () => {
    it("最新行を削除すると直前の行が現レベルに戻る", async () => {
      const { skill, emp } = await seed()
      await assignSkillLevel({ employeeId: emp.id, skillId: skill.id, level: 1, startDate: "2025-01-01" })
      await assignSkillLevel({ employeeId: emp.id, skillId: skill.id, level: 3, startDate: "2026-01-01" })

      const latest = await prisma.employeeSkill.findFirst({
        where: { employeeId: emp.id },
        orderBy: [{ startDate: "desc" }, { id: "desc" }],
      })

      const result = await deleteEmployeeSkill(latest!.id)
      expect(result).toEqual({ success: true })

      const rows = await prisma.employeeSkill.findMany({ where: { employeeId: emp.id } })
      expect(rows).toHaveLength(1)

      const current = await getEmployeeCurrentSkills(emp.id)
      expect(current[0].level).toBe(1)
    })
  })

  describe("スキルマスタ CRUD", () => {
    it("スキルを作成できる", async () => {
      const result = await createSkill(fd({ skillCode: "WORD", skillName: "Word操作", isActive: "true", sortOrder: "0" }))
      expect(result).toEqual({ success: true })
      const s = await prisma.skill.findUnique({ where: { skillCode: "WORD" } })
      expect(s).not.toBeNull()
    })

    it("重複コードはエラーを返す", async () => {
      await createSkill(fd({ skillCode: "WORD", skillName: "Word操作", isActive: "true", sortOrder: "0" }))
      const result = await createSkill(fd({ skillCode: "WORD", skillName: "別Word", isActive: "true", sortOrder: "0" }))
      expect(result.error).toBeDefined()
    })

    it("割当中のスキルは削除できない（Restrict）", async () => {
      const { skill, emp } = await seed()
      await assignSkillLevel({ employeeId: emp.id, skillId: skill.id, level: 1 })

      const result = await deleteSkill(skill.id)
      expect(result.error).toBeDefined()

      const still = await prisma.skill.findUnique({ where: { id: skill.id } })
      expect(still).not.toBeNull()
    })
  })
})
