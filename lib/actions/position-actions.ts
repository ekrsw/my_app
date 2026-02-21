"use server"

import { prisma } from "@/lib/prisma"
import { positionSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"

export async function createPosition(formData: FormData) {
  const parsed = positionSchema.safeParse({
    positionCode: formData.get("positionCode"),
    positionName: formData.get("positionName"),
    isActive: formData.get("isActive") === "true",
    sortOrder: formData.get("sortOrder"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.position.create({ data: parsed.data })
    revalidatePath("/positions")
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "この役職コードは既に使用されています" }
    }
    return { error: "役職の作成に失敗しました" }
  }
}

export async function updatePosition(id: number, formData: FormData) {
  const parsed = positionSchema.safeParse({
    positionCode: formData.get("positionCode"),
    positionName: formData.get("positionName"),
    isActive: formData.get("isActive") === "true",
    sortOrder: formData.get("sortOrder"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.position.update({
      where: { id },
      data: parsed.data,
    })
    revalidatePath("/positions")
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "この役職コードは既に使用されています" }
    }
    return { error: "役職の更新に失敗しました" }
  }
}

export async function deletePosition(id: number) {
  try {
    await prisma.position.delete({ where: { id } })
    revalidatePath("/positions")
    return { success: true }
  } catch {
    return { error: "役職の削除に失敗しました。割当中の従業員がいる場合は削除できません。" }
  }
}
