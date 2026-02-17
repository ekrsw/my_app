import type {
  Employee,
  Group,
  EmployeeFunctionRole,
  FunctionRole,
  EmployeeNameHistory,
} from "@/app/generated/prisma/client"

export type EmployeeWithGroup = Employee & {
  group: Group | null
}

export type EmployeeWithDetails = Employee & {
  group: Group | null
  functionRoles: (EmployeeFunctionRole & {
    functionRole: FunctionRole | null
  })[]
  nameHistory: EmployeeNameHistory[]
}

export type EmployeeFilterParams = {
  search?: string
  groupId?: number
  activeOnly?: boolean
}
