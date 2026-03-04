"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useQueryParams } from "@/hooks/use-query-params"
import { RoleTable } from "@/components/roles/role-table"
import type { FunctionRoleWithEmployeeCount } from "@/types"

interface RoleTabsProps {
  activeTab: string
  roles: FunctionRoleWithEmployeeCount[]
}

export function RoleTabs({ activeTab, roles }: RoleTabsProps) {
  const { setParams } = useQueryParams()

  const handleTabChange = (value: string) => {
    setParams({
      tab: value === "all" ? null : value,
    })
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="all">すべて</TabsTrigger>
        <TabsTrigger value="function">業務</TabsTrigger>
        <TabsTrigger value="authority">監督</TabsTrigger>
      </TabsList>
      <TabsContent value={activeTab} className="mt-4">
        <RoleTable data={roles} />
      </TabsContent>
    </Tabs>
  )
}
