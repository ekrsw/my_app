"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import {
  LayoutDashboard,
  Calendar,
  User,
  UsersRound,
  Shield,
  Award,
  Tag,
  Settings,
  ChevronRight,
  LogIn,
  LogOut,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"

const navItems = [
  { label: "ダッシュボード", href: "/", icon: LayoutDashboard },
  { label: "シフト管理", href: "/shifts", icon: Calendar },
  { label: "従業員", href: "/employees", icon: User },
]

const settingsSubItems = [
  { label: "グループ", href: "/groups", icon: UsersRound },
  { label: "ロール", href: "/roles", icon: Shield },
  { label: "役職", href: "/positions", icon: Award },
  { label: "シフトコード", href: "/shift-codes", icon: Tag },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const isSettingsActive = settingsSubItems.some((item) =>
    pathname.startsWith(item.href)
  )

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
              <Collapsible
                defaultOpen={isSettingsActive}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <Settings className="h-4 w-4" />
                      <span>設定</span>
                      <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {settingsSubItems.map((item) => {
                        const isActive = pathname.startsWith(item.href)
                        return (
                          <SidebarMenuSubItem key={item.href}>
                            <SidebarMenuSubButton asChild isActive={isActive}>
                              <Link href={item.href}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.label}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        {status === "loading" ? (
          <Button variant="ghost" className="w-full justify-start gap-2" disabled>
            <LogIn className="h-4 w-4" />
            <span>管理者ログイン</span>
          </Button>
        ) : session?.user ? (
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
            <span>ログアウト</span>
          </Button>
        ) : (
          <Button variant="ghost" className="w-full justify-start gap-2" asChild>
            <Link href="/login">
              <LogIn className="h-4 w-4" />
              <span>管理者ログイン</span>
            </Link>
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
