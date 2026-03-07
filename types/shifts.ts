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

export type ShiftHistoryEntry = ShiftChangeHistory & {
  employee: (Employee & { groups: (EmployeeGroup & { group: Group })[] }) | null
}
