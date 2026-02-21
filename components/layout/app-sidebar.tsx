"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Calendar,
  History,
  Users,
  FolderOpen,
  Shield,
  Award,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const navItems = [
  { label: "ダッシュボード", href: "/", icon: LayoutDashboard },
  { label: "シフト管理", href: "/shifts", icon: Calendar },
  { label: "シフト履歴", href: "/shifts/history", icon: History },
  { label: "従業員", href: "/employees", icon: Users },
  { label: "グループ", href: "/groups", icon: FolderOpen },
  { label: "役割", href: "/roles", icon: Shield },
  { label: "役職", href: "/positions", icon: Award },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          <span className="text-lg font-bold">シフト管理</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>メニュー</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
