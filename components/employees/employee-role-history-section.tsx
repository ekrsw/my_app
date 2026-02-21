"use client"

import { useState } from "react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ChevronDown } from "lucide-react"
import { formatDate } from "@/lib/date-utils"
import { ROLE_TYPE_LABELS } from "@/lib/constants"
import type { EmployeeFunctionRoleHistoryEntry } from "@/types/employees"

const CHANGE_TYPE_LABELS: Record<string, string> = {
  INSERT: "追加",
  UPDATE: "変更",
  DELETE: "削除",
}

const CHANGE_TYPE_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  INSERT: "default",
  UPDATE: "outline",
  DELETE: "destructive",
}

type Props = {
  roleHistory: EmployeeFunctionRoleHistoryEntry[]
}

export function EmployeeRoleHistorySection({ roleHistory }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 font-semibold hover:bg-muted/50 transition-colors">
        <span>役割履歴 ({roleHistory.length})</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        {roleHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 px-4">
            役割の変更履歴がありません
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>変更日時</TableHead>
                  <TableHead>変更種別</TableHead>
                  <TableHead>分類</TableHead>
                  <TableHead>主担当</TableHead>
                  <TableHead>開始日</TableHead>
                  <TableHead>終了日</TableHead>
                  <TableHead>バージョン</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roleHistory.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>
                      {formatDate(h.changedAt, "yyyy/MM/dd HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={CHANGE_TYPE_VARIANTS[h.changeType] ?? "outline"}>
                        {CHANGE_TYPE_LABELS[h.changeType] ?? h.changeType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {h.roleType ? (
                        <Badge variant="outline">
                          {ROLE_TYPE_LABELS[h.roleType] ?? h.roleType}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {h.isPrimary ? "主担当" : "-"}
                    </TableCell>
                    <TableCell>{formatDate(h.startDate)}</TableCell>
                    <TableCell>{formatDate(h.endDate)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {h.version}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
