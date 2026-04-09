"use server"

import { prisma } from "@/lib/prisma"
import { dutyTypeSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth-guard"

export async function createDutyType(formData: FormData) {
  await requireAuth()
  const parsed = dutyTypeSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    color: formData.get("color") || null,
    isActive: formData.get("isActive") === "true",
    sortOrder: formData.get("sortOrder"),
    defaultReducesCapacity: formData.get("defaultReducesCapacity") === "true",
    defaultStartTime: formData.get("defaultStartTime") as string,
    defaultEndTime: formData.get("defaultEndTime") as string,
    defaultNote: formData.get("defaultNote") as string,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.dutyType.create({
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        color: parsed.data.color ?? null,
        isActive: parsed.data.isActive,
        sortOrder: parsed.data.sortOrder,
        defaultReducesCapacity: parsed.data.defaultReducesCapacity,
        defaultStartTime: parsed.data.defaultStartTime ?? null,
        defaultEndTime: parsed.data.defaultEndTime ?? null,
        defaultNote: parsed.data.defaultNote ?? null,
      },
    })
    revalidatePath("/duty-types")
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "この業務コードは既に使用されています" }
    }
    return { error: "業務種別の作成に失敗しました" }
  }
}

export async function updateDutyType(id: number, formData: FormData) {
  await requireAuth()
  const parsed = dutyTypeSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    color: formData.get("color") || null,
    isActive: formData.get("isActive") === "true",
    sortOrder: formData.get("sortOrder"),
    defaultReducesCapacity: formData.get("defaultReducesCapacity") === "true",
    defaultStartTime: formData.get("defaultStartTime") as string,
    defaultEndTime: formData.get("defaultEndTime") as string,
    defaultNote: formData.get("defaultNote") as string,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.dutyType.update({
      where: { id },
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        color: parsed.data.color ?? null,
        isActive: parsed.data.isActive,
        sortOrder: parsed.data.sortOrder,
        defaultReducesCapacity: parsed.data.defaultReducesCapacity,
        defaultStartTime: parsed.data.defaultStartTime ?? null,
        defaultEndTime: parsed.data.defaultEndTime ?? null,
        defaultNote: parsed.data.defaultNote ?? null,
      },
    })
    revalidatePath("/duty-types")
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "この業務コードは既に使用されています" }
    }
    return { error: "業務種別の更新に失敗しました" }
  }
}

export async function deleteDutyType(id: number) {
  await requireAuth()
  try {
    await prisma.dutyType.delete({ where: { id } })
    revalidatePath("/duty-types")
    return { success: true }
  } catch {
    return { error: "業務種別の削除に失敗しました。割当で使用中の可能性があります" }
  }
}
