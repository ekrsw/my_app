"use server"

import { prisma } from "@/lib/prisma"
import { employeeSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"

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
