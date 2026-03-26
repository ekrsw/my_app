"use client"

import { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ColumnFilterPopover } from "@/components/shifts/column-filter-popover"
import { EmployeeCheckboxFilter } from "@/components/shifts/column-filters/employee-checkbox-filter"
import { CheckboxListFilter } from "@/components/shifts/column-filters/checkbox-list-filter"
import { ToggleFilter } from "@/components/shifts/column-filters/toggle-filter"
import { ActiveFilterTags, FilterTag } from "@/components/shifts/active-filter-tags"
import { ShiftBadge } from "@/components/shifts/shift-badge"
import { Badge } from "@/components/ui/badge"
import { useDashboardFilters } from "@/hooks/use-dashboard-filters"
import type { Shift, Employee, Group, EmployeeGroup, EmployeeFunctionRole, FunctionRole } from "@/app/generated/prisma/client"
import type { DashboardFilterOptions } from "@/types"

type TodayShift = Shift & {
  employee: (Employee & {
    groups: (EmployeeGroup & { group: Group })[]
    functionRoles: (EmployeeFunctionRole & { functionRole: FunctionRole | null })[]
  }) | null
}

function parseIds(value: string): number[] {
  if (!value) return []
  return value.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
}

function parseStrings(value: string): string[] {
  if (!value) return []
  return value.split(",").filter(Boolean)
}

type Props = {
  shifts: TodayShift[]
  filterOptions: DashboardFilterOptions
  distinctRoleTypes: readonly [string, string]
}

export function TodayOverviewClient({ shifts, filterOptions, distinctRoleTypes }: Props) {
  const { setParams, getParam } = useDashboardFilters()

  // --- Parse URL params ---
  const selectedEmployeeIds = useMemo(() => parseStrings(getParam("employeeIds")), [getParam])
  const groupIds = useMemo(() => parseIds(getParam("groupIds")), [getParam])
  const unassigned = getParam("unassigned") === "true"
  const selectedShiftCodes = useMemo(() => parseStrings(getParam("shiftCodes")), [getParam])
  const selectedSupervisorRoleNames = useMemo(() => parseStrings(getParam("supervisorRoleNames")), [getParam])
  const selectedBusinessRoleNames = useMemo(() => parseStrings(getParam("businessRoleNames")), [getParam])
  const isRemoteFilter = getParam("isRemote") === "true"

  // --- Popover open state ---
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false)
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false)
  const [shiftCodePopoverOpen, setShiftCodePopoverOpen] = useState(false)
  const [supervisorPopoverOpen, setSupervisorPopoverOpen] = useState(false)
  const [businessPopoverOpen, setBusinessPopoverOpen] = useState(false)

  // --- Filter handlers ---
  const handleEmployeeIdsConfirm = useCallback((ids: string[]) => {
    setParams({ employeeIds: ids.length > 0 ? ids.join(",") : null })
    setEmployeePopoverOpen(false)
  }, [setParams])

  const handleEmployeeIdsClear = useCallback(() => {
    setParams({ employeeIds: null })
    setEmployeePopoverOpen(false)
  }, [setParams])

  const handleGroupConfirm = useCallback((ids: string[], specialChecked?: boolean) => {
    setParams({
      groupIds: ids.length > 0 ? ids.join(",") : null,
      unassigned: specialChecked ? "true" : null,
    })
    setGroupPopoverOpen(false)
  }, [setParams])

  const handleGroupClear = useCallback(() => {
    setParams({ groupIds: null, unassigned: null })
    setGroupPopoverOpen(false)
  }, [setParams])

  const handleShiftCodesConfirm = useCallback((codes: string[]) => {
    setParams({ shiftCodes: codes.length > 0 ? codes.join(",") : null })
    setShiftCodePopoverOpen(false)
  }, [setParams])

  const handleShiftCodesClear = useCallback(() => {
    setParams({ shiftCodes: null })
    setShiftCodePopoverOpen(false)
  }, [setParams])

  const handleSupervisorRoleConfirm = useCallback((names: string[]) => {
    setParams({ supervisorRoleNames: names.length > 0 ? names.join(",") : null })
    setSupervisorPopoverOpen(false)
  }, [setParams])

  const handleSupervisorRoleClear = useCallback(() => {
    setParams({ supervisorRoleNames: null })
    setSupervisorPopoverOpen(false)
  }, [setParams])

  const handleBusinessRoleConfirm = useCallback((names: string[]) => {
    setParams({ businessRoleNames: names.length > 0 ? names.join(",") : null })
    setBusinessPopoverOpen(false)
  }, [setParams])

  const handleBusinessRoleClear = useCallback(() => {
    setParams({ businessRoleNames: null })
    setBusinessPopoverOpen(false)
  }, [setParams])

  const handleRemoteChange = useCallback((checked: boolean) => {
    setParams({ isRemote: checked ? "true" : null })
  }, [setParams])

  // --- Filter options ---
  const groupOptions = useMemo(
    () => filterOptions.groups.map((g) => ({ value: String(g.id), label: g.name })),
    [filterOptions.groups]
  )
  const selectedGroupValues = useMemo(() => groupIds.map(String), [groupIds])

  const shiftCodeOptions = useMemo(
    () => filterOptions.shiftCodes.map((code) => ({
      value: code,
      label: <ShiftBadge code={code} />,
      searchText: code,
    })),
    [filterOptions.shiftCodes]
  )

  const supervisorRoleOptions = useMemo(
    () => filterOptions.supervisorRoleNames.map((name) => ({ value: name, label: name })),
    [filterOptions.supervisorRoleNames]
  )

  const businessRoleOptions = useMemo(
    () => filterOptions.businessRoleNames.map((name) => ({ value: name, label: name })),
    [filterOptions.businessRoleNames]
  )

  // --- Filter tags ---
  const filterTags = useMemo<FilterTag[]>(() => {
    const tags: FilterTag[] = []

    if (selectedEmployeeIds.length > 0) {
      const label =
        selectedEmployeeIds.length <= 2
          ? selectedEmployeeIds
              .map((id) => filterOptions.employees.find((e) => e.id === id)?.name ?? "")
              .filter(Boolean)
              .join(", ")
          : `${selectedEmployeeIds.length}名選択`
      tags.push({
        key: "employeeIds",
        label: `従業員: ${label}`,
        onRemove: () => setParams({ employeeIds: null }),
      })
    }

    if (unassigned) {
      tags.push({
        key: "unassigned",
        label: "グループ: 未所属",
        onRemove: () => setParams({ unassigned: null }),
      })
    }

    if (groupIds.length > 0) {
      const label =
        groupIds.length <= 2
          ? groupIds.map((id) => filterOptions.groups.find((g) => g.id === id)?.name ?? "").filter(Boolean).join(", ")
          : `${groupIds.length}件選択`
      tags.push({
        key: "groupIds",
        label: `グループ: ${label}`,
        onRemove: () => setParams({ groupIds: null }),
      })
    }

    if (selectedShiftCodes.length > 0) {
      const label =
        selectedShiftCodes.length <= 2
          ? selectedShiftCodes.join(", ")
          : `${selectedShiftCodes.length}件選択`
      tags.push({
        key: "shiftCodes",
        label: `シフト: ${label}`,
        onRemove: () => setParams({ shiftCodes: null }),
      })
    }

    if (selectedSupervisorRoleNames.length > 0) {
      const label =
        selectedSupervisorRoleNames.length <= 2
          ? selectedSupervisorRoleNames.join(", ")
          : `${selectedSupervisorRoleNames.length}件選択`
      tags.push({
        key: "supervisorRoleNames",
        label: `${distinctRoleTypes[0]}: ${label}`,
        onRemove: () => setParams({ supervisorRoleNames: null }),
      })
    }

    if (selectedBusinessRoleNames.length > 0) {
      const label =
        selectedBusinessRoleNames.length <= 2
          ? selectedBusinessRoleNames.join(", ")
          : `${selectedBusinessRoleNames.length}件選択`
      tags.push({
        key: "businessRoleNames",
        label: `${distinctRoleTypes[1]}: ${label}`,
        onRemove: () => setParams({ businessRoleNames: null }),
      })
    }

    if (isRemoteFilter) {
      tags.push({
        key: "isRemote",
        label: "テレワークのみ",
        onRemove: () => setParams({ isRemote: null }),
      })
    }

    return tags
  }, [selectedEmployeeIds, filterOptions, unassigned, groupIds, selectedShiftCodes, selectedSupervisorRoleNames, selectedBusinessRoleNames, distinctRoleTypes, isRemoteFilter, setParams])

  const clearAllFilters = useCallback(() => {
    setParams({
      employeeIds: null,
      groupIds: null,
      unassigned: null,
      shiftCodes: null,
      supervisorRoleNames: null,
      businessRoleNames: null,
      isRemote: null,
    })
  }, [setParams])

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle>本日の出勤者 ({shifts.length}名)</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        <ActiveFilterTags tags={filterTags} onClearAll={clearAllFilters} />
        {shifts.length === 0 ? (
          <p className="text-sm text-muted-foreground">本日の出勤者はいません</p>
        ) : (
          <div className="rounded-md border flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <ColumnFilterPopover
                      label="従業員名"
                      isActive={selectedEmployeeIds.length > 0}
                      activeCount={selectedEmployeeIds.length}
                      open={employeePopoverOpen}
                      onOpenChange={setEmployeePopoverOpen}
                    >
                      <EmployeeCheckboxFilter
                        employees={filterOptions.employees}
                        selectedIds={selectedEmployeeIds}
                        onConfirm={handleEmployeeIdsConfirm}
                        onClear={handleEmployeeIdsClear}
                        popoverOpen={employeePopoverOpen}
                      />
                    </ColumnFilterPopover>
                  </TableHead>
                  <TableHead>
                    <ColumnFilterPopover
                      label="グループ"
                      isActive={groupIds.length > 0 || unassigned}
                      activeCount={groupIds.length + (unassigned ? 1 : 0)}
                      open={groupPopoverOpen}
                      onOpenChange={setGroupPopoverOpen}
                    >
                      <CheckboxListFilter
                        options={groupOptions}
                        selectedValues={selectedGroupValues}
                        onConfirm={handleGroupConfirm}
                        onClear={handleGroupClear}
                        popoverOpen={groupPopoverOpen}
                        specialOption={filterOptions.hasUnassigned || unassigned ? {
                          value: "unassigned",
                          label: "未所属",
                          checked: unassigned,
                        } : undefined}
                        searchPlaceholder="グループ名で検索..."
                      />
                    </ColumnFilterPopover>
                  </TableHead>
                  <TableHead>
                    <ColumnFilterPopover
                      label={distinctRoleTypes[1]}
                      isActive={selectedBusinessRoleNames.length > 0}
                      activeCount={selectedBusinessRoleNames.length}
                      open={businessPopoverOpen}
                      onOpenChange={setBusinessPopoverOpen}
                    >
                      <CheckboxListFilter
                        options={businessRoleOptions}
                        selectedValues={selectedBusinessRoleNames}
                        onConfirm={handleBusinessRoleConfirm}
                        onClear={handleBusinessRoleClear}
                        popoverOpen={businessPopoverOpen}
                        searchPlaceholder={`${distinctRoleTypes[1]}で検索...`}
                      />
                    </ColumnFilterPopover>
                  </TableHead>
                  <TableHead>
                    <ColumnFilterPopover
                      label={distinctRoleTypes[0]}
                      isActive={selectedSupervisorRoleNames.length > 0}
                      activeCount={selectedSupervisorRoleNames.length}
                      open={supervisorPopoverOpen}
                      onOpenChange={setSupervisorPopoverOpen}
                    >
                      <CheckboxListFilter
                        options={supervisorRoleOptions}
                        selectedValues={selectedSupervisorRoleNames}
                        onConfirm={handleSupervisorRoleConfirm}
                        onClear={handleSupervisorRoleClear}
                        popoverOpen={supervisorPopoverOpen}
                        searchPlaceholder={`${distinctRoleTypes[0]}で検索...`}
                      />
                    </ColumnFilterPopover>
                  </TableHead>
                  <TableHead>
                    <ColumnFilterPopover
                      label="シフト"
                      isActive={selectedShiftCodes.length > 0 || isRemoteFilter}
                      activeCount={selectedShiftCodes.length + (isRemoteFilter ? 1 : 0)}
                      open={shiftCodePopoverOpen}
                      onOpenChange={setShiftCodePopoverOpen}
                    >
                      <div className="flex flex-col gap-3">
                        <CheckboxListFilter
                          options={shiftCodeOptions}
                          selectedValues={selectedShiftCodes}
                          onConfirm={handleShiftCodesConfirm}
                          onClear={handleShiftCodesClear}
                          popoverOpen={shiftCodePopoverOpen}
                          searchPlaceholder="シフトコードで検索..."
                        />
                        <div className="border-t pt-2">
                          <ToggleFilter
                            checked={isRemoteFilter}
                            onChange={handleRemoteChange}
                            label="テレワークのみ表示"
                          />
                        </div>
                      </div>
                    </ColumnFilterPopover>
                  </TableHead>
                  <TableHead>TW</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => {
                  const emp = shift.employee
                  const groupName = emp?.groups?.[0]?.group?.name ?? "-"
                  const supervisorRole = emp?.functionRoles?.find(
                    (r) => r.functionRole?.roleType === distinctRoleTypes[0]
                  )?.functionRole?.roleName ?? "-"
                  const businessRole = emp?.functionRoles?.find(
                    (r) => r.functionRole?.roleType === distinctRoleTypes[1]
                  )?.functionRole?.roleName ?? "-"

                  return (
                    <TableRow key={shift.id}>
                      <TableCell className="font-medium">{emp?.name ?? "-"}</TableCell>
                      <TableCell>{groupName}</TableCell>
                      <TableCell>{businessRole}</TableCell>
                      <TableCell>{supervisorRole}</TableCell>
                      <TableCell>
                        <ShiftBadge code={shift.shiftCode} />
                      </TableCell>
                      <TableCell>
                        {shift.isRemote && (
                          <Badge variant="outline" className="text-xs">TW</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
