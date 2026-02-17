import { z } from "zod"

export const groupSchema = z.object({
  name: z.string().min(1, "グループ名は必須です").max(50, "50文字以内で入力してください"),
})

export const employeeSchema = z.object({
  name: z.string().min(1, "従業員名は必須です").max(100, "100文字以内で入力してください"),
  nameKana: z.string().max(100, "100文字以内で入力してください").nullable().optional(),
  groupId: z.coerce.number().int().positive("グループを選択してください").nullable().optional(),
  assignmentDate: z.string().nullable().optional(),
  terminationDate: z.string().nullable().optional(),
})

export const shiftSchema = z.object({
  employeeId: z.coerce.number().int().positive("従業員を選択してください"),
  shiftDate: z.string().min(1, "日付は必須です"),
  shiftCode: z.string().max(20).nullable().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  isHoliday: z.boolean().default(false),
  isPaidLeave: z.boolean().default(false),
  isRemote: z.boolean().default(false),
})

export const shiftBulkSchema = z.object({
  shiftIds: z.array(z.number()).min(1, "シフトを選択してください"),
  shiftCode: z.string().max(20).nullable().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  isHoliday: z.boolean().optional(),
  isPaidLeave: z.boolean().optional(),
  isRemote: z.boolean().optional(),
})

export const functionRoleSchema = z.object({
  roleCode: z
    .string()
    .min(1, "役割コードは必須です")
    .max(20, "20文字以内で入力してください")
    .regex(/^[A-Z_]+$/, "大文字英字とアンダースコアのみ使用できます"),
  roleName: z.string().min(1, "役割名は必須です").max(50, "50文字以内で入力してください"),
  roleType: z.enum(["FUNCTION", "AUTHORITY", "POSITION"], {
    message: "役割タイプを選択してください",
  }),
  isActive: z.boolean().default(true),
})

export const roleAssignmentSchema = z.object({
  employeeId: z.coerce.number().int().positive("従業員を選択してください"),
  functionRoleId: z.coerce.number().int().positive("役割を選択してください"),
  isPrimary: z.boolean().default(false),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
})

export type GroupFormData = z.infer<typeof groupSchema>
export type EmployeeFormData = z.infer<typeof employeeSchema>
export type ShiftFormData = z.infer<typeof shiftSchema>
export type ShiftBulkFormData = z.infer<typeof shiftBulkSchema>
export type FunctionRoleFormData = z.infer<typeof functionRoleSchema>
export type RoleAssignmentFormData = z.infer<typeof roleAssignmentSchema>
