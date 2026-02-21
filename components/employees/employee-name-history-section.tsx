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
import type { EmployeeNameHistory } from "@/app/generated/prisma/client"

type Props = {
  nameHistory: EmployeeNameHistory[]
}

export function EmployeeNameHistorySection({ nameHistory }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 font-semibold hover:bg-muted/50 transition-colors">
        <span>氏名履歴 ({nameHistory.length})</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        {nameHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 px-4">
            氏名変更履歴がありません
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>氏名</TableHead>
                  <TableHead>カナ</TableHead>
                  <TableHead>有効開始日</TableHead>
                  <TableHead>有効終了日</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>備考</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nameHistory.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {h.nameKana ?? "-"}
                    </TableCell>
                    <TableCell>{formatDate(h.validFrom)}</TableCell>
                    <TableCell>{formatDate(h.validTo)}</TableCell>
                    <TableCell>
                      <Badge variant={h.isCurrent ? "default" : "secondary"}>
                        {h.isCurrent ? "現行" : "過去"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {h.note ?? "-"}
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
