"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { DataTable } from "@/components/data-table"
import { skillColumns, type SkillRow } from "./skill-columns"
import { SkillForm } from "./skill-form"

export function SkillTable({ data }: { data: SkillRow[] }) {
  const { data: session } = useSession()
  const isAuthenticated = !!session?.user
  const [selectedSkill, setSelectedSkill] = useState<SkillRow | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <DataTable
        columns={skillColumns}
        data={data}
        clientPagination
        pageSize={10}
        onRowClick={
          isAuthenticated
            ? (row) => {
                setSelectedSkill(row)
                setDialogOpen(true)
              }
            : undefined
        }
      />
      {isAuthenticated && (
        <SkillForm
          skill={selectedSkill ?? undefined}
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) setSelectedSkill(null)
          }}
        />
      )}
    </>
  )
}
