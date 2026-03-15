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
  addEmployeePosition,
  updateEmployeePosition,
  removeEmployeePosition,
} from "@/lib/actions/employee-actions"
import { EmployeePositionHistorySection } from "@/components/employees/employee-position-history-section"
import { toast } from "sonner"
import type { EmployeeWithDetails } from "@/types/employees"
import type { Position } from "@/app/generated/prisma/client"

type Props = {
  employee: EmployeeWithDetails
  allPositions: Position[]
  isAuthenticated?: boolean
}

export function EmployeePositionsTab({ employee, allPositions, isAuthenticated }: Props) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [newPositionId, setNewPositionId] = useState("")
  const [newStartDate, setNewStartDate] = useState("")
  const [newEndDate, setNewEndDate] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editStartDate, setEditStartDate] = useState("")
  const [editEndDate, setEditEndDate] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  const activePositions = employee.positions.filter((p) => !p.endDate)
  const activePositionIds = new Set(activePositions.map((p) => p.positionId))
  const availablePositions = allPositions.filter((p) => p.isActive && !activePositionIds.has(p.id))

  async function handleAdd() {
    if (!newPositionId) return
    setAddLoading(true)
    const result = await addEmployeePosition({
      employeeId: employee.id,
      positionId: Number(newPositionId),
      startDate: newStartDate || null,
      endDate: newEndDate || null,
    })
    setAddLoading(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("役職を追加しました")
      setShowAddForm(false)
      setNewPositionId("")
      setNewStartDate("")
      setNewEndDate("")
    }
  }

  function startEdit(pos: { id: number; startDate: Date | null; endDate: Date | null }) {
    setEditingId(pos.id)
    setEditStartDate(formatDateForInput(pos.startDate))
    setEditEndDate(formatDateForInput(pos.endDate))
  }

  async function handleEditSave(id: number) {
    setActionLoading(true)
    const result = await updateEmployeePosition(id, {
      startDate: editStartDate || null,
      endDate: editEndDate || null,
    })
    setActionLoading(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("役職情報を更新しました")
      setEditingId(null)
    }
  }

  async function handleRemove(id: number) {
    setActionLoading(true)
    const result = await removeEmployeePosition(id)
    setActionLoading(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("役職を解除しました")
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
                <Label className="text-sm">役職</Label>
                <Select value={newPositionId} onValueChange={setNewPositionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="役職を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePositions.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.positionName}
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
                <Button size="sm" onClick={handleAdd} disabled={!newPositionId || addLoading}>
                  {addLoading ? "保存中..." : "保存"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
                <Plus className="mr-1 h-4 w-4" />
                役職を追加
              </Button>
            </div>
          ))}

          {/* Table */}
          {activePositions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">割り当てられた役職がありません</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>役職名</TableHead>
                    <TableHead>開始日</TableHead>
                    <TableHead>終了日</TableHead>
                    {isAuthenticated && <TableHead className="w-24">操作</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activePositions.map((pos) => (
                    <TableRow key={pos.id}>
                      <TableCell className="font-medium">{pos.position.positionName}</TableCell>
                      {isAuthenticated && editingId === pos.id ? (
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
                                onClick={() => handleEditSave(pos.id)}
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
                          <TableCell>{formatDate(pos.startDate)}</TableCell>
                          <TableCell>{formatDate(pos.endDate)}</TableCell>
                          {isAuthenticated && (
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => startEdit(pos)}
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
                                      <AlertDialogTitle>役職の解除</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {pos.position.positionName}を解除してもよろしいですか？終了日が本日に設定されます。
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleRemove(pos.id)}>
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

      <EmployeePositionHistorySection positionHistory={employee.positionHistory} />
    </div>
  )
}
