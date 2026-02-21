import type {
  Employee,
  Group,
  EmployeeFunctionRole,
  FunctionRole,
  EmployeeNameHistory,
  EmployeeGroupHistory,
  EmployeeFunctionRoleHistory,
} from "@/app/generated/prisma/client"

export type EmployeeWithGroup = Employee & {
  group: Group | null
}

export type EmployeeGroupHistoryEntry = EmployeeGroupHistory & {
  group: Group | null
}

export type EmployeeFunctionRoleHistoryEntry = EmployeeFunctionRoleHistory

export type EmployeeWithDetails = Employee & {
  group: Group | null
  functionRoles: (EmployeeFunctionRole & {
    functionRole: FunctionRole | null
  })[]
  nameHistory: EmployeeNameHistory[]
  groupHistory: EmployeeGroupHistoryEntry[]
  roleHistory: EmployeeFunctionRoleHistoryEntry[]
}

export type EmployeeFilterParams = {
  search?: string
  groupId?: number
  activeOnly?: boolean
}
