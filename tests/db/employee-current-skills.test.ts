import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"
import {
  getEmployeeCurrentSkills,
  getSkills,
} from "@/lib/db/skills"

/**
 * 設計の心臓部の検証: employee_current_skills ビューが
 * 各 (社員, スキル) の「最新1行＝現レベル」だけを返すこと。
 */
describe("employee_current_skills ビュー", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  async function seedEmployeeAndSkill() {
    const skill = await prisma.skill.create({
      data: { skillCode: "EXCEL", skillName: "Excel操作" },
    })
    const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
    return { skill, emp }
  }

  it("start_date が異なる複数行のうち最新1行（現レベル）だけを返す", async () => {
    const { skill, emp } = await seedEmployeeAndSkill()

    await prisma.employeeSkill.createMany({
      data: [
        { employeeId: emp.id, skillId: skill.id, level: 1, startDate: new Date("2025-01-01") },
        { employeeId: emp.id, skillId: skill.id, level: 2, startDate: new Date("2025-06-01") },
        { employeeId: emp.id, skillId: skill.id, level: 3, startDate: new Date("2026-01-01") },
      ],
    })

    const current = await getEmployeeCurrentSkills(emp.id)
    expect(current).toHaveLength(1)
    expect(current[0].skillId).toBe(skill.id)
    expect(current[0].level).toBe(3)
  })

  it("同一 start_date では id が大きい行（後から追記）が現レベルになる", async () => {
    const { skill, emp } = await seedEmployeeAndSkill()

    const sameDate = new Date("2026-01-01")
    // 先に Lv.2、後から Lv.4 を同じ start_date で追記
    await prisma.employeeSkill.create({
      data: { employeeId: emp.id, skillId: skill.id, level: 2, startDate: sameDate },
    })
    await prisma.employeeSkill.create({
      data: { employeeId: emp.id, skillId: skill.id, level: 4, startDate: sameDate },
    })

    const current = await getEmployeeCurrentSkills(emp.id)
    expect(current).toHaveLength(1)
    expect(current[0].level).toBe(4)
  })

  it("複数スキルはスキルごとに最新1行を返す", async () => {
    const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
    const excel = await prisma.skill.create({
      data: { skillCode: "EXCEL", skillName: "Excel操作", sortOrder: 1 },
    })
    const word = await prisma.skill.create({
      data: { skillCode: "WORD", skillName: "Word操作", sortOrder: 2 },
    })

    await prisma.employeeSkill.createMany({
      data: [
        { employeeId: emp.id, skillId: excel.id, level: 1, startDate: new Date("2025-01-01") },
        { employeeId: emp.id, skillId: excel.id, level: 3, startDate: new Date("2026-01-01") },
        { employeeId: emp.id, skillId: word.id, level: 2, startDate: new Date("2025-05-01") },
      ],
    })

    const current = await getEmployeeCurrentSkills(emp.id)
    expect(current).toHaveLength(2)
    const byCode = Object.fromEntries(current.map((c) => [c.skillCode, c.level]))
    expect(byCode.EXCEL).toBe(3)
    expect(byCode.WORD).toBe(2)
  })

  it("割当が無い社員には空配列を返す", async () => {
    const emp = await prisma.employee.create({ data: { name: "無資格者" } })
    const current = await getEmployeeCurrentSkills(emp.id)
    expect(current).toEqual([])
  })

  it("getSkills の holderCount は現在保有者数（社員数）を返す", async () => {
    const skill = await prisma.skill.create({
      data: { skillCode: "EXCEL", skillName: "Excel操作" },
    })
    const emp1 = await prisma.employee.create({ data: { name: "社員1" } })
    const emp2 = await prisma.employee.create({ data: { name: "社員2" } })

    // emp1 は Lv.1 → Lv.3 と2行追記されているが、保有者数としては1名
    await prisma.employeeSkill.createMany({
      data: [
        { employeeId: emp1.id, skillId: skill.id, level: 1, startDate: new Date("2025-01-01") },
        { employeeId: emp1.id, skillId: skill.id, level: 3, startDate: new Date("2026-01-01") },
        { employeeId: emp2.id, skillId: skill.id, level: 2, startDate: new Date("2025-06-01") },
      ],
    })

    const skills = await getSkills()
    const target = skills.find((s) => s.id === skill.id)
    expect(target?.holderCount).toBe(2)
  })
})
