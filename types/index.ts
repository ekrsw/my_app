export type { ShiftWithEmployee, ShiftCalendarData, ShiftFilterParams, ShiftHistoryEntry } from "./shifts"
export type { EmployeeWithGroups, EmployeeWithDetails, EmployeeFilterParams, EmployeeGroupHistoryEntry } from "./employees"

// 共通型
export type PaginationParams = {
  page: number
  pageSize: number
}

export type PaginatedResult<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>
