"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pencil } from "lucide-react"
import { formatDate, formatDateForInput } from "@/lib/date-utils"
import { updateEmployee } from "@/lib/actions/employee-actions"
import { EmployeeDeleteButton } from "@/components/employees/employee-form"
import { toast } from "sonner"
import type { EmployeeWithDetails } from "@/types/employees"

type Props = {
  employee: EmployeeWithDetails
  isAuthenticated?: boolean
}

export function EmployeeBasicInfoTab({ employee, isAuthenticated }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(employee.name)
  const [nameKana, setNameKana] = useState(employee.nameKana ?? "")
  const [hireDate, setHireDate] = useState(formatDateForInput(employee.hireDate))
  const [terminationDate, setTerminationDate] = useState(formatDateForInput(employee.terminationDate))

  const isActive = !employee.terminationDate || employee.terminationDate >= new Date()
  const currentGroups = employee.groups.filter((g) => !g.endDate)
  const currentRoles = employee.functionRoles.filter((r) => !r.endDate)
  const currentPositions = employee.positions.filter((p) => !p.endDate)

  function handleCancel() {
    setName(employee.name)
    setNameKana(employee.nameKana ?? "")
    setHireDate(formatDateForInput(employee.hireDate))
    setTerminationDate(formatDateForInput(employee.terminationDate))
    setIsEditing(false)
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("氏名は必須です")
      return
    }
    setLoading(true)
    const formData = new FormData()
    formData.set("name", name.trim())
    formData.set("nameKana", nameKana.trim())
    formData.set("hireDate", hireDate)
    formData.set("terminationDate", terminationDate)

    const result = await updateEmployee(employee.id, formData)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("基本情報を更新しました")
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-hireDate">入社日</Label>
              <Input
                id="edit-hireDate"
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
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
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleCancel} disabled={loading}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "保存中..." : "保存"}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "在籍中" : "退職済"}
          </Badge>
          {isAuthenticated && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="mr-1 h-4 w-4" />
                編集
              </Button>
              <EmployeeDeleteButton id={employee.id} />
            </div>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div className="col-span-2">
            <dt className="text-muted-foreground">従業員ID</dt>
            <dd className="font-mono text-xs">{employee.id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">氏名</dt>
            <dd className="font-medium">{employee.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">カナ</dt>
            <dd className="font-medium">{employee.nameKana ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">入社日</dt>
            <dd className="font-medium">{formatDate(employee.hireDate)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">退職日</dt>
            <dd className="font-medium">{formatDate(employee.terminationDate)}</dd>
          </div>
        </dl>

        <div className="mt-4 space-y-3">
          <div>
            <dt className="text-sm text-muted-foreground mb-1">所属グループ</dt>
            <dd>
              {currentGroups.length === 0 ? (
                <span className="text-sm text-muted-foreground">-</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {currentGroups.map((g) => (
                    <Badge key={g.id} variant="outline">{g.group.name}</Badge>
                  ))}
                </div>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground mb-1">ロール</dt>
            <dd>
              {currentRoles.length === 0 ? (
                <span className="text-sm text-muted-foreground">-</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {currentRoles.map((r) => (
                    <Badge key={r.id} variant="outline">
                      {r.functionRole?.roleName ?? "-"}
                      {r.isPrimary && <span className="ml-1 text-xs text-primary">(主)</span>}
                    </Badge>
                  ))}
                </div>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground mb-1">役職</dt>
            <dd>
              {currentPositions.length === 0 ? (
                <span className="text-sm text-muted-foreground">-</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {currentPositions.map((p) => (
                    <Badge key={p.id} variant="outline">{p.position.positionName}</Badge>
                  ))}
                </div>
              )}
            </dd>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
