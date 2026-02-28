"use client"

import { useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ShiftCalendar } from "./shift-calendar"
import { ShiftTable } from "./shift-table"
import { ShiftFilters } from "./shift-filters"
import { ShiftViewToggle } from "./shift-view-toggle"
import { ShiftForm } from "./shift-form"
import { ShiftBulkEditor } from "./shift-bulk-editor"
import { Upload, Pencil } from "lucide-react"
import { ShiftImportDialog } from "./shift-import-dialog"
import { SHIFT_CODE_MAP, type ShiftCodeInfo } from "@/lib/constants"
import type { ShiftCalendarData, ShiftWithEmployee } from "@/types/shifts"
import type { Shift } from "@/app/generated/prisma/client"

type Group = { id: number; name: string }

type ActiveShiftCode = {
  id: number
  code: string
  defaultStartTime: Date | null
  defaultEndTime: Date | null
  defaultIsHoliday: boolean
  defaultIsPaidLeave: boolean
  isActive: boolean | null
  sortOrder: number
}

type ShiftPageClientProps = {
  calendarData: ShiftCalendarData[]
  tableData: ShiftWithEmployee[]
  tablePageCount: number
  tablePage: number
  groups: Group[]
  year: number
  month: number
  shiftCodes: ActiveShiftCode[]
}

export function ShiftPageClient({
  calendarData,
  tableData,
  tablePageCount,
  tablePage,
  groups,
  year,
  month,
  shiftCodes,
}: ShiftPageClientProps) {
  const [view, setView] = useState<"calendar" | "table">("calendar")
  const [editOpen, setEditOpen] = useState(false)
  const [editShift, setEditShift] = useState<Shift | undefined>()
  const [editEmployeeId, setEditEmployeeId] = useState<number | undefined>()
  const [editDate, setEditDate] = useState<string | undefined>()
  const [bulkOpen, setBulkOpen] = useState(false)
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())

  // DB のシフトコードから shiftCodeMap を構築（カレンダー表示用）
  const shiftCodeMap = useMemo(() => {
    const map: Record<string, ShiftCodeInfo> = {}
    for (const sc of shiftCodes) {
      // ハードコードの色がある場合はそれを使い、なければデフォルトの色
      const hardcoded = SHIFT_CODE_MAP[sc.code]
      map[sc.code] = {
        label: hardcoded?.label ?? sc.code,
        color: hardcoded?.color ?? "text-gray-800",
        bgColor: hardcoded?.bgColor ?? "bg-gray-100",
      }
    }
    return map
  }, [shiftCodes])

  const selectedShiftIds = useMemo(() => {
    const ids: number[] = []
    for (const cellKey of selectedCells) {
      const [empIdStr, date] = cellKey.split(":")
      const empId = Number(empIdStr)
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
    (employeeId: number, date: string, shiftId?: number) => {
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
      } else {
        setEditShift(undefined)
      }
      setEditOpen(true)
    },
    [calendarData]
  )

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
    window.open(`/api/shifts/export?${params}`, "_blank")
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ShiftFilters groups={groups} year={year} month={month} />
        <div className="flex items-center gap-2">
          {selectedCells.size > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setBulkOpen(true)}
            >
              <Pencil className="h-4 w-4 mr-1" />
              {selectedCells.size}件を一括編集
            </Button>
          )}
          <ShiftImportDialog />
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Upload className="h-4 w-4 mr-1" />
            CSV
          </Button>
          <ShiftViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {view === "calendar" ? (
        <ShiftCalendar
          data={calendarData}
          year={year}
          month={month}
          onCellClick={handleCellClick}
          selectedCells={selectedCells}
          onCellSelect={handleCellSelect}
          shiftCodeMap={shiftCodeMap}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {tableData.length}件表示中
          </p>
          <ShiftTable data={tableData} pageCount={tablePageCount} page={tablePage} />
        </>
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
