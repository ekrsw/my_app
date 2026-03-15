"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmployeeBasicInfoTab } from "@/components/employees/employee-basic-info-tab"
import { EmployeeGroupsTab } from "@/components/employees/employee-groups-tab"
import { EmployeeRolesTab } from "@/components/employees/employee-roles-tab"
import { EmployeePositionsTab } from "@/components/employees/employee-positions-tab"
import type { EmployeeWithDetails } from "@/types/employees"
import type { FunctionRole, Position } from "@/app/generated/prisma/client"

type Group = { id: number; name: string }

type Props = {
  employee: EmployeeWithDetails
  groups: Group[]
  allRoles: FunctionRole[]
  allPositions: Position[]
  isAuthenticated?: boolean
}

export function EmployeeDetailTabs({ employee, groups, allRoles, allPositions, isAuthenticated }: Props) {
  const [activeTab, setActiveTab] = useState("basic")

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="basic">基本情報</TabsTrigger>
        <TabsTrigger value="groups">所属</TabsTrigger>
        <TabsTrigger value="roles">ロール</TabsTrigger>
        <TabsTrigger value="positions">役職</TabsTrigger>
      </TabsList>

      <TabsContent value="basic">
        <EmployeeBasicInfoTab employee={employee} />
      </TabsContent>

      <TabsContent value="groups">
        <EmployeeGroupsTab employee={employee} groups={groups} />
      </TabsContent>

      <TabsContent value="roles">
        <EmployeeRolesTab employee={employee} allRoles={allRoles} />
      </TabsContent>

      <TabsContent value="positions">
        <EmployeePositionsTab employee={employee} allPositions={allPositions} />
      </TabsContent>
    </Tabs>
  )
}
