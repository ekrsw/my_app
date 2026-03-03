import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Calendar, Monitor } from "lucide-react"

type StatsCardsProps = {
  activeEmployees: number
  totalEmployees: number
  todayShifts: number
  todayRemote: number
}

export function StatsCards({
  activeEmployees,
  totalEmployees,
  todayShifts,
  todayRemote,
}: StatsCardsProps) {
  const cards = [
    {
      title: "在籍従業員",
      value: activeEmployees,
      subtitle: `全${totalEmployees}名`,
      icon: Users,
    },
    {
      title: "本日出勤",
      value: todayShifts,
      subtitle: "出社",
      icon: Calendar,
    },
    {
      title: "テレワーク",
      value: todayRemote,
      subtitle: "本日",
      icon: Monitor,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
