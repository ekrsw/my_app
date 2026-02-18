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
import type { FunctionRole } from "@/app/generated/prisma/client"

type EmployeeRoleFormProps = {
  employeeId: number
  roles: FunctionRole[]
}

export function EmployeeRoleForm({ employeeId, roles }: EmployeeRoleFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [functionRoleId, setFunctionRoleId] = useState("")
  const [isPrimary, setIsPrimary] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!functionRoleId) {
      toast.error("役割を選択してください")
      return
    }
    const form = new FormData(e.currentTarget)
    setLoading(true)
    const result = await assignRole({
      employeeId,
      functionRoleId: Number(functionRoleId),
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
      setFunctionRoleId("")
      setIsPrimary(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-1 h-4 w-4" />
          役割を追加
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>役割の割当</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>役割 *</Label>
            <Select value={functionRoleId} onValueChange={setFunctionRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="役割を選択" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id.toString()}>
                    {role.roleName}
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
