export type DashboardOverviewFilter = {
  groupIds?: number[]
  unassigned?: boolean
  employeeIds?: string[]
  shiftCodes?: string[]
  supervisorRoleNames?: string[]
  businessRoleNames?: string[]
  isRemote?: boolean
}

export type DashboardFilterOptions = {
  employees: { id: string; name: string }[]
  groups: { id: number; name: string }[]
  shiftCodes: string[]
  hasUnassigned: boolean
  supervisorRoleNames: string[]
  businessRoleNames: string[]
}
