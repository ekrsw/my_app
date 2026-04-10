"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { useQueryParams } from "@/hooks/use-query-params"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react"
import { DutyViewModeSelect } from "@/components/duty-assignments/duty-view-mode-select"
import { DutyAssignmentForm } from "@/components/duty-assignments/duty-assignment-form"
import { DutyDailyView } from "@/components/duty-assignments/duty-daily-view"
import { DutyDailyTimeline } from "@/components/duty-assignments/duty-daily-timeline"
import { DutyMonthlyCalendar } from "@/components/duty-assignments/duty-monthly-calendar"
import { DutyTypeSummaryRow } from "@/components/duty-assignments/duty-type-summary-row"
import { FilterPresetManager } from "@/components/duty-assignments/filter-preset-manager"
import { GroupMultiSelect } from "@/components/shifts/group-multi-select"
import { RoleMultiSelect } from "@/components/shifts/role-multi-select"
import { DutyTypeMultiSelect } from "@/components/duty-assignments/duty-type-multi-select"
import { loadMoreDutyCalendarData, getDutyAssignmentById, deleteDutyAssignment } from "@/lib/actions/duty-assignment-actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { toDateString } from "@/lib/date-utils"
import type { ShiftCodeInfo } from "@/lib/constants"
import type {
  DutyAssignmentWithDetails,
  DutyCalendarData,
  DutyCalendarFilterParams,
  DutyDailyFilterOptions,
  DutyDailySortField,
  ShiftCodeMap,
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
  dutyTypeSummary: { name: string; color: string | null; count: number; sortOrder: number }[]
  calendarTotal: number
  calendarHasMore: boolean
  calendarNextCursor: number | null
  year: number
  month: number
  monthlyEmployeeIds: string[]
  monthlyGroupIds: number[]
  monthlyUnassigned: boolean
  monthlyRoleIds: number[]
  monthlyRoleUnassigned: boolean
  monthlyDutyTypeIds: number[]
  monthlyDutyUnassigned: boolean
  shiftCodeMap: ShiftCodeMap
  shiftCodeInfoMap: Record<string, ShiftCodeInfo>
  groups: { id: number; name: string }[]
  roles: { id: number; roleName: string }[]
  // フォーム用
  employeeOptions: { id: string; name: string }[]
  dutyTypeOptions: { id: number; name: string; defaultReducesCapacity: boolean; defaultStartTime: string | null; defaultEndTime: string | null; defaultNote: string | null }[]
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
  calendarTotal,
  calendarHasMore: initialCalendarHasMore,
  calendarNextCursor: initialCalendarNextCursor,
  year,
  month,
  monthlyEmployeeIds,
  monthlyGroupIds,
  monthlyUnassigned,
  monthlyRoleIds,
  monthlyRoleUnassigned,
  monthlyDutyTypeIds,
  monthlyDutyUnassigned,
  shiftCodeMap,
  shiftCodeInfoMap,
  groups,
  roles,
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
  const [monthlySelectedEmployeeId, setMonthlySelectedEmployeeId] = useState<string | undefined>()
  const [editLoadingId, setEditLoadingId] = useState<number | null>(null)
  const [deleteLoadingId, setDeleteLoadingId] = useState<number | null>(null)
  const router = useRouter()

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

  // --- 月次: ページネーション状態 ---
  const [calendarRows, setCalendarRows] = useState(calendarData)
  const [calendarHasMoreState, setCalendarHasMoreState] = useState(initialCalendarHasMore)
  const [calendarNextCursorState, setCalendarNextCursorState] = useState(initialCalendarNextCursor)
  const [calendarIsLoadingMore, setCalendarIsLoadingMore] = useState(false)

  useEffect(() => {
    setCalendarRows(calendarData)
    setCalendarHasMoreState(initialCalendarHasMore)
    setCalendarNextCursorState(initialCalendarNextCursor)
    setCalendarIsLoadingMore(false)
  }, [calendarData, initialCalendarHasMore, initialCalendarNextCursor])

  const calendarFilter: DutyCalendarFilterParams = useMemo(() => ({
    year,
    month,
    groupIds: monthlyGroupIds.length > 0 ? monthlyGroupIds : undefined,
    unassigned: monthlyUnassigned || undefined,
    roleIds: monthlyRoleIds.length > 0 ? monthlyRoleIds : undefined,
    roleUnassigned: monthlyRoleUnassigned || undefined,
    dutyTypeIds: monthlyDutyTypeIds.length > 0 ? monthlyDutyTypeIds : undefined,
    dutyUnassigned: monthlyDutyUnassigned || undefined,
    employeeIds: monthlyEmployeeIds.length > 0 ? monthlyEmployeeIds : undefined,
  }), [year, month, monthlyGroupIds, monthlyUnassigned, monthlyRoleIds, monthlyRoleUnassigned, monthlyDutyTypeIds, monthlyDutyUnassigned, monthlyEmployeeIds])

  const handleCalendarLoadMore = useCallback(async () => {
    if (!calendarHasMoreState || calendarNextCursorState === null || calendarIsLoadingMore) return
    setCalendarIsLoadingMore(true)
    try {
      const result = await loadMoreDutyCalendarData(calendarFilter, calendarNextCursorState)
      setCalendarRows((prev) => [...prev, ...result.data])
      setCalendarHasMoreState(result.hasMore)
      setCalendarNextCursorState(result.nextCursor)
    } finally {
      setCalendarIsLoadingMore(false)
    }
  }, [calendarHasMoreState, calendarNextCursorState, calendarIsLoadingMore, calendarFilter])

  // --- 月次: 従業員名テキスト検索 ---
  const [employeeSearchText, setEmployeeSearchText] = useState("")

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
      if (monthlyEmployeeIds.length > 0) p.monthlyEmployeeIds = monthlyEmployeeIds.join(",")
      if (monthlyGroupIds.length > 0) p.monthlyGroupIds = monthlyGroupIds.join(",")
      if (monthlyUnassigned) p.monthlyUnassigned = "true"
      if (monthlyRoleIds.length > 0) p.monthlyRoleIds = monthlyRoleIds.join(",")
      if (monthlyRoleUnassigned) p.monthlyRoleUnassigned = "true"
      if (monthlyDutyTypeIds.length > 0) p.monthlyDutyTypeIds = monthlyDutyTypeIds.join(",")
      if (monthlyDutyUnassigned) p.monthlyDutyUnassigned = "true"
    }
    return p
  }, [viewMode, employeeIds, groupIds, dutyTypeIds, reducesCapacity, sortBy, sortOrder, monthlyEmployeeIds])

  // --- 月次: 編集（割当データ取得→フォーム表示） ---
  const handleEdit = useCallback(async (assignmentId: number) => {
    setEditLoadingId(assignmentId)
    try {
      const assignment = await getDutyAssignmentById(assignmentId)
      if (assignment) {
        setEditingAssignment(assignment)
        setMonthlySelectedDate(undefined)
        setMonthlySelectedEmployeeId(undefined)
        setFormOpen(true)
      } else {
        toast.error("業務割当が見つかりませんでした")
      }
    } catch {
      toast.error("業務割当の取得に失敗しました")
    } finally {
      setEditLoadingId(null)
    }
  }, [])

  // --- 月次: 削除 ---
  const handleDelete = useCallback(async (assignmentId: number) => {
    setDeleteLoadingId(assignmentId)
    try {
      const result = await deleteDutyAssignment(assignmentId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("業務割当を削除しました")
        router.refresh()
      }
    } catch {
      toast.error("業務割当の削除に失敗しました")
    } finally {
      setDeleteLoadingId(null)
    }
  }, [router])

  // --- 月次: 新規追加（日付・従業員プリセット） ---
  const handleAddNew = useCallback((dateStr: string, employeeId: string) => {
    setEditingAssignment(undefined)
    setMonthlySelectedDate(dateStr)
    setMonthlySelectedEmployeeId(employeeId)
    setFormOpen(true)
  }, [])

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
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={employeeSearchText}
              onChange={(e) => setEmployeeSearchText(e.target.value)}
              placeholder="従業員名で検索..."
              className="w-48 pl-8"
            />
          </div>
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

      <div className="flex flex-wrap items-center gap-3">
        <GroupMultiSelect
          groups={groups}
          selectedIds={monthlyGroupIds}
          unassigned={monthlyUnassigned}
          onChange={(ids, unassigned) => {
            setParams({
              monthlyGroupIds: ids.length > 0 ? ids.join(",") : null,
              monthlyUnassigned: unassigned ? "true" : null,
            })
          }}
        />
        <RoleMultiSelect
          roles={roles}
          selectedIds={monthlyRoleIds}
          unassigned={monthlyRoleUnassigned}
          onChange={(ids, roleUnassigned) => {
            setParams({
              monthlyRoleIds: ids.length > 0 ? ids.join(",") : null,
              monthlyRoleUnassigned: roleUnassigned ? "true" : null,
            })
          }}
        />
        <DutyTypeMultiSelect
          dutyTypes={dutyTypeOptions}
          selectedIds={monthlyDutyTypeIds}
          unassigned={monthlyDutyUnassigned}
          onChange={(ids, unassigned) => {
            setParams({
              monthlyDutyTypeIds: ids.length > 0 ? ids.join(",") : null,
              monthlyDutyUnassigned: unassigned ? "true" : null,
            })
          }}
        />
      </div>

      <DutyTypeSummaryRow summary={dutyTypeSummary} />

      <DutyMonthlyCalendar
        data={calendarRows}
        year={year}
        month={month}
        selectedEmployeeIds={monthlyEmployeeIds}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAddNew={handleAddNew}
        isAuthenticated={isAuthenticated}
        editLoadingId={editLoadingId}
        deleteLoadingId={deleteLoadingId}
        employeeSearchText={employeeSearchText}
        shiftCodeMap={shiftCodeMap}
        shiftCodeInfoMap={shiftCodeInfoMap}
        total={calendarTotal}
        hasMore={calendarHasMoreState}
        isLoadingMore={calendarIsLoadingMore}
        onLoadMore={handleCalendarLoadMore}
      />

      <DutyAssignmentForm
        employees={employeeOptions}
        dutyTypes={dutyTypeOptions}
        defaultDate={monthlySelectedDate}
        defaultEmployeeId={monthlySelectedEmployeeId}
        dutyAssignment={editingAssignment}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </div>
  )
}
