"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { ActiveFilterTags, type FilterTag } from "./active-filter-tags"
import { useQueryParams } from "@/hooks/use-query-params"
import { Button } from "@/components/ui/button"
import { ShiftCalendar } from "./shift-calendar"
import { ShiftFilters } from "./shift-filters"
import { ShiftForm } from "./shift-form"
import { ShiftDetailDialog } from "./shift-detail-dialog"
import { ShiftBulkEditor } from "./shift-bulk-editor"
import { ShiftDailyView } from "./shift-daily-view"
import { Upload, Pencil } from "lucide-react"
import { ShiftImportDialog } from "./shift-import-dialog"
import { SHIFT_CODE_MAP, getColorClasses, type ShiftCodeInfo } from "@/lib/constants"
import type { ShiftCalendarData, ShiftFilterParams, ShiftDailyRow, ShiftDailyFilterParams, ShiftDailySortField, SortOrder } from "@/types/shifts"
import type { LatestShiftHistory } from "@/lib/db/shifts"
import type { Shift } from "@/app/generated/prisma/client"
import { loadMoreCalendarData, loadMoreDailyData } from "@/lib/actions/shift-actions"

type Group = { id: number; name: string }
type Role = { id: number; roleName: string; roleType: string }

type ActiveShiftCode = {
  id: number
  code: string
  color: string | null
  defaultStartTime: Date | null
  defaultEndTime: Date | null
  defaultIsHoliday: boolean
  isActive: boolean | null
  sortOrder: number
}

type ShiftPageClientProps = {
  isAuthenticated?: boolean
  viewMode: "monthly" | "daily"
  initialCalendarData: ShiftCalendarData[]
  calendarTotal: number
  calendarHasMore: boolean
  calendarNextCursor: number | null
  calendarFilter: ShiftFilterParams
  groups: Group[]
  roles: Role[]
  year: number
  month: number
  shiftCodes: ActiveShiftCode[]
  shiftIdsWithHistory: number[]
  shiftLatestHistory: Record<number, LatestShiftHistory>
  calendarEmployeeIds: string[]
  calendarEmployees: { id: string; name: string }[]
  dailyData: ShiftDailyRow[]
  dailyTotal: number
  dailyHasMore: boolean
  dailyNextCursor: number | null
  dailyDate: string
  dailyGroupIds: number[]
  dailyUnassigned: boolean
  dailySelectedShiftCodes: string[]
  dailyEmployeeIds: string[]
  dailyEmployees: { id: string; name: string }[]
  dailySortBy: ShiftDailySortField
  dailySortOrder: SortOrder
  dailyIsRemote: boolean
  dailyShiftCodeOptions: string[]
  dailyGroupOptions: { id: number; name: string }[]
  dailyHasUnassigned: boolean
  dailySupervisorRoleNames: string[]
  dailyBusinessRoleNames: string[]
  dailySupervisorRoleOptions: string[]
  dailyBusinessRoleOptions: string[]
}

export function ShiftPageClient({
  isAuthenticated,
  viewMode,
  initialCalendarData,
  calendarTotal,
  calendarHasMore: initialHasMore,
  calendarNextCursor: initialNextCursor,
  calendarFilter,
  groups,
  roles,
  year,
  month,
  shiftCodes,
  shiftIdsWithHistory,
  shiftLatestHistory,
  dailyData,
  dailyTotal,
  dailyHasMore: initialDailyHasMore,
  dailyNextCursor: initialDailyNextCursor,
  dailyDate,
  dailyGroupIds,
  dailyUnassigned,
  dailySelectedShiftCodes,
  dailyEmployeeIds,
  dailyEmployees,
  dailySortBy,
  dailySortOrder,
  dailyIsRemote,
  dailyShiftCodeOptions,
  dailyGroupOptions,
  dailyHasUnassigned,
  dailySupervisorRoleNames,
  dailyBusinessRoleNames,
  dailySupervisorRoleOptions,
  dailyBusinessRoleOptions,
  calendarEmployeeIds,
  calendarEmployees,
}: ShiftPageClientProps) {
  const [calendarData, setCalendarData] = useState(initialCalendarData)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [nextCursor, setNextCursor] = useState(initialNextCursor)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // フィルター変更時（Server Component再実行時）にリセット
  useEffect(() => {
    setCalendarData(initialCalendarData)
    setHasMore(initialHasMore)
    setNextCursor(initialNextCursor)
    setIsLoadingMore(false)
  }, [initialCalendarData, initialHasMore, initialNextCursor])

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || nextCursor === null || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const result = await loadMoreCalendarData(calendarFilter, nextCursor)
      setCalendarData((prev) => [...prev, ...result.data])
      setHasMore(result.hasMore)
      setNextCursor(result.nextCursor)
    } finally {
      setIsLoadingMore(false)
    }
  }, [hasMore, nextCursor, isLoadingMore, calendarFilter])

  // --- Daily view lazy loading state ---
  const [dailyRows, setDailyRows] = useState(dailyData)
  const [dailyHasMoreState, setDailyHasMoreState] = useState(initialDailyHasMore)
  const [dailyNextCursorState, setDailyNextCursorState] = useState(initialDailyNextCursor)
  const [dailyIsLoadingMore, setDailyIsLoadingMore] = useState(false)

  useEffect(() => {
    setDailyRows(dailyData)
    setDailyHasMoreState(initialDailyHasMore)
    setDailyNextCursorState(initialDailyNextCursor)
    setDailyIsLoadingMore(false)
  }, [dailyData, initialDailyHasMore, initialDailyNextCursor])

  const dailyFilter: ShiftDailyFilterParams = useMemo(() => ({
    date: dailyDate,
    groupIds: dailyGroupIds.length > 0 ? dailyGroupIds : undefined,
    unassigned: dailyUnassigned || undefined,
    shiftCodes: dailySelectedShiftCodes.length > 0 ? dailySelectedShiftCodes : undefined,
    employeeIds: dailyEmployeeIds.length > 0 ? dailyEmployeeIds : undefined,
    isRemote: dailyIsRemote || undefined,
    supervisorRoleNames: dailySupervisorRoleNames.length > 0 ? dailySupervisorRoleNames : undefined,
    businessRoleNames: dailyBusinessRoleNames.length > 0 ? dailyBusinessRoleNames : undefined,
    sortBy: dailySortBy,
    sortOrder: dailySortOrder,
  }), [dailyDate, dailyGroupIds, dailyUnassigned, dailySelectedShiftCodes, dailyEmployeeIds, dailyIsRemote, dailySupervisorRoleNames, dailyBusinessRoleNames, dailySortBy, dailySortOrder])

  const handleLoadMoreDaily = useCallback(async () => {
    if (!dailyHasMoreState || dailyNextCursorState === null || dailyIsLoadingMore) return
    setDailyIsLoadingMore(true)
    try {
      const result = await loadMoreDailyData(dailyFilter, dailyNextCursorState)
      setDailyRows((prev) => [...prev, ...result.data])
      setDailyHasMoreState(result.hasMore)
      setDailyNextCursorState(result.nextCursor)
    } finally {
      setDailyIsLoadingMore(false)
    }
  }, [dailyHasMoreState, dailyNextCursorState, dailyIsLoadingMore, dailyFilter])

  const [editOpen, setEditOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editShift, setEditShift] = useState<Shift | undefined>()
  const [editEmployeeId, setEditEmployeeId] = useState<string | undefined>()
  const [editDate, setEditDate] = useState<string | undefined>()
  const [bulkOpen, setBulkOpen] = useState(false)
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())

  // DB のシフトコードから shiftCodeMap を構築（カレンダー表示用）
  const shiftCodeMap = useMemo(() => {
    const map: Record<string, ShiftCodeInfo> = {}
    for (const sc of shiftCodes) {
      const dbColor = getColorClasses(sc.color)
      const hardcoded = SHIFT_CODE_MAP[sc.code]
      map[sc.code] = {
        label: hardcoded?.label ?? sc.code,
        color: dbColor?.text ?? hardcoded?.color ?? "text-gray-800",
        bgColor: dbColor?.bg ?? hardcoded?.bgColor ?? "bg-gray-100",
      }
    }
    return map
  }, [shiftCodes])

  const shiftIdsWithHistorySet = useMemo(
    () => new Set(shiftIdsWithHistory),
    [shiftIdsWithHistory]
  )

  const { setParams, getParam } = useQueryParams()

  const filterTags = useMemo(() => {
    const tags: FilterTag[] = []

    if (calendarFilter.groupIds && calendarFilter.groupIds.length > 0) {
      const names = calendarFilter.groupIds.map(id =>
        groups.find(g => g.id === id)?.name ?? `ID:${id}`
      )
      const label = names.length <= 2 ? names.join(", ") : `${names.length}グループ`
      tags.push({
        key: "groupIds",
        label: `グループ: ${label}`,
        onRemove: () => setParams({ groupIds: null }),
      })
    }

    if (calendarFilter.unassigned) {
      tags.push({
        key: "unassigned",
        label: "グループ未所属",
        onRemove: () => setParams({ unassigned: null }),
      })
    }

    if (calendarFilter.roleIds && calendarFilter.roleIds.length > 0) {
      const names = calendarFilter.roleIds.map(id =>
        roles.find(r => r.id === id)?.roleName ?? `ID:${id}`
      )
      const label = names.length <= 2 ? names.join(", ") : `${names.length}ロール`
      tags.push({
        key: "roleIds",
        label: `ロール: ${label}`,
        onRemove: () => setParams({ roleIds: null }),
      })
    }

    if (calendarFilter.roleUnassigned) {
      tags.push({
        key: "roleUnassigned",
        label: "ロール未設定",
        onRemove: () => setParams({ roleUnassigned: null }),
      })
    }

    const searchParam = getParam("search")
    if (searchParam) {
      tags.push({
        key: "search",
        label: `検索: ${searchParam}`,
        onRemove: () => setParams({ search: null }),
      })
    }

    if (calendarEmployeeIds.length > 0) {
      const names = calendarEmployeeIds.map(id =>
        calendarEmployees.find(e => e.id === id)?.name ?? id
      )
      const label = names.length <= 2 ? names.join(", ") : `${names.length}名選択`
      tags.push({
        key: "calendarEmployeeIds",
        label: `従業員: ${label}`,
        onRemove: () => setParams({ calendarEmployeeIds: null }),
      })
    }

    return tags
  }, [calendarFilter, groups, roles, getParam, calendarEmployeeIds, calendarEmployees, setParams])

  const clearAllCalendarFilters = useCallback(() => {
    setParams({
      groupIds: null,
      unassigned: null,
      roleIds: null,
      roleUnassigned: null,
      search: null,
      calendarEmployeeIds: null,
    })
  }, [setParams])

  const detailEmployeeName = useMemo(() => {
    if (!editEmployeeId) return ""
    return calendarData.find(e => e.employeeId === editEmployeeId)?.employeeName ?? ""
  }, [editEmployeeId, calendarData])

  const selectedShiftIds = useMemo(() => {
    const ids: number[] = []
    for (const cellKey of selectedCells) {
      const [empId, date] = cellKey.split(":")
      for (const emp of calendarData) {
        if (emp.employeeId === empId) {
          const shift = emp.shifts[date]
          if (shift) ids.push(shift.id)
        }
      }
    }
    return ids
  }, [selectedCells, calendarData])

  const handleCellClick = useCallback(
    (employeeId: string, date: string, shiftId?: number) => {
      setEditEmployeeId(employeeId)
      setEditDate(date)

      if (shiftId) {
        for (const emp of calendarData) {
          if (emp.employeeId === employeeId) {
            const shift = emp.shifts[date]
            if (shift) {
              setEditShift(shift)
              break
            }
          }
        }
        setDetailOpen(true)
      } else if (isAuthenticated) {
        setEditShift(undefined)
        setEditOpen(true)
      }
    },
    [calendarData, isAuthenticated]
  )

  const handleEditFromDetail = useCallback(() => {
    setDetailOpen(false)
    setEditOpen(true)
  }, [])

  const handleCellSelect = useCallback((cellKey: string) => {
    setSelectedCells((prev) => {
      const next = new Set(prev)
      if (next.has(cellKey)) {
        next.delete(cellKey)
      } else {
        next.add(cellKey)
      }
      return next
    })
  }, [])

  const handleExport = () => {
    const params = new URLSearchParams({
      year: year.toString(),
      month: month.toString(),
    })
    if (calendarFilter.groupIds && calendarFilter.groupIds.length > 0) {
      params.set("groupIds", calendarFilter.groupIds.join(","))
    }
    if (calendarFilter.unassigned) {
      params.set("unassigned", "true")
    }
    if (calendarFilter.roleIds && calendarFilter.roleIds.length > 0) {
      params.set("roleIds", calendarFilter.roleIds.join(","))
    }
    if (calendarFilter.roleUnassigned) {
      params.set("roleUnassigned", "true")
    }
    window.open(`/api/shifts/export?${params}`, "_blank")
  }

  if (viewMode === "daily") {
    return (
      <ShiftDailyView
        data={dailyRows}
        total={dailyTotal}
        hasMore={dailyHasMoreState}
        isLoadingMore={dailyIsLoadingMore}
        onLoadMore={handleLoadMoreDaily}
        dailyDate={dailyDate}
        groups={dailyGroupOptions}
        shiftCodes={shiftCodes}
        groupIds={dailyGroupIds}
        unassigned={dailyUnassigned}
        selectedShiftCodes={dailySelectedShiftCodes}
        selectedEmployeeIds={dailyEmployeeIds}
        employees={dailyEmployees}
        sortBy={dailySortBy}
        sortOrder={dailySortOrder}
        isRemoteFilter={dailyIsRemote}
        dailyShiftCodeOptions={dailyShiftCodeOptions}
        hasUnassigned={dailyHasUnassigned}
        roles={roles}
        selectedSupervisorRoleNames={dailySupervisorRoleNames}
        selectedBusinessRoleNames={dailyBusinessRoleNames}
        supervisorRoleNameOptions={dailySupervisorRoleOptions}
        businessRoleNameOptions={dailyBusinessRoleOptions}
        isAuthenticated={isAuthenticated}
        shiftCodeMap={shiftCodeMap}
        shiftIdsWithHistory={shiftIdsWithHistorySet}
        shiftLatestHistory={shiftLatestHistory}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        {isAuthenticated && selectedCells.size > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setBulkOpen(true)}
          >
            <Pencil className="h-4 w-4 mr-1" />
            {selectedCells.size}件を一括編集
          </Button>
        )}
        <ShiftFilters
          groups={groups}
          roles={roles}
          year={year}
          month={month}
          rightActions={
            <div className="flex items-center gap-2">
              {isAuthenticated && <ShiftImportDialog />}
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Upload className="h-4 w-4 mr-1" />
                CSV
              </Button>
            </div>
          }
        />
      </div>

      <ActiveFilterTags tags={filterTags} onClearAll={clearAllCalendarFilters} />

      <ShiftCalendar
        data={calendarData}
        year={year}
        month={month}
        onCellClick={handleCellClick}
        selectedCells={selectedCells}
        onCellSelect={handleCellSelect}
        shiftCodeMap={shiftCodeMap}
        shiftIdsWithHistory={shiftIdsWithHistorySet}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={handleLoadMore}
        total={calendarTotal}
        employees={calendarEmployees}
        selectedEmployeeIds={calendarEmployeeIds}
      />

      {editShift && editDate && (
        <ShiftDetailDialog
          key={`detail-${editShift.id}`}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          shift={editShift}
          employeeName={detailEmployeeName}
          date={editDate}
          shiftCodeMap={shiftCodeMap}
          hasHistory={shiftIdsWithHistorySet.has(editShift.id)}
          latestHistory={shiftLatestHistory[editShift.id] ?? null}
          isAuthenticated={isAuthenticated}
          onEdit={handleEditFromDetail}
        />
      )}

      <ShiftForm
        key={`${editShift?.id ?? "new"}-${editEmployeeId}-${editDate}`}
        open={editOpen}
        onOpenChange={setEditOpen}
        shift={editShift}
        employeeId={editEmployeeId}
        date={editDate}
        shiftCodes={shiftCodes}
      />

      <ShiftBulkEditor
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        selectedShiftIds={selectedShiftIds}
        onComplete={() => setSelectedCells(new Set())}
        shiftCodes={shiftCodes}
      />
    </div>
  )
}
