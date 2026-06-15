import { Skeleton } from "@/components/ui/skeleton"

export default function EmployeesLoading() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-32" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
