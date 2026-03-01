"use server"

import { prisma } from "@/lib/prisma"
import { shiftCodeSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"

function toTimeOrNull(value: string | null | undefined): Date | null {
  if (!value) return null
  return new Date(`1970-01-01T${value}Z`)
}

export async function createShiftCode(formData: FormData) {
  const parsed = shiftCodeSchema.safeParse({
    code: formData.get("code"),
    defaultStartTime: formData.get("defaultStartTime") || null,
    defaultEndTime: formData.get("defaultEndTime") || null,
    defaultIsHoliday: formData.get("defaultIsHoliday") === "true",
    isActive: formData.get("isActive") === "true",
    sortOrder: formData.get("sortOrder"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.shiftCode.create({
      data: {
        code: parsed.data.code,
        defaultStartTime: toTimeOrNull(parsed.data.defaultStartTime),
        defaultEndTime: toTimeOrNull(parsed.data.defaultEndTime),
        defaultIsHoliday: parsed.data.defaultIsHoliday,
        isActive: parsed.data.isActive,
        sortOrder: parsed.data.sortOrder,
      },
    })
    revalidatePath("/shift-codes")
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "このシフトコードは既に使用されています" }
    }
    return { error: "シフトコードの作成に失敗しました" }
  }
}

export async function updateShiftCode(id: number, formData: FormData) {
  const parsed = shiftCodeSchema.safeParse({
    code: formData.get("code"),
    defaultStartTime: formData.get("defaultStartTime") || null,
    defaultEndTime: formData.get("defaultEndTime") || null,
    defaultIsHoliday: formData.get("defaultIsHoliday") === "true",
    isActive: formData.get("isActive") === "true",
    sortOrder: formData.get("sortOrder"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.shiftCode.update({
      where: { id },
      data: {
        code: parsed.data.code,
        defaultStartTime: toTimeOrNull(parsed.data.defaultStartTime),
        defaultEndTime: toTimeOrNull(parsed.data.defaultEndTime),
        defaultIsHoliday: parsed.data.defaultIsHoliday,
        isActive: parsed.data.isActive,
        sortOrder: parsed.data.sortOrder,
      },
    })
    revalidatePath("/shift-codes")
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "このシフトコードは既に使用されています" }
    }
    return { error: "シフトコードの更新に失敗しました" }
  }
}

export async function deleteShiftCode(id: number) {
  try {
    await prisma.shiftCode.delete({ where: { id } })
    revalidatePath("/shift-codes")
    return { success: true }
  } catch {
    return { error: "シフトコードの削除に失敗しました" }
  }
}
