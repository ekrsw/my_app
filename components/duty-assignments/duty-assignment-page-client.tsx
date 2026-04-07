"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { useQueryParams } from "@/hooks/use-query-params"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { DutyViewModeSelect } from "@/components/duty-assignments/duty-view-mode-select"
import { DutyAssignmentForm } from "@/components/duty-assignments/duty-assignment-form"
import { DutyDailyView } from "@/components/duty-assignments/duty-daily-view"
import { DutyDailyTimeline } from "@/components/duty-assignments/duty-daily-timeline"
import { DutyMonthlyCalendar } from "@/components/duty-assignments/duty-monthly-calendar"
import { DutyTypeSummaryRow } from "@/components/duty-assignments/duty-type-summary-row"
import { FilterPresetManager } from "@/components/duty-assignments/filter-preset-manager"
import { toDateString } from "@/lib/date-utils"
import type {
  DutyAssignmentWithDetails,
  DutyCalendarData,
  DutyDailyFilterOptions,
  DutyDailySortField,
  SortOrder,
} from "@/types/duties"

type DutyAssignmentPageClientProps = {
  viewMode: "monthly" | "daily"
  isAuthenticated: boolean
  // 日次ビュー用
  dailyData: DutyAssignmentWithDetails[]
  dailyTotal: number
  dailyHasMore: boolean
  dailyNextCursor: number | null
  dailyDate: string
  filterOptions: DutyDailyFilterOptions
  employeeIds: string[]
  groupIds: number[]
  dutyTypeIds: number[]
  reducesCapacity: boolean | null
  sortBy: DutyDailySortField
  sortOrder: SortOrder
  // 月次ビュー用
  calendarData: DutyCalendarData[]
  dutyTypeSummary: { code: string; name: string; color: string | null; count: number }[]
  year: number
  month: number
  monthlyGroupIds: number[]
  allGroups: { id: number; name: string }[]
  // フォーム用
  employeeOptions: { id: string; name: string }[]
  dutyTypeOptions: { id: number; code: string; name: string; defaultReducesCapacity: boolean }[]
}

export function DutyAssignmentPageClient({
  viewMode,
  isAuthenticated,
  dailyData,
  dailyTotal,
  dailyHasMore: initialDailyHasMore,
  dailyNextCursor: initialDailyNextCursor,
  dailyDate,
  filterOptions,
  employeeIds,
  groupIds,
  dutyTypeIds,
  reducesCapacity,
  sortBy,
  sortOrder,
  calendarData,
  dutyTypeSummary,
  year,
  month,
  monthlyGroupIds,
  allGroups,
  employeeOptions,
  dutyTypeOptions,
}: DutyAssignmentPageClientProps) {
  const { setParams, getParam } = useQueryParams()

  // --- 日次ビュー: ページネーション状態 ---
  const [dailyRows, setDailyRows] = useState(dailyData)
  const [dailyHasMoreState, setDailyHasMoreState] = useState(initialDailyHasMore)
  const [dailyNextCursorState, setDailyNextCursorState] = useState(initialDailyNextCursor)

  useEffect(() => {
    setDailyRows(dailyData)
    setDailyHasMoreState(initialDailyHasMore)
    setDailyNextCursorState(initialDailyNextCursor)
  }, [dailyData, initialDailyHasMore, initialDailyNextCursor])

  // --- フォームダイアログ状態 ---
  const [formOpen, setFormOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<DutyAssignmentWithDetails | undefined>()
  const [monthlySelectedDate, setMonthlySelectedDate] = useState<string | undefined>()

  const handleOpenNewForm = useCallback(() => {
    setEditingAssignment(undefined)
    setFormOpen(true)
  }, [])

  // --- 日次: 日付ナビゲーション ---
  const navigateDay = useCallback(
    (offset: number) => {
      const current = new Date(dailyDate + "T00:00:00+09:00")
      current.setDate(current.getDate() + offset)
      setParams({ dailyDate: toDateString(current) })
    },
    [dailyDate, setParams]
  )

  const formattedDailyDate = useMemo(() => {
    const d = new Date(dailyDate + "T00:00:00+09:00")
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"]
    const dayOfWeek = dayNames[d.getDay()]
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${dayOfWeek})`
  }, [dailyDate])

  // --- 月次: 月ナビゲーション ---
  const navigateMonth = useCallback(
    (offset: number) => {
      let newYear = year
      let newMonth = month + offset
      if (newMonth < 1) {
        newMonth = 12
        newYear -= 1
      } else if (newMonth > 12) {
        newMonth = 1
        newYear += 1
      }
      setParams({ year: String(newYear), month: String(newMonth) })
    },
    [year, month, setParams]
  )

  const formattedMonth = useMemo(() => `${year}年${month}月`, [year, month])

  // --- 現在のフィルターパラメータ（プリセット保存用） ---
  const currentFilterParams = useMemo(() => {
    const p: Record<string, string> = {}
    if (viewMode === "daily") {
      if (employeeIds.length > 0) p.employeeIds = employeeIds.join(",")
      if (groupIds.length > 0) p.groupIds = groupIds.join(",")
      if (dutyTypeIds.length > 0) p.dutyTypeIds = dutyTypeIds.join(",")
      if (reducesCapacity !== null) p.reducesCapacity = String(reducesCapacity)
      if (sortBy !== "startTime") p.sortBy = sortBy
      if (sortOrder !== "asc") p.sortOrder = sortOrder
    } else {
      if (monthlyGroupIds.length > 0) p.monthlyGroupIds = monthlyGroupIds.join(",")
    }
    return p
  }, [viewMode, employeeIds, groupIds, dutyTypeIds, reducesCapacity, sortBy, sortOrder, monthlyGroupIds])

  // --- 月次セルクリック: 日次ビューへジャンプ ---
  const handleCellClick = useCallback(
    (dateStr: string) => {
      setEditingAssignment(undefined)
      setMonthlySelectedDate(dateStr)
      setFormOpen(true)
    },
    []
  )

  // --- 日次ビュー ---
  if (viewMode === "daily") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DutyViewModeSelect value="daily" />
            <Button variant="outline" size="icon" onClick={() => navigateDay(-1)} aria-label="前日">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center">
              {formattedDailyDate}
            </span>
            <Button variant="outline" size="icon" onClick={() => navigateDay(1)} aria-label="翌日">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <FilterPresetManager
              viewMode="daily"
              currentParams={currentFilterParams}
            />
            {isAuthenticated && (
              <Button size="sm" onClick={handleOpenNewForm}>
                <Plus className="h-4 w-4 mr-1" />
                新規作成
              </Button>
            )}
          </div>
        </div>

        <DutyDailyTimeline data={dailyRows} />

        <DutyDailyView
          data={dailyRows}
          total={dailyTotal}
          hasMore={dailyHasMoreState}
          nextCursor={dailyNextCursorState}
          date={dailyDate}
          filterOptions={filterOptions}
          isAuthenticated={isAuthenticated}
          employees={employeeOptions}
          dutyTypes={dutyTypeOptions}
          selectedEmployeeIds={employeeIds}
          selectedGroupIds={groupIds}
          selectedDutyTypeIds={dutyTypeIds}
          reducesCapacityFilter={reducesCapacity}
          sortBy={sortBy}
          sortOrder={sortOrder}
        />

        <DutyAssignmentForm
          employees={employeeOptions}
          dutyTypes={dutyTypeOptions}
          defaultDate={dailyDate}
          dutyAssignment={editingAssignment}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      </div>
    )
  }

  // --- 月次ビュー ---
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DutyViewModeSelect value="monthly" />
          <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)} aria-label="前月">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[100px] text-center">
            {formattedMonth}
          </span>
          <Button variant="outline" size="icon" onClick={() => navigateMonth(1)} aria-label="翌月">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <FilterPresetManager
            viewMode="monthly"
            currentParams={currentFilterParams}
          />
          {isAuthenticated && (
            <Button size="sm" onClick={handleOpenNewForm}>
              <Plus className="h-4 w-4 mr-1" />
              新規作成
            </Button>
          )}
        </div>
      </div>

      <DutyTypeSummaryRow summary={dutyTypeSummary} />

      <DutyMonthlyCalendar
        data={calendarData}
        year={year}
        month={month}
        allGroups={allGroups}
        groupIds={monthlyGroupIds}
        onCellClick={handleCellClick}
      />

      <DutyAssignmentForm
        employees={employeeOptions}
        dutyTypes={dutyTypeOptions}
        defaultDate={monthlySelectedDate}
        dutyAssignment={editingAssignment}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </div>
  )
}
