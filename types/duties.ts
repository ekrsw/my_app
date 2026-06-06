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

export type DutyCalendarData = {
  employeeId: string
  employeeName: string
  groupNames: string[]
  isTerminated: boolean
  terminationDate: string | null
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
  /**
   * 現在のコンテキストフィルター（月＋グループ/ロール/業務種別）に一致する全従業員の名簿。
   * ページング・employeeIds・employeeSearch は反映しない（フィルター選択肢用の母集合）。
   * 1ページ目（cursor===0）でのみ計算し、loadMore（cursor>0）では空配列。
   */
  employeeRoster: { id: string; name: string }[]
}
