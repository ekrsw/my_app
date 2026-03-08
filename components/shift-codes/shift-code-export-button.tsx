"use client"

import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"

export function ShiftCodeExportButton() {
  const handleExport = () => {
    window.open("/api/shift-codes/export", "_blank")
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Upload className="h-4 w-4 mr-1" />
      CSV
    </Button>
  )
}
