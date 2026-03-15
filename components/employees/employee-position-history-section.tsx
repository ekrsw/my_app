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
import { PositionHistoryDetailDialog } from "@/components/employees/position-history-detail-dialog"
import type { EmployeePositionHistoryEntry } from "@/types/employees"
import type { Position } from "@/app/generated/prisma/client"

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
  positionHistory: EmployeePositionHistoryEntry[]
  allPositions: Position[]
  isAuthenticated?: boolean
}

export function EmployeePositionHistorySection({ positionHistory, allPositions, isAuthenticated }: Props) {
  const [open, setOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<EmployeePositionHistoryEntry | null>(null)

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 font-semibold hover:bg-muted/50 transition-colors">
          <span>役職履歴 ({positionHistory.length})</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          {positionHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 px-4">
              役職の変更履歴がありません
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>変更日時</TableHead>
                    <TableHead>変更種別</TableHead>
                    <TableHead>開始日</TableHead>
                    <TableHead>終了日</TableHead>
                    <TableHead>バージョン</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positionHistory.map((h) => (
                    <TableRow
                      key={h.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedEntry(h)}
                    >
                      <TableCell>
                        {formatDate(h.changedAt, "yyyy/MM/dd HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={CHANGE_TYPE_VARIANTS[h.changeType] ?? "outline"}>
                          {CHANGE_TYPE_LABELS[h.changeType] ?? h.changeType}
                        </Badge>
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

      {selectedEntry && (
        <PositionHistoryDetailDialog
          open={!!selectedEntry}
          onOpenChange={(v) => { if (!v) setSelectedEntry(null) }}
          entry={selectedEntry}
          allPositions={allPositions}
          isAuthenticated={isAuthenticated}
        />
      )}
    </>
  )
}
