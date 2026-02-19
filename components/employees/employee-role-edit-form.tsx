"use client"

import { useState } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { updateEmployeeRole } from "@/lib/actions/role-actions"
import { toast } from "sonner"
import { Pencil } from "lucide-react"
import { formatDateForInput } from "@/lib/date-utils"
import type { EmployeeFunctionRole, FunctionRole } from "@/app/generated/prisma/client"

type EmployeeRoleEditFormProps = {
  employeeRole: EmployeeFunctionRole & { functionRole: FunctionRole | null }
}

export function EmployeeRoleEditForm({ employeeRole }: EmployeeRoleEditFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setLoading(true)
    
    const result = await updateEmployeeRole(employeeRole.id, {
      isPrimary: form.get("isPrimary") === "true",
      startDate: (form.get("startDate") as string) || null,
      endDate: (form.get("endDate") as string) || null,
    })
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("役割を更新しました")
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{employeeRole.functionRole?.roleName ?? "役割"} の編集</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="startDate">開始日</Label>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={formatDateForInput(employeeRole.startDate)}
            />
          </div>
          <div>
            <Label htmlFor="endDate">終了日</Label>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              defaultValue={formatDateForInput(employeeRole.endDate)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isPrimary"
              name="isPrimary"
              value="true"
              defaultChecked={employeeRole.isPrimary ?? false}
            />
            <Label htmlFor="isPrimary">主担当</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "更新中..." : "更新"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
