import type {
  DutyAssignment,
  DutyType,
  Employee,
  EmployeeGroup,
  Group,
} from "@/app/generated/prisma/client"

export type DutyAssignmentWithDetails = DutyAssignment & {
  employee: Employee & {
    groups: (EmployeeGroup & { group: Group })[]
  }
  dutyType: DutyType
}

export type DutyDailyFilterParams = {
  date: Date
  employeeIds?: string[]
  groupIds?: number[]
  dutyTypeIds?: number[]
  reducesCapacity?: boolean | null
  sortBy?: DutyDailySortField
  sortOrder?: SortOrder
}

export type DutyDailySortField =
  | "employeeName"
  | "groupName"
  | "dutyTypeName"
  | "startTime"

export type SortOrder = "asc" | "desc"

export type DutyDailyPaginatedResult = {
  data: DutyAssignmentWithDetails[]
  total: number
  hasMore: boolean
  nextCursor: number | null
}

export type DutyCalendarData = {
  employeeId: string
  employeeName: string
  groupName: string | null
  duties: Record<string, DutyCalendarCell[]> // key: "yyyy-MM-dd"
}

export type DutyCalendarCell = {
  id: number
  dutyTypeName: string
  dutyTypeColor: string | null
  startTime: string // "HH:mm"
  endTime: string // "HH:mm"
  reducesCapacity: boolean
  note: string | null
  title: string | null
}

export type DutyCalendarResult = {
  data: DutyCalendarData[]
  dutyTypeSummary: { name: string; color: string | null; count: number; sortOrder: number }[]
}

export type DutyDailyFilterOptions = {
  employees: { id: string; name: string }[]
  groups: { id: number; name: string }[]
  dutyTypes: { id: number; name: string; color: string | null }[]
}

export type DutyCalendarFilterParams = {
  year: number
  month: number
  groupIds?: number[]
  unassigned?: boolean
  roleIds?: number[]
  roleUnassigned?: boolean
  dutyTypeIds?: number[]
  dutyUnassigned?: boolean
  employeeSearch?: string
  employeeIds?: string[]
}

/** 従業員ID → 日付文字列 → シフトコード のマップ */
export type ShiftCodeMap = Record<string, Record<string, string>>

export type DutyCalendarPaginatedResult = {
  data: DutyCalendarData[]
  dutyTypeSummary: { name: string; color: string | null; count: number; sortOrder: number }[]
  total: number
  hasMore: boolean
  nextCursor: number | null
}
