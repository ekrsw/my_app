"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Plus, Pencil, X, Check } from "lucide-react"
import { formatDate, formatDateForInput } from "@/lib/date-utils"
import {
  addEmployeeGroup,
  updateEmployeeGroup,
  removeEmployeeGroup,
} from "@/lib/actions/employee-actions"
import { EmployeeGroupHistorySection } from "@/components/employees/employee-group-history-section"
import { toast } from "sonner"
import type { EmployeeWithDetails } from "@/types/employees"

type Group = { id: number; name: string }

type Props = {
  employee: EmployeeWithDetails
  groups: Group[]
  isAuthenticated?: boolean
}

export function EmployeeGroupsTab({ employee, groups, isAuthenticated }: Props) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [newGroupId, setNewGroupId] = useState("")
  const [newStartDate, setNewStartDate] = useState("")
  const [newEndDate, setNewEndDate] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editStartDate, setEditStartDate] = useState("")
  const [editEndDate, setEditEndDate] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  const activeGroups = employee.groups.filter((g) => !g.endDate)
  const activeGroupIds = new Set(activeGroups.map((g) => g.groupId))
  const availableGroups = groups.filter((g) => !activeGroupIds.has(g.id))

  async function handleAdd() {
    if (!newGroupId) return
    setAddLoading(true)
    const result = await addEmployeeGroup({
      employeeId: employee.id,
      groupId: Number(newGroupId),
      startDate: newStartDate || null,
      endDate: newEndDate || null,
    })
    setAddLoading(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("グループを追加しました")
      setShowAddForm(false)
      setNewGroupId("")
      setNewStartDate("")
      setNewEndDate("")
    }
  }

  function startEdit(eg: { id: number; startDate: Date | null; endDate: Date | null }) {
    setEditingId(eg.id)
    setEditStartDate(formatDateForInput(eg.startDate))
    setEditEndDate(formatDateForInput(eg.endDate))
  }

  async function handleEditSave(id: number) {
    setActionLoading(true)
    const result = await updateEmployeeGroup(id, {
      startDate: editStartDate || null,
      endDate: editEndDate || null,
    })
    setActionLoading(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("グループ情報を更新しました")
      setEditingId(null)
    }
  }

  async function handleRemove(id: number) {
    setActionLoading(true)
    const result = await removeEmployeeGroup(id)
    setActionLoading(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("グループを解除しました")
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          {/* Add form */}
          {isAuthenticated && (showAddForm ? (
            <div className="mb-4 rounded-md border p-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-sm">グループ</Label>
                <Select value={newGroupId} onValueChange={setNewGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="グループを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id.toString()}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">開始日</Label>
                  <Input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">終了日</Label>
                  <Input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                  キャンセル
                </Button>
                <Button size="sm" onClick={handleAdd} disabled={!newGroupId || addLoading}>
                  {addLoading ? "保存中..." : "保存"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
                <Plus className="mr-1 h-4 w-4" />
                グループを追加
              </Button>
            </div>
          ))}

          {/* Table */}
          {activeGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">所属グループがありません</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>グループ名</TableHead>
                    <TableHead>開始日</TableHead>
                    <TableHead>終了日</TableHead>
                    {isAuthenticated && <TableHead className="w-24">操作</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeGroups.map((eg) => (
                    <TableRow key={eg.id}>
                      <TableCell className="font-medium">{eg.group.name}</TableCell>
                      {isAuthenticated && editingId === eg.id ? (
                        <>
                          <TableCell>
                            <Input
                              type="date"
                              value={editStartDate}
                              onChange={(e) => setEditStartDate(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={editEndDate}
                              onChange={(e) => setEditEndDate(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEditSave(eg.id)}
                                disabled={actionLoading}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setEditingId(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>{formatDate(eg.startDate)}</TableCell>
                          <TableCell>{formatDate(eg.endDate)}</TableCell>
                          {isAuthenticated && (
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => startEdit(eg)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>グループの解除</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {eg.group.name}から解除してもよろしいですか？終了日が本日に設定されます。
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleRemove(eg.id)}>
                                        解除
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          )}
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <EmployeeGroupHistorySection groupHistory={employee.groupHistory} />
    </div>
  )
}
