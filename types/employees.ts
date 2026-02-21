import type {
  Employee,
  Group,
  EmployeeFunctionRole,
  FunctionRole,
  EmployeeNameHistory,
  EmployeeGroupHistory,
} from "@/app/generated/prisma/client"

export type EmployeeWithGroup = Employee & {
  group: Group | null
}

export type EmployeeGroupHistoryEntry = EmployeeGroupHistory & {
  group: Group | null
}

export type EmployeeWithDetails = Employee & {
  group: Group | null
  functionRoles: (EmployeeFunctionRole & {
    functionRole: FunctionRole | null
  })[]
  nameHistory: EmployeeNameHistory[]
  groupHistory: EmployeeGroupHistoryEntry[]
}

export type EmployeeFilterParams = {
  search?: string
  groupId?: number
  activeOnly?: boolean
}
