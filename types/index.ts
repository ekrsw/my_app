export type { ShiftWithEmployee, ShiftCalendarData, ShiftCalendarPaginatedResult, ShiftFilterParams, ShiftDailyRow, ShiftDailyFilterParams, ShiftDailySortField, SortOrder, ShiftHistoryEntry } from "./shifts"
export type { EmployeeWithGroups, EmployeeWithDetails, EmployeeFilterParams, EmployeeGroupHistoryEntry } from "./employees"
export type { DutyAssignmentWithDetails } from "./duties"
export type { DashboardOverviewFilter, DashboardFilterOptions } from "./dashboard"

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
