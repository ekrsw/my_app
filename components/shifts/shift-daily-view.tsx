"use client"

import { useState, useMemo, useCallback, useRef } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import { ShiftBadge } from "@/components/shifts/shift-badge"
import { ShiftForm } from "@/components/shifts/shift-form"
import { ShiftDetailDialog } from "@/components/shifts/shift-detail-dialog"
import type { ShiftCodeInfo } from "@/lib/constants"
import type { LatestShiftHistory } from "@/lib/db/shifts"
import { ColumnFilterPopover } from "@/components/shifts/column-filter-popover"
import { EmployeeCheckboxFilter } from "@/components/shifts/column-filters/employee-checkbox-filter"
import { CheckboxListFilter } from "@/components/shifts/column-filters/checkbox-list-filter"
import { ToggleFilter } from "@/components/shifts/column-filters/toggle-filter"
import { ActiveFilterTags, FilterTag } from "@/components/shifts/active-filter-tags"
import { ViewModeSelect } from "@/components/shifts/view-mode-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { useQueryParams } from "@/hooks/use-query-params"
import type { ShiftDailyRow, ShiftDailySortField, SortOrder } from "@/types/shifts"
import { Circle, ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react"
import Link from "next/link"

type Group = { id: number; name: string }
type ShiftCodeOption = {
  id: number
  code: string
  color: string | null
  defaultStartTime: Date | null
  defaultEndTime: Date | null
  defaultIsHoliday: boolean
  isActive: boolean | null
  sortOrder: number
}

type ShiftDailyViewProps = {
  data: ShiftDailyRow[]
  total: number
  page: number
  totalPages: number
  dailyDate: string
  groups: Group[]
  shiftCodes: ShiftCodeOption[]
  groupIds: number[]
  unassigned: boolean
  selectedShiftCodes: string[]
  selectedEmployeeIds: string[]
  employees: { id: string; name: string }[]
  sortBy: ShiftDailySortField
  sortOrder: SortOrder
  isRemoteFilter: boolean
  dailyShiftCodeOptions: string[]
  hasUnassigned: boolean
  roles: { id: number; roleName: string; roleType: string }[]
  selectedSupervisorRoleNames: string[]
  selectedBusinessRoleNames: string[]
  supervisorRoleNameOptions: string[]
  businessRoleNameOptions: string[]
  isAuthenticated?: boolean
  shiftCodeMap: Record<string, ShiftCodeInfo>
  shiftIdsWithHistory: Set<number>
  shiftLatestHistory: Record<number, LatestShiftHistory>
}

export function ShiftDailyView({
  data,
  total,
  page,
  totalPages,
  dailyDate,
  groups,
  shiftCodes,
  groupIds,
  unassigned,
  selectedShiftCodes,
  selectedEmployeeIds,
  employees,
  sortBy,
  sortOrder,
  isRemoteFilter,
  dailyShiftCodeOptions,
  hasUnassigned,
  roles,
  selectedSupervisorRoleNames,
  selectedBusinessRoleNames,
  supervisorRoleNameOptions,
  businessRoleNameOptions,
  isAuthenticated,
  shiftCodeMap,
  shiftIdsWithHistory,
  shiftLatestHistory,
}: ShiftDailyViewProps) {
  const { setParams } = useQueryParams()
  const [editOpen, setEditOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editRow, setEditRow] = useState<ShiftDailyRow | null>(null)
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false)
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false)
  const [shiftCodePopoverOpen, setShiftCodePopoverOpen] = useState(false)
  const [supervisorPopoverOpen, setSupervisorPopoverOpen] = useState(false)
  const [businessPopoverOpen, setBusinessPopoverOpen] = useState(false)

  const handleRowClick = (row: ShiftDailyRow) => {
    setEditRow(row)
    if (row.shiftId) {
      // シフトが存在する → 詳細ダイアログ表示（認証状態に関わらず）
      setDetailOpen(true)
    } else if (isAuthenticated) {
      // シフトが存在しない＋認証済み → 新規作成フォーム
      setEditOpen(true)
    }
  }

  const handleEditFromDetail = useCallback(() => {
    setDetailOpen(false)
    setEditOpen(true)
  }, [])

  const handlePageChange = (newPage: number) => {
    setParams({ dailyPage: newPage === 1 ? null : newPage })
  }

  const handleSortChange = useCallback((newSortBy: string, newSortOrder: "asc" | "desc") => {
    const isDefault = newSortBy === "employeeName" && newSortOrder === "asc"
    setParams({
      dailySortBy: isDefault ? null : newSortBy,
      dailySortOrder: isDefault ? null : newSortOrder,
      dailyPage: null,
    })
  }, [setParams])

  // --- Date navigation ---
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [editingDateValue, setEditingDateValue] = useState<string | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const formatDailyDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number)
    return `${y}年${m}月${d}日`
  }

  const formattedDate = useMemo(() => formatDailyDate(dailyDate), [dailyDate])

  const parseDateInput = (input: string): string | null => {
    const trimmed = input.trim()
    // "2026年3月14日" or "2026年03月01日"
    const jaMatch = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?$/)
    if (jaMatch) {
      const y = parseInt(jaMatch[1], 10)
      const m = parseInt(jaMatch[2], 10)
      const d = parseInt(jaMatch[3], 10)
      const date = new Date(y, m - 1, d)
      if (!isNaN(date.getTime()) && date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
        return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      }
    }
    // "2026/3/14" or "2026-3-14"
    const slashMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
    if (slashMatch) {
      const y = parseInt(slashMatch[1], 10)
      const m = parseInt(slashMatch[2], 10)
      const d = parseInt(slashMatch[3], 10)
      const date = new Date(y, m - 1, d)
      if (!isNaN(date.getTime()) && date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
        return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      }
    }
    return null
  }

  const handleDateInputCommit = () => {
    if (editingDateValue !== null) {
      const parsed = parseDateInput(editingDateValue)
      if (parsed) {
        setParams({ dailyDate: parsed, dailyPage: null })
      }
      setEditingDateValue(null)
    }
  }

  const handleDateInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleDateInputCommit()
      dateInputRef.current?.blur()
    }
  }

  const navigateDate = (delta: number) => {
    const [y, m, d] = dailyDate.split("-").map(Number)
    const date = new Date(y, m - 1, d + delta)
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    setParams({ dailyDate: dateStr, dailyPage: null })
  }

  const navigateToDate = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    setParams({ dailyDate: dateStr, dailyPage: null })
    setCalendarOpen(false)
  }

  const selectedCalendarDate = useMemo(() => {
    const [y, m, d] = dailyDate.split("-").map(Number)
    return new Date(y, m - 1, d)
  }, [dailyDate])

  // --- Filter handlers ---
  const handleEmployeeIdsConfirm = useCallback((ids: string[]) => {
    setParams({ employeeIds: ids.length > 0 ? ids.join(",") : null, dailyPage: null })
    setEmployeePopoverOpen(false)
  }, [setParams])

  const handleEmployeeIdsClear = useCallback(() => {
    setParams({ employeeIds: null, dailyPage: null })
    setEmployeePopoverOpen(false)
  }, [setParams])

  const handleGroupConfirm = useCallback((ids: string[], specialChecked?: boolean) => {
    setParams({
      groupIds: ids.length > 0 ? ids.join(",") : null,
      unassigned: specialChecked ? "true" : null,
      dailyPage: null,
    })
    setGroupPopoverOpen(false)
  }, [setParams])

  const handleGroupClear = useCallback(() => {
    setParams({ groupIds: null, unassigned: null, dailyPage: null })
    setGroupPopoverOpen(false)
  }, [setParams])

  const handleShiftCodesConfirm = useCallback((codes: string[]) => {
    setParams({
      shiftCodes: codes.length > 0 ? codes.join(",") : null,
      dailyPage: null,
    })
    setShiftCodePopoverOpen(false)
  }, [setParams])

  const handleShiftCodesClear = useCallback(() => {
    setParams({ shiftCodes: null, dailyPage: null })
    setShiftCodePopoverOpen(false)
  }, [setParams])

  const handleRemoteChange = useCallback((checked: boolean) => {
    setParams({ dailyIsRemote: checked ? "true" : null, dailyPage: null })
  }, [setParams])

  const handleSupervisorRoleConfirm = useCallback((names: string[]) => {
    setParams({ supervisorRoleNames: names.length > 0 ? names.join(",") : null, dailyPage: null })
    setSupervisorPopoverOpen(false)
  }, [setParams])

  const handleSupervisorRoleClear = useCallback(() => {
    setParams({ supervisorRoleNames: null, dailyPage: null })
    setSupervisorPopoverOpen(false)
  }, [setParams])

  const handleBusinessRoleConfirm = useCallback((names: string[]) => {
    setParams({ businessRoleNames: names.length > 0 ? names.join(",") : null, dailyPage: null })
    setBusinessPopoverOpen(false)
  }, [setParams])

  const handleBusinessRoleClear = useCallback(() => {
    setParams({ businessRoleNames: null, dailyPage: null })
    setBusinessPopoverOpen(false)
  }, [setParams])

  // --- Distinct role types for dynamic column headers ---
  // getShiftsForDaily と同じ desc 順でカラムマッピングを一致させる
  const distinctRoleTypes = useMemo(() => {
    const types = [...new Set(roles.map((r) => r.roleType))].sort().reverse()
    return [types[0] ?? "監督", types[1] ?? "業務"] as const
  }, [roles])

  // --- Filter tags ---
  const filterTags = useMemo<FilterTag[]>(() => {
    const tags: FilterTag[] = []

    if (selectedEmployeeIds.length > 0) {
      const label =
        selectedEmployeeIds.length <= 2
          ? selectedEmployeeIds
              .map((id) => employees.find((e) => e.id === id)?.name ?? "")
              .filter(Boolean)
              .join(", ")
          : `${selectedEmployeeIds.length}名選択`
      tags.push({
        key: "employeeIds",
        label: `従業員: ${label}`,
        onRemove: () => setParams({ employeeIds: null, dailyPage: null }),
      })
    }

    if (unassigned) {
      tags.push({
        key: "unassigned",
        label: "グループ: 未所属",
        onRemove: () => setParams({ unassigned: null, dailyPage: null }),
      })
    }

    if (groupIds.length > 0) {
      const label =
        groupIds.length <= 2
          ? groupIds.map((id) => groups.find((g) => g.id === id)?.name ?? "").filter(Boolean).join(", ")
          : `${groupIds.length}件選択`
      tags.push({
        key: "groupIds",
        label: `グループ: ${label}`,
        onRemove: () => setParams({ groupIds: null, dailyPage: null }),
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
        onRemove: () => setParams({ shiftCodes: null, dailyPage: null }),
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
        onRemove: () => setParams({ supervisorRoleNames: null, dailyPage: null }),
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
        onRemove: () => setParams({ businessRoleNames: null, dailyPage: null }),
      })
    }

    if (isRemoteFilter) {
      tags.push({
        key: "isRemote",
        label: "テレワークのみ",
        onRemove: () => setParams({ dailyIsRemote: null, dailyPage: null }),
      })
    }

    return tags
  }, [selectedEmployeeIds, employees, unassigned, groupIds, groups, selectedShiftCodes, selectedSupervisorRoleNames, selectedBusinessRoleNames, distinctRoleTypes, isRemoteFilter, setParams])

  const clearAllFilters = useCallback(() => {
    setParams({
      employeeIds: null,
      groupIds: null,
      unassigned: null,
      shiftCodes: null,
      supervisorRoleNames: null,
      businessRoleNames: null,
      dailyIsRemote: null,
      dailyPage: null,
    })
  }, [setParams])

  // --- Group options for checkbox filter ---
  const groupOptions = useMemo(
    () => groups.map((g) => ({ value: String(g.id), label: g.name })),
    [groups]
  )
  const selectedGroupValues = useMemo(
    () => groupIds.map(String),
    [groupIds]
  )

  // --- Shift code options for checkbox filter (当日存在分のみ) ---
  const shiftCodeOptions = useMemo(
    () =>
      dailyShiftCodeOptions.map((code) => ({
        value: code,
        label: <ShiftBadge code={code} />,
        searchText: code,
      })),
    [dailyShiftCodeOptions]
  )

  // --- Role name options for checkbox filter ---
  const supervisorRoleOptions = useMemo(
    () => supervisorRoleNameOptions.map((name) => ({ value: name, label: name })),
    [supervisorRoleNameOptions]
  )
  const businessRoleOptions = useMemo(
    () => businessRoleNameOptions.map((name) => ({ value: name, label: name })),
    [businessRoleNameOptions]
  )

  // --- Column definitions ---
  const columns: ColumnDef<ShiftDailyRow>[] = useMemo(() => [
    {
      accessorKey: "employeeName",
      header: () => (
        <ColumnFilterPopover
          label="従業員名"
          isActive={selectedEmployeeIds.length > 0}
          activeCount={selectedEmployeeIds.length}
          open={employeePopoverOpen}
          onOpenChange={setEmployeePopoverOpen}
        >
          <EmployeeCheckboxFilter
            employees={employees}
            selectedIds={selectedEmployeeIds}
            onConfirm={handleEmployeeIdsConfirm}
            onClear={handleEmployeeIdsClear}
            popoverOpen={employeePopoverOpen}
          />
        </ColumnFilterPopover>
      ),
      cell: ({ row }) => (
        <Link
          href={`/employees/${row.original.employeeId}`}
          className="hover:underline hover:text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.employeeName}
        </Link>
      ),
    },
    {
      accessorKey: "groupName",
      header: () => (
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
            specialOption={hasUnassigned || unassigned ? {
              value: "unassigned",
              label: "未所属",
              checked: unassigned,
            } : undefined}
            searchPlaceholder="グループ名で検索..."
          />
        </ColumnFilterPopover>
      ),
      cell: ({ row }) => row.original.groupName ?? "-",
    },
    {
      accessorKey: "supervisorRoleName",
      header: () => (
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
      ),
      cell: ({ row }) => row.original.supervisorRoleName ?? "-",
    },
    {
      accessorKey: "businessRoleName",
      header: () => (
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
      ),
      cell: ({ row }) => row.original.businessRoleName ?? "-",
    },
    {
      accessorKey: "shiftCode",
      header: () => (
        <ColumnFilterPopover
          label="シフトコード"
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
      ),
      cell: ({ row }) => <ShiftBadge code={row.original.shiftCode} />,
    },
    {
      accessorKey: "isRemote",
      header: () => (
        <ColumnFilterPopover
          label="テレワーク"
          isActive={isRemoteFilter}
        >
          <ToggleFilter
            checked={isRemoteFilter}
            onChange={handleRemoteChange}
            label="テレワークのみ表示"
          />
        </ColumnFilterPopover>
      ),
      cell: ({ row }) =>
        row.original.isRemote ? (
          <Circle className="h-4 w-4 text-sky-500 fill-sky-500" />
        ) : null,
      enableSorting: true,
    },
  ], [
    selectedEmployeeIds, employees, employeePopoverOpen,
    groupIds, unassigned, selectedShiftCodes,
    selectedSupervisorRoleNames, selectedBusinessRoleNames,
    isRemoteFilter, groupOptions, selectedGroupValues, shiftCodeOptions,
    supervisorRoleOptions, businessRoleOptions,
    groupPopoverOpen, shiftCodePopoverOpen,
    supervisorPopoverOpen, businessPopoverOpen,
    setParams, hasUnassigned, distinctRoleTypes,
    handleEmployeeIdsConfirm, handleEmployeeIdsClear,
    handleGroupConfirm, handleGroupClear, handleShiftCodesConfirm, handleShiftCodesClear,
    handleSupervisorRoleConfirm, handleSupervisorRoleClear,
    handleBusinessRoleConfirm, handleBusinessRoleClear,
    handleRemoteChange,
  ])

  const editShift = editRow?.shiftId
    ? {
        id: editRow.shiftId,
        employeeId: editRow.employeeId,
        shiftDate: new Date(dailyDate),
        shiftCode: editRow.shiftCode,
        startTime: null,
        endTime: null,
        isHoliday: null,
        isRemote: editRow.isRemote,
      }
    : undefined

  return (
    <div>
      {/* 日付ナビゲーション + ビュー切替 */}
      <div className="flex items-center gap-1 mb-4">
        <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Input
          ref={dateInputRef}
          value={editingDateValue ?? formattedDate}
          onFocus={() => setEditingDateValue(formattedDate)}
          onChange={(e) => setEditingDateValue(e.target.value)}
          onBlur={handleDateInputCommit}
          onKeyDown={handleDateInputKeyDown}
          className="w-[160px] text-center font-medium"
        />
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon">
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedCalendarDate}
              onSelect={(date) => date && navigateToDate(date)}
              defaultMonth={selectedCalendarDate}
            />
          </PopoverContent>
        </Popover>
        <Button variant="outline" onClick={() => navigateToDate(new Date())}>
          今日
        </Button>
        <ViewModeSelect value="daily" />
        <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-2">
        {total}件の従業員
      </p>

      <ActiveFilterTags tags={filterTags} onClearAll={clearAllFilters} />

      <DataTable
        columns={columns}
        data={data}
        pageCount={totalPages}
        page={page}
        onPageChange={handlePageChange}
        onRowClick={handleRowClick}
        serverSort={{
          sortBy,
          sortOrder,
          onSortChange: handleSortChange,
        }}
      />

      {editRow && editShift && (
        <ShiftDetailDialog
          key={`detail-${editShift.id}`}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          shift={editShift}
          employeeName={editRow.employeeName}
          date={dailyDate}
          shiftCodeMap={shiftCodeMap}
          hasHistory={shiftIdsWithHistory.has(editShift.id)}
          latestHistory={shiftLatestHistory[editShift.id] ?? null}
          isAuthenticated={isAuthenticated}
          onEdit={handleEditFromDetail}
        />
      )}

      {isAuthenticated && (
        <ShiftForm
          key={`${editRow?.shiftId ?? "new"}-${editRow?.employeeId}-${dailyDate}`}
          open={editOpen}
          onOpenChange={setEditOpen}
          shift={editShift}
          employeeId={editRow?.employeeId}
          date={dailyDate}
          shiftCodes={shiftCodes}
        />
      )}
    </div>
  )
}
