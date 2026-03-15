import { Skeleton } from "@/components/ui/skeleton"

export default function ShiftsLoading() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-10 w-64" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-48" />
      </div>
      <Skeleton className="h-[500px] w-full" />
    </div>
  )
}
