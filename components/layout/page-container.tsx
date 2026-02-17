type PageContainerProps = {
  children: React.ReactNode
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps) {
  return <main className={`flex-1 overflow-auto p-6 ${className ?? ""}`}>{children}</main>
}
