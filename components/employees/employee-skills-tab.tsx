"use client"

import { Fragment, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Plus, ChevronDown, ChevronRight, Trash2 } from "lucide-react"
import { formatDate } from "@/lib/date-utils"
import { assignSkillLevel, deleteEmployeeSkill } from "@/lib/actions/skill-actions"
import { SKILL_LEVEL_MIN, SKILL_LEVEL_MAX } from "@/lib/validators"
import { toast } from "sonner"
import type { EmployeeCurrentSkill, EmployeeSkillRow } from "@/lib/db/skills"
import type { Skill } from "@/app/generated/prisma/client"

type Props = {
  employeeId: string
  currentSkills: EmployeeCurrentSkill[]
  skillRows: EmployeeSkillRow[]
  allSkills: Skill[]
  isAuthenticated?: boolean
}

const LEVELS = Array.from(
  { length: SKILL_LEVEL_MAX - SKILL_LEVEL_MIN + 1 },
  (_, i) => SKILL_LEVEL_MIN + i
)

function LevelBadge({ level }: { level: number }) {
  return (
    <Badge variant="secondary" className="font-mono">
      Lv.{level}
    </Badge>
  )
}

export function EmployeeSkillsTab({
  employeeId,
  currentSkills,
  skillRows,
  allSkills,
  isAuthenticated,
}: Props) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [newSkillId, setNewSkillId] = useState("")
  const [newLevel, setNewLevel] = useState("")
  const [newStartDate, setNewStartDate] = useState("")
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [actionLoading, setActionLoading] = useState(false)

  // スキルごとの全割当行（履歴）をグルーピング
  const rowsBySkill = useMemo(() => {
    const map = new Map<number, EmployeeSkillRow[]>()
    for (const r of skillRows) {
      const list = map.get(r.skillId) ?? []
      list.push(r)
      map.set(r.skillId, list)
    }
    return map
  }, [skillRows])

  const availableSkills = allSkills.filter((s) => s.isActive)

  function toggleExpand(skillId: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(skillId)) next.delete(skillId)
      else next.add(skillId)
      return next
    })
  }

  async function handleAdd() {
    if (!newSkillId || !newLevel) return
    setAddLoading(true)
    const result = await assignSkillLevel({
      employeeId,
      skillId: Number(newSkillId),
      level: Number(newLevel),
      startDate: newStartDate || null,
    })
    setAddLoading(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("スキルレベルを付与しました")
      setShowAddForm(false)
      setNewSkillId("")
      setNewLevel("")
      setNewStartDate("")
    }
  }

  async function handleDeleteRow(id: number) {
    setActionLoading(true)
    const result = await deleteEmployeeSkill(id)
    setActionLoading(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("スキル割当を削除しました")
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Add form */}
        {isAuthenticated &&
          (showAddForm ? (
            <div className="mb-4 rounded-md border p-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-sm">スキル</Label>
                <Select value={newSkillId} onValueChange={setNewSkillId}>
                  <SelectTrigger>
                    <SelectValue placeholder="スキルを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSkills.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.skillName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">レベル</Label>
                  <Select value={newLevel} onValueChange={setNewLevel}>
                    <SelectTrigger>
                      <SelectValue placeholder="レベルを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((lv) => (
                        <SelectItem key={lv} value={lv.toString()}>
                          Lv.{lv}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">付与日（省略時は本日）</Label>
                  <Input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                レベルアップは新しい行として追記されます（過去の割当は書き換えません）。
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                  キャンセル
                </Button>
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={!newSkillId || !newLevel || addLoading}
                >
                  {addLoading ? "保存中..." : "保存"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
                <Plus className="mr-1 h-4 w-4" />
                スキルレベルを付与
              </Button>
            </div>
          ))}

        {/* Current skills table */}
        {currentSkills.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            割り当てられたスキルがありません
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>スキル名</TableHead>
                  <TableHead>現在レベル</TableHead>
                  <TableHead>付与日</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentSkills.map((skill) => {
                  const history = rowsBySkill.get(skill.skillId) ?? []
                  const isOpen = expanded.has(skill.skillId)
                  return (
                    <Fragment key={skill.skillId}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => toggleExpand(skill.skillId)}
                      >
                        <TableCell>
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{skill.skillName}</TableCell>
                        <TableCell>
                          <LevelBadge level={skill.level} />
                        </TableCell>
                        <TableCell>{formatDate(skill.startDate)}</TableCell>
                      </TableRow>

                      {isOpen && (
                        <TableRow className="bg-muted/30">
                          <TableCell />
                          <TableCell colSpan={3} className="py-2">
                            <div className="text-xs text-muted-foreground mb-2">
                              レベル推移（新しい順・{history.length}件）
                            </div>
                            <div className="space-y-1">
                              {history.map((row, idx) => (
                                <div
                                  key={row.id}
                                  className="flex items-center gap-3 text-sm"
                                >
                                  <LevelBadge level={row.level} />
                                  <span>{formatDate(row.startDate)}</span>
                                  {idx === 0 && (
                                    <Badge variant="default" className="text-xs">
                                      現在
                                    </Badge>
                                  )}
                                  {isAuthenticated && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-destructive"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>スキル割当の削除</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            {skill.skillName} の Lv.{row.level}（
                                            {formatDate(row.startDate)}）を削除します。
                                            {idx === 0 &&
                                              "現在のレベルを削除すると、直前の割当が現在のレベルに戻ります。"}
                                            この操作は取り消せません。
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeleteRow(row.id)}
                                            disabled={actionLoading}
                                          >
                                            削除
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
