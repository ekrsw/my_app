"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  updateEmployeeWithRoles,
  type RoleChangeItem,
} from "@/lib/actions/employee-actions"
import { ROLE_TYPE_LABELS } from "@/lib/constants"
import { formatDateForInput } from "@/lib/date-utils"
import { toast } from "sonner"
import { Pencil, Plus, Trash2 } from "lucide-react"
import type { EmployeeWithDetails } from "@/types/employees"
import type { FunctionRole } from "@/app/generated/prisma/client"

type Group = { id: number; name: string }

type RoleState = {
  id?: number
  functionRoleId: number
  roleName: string
  roleType: string
  isPrimary: boolean
  startDate: string
  endDate: string
  status: "existing" | "added" | "modified" | "removed"
}

type EmployeeEditDialogProps = {
  employee: EmployeeWithDetails
  groups: Group[]
  allRoles: FunctionRole[]
}

export function EmployeeEditDialog({
  employee,
  groups,
  allRoles,
}: EmployeeEditDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Employee basic info state
  const [name, setName] = useState(employee.name)
  const [nameKana, setNameKana] = useState(employee.nameKana ?? "")
  const [groupId, setGroupId] = useState(employee.groupId?.toString() ?? "")
  const [assignmentDate, setAssignmentDate] = useState(
    formatDateForInput(employee.assignmentDate)
  )
  const [terminationDate, setTerminationDate] = useState(
    formatDateForInput(employee.terminationDate)
  )

  // Role management state
  const [roles, setRoles] = useState<RoleState[]>(() =>
    employee.functionRoles.map((r) => ({
      id: r.id,
      functionRoleId: r.functionRoleId ?? 0,
      roleName: r.functionRole?.roleName ?? "-",
      roleType: r.roleType,
      isPrimary: r.isPrimary ?? false,
      startDate: formatDateForInput(r.startDate),
      endDate: formatDateForInput(r.endDate),
      status: "existing" as const,
    }))
  )

  // New role add state
  const [newRoleId, setNewRoleId] = useState("")

  const resetState = useCallback(() => {
    setName(employee.name)
    setNameKana(employee.nameKana ?? "")
    setGroupId(employee.groupId?.toString() ?? "")
    setAssignmentDate(formatDateForInput(employee.assignmentDate))
    setTerminationDate(formatDateForInput(employee.terminationDate))
    setRoles(
      employee.functionRoles.map((r) => ({
        id: r.id,
        functionRoleId: r.functionRoleId ?? 0,
        roleName: r.functionRole?.roleName ?? "-",
        roleType: r.roleType,
        isPrimary: r.isPrimary ?? false,
        startDate: formatDateForInput(r.startDate),
        endDate: formatDateForInput(r.endDate),
        status: "existing" as const,
      }))
    )
    setNewRoleId("")
  }, [employee])

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      resetState()
    }
    setOpen(nextOpen)
  }

  function handleAddRole() {
    if (!newRoleId) return
    const roleId = Number(newRoleId)
    const role = allRoles.find((r) => r.id === roleId)
    if (!role) return

    setRoles((prev) => [
      ...prev,
      {
        functionRoleId: role.id,
        roleName: role.roleName,
        roleType: role.roleType,
        isPrimary: false,
        startDate: new Date().toISOString().split("T")[0],
        endDate: "",
        status: "added",
      },
    ])
    setNewRoleId("")
  }

  function handleRemoveRole(index: number) {
    setRoles((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r
        if (r.status === "added") {
          // For newly added roles, just remove from list
          return { ...r, status: "removed" as const }
        }
        // For existing roles, mark as removed
        return { ...r, status: "removed" as const }
      })
    )
  }

  function handleRestoreRole(index: number) {
    setRoles((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r
        return { ...r, status: "existing" as const }
      })
    )
  }

  function handleRoleChange(
    index: number,
    field: "isPrimary" | "startDate" | "endDate",
    value: boolean | string
  ) {
    setRoles((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r
        const updated = { ...r, [field]: value }
        if (r.status === "existing") {
          updated.status = "modified"
        }
        return updated
      })
    )
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("氏名は必須です")
      return
    }

    setLoading(true)

    // Build role changes list
    const roleChanges: RoleChangeItem[] = roles
      .filter((r) => r.status !== "existing")
      .filter((r) => !(r.status === "removed" && !r.id)) // skip removed-added
      .map((r) => ({
        status: r.status === "existing" ? "modified" : r.status,
        id: r.id,
        functionRoleId: r.functionRoleId,
        isPrimary: r.isPrimary,
        startDate: r.startDate || null,
        endDate: r.endDate || null,
      }))

    const result = await updateEmployeeWithRoles(
      employee.id,
      {
        name: name.trim(),
        nameKana: nameKana.trim() || null,
        groupId: groupId ? Number(groupId) : null,
        assignmentDate: assignmentDate || null,
        terminationDate: terminationDate || null,
      },
      roleChanges
    )

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("従業員情報を更新しました")
      setOpen(false)
    }
  }

  // Filter visible roles (hide removed-added ones)
  const visibleRoles = roles.filter(
    (r) => !(r.status === "removed" && !r.id)
  )

  // Roles available to add (exclude already assigned active roles)
  const activeRoleIds = new Set(
    roles
      .filter((r) => r.status !== "removed")
      .map((r) => r.functionRoleId)
  )
  const availableRoles = allRoles.filter(
    (r) => r.isActive && !activeRoleIds.has(r.id)
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-1 h-4 w-4" />
          編集
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>従業員編集</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Section 1: Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">基本情報</h3>
            <div className="space-y-2">
              <Label htmlFor="edit-name">氏名 *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nameKana">カナ</Label>
              <Input
                id="edit-nameKana"
                value={nameKana}
                onChange={(e) => setNameKana(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>グループ</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="グループを選択" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id.toString()}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-assignmentDate">配属日</Label>
                <Input
                  id="edit-assignmentDate"
                  type="date"
                  value={assignmentDate}
                  onChange={(e) => setAssignmentDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-terminationDate">退職日</Label>
                <Input
                  id="edit-terminationDate"
                  type="date"
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 2: Role Management */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">役割管理</h3>

            {/* Current roles */}
            {visibleRoles.length > 0 && (
              <div className="space-y-3">
                {visibleRoles.map((role, index) => {
                  const originalIndex = roles.indexOf(role)
                  const isRemoved = role.status === "removed"

                  return (
                    <div
                      key={`${role.id ?? "new"}-${role.functionRoleId}-${index}`}
                      className={`rounded-md border p-3 space-y-2 ${
                        isRemoved ? "opacity-50 bg-muted" : ""
                      } ${role.status === "added" ? "border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-800" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {role.roleName}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {ROLE_TYPE_LABELS[role.roleType] ?? role.roleType}
                          </Badge>
                          {role.status === "added" && (
                            <Badge variant="default" className="text-xs">新規</Badge>
                          )}
                          {role.status === "removed" && (
                            <Badge variant="destructive" className="text-xs">解除</Badge>
                          )}
                        </div>
                        {isRemoved ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestoreRole(originalIndex)}
                          >
                            元に戻す
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveRole(originalIndex)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {!isRemoved && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">開始日</Label>
                            <Input
                              type="date"
                              value={role.startDate}
                              onChange={(e) =>
                                handleRoleChange(originalIndex, "startDate", e.target.value)
                              }
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">終了日</Label>
                            <Input
                              type="date"
                              value={role.endDate}
                              onChange={(e) =>
                                handleRoleChange(originalIndex, "endDate", e.target.value)
                              }
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="col-span-2 flex items-center gap-2">
                            <Checkbox
                              id={`primary-${originalIndex}`}
                              checked={role.isPrimary}
                              onCheckedChange={(v) =>
                                handleRoleChange(originalIndex, "isPrimary", v === true)
                              }
                            />
                            <Label htmlFor={`primary-${originalIndex}`} className="text-xs">
                              主担当
                            </Label>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add new role */}
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">役割を追加</Label>
                <Select value={newRoleId} onValueChange={setNewRoleId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="役割を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((r) => (
                      <SelectItem key={r.id} value={r.id.toString()}>
                        {r.roleName}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({ROLE_TYPE_LABELS[r.roleType] ?? r.roleType})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRole}
                disabled={!newRoleId}
                className="h-9"
              >
                <Plus className="mr-1 h-4 w-4" />
                追加
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              キャンセル
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
