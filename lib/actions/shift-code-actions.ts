"use server"

import { prisma } from "@/lib/prisma"
import { shiftCodeSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth-guard"

function toTimeOrNull(value: string | null | undefined): Date | null {
  if (!value) return null
  return new Date(`1970-01-01T${value}Z`)
}

export async function createShiftCode(formData: FormData) {
  await requireAuth()
  const parsed = shiftCodeSchema.safeParse({
    code: formData.get("code"),
    color: formData.get("color") || null,
    defaultStartTime: formData.get("defaultStartTime") || null,
    defaultEndTime: formData.get("defaultEndTime") || null,
    defaultIsHoliday: formData.get("defaultIsHoliday") === "true",
    isActive: formData.get("isActive") === "true",
    sortOrder: formData.get("sortOrder"),
    defaultLunchBreakStart: formData.get("defaultLunchBreakStart") || null,
    defaultLunchBreakEnd: formData.get("defaultLunchBreakEnd") || null,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.shiftCode.create({
      data: {
        code: parsed.data.code,
        color: parsed.data.color ?? null,
        defaultStartTime: toTimeOrNull(parsed.data.defaultStartTime),
        defaultEndTime: toTimeOrNull(parsed.data.defaultEndTime),
        defaultIsHoliday: parsed.data.defaultIsHoliday,
        isActive: parsed.data.isActive,
        sortOrder: parsed.data.sortOrder,
        defaultLunchBreakStart: toTimeOrNull(parsed.data.defaultLunchBreakStart),
        defaultLunchBreakEnd: toTimeOrNull(parsed.data.defaultLunchBreakEnd),
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
  await requireAuth()
  const parsed = shiftCodeSchema.safeParse({
    code: formData.get("code"),
    color: formData.get("color") || null,
    defaultStartTime: formData.get("defaultStartTime") || null,
    defaultEndTime: formData.get("defaultEndTime") || null,
    defaultIsHoliday: formData.get("defaultIsHoliday") === "true",
    isActive: formData.get("isActive") === "true",
    sortOrder: formData.get("sortOrder"),
    defaultLunchBreakStart: formData.get("defaultLunchBreakStart") || null,
    defaultLunchBreakEnd: formData.get("defaultLunchBreakEnd") || null,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.shiftCode.update({
      where: { id },
      data: {
        code: parsed.data.code,
        color: parsed.data.color ?? null,
        defaultStartTime: toTimeOrNull(parsed.data.defaultStartTime),
        defaultEndTime: toTimeOrNull(parsed.data.defaultEndTime),
        defaultIsHoliday: parsed.data.defaultIsHoliday,
        isActive: parsed.data.isActive,
        sortOrder: parsed.data.sortOrder,
        defaultLunchBreakStart: toTimeOrNull(parsed.data.defaultLunchBreakStart),
        defaultLunchBreakEnd: toTimeOrNull(parsed.data.defaultLunchBreakEnd),
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
  await requireAuth()
  try {
    await prisma.shiftCode.delete({ where: { id } })
    revalidatePath("/shift-codes")
    return { success: true }
  } catch {
    return { error: "シフトコードの削除に失敗しました" }
  }
}

type ShiftCodeImportRow = {
  rowIndex: number
  code: string
  color: string | null
  defaultStartTime: string | null
  defaultEndTime: string | null
  defaultIsHoliday: boolean
  isActive: boolean
  sortOrder: number
}

type ShiftCodeImportResult = {
  success: boolean
  created: number
  updated: number
  errors: Array<{ rowIndex: number; error: string }>
}

export async function importShiftCodes(
  rows: ShiftCodeImportRow[]
): Promise<ShiftCodeImportResult> {
  await requireAuth()
  let created = 0
  let updated = 0
  const errors: Array<{ rowIndex: number; error: string }> = []

  try {
    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        try {
          const existing = await tx.shiftCode.findUnique({
            where: { code: row.code },
          })

          const data = {
            color: row.color,
            defaultStartTime: toTimeOrNull(row.defaultStartTime),
            defaultEndTime: toTimeOrNull(row.defaultEndTime),
            defaultIsHoliday: row.defaultIsHoliday,
            isActive: row.isActive,
            sortOrder: row.sortOrder,
          }

          if (existing) {
            await tx.shiftCode.update({
              where: { id: existing.id },
              data: { code: row.code, ...data },
            })
            updated++
          } else {
            await tx.shiftCode.create({
              data: { code: row.code, ...data },
            })
            created++
          }
        } catch {
          errors.push({ rowIndex: row.rowIndex, error: "データの保存に失敗しました" })
        }
      }
    })

    revalidatePath("/shift-codes")
    return { success: true, created, updated, errors }
  } catch {
    return { success: false, created: 0, updated: 0, errors: [{ rowIndex: 0, error: "インポートに失敗しました" }] }
  }
}
