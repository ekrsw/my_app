"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
import { assignRole, updateEmployeeRole, unassignRole } from "@/lib/actions/role-actions"
import { EmployeeRoleHistorySection } from "@/components/employees/employee-role-history-section"
import { toast } from "sonner"
import type { EmployeeWithDetails } from "@/types/employees"
import type { FunctionRole } from "@/app/generated/prisma/client"

type Props = {
  employee: EmployeeWithDetails
  allRoles: FunctionRole[]
}

export function EmployeeRolesTab({ employee, allRoles }: Props) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [newRoleId, setNewRoleId] = useState("")
  const [newIsPrimary, setNewIsPrimary] = useState(false)
  const [newStartDate, setNewStartDate] = useState("")
  const [newEndDate, setNewEndDate] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editIsPrimary, setEditIsPrimary] = useState(false)
  const [editStartDate, setEditStartDate] = useState("")
  const [editEndDate, setEditEndDate] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  const activeRoles = employee.functionRoles.filter((r) => !r.endDate)
  const activeRoleIds = new Set(activeRoles.map((r) => r.functionRoleId))
  const availableRoles = allRoles.filter((r) => r.isActive && !activeRoleIds.has(r.id))

  async function handleAdd() {
    if (!newRoleId) return
    setAddLoading(true)
    const result = await assignRole({
      employeeId: employee.id,
      functionRoleId: Number(newRoleId),
      isPrimary: newIsPrimary,
      startDate: newStartDate || null,
      endDate: newEndDate || null,
    })
    setAddLoading(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("ロールを割り当てました")
      setShowAddForm(false)
      setNewRoleId("")
      setNewIsPrimary(false)
      setNewStartDate("")
      setNewEndDate("")
    }
  }

  function startEdit(role: {
    id: number
    isPrimary: boolean | null
    startDate: Date | null
    endDate: Date | null
  }) {
    setEditingId(role.id)
    setEditIsPrimary(role.isPrimary ?? false)
    setEditStartDate(formatDateForInput(role.startDate))
    setEditEndDate(formatDateForInput(role.endDate))
  }

  async function handleEditSave(id: number) {
    setActionLoading(true)
    const result = await updateEmployeeRole(id, {
      isPrimary: editIsPrimary,
      startDate: editStartDate || null,
      endDate: editEndDate || null,
    })
    setActionLoading(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("ロール情報を更新しました")
      setEditingId(null)
    }
  }

  async function handleRemove(id: number) {
    setActionLoading(true)
    const result = await unassignRole(id)
    setActionLoading(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("ロールを解除しました")
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          {/* Add form */}
          {showAddForm ? (
            <div className="mb-4 rounded-md border p-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-sm">ロール</Label>
                <Select value={newRoleId} onValueChange={setNewRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="ロールを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((r) => (
                      <SelectItem key={r.id} value={r.id.toString()}>
                        {r.roleName}
                        <span className="ml-1 text-xs text-muted-foreground">({r.roleType})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="new-isPrimary"
                  checked={newIsPrimary}
                  onCheckedChange={(v) => setNewIsPrimary(v === true)}
                />
                <Label htmlFor="new-isPrimary" className="text-sm">主担当</Label>
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
                <Button size="sm" onClick={handleAdd} disabled={!newRoleId || addLoading}>
                  {addLoading ? "保存中..." : "保存"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
                <Plus className="mr-1 h-4 w-4" />
                ロールを追加
              </Button>
            </div>
          )}

          {/* Table */}
          {activeRoles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">割り当てられたロールがありません</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ロール名</TableHead>
                    <TableHead>タイプ</TableHead>
                    <TableHead>主担当</TableHead>
                    <TableHead>開始日</TableHead>
                    <TableHead>終了日</TableHead>
                    <TableHead className="w-24">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeRoles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">
                        {role.functionRole?.roleName ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{role.roleType}</Badge>
                      </TableCell>
                      {editingId === role.id ? (
                        <>
                          <TableCell>
                            <Checkbox
                              checked={editIsPrimary}
                              onCheckedChange={(v) => setEditIsPrimary(v === true)}
                            />
                          </TableCell>
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
                                onClick={() => handleEditSave(role.id)}
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
                          <TableCell>{role.isPrimary ? "主担当" : "-"}</TableCell>
                          <TableCell>{formatDate(role.startDate)}</TableCell>
                          <TableCell>{formatDate(role.endDate)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => startEdit(role)}
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
                                    <AlertDialogTitle>ロールの解除</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {role.functionRole?.roleName}を解除してもよろしいですか？終了日が本日に設定されます。
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRemove(role.id)}>
                                      解除
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
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

      <EmployeeRoleHistorySection roleHistory={employee.roleHistory} />
    </div>
  )
}
