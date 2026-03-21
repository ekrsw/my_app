"use server"

import { prisma } from "@/lib/prisma"
import { dutyAssignmentSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth-guard"

export async function createDutyAssignment(data: {
  employeeId: string
  dutyTypeId: number
  dutyDate: string
  startTime: string
  endTime: string
}) {
  await requireAuth()
  const parsed = dutyAssignmentSchema.safeParse(data)

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.dutyAssignment.create({
      data: {
        employeeId: parsed.data.employeeId,
        dutyTypeId: parsed.data.dutyTypeId,
        dutyDate: new Date(parsed.data.dutyDate),
        startTime: new Date(`1970-01-01T${parsed.data.startTime}Z`),
        endTime: new Date(`1970-01-01T${parsed.data.endTime}Z`),
      },
    })
    revalidatePath("/duty-assignments")
    revalidatePath("/")
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "この従業員・業務種別・日付・開始時刻の組み合わせは既に存在します" }
    }
    return { error: "業務割当の作成に失敗しました" }
  }
}

export async function updateDutyAssignment(
  id: number,
  data: {
    employeeId: string
    dutyTypeId: number
    dutyDate: string
    startTime: string
    endTime: string
  }
) {
  await requireAuth()
  const parsed = dutyAssignmentSchema.safeParse(data)

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.dutyAssignment.update({
      where: { id },
      data: {
        employeeId: parsed.data.employeeId,
        dutyTypeId: parsed.data.dutyTypeId,
        dutyDate: new Date(parsed.data.dutyDate),
        startTime: new Date(`1970-01-01T${parsed.data.startTime}Z`),
        endTime: new Date(`1970-01-01T${parsed.data.endTime}Z`),
      },
    })
    revalidatePath("/duty-assignments")
    revalidatePath("/")
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "この従業員・業務種別・日付・開始時刻の組み合わせは既に存在します" }
    }
    return { error: "業務割当の更新に失敗しました" }
  }
}

export async function deleteDutyAssignment(id: number) {
  await requireAuth()
  try {
    await prisma.dutyAssignment.delete({ where: { id } })
    revalidatePath("/duty-assignments")
    revalidatePath("/")
    return { success: true }
  } catch {
    return { error: "業務割当の削除に失敗しました" }
  }
}
