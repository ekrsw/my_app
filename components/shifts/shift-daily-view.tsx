"use client"

import { useState, useMemo, useCallback } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import { ShiftBadge } from "@/components/shifts/shift-badge"
import { ShiftForm } from "@/components/shifts/shift-form"
import { ColumnFilterPopover } from "@/components/shifts/column-filter-popover"
import { EmployeeCheckboxFilter } from "@/components/shifts/column-filters/employee-checkbox-filter"
import { CheckboxListFilter } from "@/components/shifts/column-filters/checkbox-list-filter"
import { TimeRangeFilter } from "@/components/shifts/column-filters/time-range-filter"
import { ToggleFilter } from "@/components/shifts/column-filters/toggle-filter"
import { ActiveFilterTags, FilterTag } from "@/components/shifts/active-filter-tags"
import { ViewModeSelect } from "@/components/shifts/view-mode-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useQueryParams } from "@/hooks/use-query-params"
import { formatTime } from "@/lib/date-utils"
import type { ShiftDailyRow, ShiftDailySortField, SortOrder } from "@/types/shifts"
import { Circle, Check, ChevronLeft, ChevronRight } from "lucide-react"

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
  startTimeFrom: string
  endTimeTo: string
  sortBy: ShiftDailySortField
  sortOrder: SortOrder
  isHolidayFilter: boolean
  isRemoteFilter: boolean
  dailyShiftCodeOptions: string[]
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
  startTimeFrom,
  endTimeTo,
  sortBy,
  sortOrder,
  isHolidayFilter,
  isRemoteFilter,
  dailyShiftCodeOptions,
}: ShiftDailyViewProps) {
  const { setParams } = useQueryParams()
  const [editOpen, setEditOpen] = useState(false)
  const [editRow, setEditRow] = useState<ShiftDailyRow | null>(null)
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false)
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false)
  const [shiftCodePopoverOpen, setShiftCodePopoverOpen] = useState(false)

  const handleRowClick = (row: ShiftDailyRow) => {
    setEditRow(row)
    setEditOpen(true)
  }

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
  const navigateDate = (delta: number) => {
    const [y, m, d] = dailyDate.split("-").map(Number)
    const date = new Date(y, m - 1, d + delta)
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    setParams({ dailyDate: dateStr, dailyPage: null })
  }

  // --- Filter handlers ---
  const handleEmployeeIdsConfirm = useCallback((ids: string[]) => {
    setParams({ employeeIds: ids.length > 0 ? ids.join(",") : null, dailyPage: null })
    setEmployeePopoverOpen(false)
  }, [setParams])

  const handleEmployeeIdsClear = useCallback(() => {
    setParams({ employeeIds: null, dailyPage: null })
    setEmployeePopoverOpen(false)
  }, [setParams])

  const handleGroupConfirm = useCallback((ids: string[]) => {
    setParams({
      groupIds: ids.length > 0 ? ids.join(",") : null,
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

  const handleStartTimeChange = useCallback((value: string) => {
    setParams({ startTimeFrom: value || null, dailyPage: null })
  }, [setParams])

  const handleEndTimeChange = useCallback((value: string) => {
    setParams({ endTimeTo: value || null, dailyPage: null })
  }, [setParams])

  const handleHolidayChange = useCallback((checked: boolean) => {
    setParams({ dailyIsHoliday: checked ? "true" : null, dailyPage: null })
  }, [setParams])

  const handleRemoteChange = useCallback((checked: boolean) => {
    setParams({ dailyIsRemote: checked ? "true" : null, dailyPage: null })
  }, [setParams])

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

    if (startTimeFrom) {
      tags.push({
        key: "startTimeFrom",
        label: `開始: ${startTimeFrom}以降`,
        onRemove: () => setParams({ startTimeFrom: null, dailyPage: null }),
      })
    }

    if (endTimeTo) {
      tags.push({
        key: "endTimeTo",
        label: `終了: ${endTimeTo}以前`,
        onRemove: () => setParams({ endTimeTo: null, dailyPage: null }),
      })
    }

    if (isHolidayFilter) {
      tags.push({
        key: "isHoliday",
        label: "休日のみ",
        onRemove: () => setParams({ dailyIsHoliday: null, dailyPage: null }),
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
  }, [selectedEmployeeIds, employees, unassigned, groupIds, groups, selectedShiftCodes, startTimeFrom, endTimeTo, isHolidayFilter, isRemoteFilter, setParams])

  const clearAllFilters = useCallback(() => {
    setParams({
      employeeIds: null,
      groupIds: null,
      unassigned: null,
      shiftCodes: null,
      startTimeFrom: null,
      endTimeTo: null,
      dailyIsHoliday: null,
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
            specialOption={{
              value: "unassigned",
              label: "未所属",
              checked: unassigned,
              onChange: (checked) => setParams({ unassigned: checked ? "true" : null, dailyPage: null }),
            }}
            searchPlaceholder="グループ名で検索..."
          />
        </ColumnFilterPopover>
      ),
      cell: ({ row }) => row.original.groupName ?? "-",
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
      accessorKey: "startTime",
      header: () => (
        <ColumnFilterPopover
          label="開始時刻"
          isActive={!!startTimeFrom}
        >
          <TimeRangeFilter
            value={startTimeFrom}
            onChange={handleStartTimeChange}
            label="この時刻以降"
          />
        </ColumnFilterPopover>
      ),
      cell: ({ row }) => formatTime(row.original.startTime),
    },
    {
      accessorKey: "endTime",
      header: () => (
        <ColumnFilterPopover
          label="終了時刻"
          isActive={!!endTimeTo}
        >
          <TimeRangeFilter
            value={endTimeTo}
            onChange={handleEndTimeChange}
            label="この時刻以前"
          />
        </ColumnFilterPopover>
      ),
      cell: ({ row }) => formatTime(row.original.endTime),
    },
    {
      accessorKey: "isHoliday",
      header: () => (
        <ColumnFilterPopover
          label="休日"
          isActive={isHolidayFilter}
        >
          <ToggleFilter
            checked={isHolidayFilter}
            onChange={handleHolidayChange}
            label="休日のみ表示"
          />
        </ColumnFilterPopover>
      ),
      cell: ({ row }) =>
        row.original.isHoliday ? (
          <Check className="h-4 w-4 text-red-500" />
        ) : null,
      enableSorting: true,
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
    groupIds, unassigned, selectedShiftCodes, startTimeFrom, endTimeTo,
    isHolidayFilter, isRemoteFilter, groupOptions, selectedGroupValues, shiftCodeOptions,
    groupPopoverOpen, shiftCodePopoverOpen, setParams,
    handleEmployeeIdsConfirm, handleEmployeeIdsClear,
    handleGroupConfirm, handleGroupClear, handleShiftCodesConfirm, handleShiftCodesClear,
    handleStartTimeChange, handleEndTimeChange, handleHolidayChange, handleRemoteChange,
  ])

  const editShift = editRow?.shiftId
    ? {
        id: editRow.shiftId,
        employeeId: editRow.employeeId,
        shiftDate: new Date(dailyDate),
        shiftCode: editRow.shiftCode,
        startTime: editRow.startTime,
        endTime: editRow.endTime,
        isHoliday: editRow.isHoliday,
        isRemote: editRow.isRemote,
      }
    : undefined

  return (
    <div>
      {/* 日付ナビゲーション + ビュー切替 */}
      <div className="flex items-center gap-1 mb-4">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={() => navigateDate(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Input
          type="date"
          value={dailyDate}
          onChange={(e) =>
            setParams({ dailyDate: e.target.value || null, dailyPage: null })
          }
          className="w-44"
        />
        <ViewModeSelect value="daily" />
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={() => navigateDate(1)}
        >
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

      <ShiftForm
        key={`${editRow?.shiftId ?? "new"}-${editRow?.employeeId}-${dailyDate}`}
        open={editOpen}
        onOpenChange={setEditOpen}
        shift={editShift}
        employeeId={editRow?.employeeId}
        date={dailyDate}
        shiftCodes={shiftCodes}
      />
    </div>
  )
}
