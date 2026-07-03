"use server"

import { prisma } from "@/lib/prisma"
import { skillSchema, skillLevelSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth-guard"
import { getTodayJST } from "@/lib/date-utils"
import { ROUTES, employeeDetail } from "@/lib/routes"

// --- スキルマスタ CRUD（positions と同型） ---

export async function createSkill(formData: FormData) {
  await requireAuth()
  const parsed = skillSchema.safeParse({
    skillCode: formData.get("skillCode"),
    skillName: formData.get("skillName"),
    isActive: formData.get("isActive") === "true",
    sortOrder: formData.get("sortOrder"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.skill.create({ data: parsed.data })
    revalidatePath(ROUTES.skills)
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "このスキルコードは既に使用されています" }
    }
    return { error: "スキルの作成に失敗しました" }
  }
}

export async function updateSkill(id: number, formData: FormData) {
  await requireAuth()
  const parsed = skillSchema.safeParse({
    skillCode: formData.get("skillCode"),
    skillName: formData.get("skillName"),
    isActive: formData.get("isActive") === "true",
    sortOrder: formData.get("sortOrder"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.skill.update({ where: { id }, data: parsed.data })
    revalidatePath(ROUTES.skills)
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "このスキルコードは既に使用されています" }
    }
    return { error: "スキルの更新に失敗しました" }
  }
}

export async function deleteSkill(id: number) {
  await requireAuth()
  try {
    await prisma.skill.delete({ where: { id } })
    revalidatePath(ROUTES.skills)
    return { success: true }
  } catch {
    return {
      error:
        "スキルの削除に失敗しました。割当中の従業員がいる場合は削除できません（無効化をご検討ください）。",
    }
  }
}

// --- スキルレベル割当（追記専用） ---

/**
 * 社員にスキルレベルを付与する。レベルアップは新規行の追記で表現する（過去行は不変）。
 * 現在の最新レベルと同値の場合は、無意味な重複追記を防ぐためソフトガードで弾く。
 * （降格・再付与は許容するため DB 制約ではなくアプリ側チェックとする）
 */
export async function assignSkillLevel(data: {
  employeeId: string
  skillId: number
  level: number
  startDate?: string | null
}) {
  await requireAuth()
  const parsed = skillLevelSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { employeeId, skillId, level } = parsed.data

  // ソフトガード: 現在の最新レベルと同値なら弾く
  const current = await prisma.employeeSkill.findFirst({
    where: { employeeId, skillId },
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
    select: { level: true },
  })
  if (current && current.level === level) {
    return { error: "現在のレベルと同じです。レベルが変わる場合のみ追加してください。" }
  }

  try {
    await prisma.employeeSkill.create({
      data: {
        employeeId,
        skillId,
        level,
        startDate: parsed.data.startDate
          ? new Date(parsed.data.startDate)
          : getTodayJST(),
      },
    })
    revalidatePath(employeeDetail(employeeId))
    revalidatePath(ROUTES.employees)
    revalidatePath(ROUTES.skills)
    return { success: true }
  } catch {
    return { error: "スキルレベルの付与に失敗しました" }
  }
}

/**
 * スキル割当行を物理削除する（訂正・取り消し用）。
 * 直前の行が自動的に「最新＝現レベル」に戻る。
 */
export async function deleteEmployeeSkill(id: number) {
  await requireAuth()
  try {
    const deleted = await prisma.employeeSkill.delete({
      where: { id },
      select: { employeeId: true },
    })
    revalidatePath(employeeDetail(deleted.employeeId))
    revalidatePath(ROUTES.employees)
    revalidatePath(ROUTES.skills)
    return { success: true }
  } catch {
    return { error: "スキル割当の削除に失敗しました" }
  }
}
