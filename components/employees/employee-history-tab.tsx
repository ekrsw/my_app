import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/date-utils"
import type { EmployeeWithDetails } from "@/types/employees"

export function EmployeeHistoryTab({ employee }: { employee: EmployeeWithDetails }) {
  const { nameHistory } = employee

  if (nameHistory.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">氏名変更履歴がありません</p>
  }

  return (
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
              <TableCell className="text-muted-foreground">{h.nameKana ?? "-"}</TableCell>
              <TableCell>{formatDate(h.validFrom)}</TableCell>
              <TableCell>{formatDate(h.validTo)}</TableCell>
              <TableCell>
                <Badge variant={h.isCurrent ? "default" : "secondary"}>
                  {h.isCurrent ? "現行" : "過去"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{h.note ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
