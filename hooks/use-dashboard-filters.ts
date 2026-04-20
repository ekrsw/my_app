"use client"

import { useEffect, useRef } from "react"
import { useQueryParams } from "@/hooks/use-query-params"

const STORAGE_KEY = "dashboard-filters"
const FILTER_KEYS = [
  "groupIds",
  "unassigned",
  "employeeIds",
  "shiftCodes",
  "supervisorRoleNames",
  "businessRoleNames",
  "isRemote",
  "excludeNightShift",
  "interval",
] as const

export function useDashboardFilters() {
  const { setParams, getParam, searchParams } = useQueryParams()
  const restored = useRef(false)

  // 初回マウント時: URLパラメータが空の場合のみ localStorage から復元
  useEffect(() => {
    if (restored.current) return
    restored.current = true

    const hasAnyParam = FILTER_KEYS.some((key) => searchParams.has(key))
    if (hasAnyParam) return

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return
      const parsed = JSON.parse(saved) as Record<string, string>
      const updates: Record<string, string | null> = {}
      for (const key of FILTER_KEYS) {
        if (parsed[key]) {
          updates[key] = parsed[key]
        }
      }
      if (Object.keys(updates).length > 0) {
        setParams(updates)
      }
    } catch {
      // localStorage read failure — ignore
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // フィルター変更時: localStorage に自動保存
  useEffect(() => {
    if (!restored.current) return

    const toSave: Record<string, string> = {}
    for (const key of FILTER_KEYS) {
      const val = searchParams.get(key)
      if (val) {
        toSave[key] = val
      }
    }

    try {
      if (Object.keys(toSave).length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // localStorage write failure — ignore
    }
  }, [searchParams])

  return { setParams, getParam, searchParams }
}
