"use client"

import { useState, useCallback } from "react"

export function useShiftCalendar() {
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())

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
    selectedCells,
    toggleCell,
    clearSelection,
  }
}
