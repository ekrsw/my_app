import { Skeleton } from "@/components/ui/skeleton"

export default function DataLoading() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-24" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-40" />
      </div>
      <Skeleton className="h-[400px] w-full" />
    </div>
  )
}
