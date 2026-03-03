"use client"

import { useState, useMemo, useCallback } from "react"
import type { ShiftCalendarData } from "@/types/shifts"

type GroupedData = {
  groupId: number | null
  groupName: string | null
  employees: ShiftCalendarData[]
  collapsed: boolean
}

export function useShiftCalendar(data: ShiftCalendarData[]) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number | null>>(new Set())
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())

  const groupedData = useMemo(() => {
    const groups = new Map<number | null, GroupedData>()
    for (const emp of data) {
      const key = emp.groupId
      if (!groups.has(key)) {
        groups.set(key, {
          groupId: key,
          groupName: emp.groupName,
          employees: [],
          collapsed: collapsedGroups.has(key),
        })
      }
      groups.get(key)!.employees.push(emp)
    }
    return Array.from(groups.values())
  }, [data, collapsedGroups])

  const toggleGroup = useCallback((groupId: number | null) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }, [])

  const toggleCell = useCallback((cellKey: string) => {
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

  const clearSelection = useCallback(() => {
    setSelectedCells(new Set())
  }, [])

  return {
    groupedData,
    selectedCells,
    toggleGroup,
    toggleCell,
    clearSelection,
  }
}
