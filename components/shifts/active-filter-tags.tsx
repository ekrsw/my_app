"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

export type FilterTag = {
  key: string
  label: string
  onRemove: () => void
}

type ActiveFilterTagsProps = {
  tags: FilterTag[]
  onClearAll: () => void
}

export function ActiveFilterTags({ tags, onClearAll }: ActiveFilterTagsProps) {
  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-2">
      {tags.map((tag) => (
        <Badge
          key={tag.key}
          variant="secondary"
          className="pl-2 pr-1 py-0.5 gap-1 text-xs font-normal"
        >
          {tag.label}
          <button
            type="button"
            className="ml-0.5 hover:bg-muted-foreground/20 rounded-full p-0.5"
            onClick={tag.onRemove}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-muted-foreground"
        onClick={onClearAll}
      >
        すべてクリア
      </Button>
    </div>
  )
}
