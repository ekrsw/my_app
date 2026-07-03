import { prisma } from "@/lib/prisma"

/**
 * スキルマスタ一覧。各スキルについて「現在そのスキルを保有している社員数」
 * （＝employee_current_skills ビューの行数）を holderCount として付与する。
 */
export async function getSkills() {
  const skills = await prisma.skill.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  })

  const counts = await prisma.$queryRaw<{ skillId: number; count: bigint }[]>`
    SELECT skill_id AS "skillId", COUNT(*)::bigint AS "count"
    FROM employee_current_skills
    GROUP BY skill_id
  `
  const countMap = new Map(counts.map((c) => [c.skillId, Number(c.count)]))

  return skills.map((s) => ({ ...s, holderCount: countMap.get(s.id) ?? 0 }))
}

export type SkillWithCount = Awaited<ReturnType<typeof getSkills>>[number]

/** 割当フォーム用の有効スキル一覧。 */
export async function getActiveSkills() {
  return prisma.skill.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  })
}

export type EmployeeCurrentSkill = {
  id: number
  skillId: number
  skillCode: string
  skillName: string
  level: number
  startDate: Date
}

/**
 * 指定社員の「現在のスキルレベル一覧」。employee_current_skills ビュー経由で、
 * 各スキルの最新1行（＝現レベル）だけを取得する。
 */
export async function getEmployeeCurrentSkills(
  employeeId: string
): Promise<EmployeeCurrentSkill[]> {
  return prisma.$queryRaw<EmployeeCurrentSkill[]>`
    SELECT ecs.id          AS "id",
           ecs.skill_id    AS "skillId",
           s.skill_code    AS "skillCode",
           s.skill_name    AS "skillName",
           ecs.level       AS "level",
           ecs.start_date  AS "startDate"
    FROM employee_current_skills ecs
    JOIN skills s ON s.id = ecs.skill_id
    WHERE ecs.employee_id = ${employeeId}::uuid
    ORDER BY s.sort_order ASC, s.id ASC
  `
}

/**
 * 指定 (社員, スキル) のレベル推移（全割当行）。start_date 降順→id 降順で、
 * 先頭が現在のレベル。追記専用なのでこれがそのままタイムラインになる。
 */
export async function getEmployeeSkillHistory(employeeId: string, skillId: number) {
  return prisma.employeeSkill.findMany({
    where: { employeeId, skillId },
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
  })
}

/**
 * 指定社員の全スキル割当行（スキル名付き）。UI 側でスキルごとにグルーピングして
 * レベル推移タイムラインを描画するために使う。start_date 降順→id 降順なので、
 * 各スキルの先頭行が現在のレベル。
 */
export async function getEmployeeSkillRows(employeeId: string) {
  return prisma.employeeSkill.findMany({
    where: { employeeId },
    include: {
      skill: { select: { skillCode: true, skillName: true, sortOrder: true } },
    },
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
  })
}

export type EmployeeSkillRow = Awaited<ReturnType<typeof getEmployeeSkillRows>>[number]
