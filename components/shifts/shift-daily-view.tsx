"use client"

import { useState, useMemo, useCallback } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import { ShiftBadge } from "@/components/shifts/shift-badge"
import { ShiftForm } from "@/components/shifts/shift-form"
import { ColumnFilterPopover } from "@/components/shifts/column-filter-popover"
import { TextSearchFilter } from "@/components/shifts/column-filters/text-search-filter"
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
  search: string
  startTimeFrom: string
  endTimeTo: string
  sortBy: ShiftDailySortField
  sortOrder: SortOrder
  isHolidayFilter: boolean
  isRemoteFilter: boolean
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
  search,
  startTimeFrom,
  endTimeTo,
  sortBy,
  sortOrder,
  isHolidayFilter,
  isRemoteFilter,
}: ShiftDailyViewProps) {
  const { setParams } = useQueryParams()
  const [editOpen, setEditOpen] = useState(false)
  const [editRow, setEditRow] = useState<ShiftDailyRow | null>(null)

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
  const handleSearchChange = useCallback((value: string) => {
    setParams({ search: value || null, dailyPage: null })
  }, [setParams])

  const handleGroupChange = useCallback((ids: string[]) => {
    setParams({
      groupIds: ids.length > 0 ? ids.join(",") : null,
      dailyPage: null,
    })
  }, [setParams])

  const handleUnassignedChange = useCallback((checked: boolean) => {
    setParams({ unassigned: checked ? "true" : null, dailyPage: null })
  }, [setParams])

  const handleShiftCodesChange = useCallback((codes: string[]) => {
    setParams({
      shiftCodes: codes.length > 0 ? codes.join(",") : null,
      dailyPage: null,
    })
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

    if (search) {
      tags.push({
        key: "search",
        label: `従業員名: ${search}`,
        onRemove: () => setParams({ search: null, dailyPage: null }),
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
  }, [search, unassigned, groupIds, groups, selectedShiftCodes, startTimeFrom, endTimeTo, isHolidayFilter, isRemoteFilter, setParams])

  const clearAllFilters = useCallback(() => {
    setParams({
      search: null,
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

  // --- Shift code options for checkbox filter ---
  const shiftCodeOptions = useMemo(
    () =>
      shiftCodes.map((sc) => ({
        value: sc.code,
        label: <ShiftBadge code={sc.code} />,
      })),
    [shiftCodes]
  )

  // --- Column definitions ---
  const columns: ColumnDef<ShiftDailyRow>[] = useMemo(() => [
    {
      accessorKey: "employeeName",
      header: () => (
        <ColumnFilterPopover
          label="従業員名"
          isActive={!!search}
        >
          <TextSearchFilter
            value={search}
            onChange={handleSearchChange}
            placeholder="従業員名で検索..."
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
        >
          <CheckboxListFilter
            options={groupOptions}
            selectedValues={selectedGroupValues}
            onChange={(values) => handleGroupChange(values)}
            specialOption={{
              value: "unassigned",
              label: "未所属",
              checked: unassigned,
              onChange: handleUnassignedChange,
            }}
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
        >
          <CheckboxListFilter
            options={shiftCodeOptions}
            selectedValues={selectedShiftCodes}
            onChange={handleShiftCodesChange}
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
    search, groupIds, unassigned, selectedShiftCodes, startTimeFrom, endTimeTo,
    isHolidayFilter, isRemoteFilter, groupOptions, selectedGroupValues, shiftCodeOptions,
    handleSearchChange, handleGroupChange, handleUnassignedChange, handleShiftCodesChange,
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
