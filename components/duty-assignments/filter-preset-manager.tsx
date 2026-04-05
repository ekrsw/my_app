"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useQueryParams } from "@/hooks/use-query-params"
import { BookmarkPlus, ChevronDown, Trash2 } from "lucide-react"

type Preset = {
  name: string
  params: Record<string, string>
}

type FilterPresetManagerProps = {
  viewMode: "daily" | "monthly"
  currentParams: Record<string, string>
}

const MAX_PRESETS = 10

function getStorageKey(viewMode: "daily" | "monthly"): string {
  return `duty-filter-presets-${viewMode}`
}

function loadPresets(viewMode: "daily" | "monthly"): Preset[] {
  try {
    const raw = localStorage.getItem(getStorageKey(viewMode))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as Preset[]
  } catch {
    return []
  }
}

function savePresets(viewMode: "daily" | "monthly", presets: Preset[]): void {
  try {
    localStorage.setItem(getStorageKey(viewMode), JSON.stringify(presets))
  } catch {
    // localStorage unavailable or quota exceeded
  }
}

export function FilterPresetManager({
  viewMode,
  currentParams,
}: FilterPresetManagerProps) {
  const { setParams } = useQueryParams()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [presetName, setPresetName] = useState("")
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets(viewMode))
  const [error, setError] = useState("")

  const refreshPresets = useCallback(() => {
    setPresets(loadPresets(viewMode))
  }, [viewMode])

  const handleSaveClick = useCallback(() => {
    setPresetName("")
    setError("")
    setDialogOpen(true)
    refreshPresets()
  }, [refreshPresets])

  const handleSaveConfirm = useCallback(() => {
    const trimmed = presetName.trim()
    if (!trimmed) {
      setError("プリセット名を入力してください")
      return
    }

    const current = loadPresets(viewMode)
    if (current.length >= MAX_PRESETS) {
      setError(`プリセットは最大${MAX_PRESETS}件までです`)
      return
    }

    const duplicate = current.some((p) => p.name === trimmed)
    if (duplicate) {
      setError("同じ名前のプリセットが既に存在します")
      return
    }

    const newPreset: Preset = { name: trimmed, params: { ...currentParams } }
    const updated = [...current, newPreset]
    savePresets(viewMode, updated)
    setPresets(updated)
    setDialogOpen(false)
  }, [presetName, viewMode, currentParams])

  const handleLoad = useCallback(
    (preset: Preset) => {
      setParams(preset.params)
    },
    [setParams]
  )

  const handleDelete = useCallback(
    (name: string) => {
      const current = loadPresets(viewMode)
      const updated = current.filter((p) => p.name !== name)
      savePresets(viewMode, updated)
      setPresets(updated)
    },
    [viewMode]
  )

  const hasPresets = presets.length > 0

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={handleSaveClick}
      >
        <BookmarkPlus className="mr-1 h-3.5 w-3.5" />
        保存
      </Button>

      <DropdownMenu onOpenChange={(open) => open && refreshPresets()}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs">
            プリセット
            <ChevronDown className="ml-1 h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {!hasPresets && (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              保存済みプリセットはありません
            </div>
          )}
          {presets.map((preset) => (
            <DropdownMenuItem
              key={preset.name}
              className="flex items-center justify-between"
              onSelect={(e) => {
                e.preventDefault()
                handleLoad(preset)
              }}
            >
              <span className="truncate text-sm">{preset.name}</span>
              <button
                type="button"
                className="ml-2 shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(preset.name)
                }}
                aria-label={`${preset.name}を削除`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuItem>
          ))}
          {hasPresets && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1 text-[10px] text-muted-foreground">
                {presets.length}/{MAX_PRESETS} 件
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>フィルタープリセットを保存</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="preset-name">プリセット名</Label>
              <Input
                id="preset-name"
                value={presetName}
                onChange={(e) => {
                  setPresetName(e.target.value)
                  setError("")
                }}
                placeholder="例: 月曜日の設定"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleSaveConfirm()
                  }
                }}
              />
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
            >
              キャンセル
            </Button>
            <Button size="sm" onClick={handleSaveConfirm}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
