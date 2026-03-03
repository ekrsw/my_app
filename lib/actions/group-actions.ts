"use server"

import { prisma } from "@/lib/prisma"
import { groupSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"

export async function createGroup(formData: FormData) {
  const parsed = groupSchema.safeParse({
    name: formData.get("name"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.group.create({ data: parsed.data })
    revalidatePath("/groups")
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "このグループ名は既に使用されています" }
    }
    return { error: "グループの作成に失敗しました" }
  }
}

export async function updateGroup(id: number, formData: FormData) {
  const parsed = groupSchema.safeParse({
    name: formData.get("name"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.group.update({
      where: { id },
      data: parsed.data,
    })
    revalidatePath("/groups")
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "このグループ名は既に使用されています" }
    }
    return { error: "グループの更新に失敗しました" }
  }
}

export async function deleteGroup(id: number) {
  try {
    await prisma.group.delete({ where: { id } })
    revalidatePath("/groups")
    return { success: true }
  } catch {
    return { error: "グループの削除に失敗しました。従業員が所属している場合は削除できません。" }
  }
}
