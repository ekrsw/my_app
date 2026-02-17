import { Badge } from "@/components/ui/badge"
import { getShiftCodeInfo } from "@/lib/constants"

export function ShiftBadge({ code }: { code: string | null }) {
  const info = getShiftCodeInfo(code)
  return (
    <Badge className={`${info.bgColor} ${info.color} border-0 text-xs font-medium`}>
      {info.label}
    </Badge>
  )
}
