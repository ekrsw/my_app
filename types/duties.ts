import type {
  DutyAssignment,
  DutyType,
  Employee,
  EmployeeGroup,
  Group,
} from "@/app/generated/prisma/client"

export type DutyAssignmentWithDetails = DutyAssignment & {
  employee: Employee & {
    groups: (EmployeeGroup & { group: Group })[]
  }
  dutyType: DutyType
}
