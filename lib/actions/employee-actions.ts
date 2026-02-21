"use server"

import { prisma } from "@/lib/prisma"
import { employeeSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"

export type RoleChangeItem = {
  status: "added" | "modified" | "removed"
  id?: number // existing role id (for modified/removed)
  functionRoleId?: number
  isPrimary?: boolean
  startDate?: string | null
  endDate?: string | null
}

export type PositionChangeItem = {
  status: "added" | "modified" | "removed"
  id?: number // existing employee_position id (for modified/removed)
  positionId?: number
  startDate?: string | null
  endDate?: string | null
}

export async function createEmployee(formData: FormData) {
  const parsed = employeeSchema.safeParse({
    name: formData.get("name"),
    nameKana: formData.get("nameKana") || null,
    groupId: formData.get("groupId") ? Number(formData.get("groupId")) : null,
    assignmentDate: formData.get("assignmentDate") || null,
    terminationDate: formData.get("terminationDate") || null,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const data = {
    name: parsed.data.name,
    nameKana: parsed.data.nameKana ?? null,
    groupId: parsed.data.groupId ?? null,
    assignmentDate: parsed.data.assignmentDate
      ? new Date(parsed.data.assignmentDate)
      : null,
    terminationDate: parsed.data.terminationDate
      ? new Date(parsed.data.terminationDate)
      : null,
  }

  try {
    await prisma.employee.create({ data })
    revalidatePath("/employees")
    return { success: true }
  } catch {
    return { error: "従業員の作成に失敗しました" }
  }
}

export async function updateEmployee(id: number, formData: FormData) {
  const parsed = employeeSchema.safeParse({
    name: formData.get("name"),
    nameKana: formData.get("nameKana") || null,
    groupId: formData.get("groupId") ? Number(formData.get("groupId")) : null,
    assignmentDate: formData.get("assignmentDate") || null,
    terminationDate: formData.get("terminationDate") || null,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const data = {
    name: parsed.data.name,
    nameKana: parsed.data.nameKana ?? null,
    groupId: parsed.data.groupId ?? null,
    assignmentDate: parsed.data.assignmentDate
      ? new Date(parsed.data.assignmentDate)
      : null,
    terminationDate: parsed.data.terminationDate
      ? new Date(parsed.data.terminationDate)
      : null,
  }

  try {
    await prisma.employee.update({ where: { id }, data })
    revalidatePath("/employees")
    revalidatePath(`/employees/${id}`)
    return { success: true }
  } catch {
    return { error: "従業員の更新に失敗しました" }
  }
}

export async function deleteEmployee(id: number) {
  try {
    await prisma.employee.delete({ where: { id } })
    revalidatePath("/employees")
    return { success: true }
  } catch {
    return { error: "従業員の削除に失敗しました。関連データがある場合は削除できません。" }
  }
}

export async function updateEmployeeWithRoles(
  id: number,
  employeeData: {
    name: string
    nameKana: string | null
    groupId: number | null
    assignmentDate: string | null
    terminationDate: string | null
  },
  roleChanges: RoleChangeItem[],
  positionChanges: PositionChangeItem[] = []
) {
  const parsed = employeeSchema.safeParse(employeeData)

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. 従業員基本情報更新（名前/グループ変更はDBトリガーで履歴化）
      await tx.employee.update({
        where: { id },
        data: {
          name: parsed.data.name,
          nameKana: parsed.data.nameKana ?? null,
          groupId: parsed.data.groupId ?? null,
          assignmentDate: parsed.data.assignmentDate
            ? new Date(parsed.data.assignmentDate)
            : null,
          terminationDate: parsed.data.terminationDate
            ? new Date(parsed.data.terminationDate)
            : null,
        },
      })

      // 2. 役割変更を処理（各操作はDBトリガーで履歴化）
      for (const change of roleChanges) {
        if (change.status === "added" && change.functionRoleId) {
          await tx.employeeFunctionRole.create({
            data: {
              employeeId: id,
              functionRoleId: change.functionRoleId,
              isPrimary: change.isPrimary ?? false,
              startDate: change.startDate ? new Date(change.startDate) : null,
              endDate: null,
            },
          })
        } else if (change.status === "modified" && change.id) {
          await tx.employeeFunctionRole.update({
            where: { id: change.id },
            data: {
              isPrimary: change.isPrimary,
              startDate: change.startDate ? new Date(change.startDate) : null,
              endDate: change.endDate ? new Date(change.endDate) : null,
            },
          })
        } else if (change.status === "removed" && change.id) {
          await tx.employeeFunctionRole.update({
            where: { id: change.id },
            data: { endDate: new Date() },
          })
        }
      }

      // 3. 役職変更を処理（各操作はDBトリガーで履歴化）
      for (const change of positionChanges) {
        if (change.status === "added" && change.positionId) {
          await tx.employeePosition.create({
            data: {
              employeeId: id,
              positionId: change.positionId,
              startDate: change.startDate ? new Date(change.startDate) : new Date(),
              endDate: null,
            },
          })
        } else if (change.status === "modified" && change.id) {
          await tx.employeePosition.update({
            where: { id: change.id },
            data: {
              startDate: change.startDate ? new Date(change.startDate) : undefined,
              endDate: change.endDate ? new Date(change.endDate) : null,
            },
          })
        } else if (change.status === "removed" && change.id) {
          await tx.employeePosition.update({
            where: { id: change.id },
            data: { endDate: new Date() },
          })
        }
      }
    })

    revalidatePath("/employees")
    revalidatePath(`/employees/${id}`)
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "message" in e && typeof e.message === "string" && e.message.includes("employee_positions_no_overlap")) {
      return { error: "指定期間は既存の役職期間と重複しています" }
    }
    return { error: "従業員情報の更新に失敗しました" }
  }
}
