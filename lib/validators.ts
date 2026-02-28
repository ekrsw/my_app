import { z } from "zod"

export const groupSchema = z.object({
  name: z.string().min(1, "グループ名は必須です").max(50, "50文字以内で入力してください"),
})

export const employeeSchema = z.object({
  name: z.string().min(1, "従業員名は必須です").max(100, "100文字以内で入力してください"),
  nameKana: z.string().max(100, "100文字以内で入力してください").nullable().optional(),
  hireDate: z.string().nullable().optional(),
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
  roleType: z.enum(["FUNCTION", "AUTHORITY"], {
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

export const positionSchema = z.object({
  positionCode: z
    .string()
    .min(1, "役職コードは必須です")
    .max(20, "20文字以内で入力してください")
    .regex(/^[A-Z_]+$/, "大文字英字とアンダースコアのみ使用できます"),
  positionName: z.string().min(1, "役職名は必須です").max(50, "50文字以内で入力してください"),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0, "0以上の数値を入力してください").default(0),
})

export type GroupFormData = z.infer<typeof groupSchema>
export type EmployeeFormData = z.infer<typeof employeeSchema>
export type ShiftFormData = z.infer<typeof shiftSchema>
export type ShiftBulkFormData = z.infer<typeof shiftBulkSchema>
export type FunctionRoleFormData = z.infer<typeof functionRoleSchema>
export type RoleAssignmentFormData = z.infer<typeof roleAssignmentSchema>
export type PositionFormData = z.infer<typeof positionSchema>

export const shiftCodeSchema = z.object({
  code: z.string().min(1, "シフトコードは必須です").max(20, "20文字以内で入力してください"),
  defaultStartTime: z.string().nullable().optional(),
  defaultEndTime: z.string().nullable().optional(),
  defaultIsHoliday: z.boolean().default(false),
  defaultIsPaidLeave: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0, "0以上の数値を入力してください").default(0),
})
export type ShiftCodeFormData = z.infer<typeof shiftCodeSchema>

// CSV Import schemas
export const employeeCsvRowSchema = z.object({
  employeeId: z.coerce.number().int().positive().nullable(),
  name: z.string().min(1, "従業員名は必須です").max(100, "100文字以内で入力してください"),
  nameKana: z.string().max(100).nullable(),
  hireDate: z.string().nullable(),
  terminationDate: z.string().nullable(),
  groupNames: z.string().nullable(),
})

export const shiftCsvRowSchema = z.object({
  shiftDate: z.string().min(1, "日付は必須です"),
  employeeId: z.coerce.number().int().positive("従業員IDは必須です"),
  shiftCode: z.string().max(20).nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  isHoliday: z.boolean(),
  isPaidLeave: z.boolean(),
  isRemote: z.boolean(),
})

export type EmployeeCsvRow = z.infer<typeof employeeCsvRowSchema>
export type ShiftCsvRow = z.infer<typeof shiftCsvRowSchema>
