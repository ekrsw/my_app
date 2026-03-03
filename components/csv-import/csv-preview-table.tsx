"use client"

import { CheckCircle2, XCircle } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type CsvPreviewTableProps = {
  headers: string[]
  rows: Array<{
    rowIndex: number
    cells: string[]
    valid: boolean
    error?: string
  }>
}

export function CsvPreviewTable({ headers, rows }: CsvPreviewTableProps) {
  const validCount = rows.filter((r) => r.valid).length
  const errorCount = rows.filter((r) => !r.valid).length

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-sm">
        <span>全{rows.length}件</span>
        <span className="text-green-600">有効: {validCount}件</span>
        {errorCount > 0 && (
          <span className="text-red-600">エラー: {errorCount}件</span>
        )}
      </div>
      <div className="overflow-auto max-h-[300px] rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">行</TableHead>
              <TableHead className="w-[32px]"></TableHead>
              {headers.map((h) => (
                <TableHead key={h} className="whitespace-nowrap px-2">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.rowIndex}
                className={row.valid ? "" : "bg-red-50 dark:bg-red-950/20"}
                title={row.valid ? undefined : row.error}
              >
                <TableCell className="text-muted-foreground text-xs">
                  {row.rowIndex}
                </TableCell>
                <TableCell className="px-1">
                  {row.valid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                  )}
                </TableCell>
                {row.cells.map((cell, ci) => (
                  <TableCell key={ci} className="text-xs whitespace-nowrap px-2">
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {errorCount > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-red-600">エラー詳細:</p>
          <div className="max-h-[100px] overflow-y-auto text-xs space-y-0.5">
            {rows
              .filter((r) => !r.valid)
              .map((row) => (
                <p key={row.rowIndex} className="text-red-600">
                  {row.rowIndex}行目: {row.error}
                </p>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
