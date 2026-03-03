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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { assignRole } from "@/lib/actions/role-actions"
import { toast } from "sonner"
import { UserPlus } from "lucide-react"

type Employee = { id: string; name: string }

type RoleAssignmentDialogProps = {
  roleId: number
  roleName: string
  employees: Employee[]
}

export function RoleAssignmentDialog({
  roleId,
  roleName,
  employees,
}: RoleAssignmentDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [employeeId, setEmployeeId] = useState("")
  const [isPrimary, setIsPrimary] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!employeeId) {
      toast.error("従業員を選択してください")
      return
    }
    const form = new FormData(e.currentTarget)
    setLoading(true)
    const result = await assignRole({
      employeeId,
      functionRoleId: roleId,
      isPrimary,
      startDate: (form.get("startDate") as string) || null,
      endDate: null,
    })
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("役割を割り当てました")
      setOpen(false)
      setEmployeeId("")
      setIsPrimary(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="mr-1 h-4 w-4" />
          割当
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{roleName} の割当</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>従業員 *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="従業員を選択" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id.toString()}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="startDate">開始日</Label>
            <Input id="startDate" name="startDate" type="date" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isPrimary"
              checked={isPrimary}
              onCheckedChange={(v) => setIsPrimary(v === true)}
            />
            <Label htmlFor="isPrimary">主担当</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "割当中..." : "割当"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
