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
  shiftId: number | null
  shiftCode: string
  startTime: Date | null
  endTime: Date | null
  isHoliday: boolean
  isRemote: boolean
}

export type ShiftDailySortField =
  | "employeeName" | "groupName" | "shiftCode"
  | "startTime" | "endTime" | "isHoliday" | "isRemote"

export type SortOrder = "asc" | "desc"

export type ShiftDailyFilterParams = {
  date: string              // "yyyy-MM-dd"
  groupIds?: number[]
  unassigned?: boolean
  shiftCodes?: string[]
  employeeSearch?: string
  employeeIds?: string[]
  startTimeFrom?: string    // "HH:mm"
  endTimeTo?: string        // "HH:mm"
  isHoliday?: boolean
  isRemote?: boolean
  sortBy?: ShiftDailySortField
  sortOrder?: SortOrder
}

export type DailyFilterOptions = {
  employees: { id: string; name: string }[]
  groups: { id: number; name: string }[]
  shiftCodes: string[]
  hasUnassigned: boolean
}

export type ShiftHistoryEntry = ShiftChangeHistory & {
  employee: (Employee & { groups: (EmployeeGroup & { group: Group })[] }) | null
}
