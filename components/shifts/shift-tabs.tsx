"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useQueryParams } from "@/hooks/use-query-params"

export function ShiftTabs({
  activeTab,
  children,
}: {
  activeTab: string
  children: React.ReactNode
}) {
  const { setParams } = useQueryParams()

  const handleTabChange = (value: string) => {
    setParams({
      tab: value === "management" ? null : value,
      page: null,
    })
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="management">シフト管理</TabsTrigger>
        <TabsTrigger value="history">変更履歴</TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  )
}
