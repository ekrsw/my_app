"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import {
  LayoutDashboard,
  Calendar,
  Headset,
  User,
  UsersRound,
  Shield,
  Award,
  Tag,
  Settings,
  ChevronRight,
  LogIn,
  LogOut,
  ClipboardList,
  ListChecks,
  Database,
  PanelLeftIcon,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const navItems = [
  { label: "ダッシュボード", href: "/", icon: LayoutDashboard },
  { label: "シフト管理", href: "/shifts", icon: Calendar },
  { label: "業務管理", href: "/duty-assignments", icon: ClipboardList },
  { label: "従業員", href: "/employees", icon: User },
]

const settingsSubItems = [
  { label: "グループ", href: "/groups", icon: UsersRound },
  { label: "ロール", href: "/roles", icon: Shield },
  { label: "役職", href: "/positions", icon: Award },
  { label: "シフトコード", href: "/shift-codes", icon: Tag },
  { label: "業務種別", href: "/duty-types", icon: ListChecks },
  { label: "データ", href: "/data", icon: Database },
]

function useIsDesktopCollapsed() {
  const { state, isMobile } = useSidebar()
  return state === "collapsed" && !isMobile
}

function SidebarBrandToggle() {
  const { toggleSidebar, isMobile } = useSidebar()
  const isCollapsed = useIsDesktopCollapsed()

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="サイドバーを開く"
        className="group/brand flex h-10 w-10 items-center justify-center rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Headset className="h-5 w-5 group-hover/brand:hidden" />
        <PanelLeftIcon className="hidden h-5 w-5 group-hover/brand:block" />
      </button>
    )
  }

  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <Link href="/" className="flex min-w-0 items-center gap-2">
        <Headset className="h-6 w-6 shrink-0" />
        <span className="truncate text-lg font-bold">CSC管理ツール</span>
      </Link>
      {!isMobile && <SidebarTrigger aria-label="サイドバーを閉じる" />}
    </div>
  )
}

function SettingsNav() {
  const pathname = usePathname()
  const isCollapsed = useIsDesktopCollapsed()
  const isSettingsActive = settingsSubItems.some((item) =>
    pathname.startsWith(item.href)
  )

  if (isCollapsed) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              isActive={isSettingsActive}
              tooltip="設定"
              aria-label="設定"
            >
              <Settings className="h-4 w-4" />
              <span>設定</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start">
            {settingsSubItems.map((item) => (
              <DropdownMenuItem key={item.href} asChild>
                <Link href={item.href}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    )
  }

  return (
    <Collapsible
      defaultOpen={isSettingsActive}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip="設定">
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
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b p-2 group-data-[collapsible=icon]:border-b-0">
        <SidebarBrandToggle />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
              <SettingsNav />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            {status === "loading" ? (
              <SidebarMenuButton disabled tooltip="管理者ログイン">
                <LogIn className="h-4 w-4" />
                <span>管理者ログイン</span>
              </SidebarMenuButton>
            ) : session?.user ? (
              <SidebarMenuButton
                tooltip="ログアウト"
                onClick={async () => {
                  await signOut({ redirect: false })
                  window.location.href = "/"
                }}
              >
                <LogOut className="h-4 w-4" />
                <span>ログアウト</span>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton asChild tooltip="管理者ログイン">
                <Link href="/login">
                  <LogIn className="h-4 w-4" />
                  <span>管理者ログイン</span>
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
