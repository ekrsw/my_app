"use server"

import { prisma } from "@/lib/prisma"
import { functionRoleSchema, roleAssignmentSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"

export async function createFunctionRole(formData: FormData) {
  const parsed = functionRoleSchema.safeParse({
    roleCode: formData.get("roleCode"),
    roleName: formData.get("roleName"),
    roleType: formData.get("roleType"),
    isActive: formData.get("isActive") === "true",
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.functionRole.create({ data: parsed.data })
    revalidatePath("/roles")
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "この役割コードは既に使用されています" }
    }
    return { error: "役割の作成に失敗しました" }
  }
}

export async function updateFunctionRole(id: number, formData: FormData) {
  const parsed = functionRoleSchema.safeParse({
    roleCode: formData.get("roleCode"),
    roleName: formData.get("roleName"),
    roleType: formData.get("roleType"),
    isActive: formData.get("isActive") === "true",
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.functionRole.update({
      where: { id },
      data: parsed.data,
    })
    revalidatePath("/roles")
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "この役割コードは既に使用されています" }
    }
    return { error: "役割の更新に失敗しました" }
  }
}

export async function deleteFunctionRole(id: number) {
  try {
    await prisma.functionRole.delete({ where: { id } })
    revalidatePath("/roles")
    return { success: true }
  } catch {
    return { error: "役割の削除に失敗しました。割当中の従業員がいる場合は削除できません。" }
  }
}

export async function assignRole(data: {
  employeeId: number
  functionRoleId: number
  isPrimary?: boolean
  startDate?: string | null
  endDate?: string | null
}) {
  const parsed = roleAssignmentSchema.safeParse(data)

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.employeeFunctionRole.create({
      data: {
        employeeId: parsed.data.employeeId,
        functionRoleId: parsed.data.functionRoleId,
        isPrimary: parsed.data.isPrimary,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      },
    })
    revalidatePath("/roles")
    revalidatePath(`/employees/${parsed.data.employeeId}`)
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return {
        error: "この従業員には同じカテゴリの役割が既に割り当てられています。同一カテゴリ（業務役割/監督権限/役職）の役割は1つしか持てません。",
      }
    }
    return { error: "役割の割当に失敗しました" }
  }
}

export async function updateEmployeeRole(
  id: number,
  data: {
    isPrimary?: boolean
    startDate?: string | null
    endDate?: string | null
  }
) {
  try {
    const updateData: {
      isPrimary?: boolean
      startDate?: Date | null
      endDate?: Date | null
    } = {}

    if (data.isPrimary !== undefined) {
      updateData.isPrimary = data.isPrimary
    }
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null
    }
    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate ? new Date(data.endDate) : null
    }

    const role = await prisma.employeeFunctionRole.findUnique({
      where: { id },
      select: { employeeId: true },
    })

    await prisma.employeeFunctionRole.update({
      where: { id },
      data: updateData,
    })

    revalidatePath("/roles")
    if (role?.employeeId) {
      revalidatePath(`/employees/${role.employeeId}`)
    }
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return {
        error: "この設定では制約違反が発生します。同一カテゴリの役割は1つしか持てません。",
      }
    }
    return { error: "役割の更新に失敗しました" }
  }
}

export async function unassignRole(id: number) {
  try {
    await prisma.employeeFunctionRole.update({
      where: { id },
      data: { endDate: new Date() },
    })
    revalidatePath("/roles")
    revalidatePath("/employees")
    return { success: true }
  } catch {
    return { error: "役割の解除に失敗しました" }
  }
}
