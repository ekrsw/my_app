"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
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
import { Circle, ChevronLeft, ChevronRight, CalendarIcon, ArrowUp, ArrowDown, ArrowUpDown, Loader2 } from "lucide-react"
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
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
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
  hasMore,
  isLoadingMore,
  onLoadMore,
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

  const handleSortChange = useCallback((newSortBy: string, newSortOrder: "asc" | "desc") => {
    const isDefault = newSortBy === "employeeName" && newSortOrder === "asc"
    setParams({
      dailySortBy: isDefault ? null : newSortBy,
      dailySortOrder: isDefault ? null : newSortOrder,
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
        setParams({ dailyDate: parsed })
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
    setParams({ dailyDate: dateStr })
  }

  const navigateToDate = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    setParams({ dailyDate: dateStr })
    setCalendarOpen(false)
  }

  const selectedCalendarDate = useMemo(() => {
    const [y, m, d] = dailyDate.split("-").map(Number)
    return new Date(y, m - 1, d)
  }, [dailyDate])

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
  }, [setParams])

  const handleGroupClear = useCallback(() => {
    setParams({ groupIds: null, unassigned: null })
    setGroupPopoverOpen(false)
  }, [setParams])

  const handleShiftCodesConfirm = useCallback((codes: string[]) => {
    setParams({
      shiftCodes: codes.length > 0 ? codes.join(",") : null,
    })
    setShiftCodePopoverOpen(false)
  }, [setParams])

  const handleShiftCodesClear = useCallback(() => {
    setParams({ shiftCodes: null })
    setShiftCodePopoverOpen(false)
  }, [setParams])

  const handleRemoteChange = useCallback((checked: boolean) => {
    setParams({ dailyIsRemote: checked ? "true" : null })
  }, [setParams])

  const handleSupervisorRoleConfirm = useCallback((names: string[]) => {
    setParams({ supervisorRoleNames: names.length > 0 ? names.join(",") : null })
    setSupervisorPopoverOpen(false)
  }, [setParams])

  const handleSupervisorRoleClear = useCallback(() => {
    setParams({ supervisorRoleNames: null })
    setSupervisorPopoverOpen(false)
  }, [setParams])

  const handleBusinessRoleConfirm = useCallback((names: string[]) => {
    setParams({ businessRoleNames: names.length > 0 ? names.join(",") : null })
    setBusinessPopoverOpen(false)
  }, [setParams])

  const handleBusinessRoleClear = useCallback(() => {
    setParams({ businessRoleNames: null })
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
          ? groupIds.map((id) => groups.find((g) => g.id === id)?.name ?? "").filter(Boolean).join(", ")
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
        label: "テレワークのみ",
        onRemove: () => setParams({ dailyIsRemote: null }),
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

  // --- Dynamic height calculation ---
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

  // --- TanStack Table setup ---
  const [sorting, setSorting] = useState<SortingState>(
    [{ id: sortBy, desc: sortOrder === "desc" }]
  )

  const handleSortingChange = useCallback(
    (updater: SortingState | ((prev: SortingState) => SortingState)) => {
      const newSorting = typeof updater === "function" ? updater(sorting) : updater
      setSorting(newSorting)
      if (newSorting.length > 0) {
        handleSortChange(newSorting[0].id, newSorting[0].desc ? "desc" : "asc")
      } else {
        handleSortChange("employeeName", "asc")
      }
    },
    [sorting, handleSortChange]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    state: { sorting },
    onSortingChange: handleSortingChange,
  })

  // --- IntersectionObserver for lazy loading ---
  const sentinelRef = useRef<HTMLDivElement>(null)
  const onLoadMoreRef = useRef(onLoadMore)
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore
  }, [onLoadMore])

  useEffect(() => {
    const sentinel = sentinelRef.current
    const container = scrollContainerRef.current
    if (!sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMoreRef.current?.()
        }
      },
      { root: container, rootMargin: "200px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore])

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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
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
          <Input
            ref={dateInputRef}
            value={editingDateValue ?? formattedDate}
            onFocus={() => setEditingDateValue(formattedDate)}
            onChange={(e) => setEditingDateValue(e.target.value)}
            onBlur={handleDateInputCommit}
            onKeyDown={handleDateInputKeyDown}
            className="w-[160px] text-center font-medium"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigateToDate(new Date())}>
            今日
          </Button>
          <ViewModeSelect value="daily" />
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-2">
        {total}件の従業員
      </p>

      <ActiveFilterTags tags={filterTags} onClearAll={clearAllFilters} />

      <div
        ref={scrollContainerRef}
        className="rounded-md border overflow-auto [&_[data-slot=table-container]]:overflow-visible"
        style={{ maxHeight }}
      >
        <Table>
          <TableHeader className="sticky top-0 z-10 [&_th]:bg-background [&_tr]:border-b-0 shadow-[0_1px_0_0_var(--border)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            header.column.getCanSort() &&
                              "cursor-pointer select-none flex items-center gap-1"
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getCanSort() && (
                            sorted === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5 shrink-0" />
                            ) : sorted === "desc" ? (
                              <ArrowDown className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-30" />
                            )
                          )}
                        </div>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  データがありません
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* センチネル要素 + ローディング表示 */}
        {data.length > 0 && hasMore && (
          <div ref={sentinelRef} className="flex items-center justify-center py-4">
            {isLoadingMore && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </div>
        )}

        {/* 件数表示 */}
        {total > 0 && data.length > 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground border-t">
            {data.length} / 全{total}人 表示中
            {hasMore && !isLoadingMore && " — スクロールで続きを読み込み"}
          </div>
        )}
      </div>

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
