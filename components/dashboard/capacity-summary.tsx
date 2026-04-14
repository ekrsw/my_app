"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ColumnFilterPopover } from "@/components/common/filters/column-filter-popover"
import { CheckboxListFilter } from "@/components/common/filters/checkbox-list-filter"
import {
  calculateFilteredCapacity,
  extractFilterOptions,
  getCapacityColor,
  getCurrentJSTTimeHHMM,
} from "@/lib/capacity-utils"
import type { ShiftWithDetails, CapacityFilter } from "@/lib/capacity-utils"

type DutyForCapacity = {
  employeeId: string
  startTime: Date | string
  endTime: Date | string
  reducesCapacity: boolean
}

type Props = {
  shifts: ShiftWithDetails[]
  duties: DutyForCapacity[]
  roleTypes: readonly [string, string]
}

const COLOR_STYLES = {
  green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
} as const

export function CapacitySummary({ shifts, duties, roleTypes }: Props) {
  const [currentTime, setCurrentTime] = useState(getCurrentJSTTimeHHMM)
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([])
  const [selectedRoleNames, setSelectedRoleNames] = useState<Record<string, string[]>>({})
  const [groupFilterOpen, setGroupFilterOpen] = useState(false)
  const [roleFilterOpen, setRoleFilterOpen] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentJSTTimeHHMM())
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  const filterOptions = useMemo(
    () => extractFilterOptions(shifts, currentTime),
    [shifts, currentTime]
  )

  const filter: CapacityFilter | undefined = useMemo(() => {
    const hasGroup = selectedGroupIds.length > 0
    const hasRole = Object.values(selectedRoleNames).some((v) => v.length > 0)
    if (!hasGroup && !hasRole) return undefined
    return {
      groupIds: hasGroup ? selectedGroupIds : undefined,
      roleNames: hasRole ? selectedRoleNames : undefined,
    }
  }, [selectedGroupIds, selectedRoleNames])

  const isFiltered = !!filter
  const capacity = useMemo(
    () => calculateFilteredCapacity(shifts, duties, currentTime, filter, "SV"),
    [shifts, duties, currentTime, filter]
  )
  const { total, onDuty, onLunch, available, svTotal, svAvailable } = capacity
  const color = getCapacityColor(available)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            現在の対応可能状況
            {isFiltered && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">(フィルター中)</span>
            )}
          </CardTitle>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* グループフィルター */}
          <ColumnFilterPopover
            label="グループ"
            isActive={selectedGroupIds.length > 0}
            activeCount={selectedGroupIds.length}
            open={groupFilterOpen}
            onOpenChange={setGroupFilterOpen}
          >
            <CheckboxListFilter
              options={filterOptions.groups.map((g) => ({
                value: String(g.id),
                label: g.name,
              }))}
              selectedValues={selectedGroupIds.map(String)}
              onConfirm={(values) => {
                setSelectedGroupIds(values.map(Number))
                setGroupFilterOpen(false)
              }}
              onClear={() => {
                setSelectedGroupIds([])
                setGroupFilterOpen(false)
              }}
              popoverOpen={groupFilterOpen}
            />
          </ColumnFilterPopover>

          {/* ロールフィルター（roleType ごと） */}
          {[roleTypes[0], roleTypes[1]].map((rt) => {
            const names = filterOptions.roles[rt]
            if (!names || names.length === 0) return null
            const selected = selectedRoleNames[rt] ?? []
            const open = roleFilterOpen[rt] ?? false
            return (
              <ColumnFilterPopover
                key={rt}
                label={rt}
                isActive={selected.length > 0}
                activeCount={selected.length}
                open={open}
                onOpenChange={(o) => setRoleFilterOpen((prev) => ({ ...prev, [rt]: o }))}
              >
                <CheckboxListFilter
                  options={names.map((n) => ({ value: n, label: n }))}
                  selectedValues={selected}
                  onConfirm={(values) => {
                    setSelectedRoleNames((prev) => ({ ...prev, [rt]: values }))
                    setRoleFilterOpen((prev) => ({ ...prev, [rt]: false }))
                  }}
                  onClear={() => {
                    setSelectedRoleNames((prev) => ({ ...prev, [rt]: [] }))
                    setRoleFilterOpen((prev) => ({ ...prev, [rt]: false }))
                  }}
                  popoverOpen={open}
                />
              </ColumnFilterPopover>
            )
          })}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{total}</div>
            <div className="text-xs text-muted-foreground">
              出勤<span className="ml-1">(SV: {svTotal})</span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{onLunch}</div>
            <div className="text-xs text-muted-foreground">昼休憩</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{onDuty}</div>
            <div className="text-xs text-muted-foreground">他業務</div>
          </div>
          <div className={cn("rounded-lg px-4 py-2 text-center", COLOR_STYLES[color])}>
            <div className="text-2xl font-bold">{available}</div>
            <div className="text-xs">
              対応可能<span className="ml-1">(SV: {svAvailable})</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
