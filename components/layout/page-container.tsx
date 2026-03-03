type PageContainerProps = {
  children: React.ReactNode
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps) {
  return <main className={`min-w-0 flex-1 overflow-auto p-6 ${className ?? ""}`}>{children}</main>
}
