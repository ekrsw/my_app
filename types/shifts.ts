import type { Shift, Employee, Group, ShiftChangeHistory } from "@/app/generated/prisma/client"

export type ShiftWithEmployee = Shift & {
  employee: (Employee & { group: Group | null }) | null
}

export type ShiftCalendarData = {
  employeeId: number
  employeeName: string
  groupId: number | null
  groupName: string | null
  shifts: Record<string, Shift> // key: "yyyy-MM-dd"
}

export type ShiftFilterParams = {
  year: number
  month: number
  groupId?: number
  employeeSearch?: string
}

export type ShiftHistoryEntry = ShiftChangeHistory & {
  shift: Shift & {
    employee: (Employee & { group: Group | null }) | null
  }
}
