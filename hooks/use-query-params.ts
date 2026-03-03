"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useCallback } from "react"

export function useQueryParams() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const setParams = useCallback(
    (updates: Record<string, string | number | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "") {
          params.delete(key)
        } else {
          params.set(key, String(value))
        }
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  const getParam = useCallback(
    (key: string, defaultValue?: string) => {
      return searchParams.get(key) ?? defaultValue ?? ""
    },
    [searchParams]
  )

  const getNumParam = useCallback(
    (key: string, defaultValue: number) => {
      const val = searchParams.get(key)
      if (!val) return defaultValue
      const num = parseInt(val, 10)
      return isNaN(num) ? defaultValue : num
    },
    [searchParams]
  )

  return { setParams, getParam, getNumParam, searchParams }
}
