"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

export function DutyTypeExportSection() {
  const [activeOnly, setActiveOnly] = useState(true)

  const handleExport = () => {
    const params = new URLSearchParams()
    params.set("activeOnly", activeOnly.toString())
    window.open(`/api/duty-types/export?${params}`, "_blank")
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">業務種別マスタCSVエクスポート</h3>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="duty-type-active-only"
          checked={activeOnly}
          onCheckedChange={(checked) => setActiveOnly(checked === true)}
        />
        <Label htmlFor="duty-type-active-only" className="text-sm font-medium">
          有効な業務種別のみ
        </Label>
      </div>

      <div>
        <Button onClick={handleExport}>
          <Download className="mr-1 h-4 w-4" />
          エクスポート
        </Button>
      </div>
    </div>
  )
}
