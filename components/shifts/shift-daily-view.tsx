"use client"

import { useState, useMemo, useCallback } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import { ShiftBadge } from "@/components/shifts/shift-badge"
import { ShiftForm } from "@/components/shifts/shift-form"
import { ColumnFilterPopover } from "@/components/shifts/column-filter-popover"
import { EmployeeCheckboxFilter } from "@/components/shifts/column-filters/employee-checkbox-filter"
import { CheckboxListFilter } from "@/components/shifts/column-filters/checkbox-list-filter"
import { ToggleFilter } from "@/components/shifts/column-filters/toggle-filter"
import { ActiveFilterTags, FilterTag } from "@/components/shifts/active-filter-tags"
import { ViewModeSelect } from "@/components/shifts/view-mode-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useQueryParams } from "@/hooks/use-query-params"
import type { ShiftDailyRow, ShiftDailySortField, SortOrder } from "@/types/shifts"
import { Circle, ChevronLeft, ChevronRight } from "lucide-react"

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

    if (isRemoteFilter) {
      tags.push({
        key: "isRemote",
        label: "テレワークのみ",
        onRemove: () => setParams({ dailyIsRemote: null, dailyPage: null }),
      })
    }

    return tags
  }, [selectedEmployeeIds, employees, unassigned, groupIds, groups, selectedShiftCodes, isRemoteFilter, setParams])

  const clearAllFilters = useCallback(() => {
    setParams({
      employeeIds: null,
      groupIds: null,
      unassigned: null,
      shiftCodes: null,
      dailyIsRemote: null,
      dailyPage: null,
    })
  }, [setParams])

  // --- Distinct role types for dynamic column headers ---
  // getShiftsForDaily と同じ desc 順でカラムマッピングを一致させる
  const distinctRoleTypes = useMemo(() => {
    const types = [...new Set(roles.map((r) => r.roleType))].sort().reverse()
    return [types[0] ?? "監督", types[1] ?? "業務"] as const
  }, [roles])

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
      header: distinctRoleTypes[0],
      cell: ({ row }) => row.original.supervisorRoleName ?? "-",
    },
    {
      accessorKey: "businessRoleName",
      header: distinctRoleTypes[1],
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
    isRemoteFilter, groupOptions, selectedGroupValues, shiftCodeOptions,
    groupPopoverOpen, shiftCodePopoverOpen, setParams, hasUnassigned, distinctRoleTypes,
    handleEmployeeIdsConfirm, handleEmployeeIdsClear,
    handleGroupConfirm, handleGroupClear, handleShiftCodesConfirm, handleShiftCodesClear,
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
