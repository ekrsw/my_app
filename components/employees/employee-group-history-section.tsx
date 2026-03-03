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
import type { EmployeeGroupHistoryEntry } from "@/types/employees"

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
  groupHistory: EmployeeGroupHistoryEntry[]
}

export function EmployeeGroupHistorySection({ groupHistory }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 font-semibold hover:bg-muted/50 transition-colors">
        <span>所属履歴 ({groupHistory.length})</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        {groupHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 px-4">
            所属グループの変更履歴がありません
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>変更日時</TableHead>
                  <TableHead>変更種別</TableHead>
                  <TableHead>グループ</TableHead>
                  <TableHead>開始日</TableHead>
                  <TableHead>終了日</TableHead>
                  <TableHead>バージョン</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupHistory.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>
                      {formatDate(h.changedAt, "yyyy/MM/dd HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={CHANGE_TYPE_VARIANTS[h.changeType] ?? "outline"}>
                        {CHANGE_TYPE_LABELS[h.changeType] ?? h.changeType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {h.group?.name ?? "未所属"}
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
