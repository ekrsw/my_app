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
import { Badge } from "@/components/ui/badge"
import { DutyAssignmentForm } from "@/components/duty-assignments/duty-assignment-form"
import { ColumnFilterPopover } from "@/components/common/filters/column-filter-popover"
import { EmployeeCheckboxFilter } from "@/components/common/filters/employee-checkbox-filter"
import { CheckboxListFilter } from "@/components/common/filters/checkbox-list-filter"
import { ToggleFilter } from "@/components/common/filters/toggle-filter"
import { ActiveFilterTags, FilterTag } from "@/components/common/filters/active-filter-tags"
import { useQueryParams } from "@/hooks/use-query-params"
import { loadMoreDutyDailyData } from "@/lib/actions/duty-assignment-actions"
import { COLOR_PALETTE } from "@/lib/constants"
import type {
  DutyAssignmentWithDetails,
  DutyDailyFilterOptions,
  DutyDailySortField,
  SortOrder,
} from "@/types/duties"
import { Loader2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import Link from "next/link"

type DutyDailyViewProps = {
  data: DutyAssignmentWithDetails[]
  total: number
  hasMore: boolean
  nextCursor: number | null
  date: string
  filterOptions: DutyDailyFilterOptions
  isAuthenticated: boolean
  employees: { id: string; name: string }[]
  dutyTypes: { id: number; code: string; name: string; defaultReducesCapacity: boolean }[]
  // Filter state from URL
  selectedEmployeeIds: string[]
  selectedGroupIds: number[]
  selectedDutyTypeIds: number[]
  reducesCapacityFilter: boolean | null
  sortBy: DutyDailySortField
  sortOrder: SortOrder
}

function formatTime(d: Date | string | null): string {
  if (!d) return ""
  const iso = typeof d === "string" ? d : d.toISOString()
  return iso.substring(11, 16)
}

function getDutyTypeBadge(dutyType: { code: string; name: string; color: string | null }) {
  const palette = dutyType.color ? COLOR_PALETTE[dutyType.color] : null
  if (palette) {
    return (
      <Badge variant="outline" className={cn(palette.text, palette.bg, "border-0 font-medium")}>
        {dutyType.name}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="font-medium">
      {dutyType.name}
    </Badge>
  )
}

export function DutyDailyView({
  data: initialData,
  total: initialTotal,
  hasMore: initialHasMore,
  nextCursor: initialNextCursor,
  date,
  filterOptions,
  isAuthenticated,
  employees,
  dutyTypes,
  selectedEmployeeIds,
  selectedGroupIds,
  selectedDutyTypeIds,
  reducesCapacityFilter,
  sortBy,
  sortOrder,
}: DutyDailyViewProps) {
  const { setParams } = useQueryParams()
  const [allData, setAllData] = useState(initialData)
  const [total, setTotal] = useState(initialTotal)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [nextCursor, setNextCursor] = useState(initialNextCursor)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editRow, setEditRow] = useState<DutyAssignmentWithDetails | null>(null)

  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false)
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false)
  const [dutyTypePopoverOpen, setDutyTypePopoverOpen] = useState(false)

  // Reset data when server props change (filter/sort changed)
  const prevKeyRef = useRef("")
  const dataKey = `${date}-${selectedEmployeeIds.join(",")}-${selectedGroupIds.join(",")}-${selectedDutyTypeIds.join(",")}-${reducesCapacityFilter}-${sortBy}-${sortOrder}`
  if (dataKey !== prevKeyRef.current) {
    prevKeyRef.current = dataKey
    setAllData(initialData)
    setTotal(initialTotal)
    setHasMore(initialHasMore)
    setNextCursor(initialNextCursor)
  }

  const handleRowClick = (row: DutyAssignmentWithDetails) => {
    if (!isAuthenticated) return
    setEditRow(row)
    setEditOpen(true)
  }

  const handleSortChange = useCallback((newSortBy: string, newSortOrder: "asc" | "desc") => {
    const isDefault = newSortBy === "employeeName" && newSortOrder === "asc"
    setParams({
      dutySortBy: isDefault ? null : newSortBy,
      dutySortOrder: isDefault ? null : newSortOrder,
    })
  }, [setParams])

  // --- Filter handlers ---
  const handleEmployeeIdsConfirm = useCallback((ids: string[]) => {
    setParams({ dutyEmployeeIds: ids.length > 0 ? ids.join(",") : null })
    setEmployeePopoverOpen(false)
  }, [setParams])

  const handleEmployeeIdsClear = useCallback(() => {
    setParams({ dutyEmployeeIds: null })
    setEmployeePopoverOpen(false)
  }, [setParams])

  const handleGroupConfirm = useCallback((ids: string[]) => {
    setParams({ dutyGroupIds: ids.length > 0 ? ids.join(",") : null })
    setGroupPopoverOpen(false)
  }, [setParams])

  const handleGroupClear = useCallback(() => {
    setParams({ dutyGroupIds: null })
    setGroupPopoverOpen(false)
  }, [setParams])

  const handleDutyTypeConfirm = useCallback((ids: string[]) => {
    setParams({ dutyTypeIds: ids.length > 0 ? ids.join(",") : null })
    setDutyTypePopoverOpen(false)
  }, [setParams])

  const handleDutyTypeClear = useCallback(() => {
    setParams({ dutyTypeIds: null })
    setDutyTypePopoverOpen(false)
  }, [setParams])

  const handleReducesCapacityChange = useCallback((checked: boolean) => {
    setParams({ dutyReducesCapacity: checked ? "true" : null })
  }, [setParams])

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
        key: "dutyEmployeeIds",
        label: `従業員: ${label}`,
        onRemove: () => setParams({ dutyEmployeeIds: null }),
      })
    }

    if (selectedGroupIds.length > 0) {
      const label =
        selectedGroupIds.length <= 2
          ? selectedGroupIds.map((id) => filterOptions.groups.find((g) => g.id === id)?.name ?? "").filter(Boolean).join(", ")
          : `${selectedGroupIds.length}件選択`
      tags.push({
        key: "dutyGroupIds",
        label: `グループ: ${label}`,
        onRemove: () => setParams({ dutyGroupIds: null }),
      })
    }

    if (selectedDutyTypeIds.length > 0) {
      const label =
        selectedDutyTypeIds.length <= 2
          ? selectedDutyTypeIds.map((id) => filterOptions.dutyTypes.find((dt) => dt.id === id)?.name ?? "").filter(Boolean).join(", ")
          : `${selectedDutyTypeIds.length}件選択`
      tags.push({
        key: "dutyTypeIds",
        label: `業務種別: ${label}`,
        onRemove: () => setParams({ dutyTypeIds: null }),
      })
    }

    if (reducesCapacityFilter !== null) {
      tags.push({
        key: "dutyReducesCapacity",
        label: "控除のみ",
        onRemove: () => setParams({ dutyReducesCapacity: null }),
      })
    }

    return tags
  }, [selectedEmployeeIds, selectedGroupIds, selectedDutyTypeIds, reducesCapacityFilter, filterOptions, setParams])

  const clearAllFilters = useCallback(() => {
    setParams({
      dutyEmployeeIds: null,
      dutyGroupIds: null,
      dutyTypeIds: null,
      dutyReducesCapacity: null,
    })
  }, [setParams])

  // --- Filter options ---
  const groupOptions = useMemo(
    () => filterOptions.groups.map((g) => ({ value: String(g.id), label: g.name })),
    [filterOptions.groups]
  )
  const selectedGroupValues = useMemo(
    () => selectedGroupIds.map(String),
    [selectedGroupIds]
  )

  const dutyTypeOptions = useMemo(
    () => filterOptions.dutyTypes.map((dt) => ({
      value: String(dt.id),
      label: getDutyTypeBadge(dt),
      searchText: `${dt.code} ${dt.name}`,
    })),
    [filterOptions.dutyTypes]
  )
  const selectedDutyTypeValues = useMemo(
    () => selectedDutyTypeIds.map(String),
    [selectedDutyTypeIds]
  )

  // --- Column definitions ---
  const columns: ColumnDef<DutyAssignmentWithDetails>[] = useMemo(() => [
    {
      id: "employeeName",
      accessorFn: (row) => row.employee.name,
      header: () => (
        <ColumnFilterPopover
          label="従業員"
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
      ),
      cell: ({ row }) => (
        <Link
          href={`/employees/${row.original.employeeId}`}
          className="hover:underline hover:text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.employee.name}
        </Link>
      ),
    },
    {
      id: "groupName",
      accessorFn: (row) => row.employee.groups[0]?.group.name ?? null,
      header: () => (
        <ColumnFilterPopover
          label="グループ"
          isActive={selectedGroupIds.length > 0}
          activeCount={selectedGroupIds.length}
          open={groupPopoverOpen}
          onOpenChange={setGroupPopoverOpen}
        >
          <CheckboxListFilter
            options={groupOptions}
            selectedValues={selectedGroupValues}
            onConfirm={handleGroupConfirm}
            onClear={handleGroupClear}
            popoverOpen={groupPopoverOpen}
            searchPlaceholder="グループ名で検索..."
          />
        </ColumnFilterPopover>
      ),
      cell: ({ row }) => row.original.employee.groups[0]?.group.name ?? "-",
    },
    {
      id: "dutyTypeName",
      accessorFn: (row) => row.dutyType.name,
      header: () => (
        <ColumnFilterPopover
          label="業務種別"
          isActive={selectedDutyTypeIds.length > 0}
          activeCount={selectedDutyTypeIds.length}
          open={dutyTypePopoverOpen}
          onOpenChange={setDutyTypePopoverOpen}
        >
          <CheckboxListFilter
            options={dutyTypeOptions}
            selectedValues={selectedDutyTypeValues}
            onConfirm={handleDutyTypeConfirm}
            onClear={handleDutyTypeClear}
            popoverOpen={dutyTypePopoverOpen}
            searchPlaceholder="業務種別で検索..."
          />
        </ColumnFilterPopover>
      ),
      cell: ({ row }) => getDutyTypeBadge(row.original.dutyType),
    },
    {
      id: "timeRange",
      accessorFn: (row) => row.startTime,
      header: () => <span>時間帯</span>,
      cell: ({ row }) => {
        const start = formatTime(row.original.startTime)
        const end = formatTime(row.original.endTime)
        if (!start && !end) return "-"
        return `${start} - ${end}`
      },
    },
    {
      id: "reducesCapacity",
      accessorFn: (row) => row.reducesCapacity,
      header: () => (
        <ColumnFilterPopover
          label="控除/対応可"
          isActive={reducesCapacityFilter !== null}
        >
          <ToggleFilter
            checked={reducesCapacityFilter === true}
            onChange={handleReducesCapacityChange}
            label="控除のみ表示"
          />
        </ColumnFilterPopover>
      ),
      cell: ({ row }) => (
        <Badge variant={row.original.reducesCapacity ? "destructive" : "secondary"} className="text-xs">
          {row.original.reducesCapacity ? "控除" : "対応可"}
        </Badge>
      ),
    },
    {
      id: "notes",
      accessorFn: (row) => row.note,
      header: () => <span>備考</span>,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
          {row.original.note || "-"}
        </span>
      ),
    },
  ], [
    selectedEmployeeIds, filterOptions.employees, employeePopoverOpen,
    selectedGroupIds, groupOptions, selectedGroupValues, groupPopoverOpen,
    selectedDutyTypeIds, dutyTypeOptions, selectedDutyTypeValues, dutyTypePopoverOpen,
    reducesCapacityFilter,
    handleEmployeeIdsConfirm, handleEmployeeIdsClear,
    handleGroupConfirm, handleGroupClear,
    handleDutyTypeConfirm, handleDutyTypeClear,
    handleReducesCapacityChange,
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
    data: allData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    state: { sorting },
    onSortingChange: handleSortingChange,
  })

  // --- Infinite scroll with IntersectionObserver ---
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || nextCursor === null) return
    setIsLoadingMore(true)
    try {
      const [y, m, d] = date.split("-").map(Number)
      const result = await loadMoreDutyDailyData(
        {
          date: new Date(y, m - 1, d),
          employeeIds: selectedEmployeeIds.length > 0 ? selectedEmployeeIds : undefined,
          groupIds: selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
          dutyTypeIds: selectedDutyTypeIds.length > 0 ? selectedDutyTypeIds : undefined,
          reducesCapacity: reducesCapacityFilter,
          sortBy,
          sortOrder,
        },
        nextCursor
      )
      setAllData((prev) => [...prev, ...result.data])
      setTotal(result.total)
      setHasMore(result.hasMore)
      setNextCursor(result.nextCursor)
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, hasMore, nextCursor, date, selectedEmployeeIds, selectedGroupIds, selectedDutyTypeIds, reducesCapacityFilter, sortBy, sortOrder])

  const loadMoreRef = useRef(loadMore)
  useEffect(() => {
    loadMoreRef.current = loadMore
  }, [loadMore])

  useEffect(() => {
    const sentinel = sentinelRef.current
    const container = scrollContainerRef.current
    if (!sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreRef.current?.()
        }
      },
      { root: container, rootMargin: "200px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore])

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-2">
        {total}件の業務割当
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
                  className={cn(isAuthenticated && "cursor-pointer")}
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

        {/* Sentinel + loading indicator */}
        {allData.length > 0 && hasMore && (
          <div ref={sentinelRef} className="flex items-center justify-center py-4">
            {isLoadingMore && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </div>
        )}

        {/* Count display */}
        {total > 0 && allData.length > 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground border-t">
            {allData.length} / 全{total}件 表示中
            {hasMore && !isLoadingMore && " -- スクロールで続きを読み込み"}
          </div>
        )}
      </div>

      {isAuthenticated && (
        <DutyAssignmentForm
          key={`duty-form-${editRow?.id ?? "new"}-${editRow?.employeeId}-${date}`}
          employees={employees}
          dutyTypes={dutyTypes}
          defaultDate={date}
          dutyAssignment={editRow ?? undefined}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </div>
  )
}
