import { z } from "zod"

export const groupSchema = z.object({
  name: z.string().min(1, "グループ名は必須です").max(50, "50文字以内で入力してください"),
  abbreviatedName: z.union([z.string(), z.null()])
    .transform((v) => (v === null ? null : v.trim() === "" ? null : v.trim()))
    .pipe(z.string().max(10, "10文字以内で入力してください").nullable())
    .optional(),
})

export const employeeSchema = z.object({
  name: z.string().min(1, "従業員名は必須です").max(100, "100文字以内で入力してください"),
  nameKana: z.string().max(100, "100文字以内で入力してください").nullable().optional(),
  hireDate: z.string().nullable().optional(),
  terminationDate: z.string().nullable().optional(),
})

const timeHHmmField = z.union([z.string(), z.null()])
  .transform((v) => (!v || v === "" ? null : v))
  .pipe(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:mm形式で入力してください").nullable())
  .optional()

export const shiftSchema = z.object({
  employeeId: z.string().uuid("従業員を選択してください"),
  shiftDate: z.string().min(1, "日付は必須です"),
  shiftCode: z.string().max(20).nullable().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  isHoliday: z.boolean().default(false),
  isRemote: z.boolean().default(false),
  lunchBreakStart: timeHHmmField,
  lunchBreakEnd: timeHHmmField,
})

export const shiftBulkSchema = z.object({
  shiftIds: z.array(z.number()).min(1, "シフトを選択してください"),
  shiftCode: z.string().max(20).nullable().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  isHoliday: z.boolean().optional(),
  isRemote: z.boolean().optional(),
  note: z.string().max(255).nullable().optional(),
})

export const functionRoleSchema = z.object({
  roleCode: z
    .string()
    .min(1, "ロールコードは必須です")
    .max(20, "20文字以内で入力してください")
    .regex(/^[A-Z_]+$/, "大文字英字とアンダースコアのみ使用できます"),
  roleName: z.string().min(1, "ロール名は必須です").max(50, "50文字以内で入力してください"),
  roleType: z.string().min(1, "ロールタイプは必須です").max(20, "20文字以内で入力してください"),
  isActive: z.boolean().default(true),
})

export const roleAssignmentSchema = z.object({
  employeeId: z.string().uuid("従業員を選択してください"),
  functionRoleId: z.coerce.number().int().positive("ロールを選択してください"),
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

export const groupAssignmentSchema = z.object({
  employeeId: z.string().uuid("従業員を選択してください"),
  groupId: z.coerce.number().int().positive("グループを選択してください"),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
})

export const positionAssignmentSchema = z.object({
  employeeId: z.string().uuid("従業員を選択してください"),
  positionId: z.coerce.number().int().positive("役職を選択してください"),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
})

export type GroupAssignmentFormData = z.infer<typeof groupAssignmentSchema>
export type PositionAssignmentFormData = z.infer<typeof positionAssignmentSchema>

export const shiftHistoryNoteSchema = z.object({
  note: z.string().max(255, "255文字以内で入力してください").default(""),
})
export type ShiftHistoryNoteFormData = z.infer<typeof shiftHistoryNoteSchema>

export const shiftCodeSchema = z.object({
  code: z.string().min(1, "シフトコードは必須です").max(20, "20文字以内で入力してください"),
  color: z.string().max(20).nullable().optional(),
  defaultStartTime: z.string().nullable().optional(),
  defaultEndTime: z.string().nullable().optional(),
  defaultIsHoliday: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0, "0以上の数値を入力してください").default(0),
  defaultLunchBreakStart: timeHHmmField,
  defaultLunchBreakEnd: timeHHmmField,
})
export type ShiftCodeFormData = z.infer<typeof shiftCodeSchema>

// 業務種別スキーマ
export const dutyTypeSchema = z.object({
  name: z.string().min(1, "業務名は必須です").max(50, "50文字以内で入力してください"),
  color: z.string().max(20).nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0, "0以上の数値を入力してください").default(0),
  defaultReducesCapacity: z.boolean().default(true),
  defaultStartTime: z.string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:mm形式で入力してください").nullable())
    .optional(),
  defaultEndTime: z.string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:mm形式で入力してください").nullable())
    .optional(),
  defaultNote: z.string()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  defaultTitle: z.string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().max(100, "100文字以内で入力してください").nullable())
    .optional(),
})
export type DutyTypeFormData = z.infer<typeof dutyTypeSchema>

// 業務割当スキーマ
export const dutyAssignmentSchema = z.object({
  employeeId: z.string().uuid("従業員を選択してください"),
  dutyTypeId: z.coerce.number().int().positive("業務種別を選択してください"),
  dutyDate: z.string().min(1, "日付は必須です"),
  startTime: z.string().min(1, "開始時刻は必須です"),
  endTime: z.string().min(1, "終了時刻は必須です"),
  note: z.string().optional(),
  title: z.string()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.string().max(100, "100文字以内で入力してください").optional())
    .optional(),
  reducesCapacity: z.boolean().default(true),
}).refine((data) => data.endTime !== data.startTime, {
  message: "終了時刻は開始時刻と異なる値にしてください",
  path: ["endTime"],
})
export type DutyAssignmentFormData = z.infer<typeof dutyAssignmentSchema>

// CSV Import schemas
export const employeeCsvRowSchema = z.object({
  employeeId: z.string().uuid().nullable(),
  name: z.string().min(1, "従業員名は必須です").max(100, "100文字以内で入力してください"),
  nameKana: z.string().max(100).nullable(),
  hireDate: z.string().nullable(),
  terminationDate: z.string().nullable(),
  groupNames: z.string().nullable(),
})

export const shiftCsvRowSchema = z.object({
  shiftDate: z.string().min(1, "日付は必須です"),
  employeeId: z.string().refine(
    (v) => v === "" || z.string().uuid().safeParse(v).success,
    "従業員IDはUUID形式で入力してください"
  ),
  shiftCode: z.string().max(20).nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  isHoliday: z.boolean(),
  isRemote: z.boolean(),
})

export const shiftCodeCsvRowSchema = z.object({
  code: z.string().min(1, "シフトコードは必須です").max(20, "20文字以内で入力してください"),
  color: z.string().max(20).nullable(),
  defaultStartTime: z.string().nullable(),
  defaultEndTime: z.string().nullable(),
  defaultIsHoliday: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0, "0以上の数値を入力してください"),
})

export const roleCsvRowSchema = z.object({
  employeeName: z.string().min(1, "従業員名は必須です"),
  roleCode: z.string().min(1, "ロールコードは必須です").max(20, "20文字以内で入力してください"),
  isPrimary: z.boolean(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
})

export type EmployeeCsvRow = z.infer<typeof employeeCsvRowSchema>
export type ShiftCsvRow = z.infer<typeof shiftCsvRowSchema>
export type ShiftCodeCsvRow = z.infer<typeof shiftCodeCsvRowSchema>
export type RoleCsvRow = z.infer<typeof roleCsvRowSchema>

// 履歴編集スキーマ
export const groupHistoryEditSchema = z.object({
  groupId: z.coerce.number().int().positive("グループを選択してください").nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
})
export type GroupHistoryEditFormData = z.infer<typeof groupHistoryEditSchema>

export const roleHistoryEditSchema = z.object({
  roleType: z.string().max(20).nullable().optional(),
  isPrimary: z.boolean().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
})
export type RoleHistoryEditFormData = z.infer<typeof roleHistoryEditSchema>

export const positionHistoryEditSchema = z.object({
  positionId: z.coerce.number().int().positive("役職を選択してください").nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
})
export type PositionHistoryEditFormData = z.infer<typeof positionHistoryEditSchema>
