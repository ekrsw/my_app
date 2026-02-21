import type {
  Employee,
  Group,
  EmployeeFunctionRole,
  FunctionRole,
  EmployeeNameHistory,
  EmployeeGroupHistory,
  EmployeeFunctionRoleHistory,
  EmployeePosition,
  Position,
  EmployeePositionHistory,
} from "@/app/generated/prisma/client"

export type EmployeeWithGroup = Employee & {
  group: Group | null
}

export type EmployeeGroupHistoryEntry = EmployeeGroupHistory & {
  group: Group | null
}

export type EmployeeFunctionRoleHistoryEntry = EmployeeFunctionRoleHistory

export type EmployeePositionWithPosition = EmployeePosition & {
  position: Position
}

export type EmployeePositionHistoryEntry = EmployeePositionHistory

export type EmployeeWithDetails = Employee & {
  group: Group | null
  functionRoles: (EmployeeFunctionRole & {
    functionRole: FunctionRole | null
  })[]
  positions: EmployeePositionWithPosition[]
  nameHistory: EmployeeNameHistory[]
  groupHistory: EmployeeGroupHistoryEntry[]
  roleHistory: EmployeeFunctionRoleHistoryEntry[]
  positionHistory: EmployeePositionHistoryEntry[]
}

export type EmployeeFilterParams = {
  search?: string
  groupId?: number
  activeOnly?: boolean
}
