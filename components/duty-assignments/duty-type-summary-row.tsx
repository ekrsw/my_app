"use client"

import { getColorClasses, COLOR_PALETTE } from "@/lib/constants"
import { cn } from "@/lib/utils"

type DutyTypeSummaryRowProps = {
  summary: { name: string; color: string | null; count: number; sortOrder: number }[]
}

export function DutyTypeSummaryRow({ summary }: DutyTypeSummaryRowProps) {
  if (summary.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 px-1 py-2">
      {summary.map((item, idx) => {
        const colors = getColorClasses(item.color)
        const fallback = COLOR_PALETTE["gray"]

        const textClass = colors?.text ?? fallback.text
        const bgClass = colors?.bg ?? fallback.bg
        const swatchClass = colors
          ? `bg-${item.color}-500`
          : fallback.swatch

        return (
          <span
            key={idx}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              bgClass,
              textClass
            )}
          >
            <span
              className={cn("inline-block h-2 w-2 rounded-full shrink-0", swatchClass)}
              aria-hidden="true"
            />
            <span>{item.name}</span>
            <span className="font-bold">{item.count}</span>
          </span>
        )
      })}
    </div>
  )
}
