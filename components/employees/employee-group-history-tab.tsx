import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/date-utils"
import type { EmployeeWithDetails } from "@/types/employees"

export function EmployeeGroupHistoryTab({ employee }: { employee: EmployeeWithDetails }) {
  const { groupHistory } = employee

  if (groupHistory.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">所属グループの変更履歴がありません</p>
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>変更日時</TableHead>
            <TableHead>変更前グループ</TableHead>
            <TableHead>配属日</TableHead>
            <TableHead>バージョン</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupHistory.map((h) => (
            <TableRow key={h.id}>
              <TableCell>{formatDate(h.changedAt, "yyyy/MM/dd HH:mm")}</TableCell>
              <TableCell className="font-medium">{h.group?.name ?? "未所属"}</TableCell>
              <TableCell>{formatDate(h.assignmentDate)}</TableCell>
              <TableCell className="text-muted-foreground">{h.version}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
