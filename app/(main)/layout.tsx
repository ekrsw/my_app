import { cookies } from "next/headers"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SessionProvider } from "@/components/auth/session-provider"

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <SessionProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  )
}
