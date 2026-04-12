import type { Shift, Employee, Group, EmployeeGroup, ShiftChangeHistory } from "@/app/generated/prisma/client"

export type ShiftWithEmployee = Shift & {
  employee: (Employee & { groups: (EmployeeGroup & { group: Group })[] }) | null
}

export type ShiftCalendarData = {
  employeeId: string
  employeeName: string
  groupId: number | null
  groupName: string | null
  shifts: Record<string, Shift> // key: "yyyy-MM-dd"
}

export type ShiftFilterParams = {
  year: number
  month: number
  groupIds?: number[]
  unassigned?: boolean
  roleIds?: number[]
  roleUnassigned?: boolean
  employeeSearch?: string
  employeeIds?: string[]
}

export type ShiftCalendarPaginatedResult = {
  data: ShiftCalendarData[]
  total: number
  hasMore: boolean
  nextCursor: number | null
}

export type ShiftDailyRow = {
  employeeId: string
  employeeName: string
  groupName: string | null
  supervisorRoleName: string | null
  businessRoleName: string | null
  shiftId: number | null
  shiftCode: string
  startTime: Date | null
  endTime: Date | null
  isHoliday: boolean | null
  isRemote: boolean
  lunchBreakStart: Date | null
  lunchBreakEnd: Date | null
}

export type ShiftDailyPaginatedResult = {
  data: ShiftDailyRow[]
  total: number
  hasMore: boolean
  nextCursor: number | null
}

export type ShiftDailySortField =
  | "employeeName" | "groupName" | "supervisorRoleName" | "businessRoleName"
  | "shiftCode" | "isRemote"

export type SortOrder = "asc" | "desc"

export type ShiftDailyFilterParams = {
  date: string              // "yyyy-MM-dd"
  groupIds?: number[]
  unassigned?: boolean
  shiftCodes?: string[]
  employeeSearch?: string
  employeeIds?: string[]
  isRemote?: boolean
  supervisorRoleNames?: string[]
  businessRoleNames?: string[]
  sortBy?: ShiftDailySortField
  sortOrder?: SortOrder
}

export type DailyFilterOptions = {
  employees: { id: string; name: string }[]
  groups: { id: number; name: string }[]
  shiftCodes: string[]
  hasUnassigned: boolean
  supervisorRoleNames: string[]
  businessRoleNames: string[]
}

export type ShiftHistoryEntry = ShiftChangeHistory & {
  employee: (Employee & { groups: (EmployeeGroup & { group: Group })[] }) | null
}
