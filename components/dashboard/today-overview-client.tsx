"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import Link from "next/link"
import { ShiftDetailDialog } from "@/components/shifts/shift-detail-dialog"
import { ShiftForm } from "@/components/shifts/shift-form"
import { type ShiftCodeInfo, SHIFT_CODE_MAP, getColorClasses } from "@/lib/constants"
import type { LatestShiftHistory } from "@/lib/db/shifts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ColumnFilterPopover } from "@/components/common/filters/column-filter-popover"
import { EmployeeCheckboxFilter } from "@/components/common/filters/employee-checkbox-filter"
import { CheckboxListFilter } from "@/components/common/filters/checkbox-list-filter"
import { ToggleFilter } from "@/components/common/filters/toggle-filter"
import { ActiveFilterTags, FilterTag } from "@/components/common/filters/active-filter-tags"
import { ShiftBadge } from "@/components/shifts/shift-badge"
import { useDashboardFilters } from "@/hooks/use-dashboard-filters"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { TimelineHeatmap, parseInterval, type IntervalMin } from "@/components/dashboard/timeline-heatmap"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { Shift, Employee, Group, EmployeeGroup, EmployeeFunctionRole, FunctionRole } from "@/app/generated/prisma/client"
import type { DashboardFilterOptions } from "@/types"
import type { DutyAssignmentWithDetails } from "@/types/duties"

export type TodayShift = Shift & {
  employee: (Employee & {
    groups: (EmployeeGroup & { group: Group })[]
    functionRoles: (EmployeeFunctionRole & { functionRole: FunctionRole | null })[]
  }) | null
}

function parseIds(value: string): number[] {
  if (!value) return []
  return value.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
}

function parseStrings(value: string): string[] {
  if (!value) return []
  return value.split(",").filter(Boolean)
}

type SortKey = "employee" | "group" | "businessRole" | "supervisorRole" | "shiftCode" | "tw"
type SortDir = "asc" | "desc"
type SortState = { key: SortKey; dir: SortDir } | null

type ActiveShiftCode = {
  id: number
  code: string
  color: string | null
  defaultStartTime: Date | null
  defaultEndTime: Date | null
  defaultIsHoliday: boolean
  isActive: boolean | null
  sortOrder: number
  defaultLunchBreakStart: Date | null
  defaultLunchBreakEnd: Date | null
}

type Props = {
  shifts: TodayShift[]
  overnightShifts: TodayShift[]
  filterOptions: DashboardFilterOptions
  distinctRoleTypes: readonly [string, string]
  isAuthenticated?: boolean
  shiftCodes: ActiveShiftCode[]
  shiftIdsWithHistory: number[]
  shiftLatestHistory: Record<number, LatestShiftHistory>
  todayDateString: string
  dutyAssignments?: DutyAssignmentWithDetails[]
  employees?: { id: string; name: string }[]
  dutyTypes?: { id: number; name: string; defaultReducesCapacity: boolean; defaultStartTime: string | null; defaultEndTime: string | null; defaultNote: string | null; defaultTitle: string | null }[]
}

export function TodayOverviewClient({ shifts, overnightShifts, filterOptions, distinctRoleTypes, isAuthenticated, shiftCodes: shiftCodesData, shiftIdsWithHistory, shiftLatestHistory, todayDateString, dutyAssignments, employees = [], dutyTypes = [] }: Props) {
  const { setParams, getParam } = useDashboardFilters()

  // --- Dynamic height calculation (same pattern as shift-calendar) ---
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [maxHeight, setMaxHeight] = useState<number>(600)

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const updateHeight = () => {
      const rect = container.getBoundingClientRect()
      const available = window.innerHeight - rect.top - 48
      setMaxHeight(Math.max(300, available))
    }

    updateHeight()
    window.addEventListener("resize", updateHeight)
    const observer = new ResizeObserver(updateHeight)
    observer.observe(document.documentElement)

    return () => {
      window.removeEventListener("resize", updateHeight)
      observer.disconnect()
    }
  })

  // --- Tab and timeline row count state ---
  const [activeTab, setActiveTab] = useState("timeline")
  const [timelineRowCount, setTimelineRowCount] = useState<number | null>(null)

  // --- Shift detail/edit dialog state ---
  const [nameSearch, setNameSearch] = useState("")
  const excludeNightShift = getParam("excludeNightShift") === "true"
  const [editOpen, setEditOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editRow, setEditRow] = useState<TodayShift | null>(null)

  const shiftCodeMap = useMemo(() => {
    const map: Record<string, ShiftCodeInfo> = {}
    for (const sc of shiftCodesData) {
      const dbColor = getColorClasses(sc.color)
      const hardcoded = SHIFT_CODE_MAP[sc.code]
      map[sc.code] = {
        label: hardcoded?.label ?? sc.code,
        color: dbColor?.text ?? hardcoded?.color ?? "text-gray-800",
        bgColor: dbColor?.bg ?? hardcoded?.bgColor ?? "bg-gray-100",
      }
    }
    return map
  }, [shiftCodesData])

  const shiftIdsWithHistorySet = useMemo(
    () => new Set(shiftIdsWithHistory),
    [shiftIdsWithHistory]
  )

  const handleRowClick = useCallback((shift: TodayShift) => {
    setEditRow(shift)
    setDetailOpen(true)
  }, [])

  const handleEditFromDetail = useCallback(() => {
    setDetailOpen(false)
    setEditOpen(true)
  }, [])

  // --- Sort state ---
  const [sort, setSort] = useState<SortState>(null)

  const toggleSort = useCallback((key: SortKey) => {
    setSort((prev) => {
      if (prev?.key === key) {
        if (prev.dir === "asc") return { key, dir: "desc" }
        return null
      }
      return { key, dir: "asc" }
    })
  }, [])

  // --- Parse URL params ---
  const selectedEmployeeIds = useMemo(() => parseStrings(getParam("employeeIds")), [getParam])
  const groupIds = useMemo(() => parseIds(getParam("groupIds")), [getParam])
  const unassigned = getParam("unassigned") === "true"
  const selectedShiftCodes = useMemo(() => parseStrings(getParam("shiftCodes")), [getParam])
  const selectedSupervisorRoleNames = useMemo(() => parseStrings(getParam("supervisorRoleNames")), [getParam])
  const selectedBusinessRoleNames = useMemo(() => parseStrings(getParam("businessRoleNames")), [getParam])
  const isRemoteFilter = getParam("isRemote") === "true"
  const interval = useMemo(() => parseInterval(getParam("interval")), [getParam])

  const handleIntervalChange = useCallback((v: IntervalMin) => {
    setParams({ interval: String(v) })
  }, [setParams])

  // --- Popover open state ---
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false)
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false)
  const [shiftCodePopoverOpen, setShiftCodePopoverOpen] = useState(false)
  const [supervisorPopoverOpen, setSupervisorPopoverOpen] = useState(false)
  const [businessPopoverOpen, setBusinessPopoverOpen] = useState(false)
  const [twPopoverOpen, setTwPopoverOpen] = useState(false)

  // タイムラインビュー用ポップオーバーstate（リストビューと独立）
  const [tlGroupPopoverOpen, setTlGroupPopoverOpen] = useState(false)
  const [tlSupervisorPopoverOpen, setTlSupervisorPopoverOpen] = useState(false)
  const [tlBusinessPopoverOpen, setTlBusinessPopoverOpen] = useState(false)

  // --- Filter handlers ---
  const handleEmployeeIdsConfirm = useCallback((ids: string[]) => {
    setParams({ employeeIds: ids.length > 0 ? ids.join(",") : null })
    setEmployeePopoverOpen(false)
  }, [setParams])

  const handleEmployeeIdsClear = useCallback(() => {
    setParams({ employeeIds: null })
    setEmployeePopoverOpen(false)
  }, [setParams])

  const handleGroupConfirm = useCallback((ids: string[], specialChecked?: boolean) => {
    setParams({
      groupIds: ids.length > 0 ? ids.join(",") : null,
      unassigned: specialChecked ? "true" : null,
    })
    setGroupPopoverOpen(false)
    setTlGroupPopoverOpen(false)
  }, [setParams])

  const handleGroupClear = useCallback(() => {
    setParams({ groupIds: null, unassigned: null })
    setGroupPopoverOpen(false)
    setTlGroupPopoverOpen(false)
  }, [setParams])

  const handleShiftCodesConfirm = useCallback((codes: string[]) => {
    setParams({ shiftCodes: codes.length > 0 ? codes.join(",") : null })
    setShiftCodePopoverOpen(false)
  }, [setParams])

  const handleShiftCodesClear = useCallback(() => {
    setParams({ shiftCodes: null })
    setShiftCodePopoverOpen(false)
  }, [setParams])

  const handleSupervisorRoleConfirm = useCallback((names: string[]) => {
    setParams({ supervisorRoleNames: names.length > 0 ? names.join(",") : null })
    setSupervisorPopoverOpen(false)
    setTlSupervisorPopoverOpen(false)
  }, [setParams])

  const handleSupervisorRoleClear = useCallback(() => {
    setParams({ supervisorRoleNames: null })
    setSupervisorPopoverOpen(false)
    setTlSupervisorPopoverOpen(false)
  }, [setParams])

  const handleBusinessRoleConfirm = useCallback((names: string[]) => {
    setParams({ businessRoleNames: names.length > 0 ? names.join(",") : null })
    setBusinessPopoverOpen(false)
    setTlBusinessPopoverOpen(false)
  }, [setParams])

  const handleBusinessRoleClear = useCallback(() => {
    setParams({ businessRoleNames: null })
    setBusinessPopoverOpen(false)
    setTlBusinessPopoverOpen(false)
  }, [setParams])

  const handleTwFilterChange = useCallback((checked: boolean) => {
    setParams({ isRemote: checked ? "true" : null })
    setTwPopoverOpen(false)
  }, [setParams])

  // --- Filter options ---
  const groupOptions = useMemo(
    () => filterOptions.groups.map((g) => ({ value: String(g.id), label: g.name })),
    [filterOptions.groups]
  )
  const selectedGroupValues = useMemo(() => groupIds.map(String), [groupIds])

  const shiftCodeOptions = useMemo(
    () => filterOptions.shiftCodes
      .filter((code) => !excludeNightShift || code !== "22_8")
      .map((code) => ({
        value: code,
        label: <ShiftBadge code={code} shiftCodeMap={shiftCodeMap} />,
        searchText: code,
      })),
    [filterOptions.shiftCodes, shiftCodeMap, excludeNightShift]
  )

  const supervisorRoleOptions = useMemo(
    () => filterOptions.supervisorRoleNames.map((name) => ({ value: name, label: name })),
    [filterOptions.supervisorRoleNames]
  )

  const businessRoleOptions = useMemo(
    () => filterOptions.businessRoleNames.map((name) => ({ value: name, label: name })),
    [filterOptions.businessRoleNames]
  )

  // --- Sorted shifts ---
  const sortedShifts = useMemo(() => {
    if (!sort) return shifts

    const getValue = (shift: TodayShift): string => {
      const emp = shift.employee
      switch (sort.key) {
        case "employee":
          return emp?.name ?? ""
        case "group":
          return emp?.groups?.[0]?.group?.name ?? ""
        case "businessRole":
          return emp?.functionRoles?.find(
            (r) => r.functionRole?.roleType === distinctRoleTypes[1]
          )?.functionRole?.roleName ?? ""
        case "supervisorRole":
          return emp?.functionRoles?.find(
            (r) => r.functionRole?.roleType === distinctRoleTypes[0]
          )?.functionRole?.roleName ?? ""
        case "shiftCode":
          return shift.shiftCode ?? ""
        case "tw":
          return shift.isRemote ? "0" : "1"
        default:
          return ""
      }
    }

    return [...shifts].sort((a, b) => {
      const va = getValue(a)
      const vb = getValue(b)
      const cmp = va.localeCompare(vb, "ja")
      return sort.dir === "asc" ? cmp : -cmp
    })
  }, [shifts, sort, distinctRoleTypes])

  // --- Night shift filter (名前検索とは別に適用) ---
  const nightShiftFiltered = useMemo(() => {
    if (!excludeNightShift) return sortedShifts
    return sortedShifts.filter((shift) => shift.shiftCode !== "22_8")
  }, [sortedShifts, excludeNightShift])

  // --- Name search filter (リストビュー用) ---
  const filteredShifts = useMemo(() => {
    if (!nameSearch.trim()) return nightShiftFiltered
    const query = nameSearch.trim().toLowerCase()
    return nightShiftFiltered.filter((shift) =>
      shift.employee?.name?.toLowerCase().includes(query)
    )
  }, [nightShiftFiltered, nameSearch])

  // --- 夜勤含むモードでの空状態判定（タイムラインにovernightShiftsがある場合も考慮） ---
  const hasAnyContent = filteredShifts.length > 0 || (!excludeNightShift && overnightShifts.length > 0)

  // --- Filter tags ---
  const filterTags = useMemo<FilterTag[]>(() => {
    const tags: FilterTag[] = []

    if (selectedEmployeeIds.length > 0) {
      const label =
        selectedEmployeeIds.length <= 2
          ? selectedEmployeeIds
              .map((id) => filterOptions.employees.find((e) => e.id === id)?.name ?? "")
              .filter(Boolean)
              .join(", ")
          : `${selectedEmployeeIds.length}名選択`
      tags.push({
        key: "employeeIds",
        label: `従業員: ${label}`,
        onRemove: () => setParams({ employeeIds: null }),
      })
    }

    if (unassigned) {
      tags.push({
        key: "unassigned",
        label: "グループ: 未所属",
        onRemove: () => setParams({ unassigned: null }),
      })
    }

    if (groupIds.length > 0) {
      const label =
        groupIds.length <= 2
          ? groupIds.map((id) => filterOptions.groups.find((g) => g.id === id)?.name ?? "").filter(Boolean).join(", ")
          : `${groupIds.length}件選択`
      tags.push({
        key: "groupIds",
        label: `グループ: ${label}`,
        onRemove: () => setParams({ groupIds: null }),
      })
    }

    if (selectedShiftCodes.length > 0) {
      const label =
        selectedShiftCodes.length <= 2
          ? selectedShiftCodes.join(", ")
          : `${selectedShiftCodes.length}件選択`
      tags.push({
        key: "shiftCodes",
        label: `シフト: ${label}`,
        onRemove: () => setParams({ shiftCodes: null }),
      })
    }

    if (selectedSupervisorRoleNames.length > 0) {
      const label =
        selectedSupervisorRoleNames.length <= 2
          ? selectedSupervisorRoleNames.join(", ")
          : `${selectedSupervisorRoleNames.length}件選択`
      tags.push({
        key: "supervisorRoleNames",
        label: `${distinctRoleTypes[0]}: ${label}`,
        onRemove: () => setParams({ supervisorRoleNames: null }),
      })
    }

    if (selectedBusinessRoleNames.length > 0) {
      const label =
        selectedBusinessRoleNames.length <= 2
          ? selectedBusinessRoleNames.join(", ")
          : `${selectedBusinessRoleNames.length}件選択`
      tags.push({
        key: "businessRoleNames",
        label: `${distinctRoleTypes[1]}: ${label}`,
        onRemove: () => setParams({ businessRoleNames: null }),
      })
    }

    if (isRemoteFilter) {
      tags.push({
        key: "isRemote",
        label: "TWのみ",
        onRemove: () => setParams({ isRemote: null }),
      })
    }

    return tags
  }, [selectedEmployeeIds, filterOptions, unassigned, groupIds, selectedShiftCodes, selectedSupervisorRoleNames, selectedBusinessRoleNames, distinctRoleTypes, isRemoteFilter, setParams])

  const clearAllFilters = useCallback(() => {
    setNameSearch("")
    setParams({
      employeeIds: null,
      groupIds: null,
      unassigned: null,
      shiftCodes: null,
      supervisorRoleNames: null,
      businessRoleNames: null,
      isRemote: null,
      excludeNightShift: null,
    })
  }, [setParams])

  // --- Sort button renderer ---
  const renderSortButton = useCallback((columnKey: SortKey) => {
    const isActive = sort?.key === columnKey
    return (
      <button
        type="button"
        className={cn(
          "inline-flex items-center justify-center h-5 w-5 rounded-sm hover:bg-accent",
          isActive ? "text-primary" : "text-muted-foreground"
        )}
        onClick={() => toggleSort(columnKey)}
      >
        {isActive && sort.dir === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : isActive && sort.dir === "desc" ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3" />
        )}
      </button>
    )
  }, [sort, toggleSort])

  return (
    <Card className="h-full flex flex-col min-w-0">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <CardTitle>本日の出勤者 ({activeTab === "timeline" && timelineRowCount !== null ? timelineRowCount : filteredShifts.length}名)</CardTitle>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
              <Checkbox
                checked={excludeNightShift}
                onCheckedChange={(checked) => setParams({ excludeNightShift: checked ? "true" : null })}
              />
              夜勤は除く
            </label>
            <Input
              placeholder="従業員名で検索..."
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              className="w-64 h-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        <ActiveFilterTags tags={filterTags} onClearAll={clearAllFilters} />
        {shifts.length === 0 && overnightShifts.length === 0 ? (
          <p className="text-sm text-muted-foreground">本日の出勤者はいません</p>
        ) : !hasAnyContent ? (
          <p className="text-sm text-muted-foreground py-4 text-center">該当する従業員が見つかりません</p>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="mb-2">
              <TabsTrigger value="timeline">タイムライン</TabsTrigger>
              <TabsTrigger value="list">リスト</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline" className="flex-1 min-h-0">
              <TimelineHeatmap
                shifts={nightShiftFiltered}
                overnightShifts={excludeNightShift ? [] : overnightShifts}
                showFullDay={!excludeNightShift}
                nameSearch={nameSearch}
                onRowCountChange={setTimelineRowCount}
                onShiftCellClick={handleRowClick}
                distinctRoleTypes={distinctRoleTypes}
                duties={dutyAssignments}
                groupOptions={groupOptions}
                selectedGroupValues={selectedGroupValues}
                unassigned={unassigned}
                groupPopoverOpen={tlGroupPopoverOpen}
                onGroupPopoverOpenChange={setTlGroupPopoverOpen}
                onGroupConfirm={handleGroupConfirm}
                onGroupClear={handleGroupClear}
                hasUnassigned={filterOptions.hasUnassigned}
                businessRoleOptions={businessRoleOptions}
                selectedBusinessRoleNames={selectedBusinessRoleNames}
                businessPopoverOpen={tlBusinessPopoverOpen}
                onBusinessPopoverOpenChange={setTlBusinessPopoverOpen}
                onBusinessRoleConfirm={handleBusinessRoleConfirm}
                onBusinessRoleClear={handleBusinessRoleClear}
                supervisorRoleOptions={supervisorRoleOptions}
                selectedSupervisorRoleNames={selectedSupervisorRoleNames}
                supervisorPopoverOpen={tlSupervisorPopoverOpen}
                onSupervisorPopoverOpenChange={setTlSupervisorPopoverOpen}
                onSupervisorRoleConfirm={handleSupervisorRoleConfirm}
                onSupervisorRoleClear={handleSupervisorRoleClear}
                shiftCodeMap={shiftCodeMap}
                shiftCodeOptions={shiftCodeOptions}
                selectedShiftCodes={selectedShiftCodes}
                shiftCodePopoverOpen={shiftCodePopoverOpen}
                onShiftCodePopoverOpenChange={setShiftCodePopoverOpen}
                onShiftCodesConfirm={handleShiftCodesConfirm}
                onShiftCodesClear={handleShiftCodesClear}
                isRemoteFilter={isRemoteFilter}
                twPopoverOpen={twPopoverOpen}
                onTwPopoverOpenChange={setTwPopoverOpen}
                onTwFilterChange={handleTwFilterChange}
                interval={interval}
                onIntervalChange={handleIntervalChange}
                isAuthenticated={isAuthenticated}
                employees={employees}
                dutyTypes={dutyTypes}
              />
            </TabsContent>
            <TabsContent value="list" className="flex-1 min-h-0">
          <div
            ref={scrollContainerRef}
            className="rounded-md border overflow-auto [&_[data-slot=table-container]]:overflow-visible"
            style={{ maxHeight }}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 [&_th]:bg-background [&_tr]:border-b-0 shadow-[0_1px_0_0_var(--border)]">
                <TableRow>
                  <TableHead>
                    <div className="flex items-center">
                      <ColumnFilterPopover
                        label="従業員名"
                        isActive={selectedEmployeeIds.length > 0}
                        activeCount={selectedEmployeeIds.length}
                        open={employeePopoverOpen}
                        onOpenChange={setEmployeePopoverOpen}
                      >
                        <EmployeeCheckboxFilter
                          employees={filterOptions.employees}
                          selectedIds={selectedEmployeeIds}
                          onConfirm={handleEmployeeIdsConfirm}
                          onClear={handleEmployeeIdsClear}
                          popoverOpen={employeePopoverOpen}
                        />
                      </ColumnFilterPopover>
                      {renderSortButton("employee")}
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center">
                      <ColumnFilterPopover
                        label="グループ"
                        isActive={groupIds.length > 0 || unassigned}
                        activeCount={groupIds.length + (unassigned ? 1 : 0)}
                        open={groupPopoverOpen}
                        onOpenChange={setGroupPopoverOpen}
                      >
                        <CheckboxListFilter
                          options={groupOptions}
                          selectedValues={selectedGroupValues}
                          onConfirm={handleGroupConfirm}
                          onClear={handleGroupClear}
                          popoverOpen={groupPopoverOpen}
                          specialOption={filterOptions.hasUnassigned || unassigned ? {
                            value: "unassigned",
                            label: "未所属",
                            checked: unassigned,
                          } : undefined}
                          searchPlaceholder="グループ名で検索..."
                        />
                      </ColumnFilterPopover>
                      {renderSortButton("group")}
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center">
                      <ColumnFilterPopover
                        label={distinctRoleTypes[1]}
                        isActive={selectedBusinessRoleNames.length > 0}
                        activeCount={selectedBusinessRoleNames.length}
                        open={businessPopoverOpen}
                        onOpenChange={setBusinessPopoverOpen}
                      >
                        <CheckboxListFilter
                          options={businessRoleOptions}
                          selectedValues={selectedBusinessRoleNames}
                          onConfirm={handleBusinessRoleConfirm}
                          onClear={handleBusinessRoleClear}
                          popoverOpen={businessPopoverOpen}
                          searchPlaceholder={`${distinctRoleTypes[1]}で検索...`}
                        />
                      </ColumnFilterPopover>
                      {renderSortButton("businessRole")}
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center">
                      <ColumnFilterPopover
                        label={distinctRoleTypes[0]}
                        isActive={selectedSupervisorRoleNames.length > 0}
                        activeCount={selectedSupervisorRoleNames.length}
                        open={supervisorPopoverOpen}
                        onOpenChange={setSupervisorPopoverOpen}
                      >
                        <CheckboxListFilter
                          options={supervisorRoleOptions}
                          selectedValues={selectedSupervisorRoleNames}
                          onConfirm={handleSupervisorRoleConfirm}
                          onClear={handleSupervisorRoleClear}
                          popoverOpen={supervisorPopoverOpen}
                          searchPlaceholder={`${distinctRoleTypes[0]}で検索...`}
                        />
                      </ColumnFilterPopover>
                      {renderSortButton("supervisorRole")}
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center">
                      <ColumnFilterPopover
                        label="シフト"
                        isActive={selectedShiftCodes.length > 0}
                        activeCount={selectedShiftCodes.length}
                        open={shiftCodePopoverOpen}
                        onOpenChange={setShiftCodePopoverOpen}
                      >
                        <CheckboxListFilter
                          options={shiftCodeOptions}
                          selectedValues={selectedShiftCodes}
                          onConfirm={handleShiftCodesConfirm}
                          onClear={handleShiftCodesClear}
                          popoverOpen={shiftCodePopoverOpen}
                          searchPlaceholder="シフトコードで検索..."
                        />
                      </ColumnFilterPopover>
                      {renderSortButton("shiftCode")}
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center">
                      <ColumnFilterPopover
                        label="TW"
                        isActive={isRemoteFilter}
                        open={twPopoverOpen}
                        onOpenChange={setTwPopoverOpen}
                      >
                        <ToggleFilter
                          checked={isRemoteFilter}
                          onChange={handleTwFilterChange}
                          label="TWのみ表示"
                        />
                      </ColumnFilterPopover>
                      {renderSortButton("tw")}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShifts.map((shift) => {
                  const emp = shift.employee
                  const groupName = emp?.groups?.[0]?.group?.name ?? "-"
                  const supervisorRole = emp?.functionRoles?.find(
                    (r) => r.functionRole?.roleType === distinctRoleTypes[0]
                  )?.functionRole?.roleName ?? "-"
                  const businessRole = emp?.functionRoles?.find(
                    (r) => r.functionRole?.roleType === distinctRoleTypes[1]
                  )?.functionRole?.roleName ?? "-"

                  return (
                    <TableRow key={shift.id} className="cursor-pointer" onClick={() => handleRowClick(shift)}>
                      <TableCell className="font-medium">
                      {emp ? (
                        <Link
                          href={`/employees/${emp.id}`}
                          className="hover:underline hover:text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {emp.name}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                      <TableCell>{groupName}</TableCell>
                      <TableCell>{businessRole}</TableCell>
                      <TableCell>{supervisorRole}</TableCell>
                      <TableCell>
                        <ShiftBadge code={shift.shiftCode} shiftCodeMap={shiftCodeMap} />
                      </TableCell>
                      <TableCell className="text-center">
                        {shift.isRemote && (
                          <span className="text-sky-600 text-sm font-bold">●</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>

      {editRow && (
        <ShiftDetailDialog
          key={`detail-${editRow.id}`}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          shift={editRow}
          employeeName={editRow.employee?.name ?? "-"}
          date={todayDateString}
          shiftCodeMap={shiftCodeMap}
          hasHistory={shiftIdsWithHistorySet.has(editRow.id)}
          latestHistory={shiftLatestHistory[editRow.id] ?? null}
          isAuthenticated={isAuthenticated}
          onEdit={handleEditFromDetail}
        />
      )}

      {isAuthenticated && editRow && (
        <ShiftForm
          key={`edit-${editRow.id}`}
          open={editOpen}
          onOpenChange={setEditOpen}
          shift={{
            id: editRow.id,
            employeeId: editRow.employeeId,
            shiftDate: editRow.shiftDate,
            shiftCode: editRow.shiftCode,
            startTime: editRow.startTime,
            endTime: editRow.endTime,
            isHoliday: editRow.isHoliday,
            isRemote: editRow.isRemote,
            lunchBreakStart: editRow.lunchBreakStart,
            lunchBreakEnd: editRow.lunchBreakEnd,
          }}
          employeeId={editRow.employeeId ?? undefined}
          date={todayDateString}
          shiftCodes={shiftCodesData}
        />
      )}
    </Card>
  )
}
