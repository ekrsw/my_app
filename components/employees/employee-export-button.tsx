"use client"

import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"
import { useSearchParams } from "next/navigation"

export function EmployeeExportButton() {
  const searchParams = useSearchParams()

  const handleExport = () => {
    const params = new URLSearchParams()
    const groupId = searchParams.get("groupId")
    const activeOnly = searchParams.get("activeOnly")

    if (groupId) params.set("groupId", groupId)
    if (activeOnly) params.set("activeOnly", activeOnly)

    window.open(`/api/employees/export?${params}`, "_blank")
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Upload className="h-4 w-4 mr-1" />
      CSV
    </Button>
  )
}
