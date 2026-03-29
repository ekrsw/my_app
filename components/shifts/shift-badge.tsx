import { Badge } from "@/components/ui/badge"
import { getShiftCodeInfo, type ShiftCodeInfo } from "@/lib/constants"

export function ShiftBadge({ code, shiftCodeMap }: { code: string | null; shiftCodeMap?: Record<string, ShiftCodeInfo> }) {
  const info = getShiftCodeInfo(code, shiftCodeMap)
  return (
    <Badge className={`${info.bgColor} ${info.color} border-0 text-xs font-medium`}>
      {info.label}
    </Badge>
  )
}
