"use client"

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  SortingState,
  getSortedRowModel,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  // Server-side pagination
  pageCount?: number
  page?: number
  onPageChange?: (page: number) => void
  // Client-side pagination
  clientPagination?: boolean
  pageSize?: number
  // Row click handler
  onRowClick?: (row: TData) => void
  // Server-side sorting
  serverSort?: {
    sortBy: string
    sortOrder: "asc" | "desc"
    onSortChange: (sortBy: string, sortOrder: "asc" | "desc") => void
  }
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageCount,
  page = 1,
  onPageChange,
  clientPagination = false,
  pageSize = 20,
  onRowClick,
  serverSort,
}: DataTableProps<TData, TValue>) {
  // サーバーサイドソート時は serverSort の値から初期値を設定
  const [sorting, setSorting] = useState<SortingState>(
    serverSort
      ? [{ id: serverSort.sortBy, desc: serverSort.sortOrder === "desc" }]
      : []
  )

  const handleSortingChange = useCallback(
    (updater: SortingState | ((prev: SortingState) => SortingState)) => {
      const newSorting = typeof updater === "function" ? updater(sorting) : updater
      setSorting(newSorting)
      if (serverSort) {
        if (newSorting.length > 0) {
          serverSort.onSortChange(newSorting[0].id, newSorting[0].desc ? "desc" : "asc")
        } else {
          serverSort.onSortChange("employeeName", "asc")
        }
      }
    },
    [serverSort, sorting]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(serverSort
      ? { manualSorting: true }
      : { getSortedRowModel: getSortedRowModel() }),
    ...(clientPagination
      ? {
          getPaginationRowModel: getPaginationRowModel(),
          initialState: { pagination: { pageSize } },
        }
      : {
          manualPagination: true,
          pageCount: pageCount ?? -1,
        }),
    state: {
      sorting,
      ...(!clientPagination && {
        pagination: { pageIndex: page - 1, pageSize },
      }),
    },
    onSortingChange: handleSortingChange,
  })

  const currentPage = clientPagination
    ? table.getState().pagination.pageIndex + 1
    : page
  const totalPages = clientPagination
    ? table.getPageCount()
    : (pageCount ?? 1)

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
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
                  className={onRowClick ? "cursor-pointer" : undefined}
                  onClick={() => onRowClick?.(row.original)}
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
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-4">
          <div className="text-sm text-muted-foreground">
            {currentPage} / {totalPages} ページ
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                clientPagination
                  ? table.setPageIndex(0)
                  : onPageChange?.(1)
              }
              disabled={currentPage <= 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                clientPagination
                  ? table.previousPage()
                  : onPageChange?.(currentPage - 1)
              }
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                clientPagination
                  ? table.nextPage()
                  : onPageChange?.(currentPage + 1)
              }
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                clientPagination
                  ? table.setPageIndex(totalPages - 1)
                  : onPageChange?.(totalPages)
              }
              disabled={currentPage >= totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
