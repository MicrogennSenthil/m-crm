import {
  LayoutDashboard,
  TrendingUp,
  Wrench,
  ClipboardCheck,
  Headphones,
  BarChart3,
  Database,
  Settings,
  LogOut,
  ListTodo,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";

// Navigation items based on design guidelines
const mainMenuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    roles: ["sales_executive", "engineer", "support", "admin"],
  },
  {
    title: "Tasks",
    url: "/tasks",
    icon: ListTodo,
    roles: ["sales_executive", "engineer", "support", "admin"],
  },
  {
    title: "Sales Pipeline",
    url: "/sales",
    icon: TrendingUp,
    roles: ["sales_executive", "admin"],
  },
  {
    title: "Implementations",
    url: "/implementations",
    icon: Wrench,
    roles: ["engineer", "admin"],
  },
  {
    title: "Work Tracking",
    url: "/implementation-dashboard",
    icon: ClipboardCheck,
    roles: ["engineer", "admin"],
  },
  {
    title: "Support Tickets",
    url: "/support",
    icon: Headphones,
    roles: ["support", "admin"],
  },
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
    roles: ["admin"],
  },
  {
    title: "Masters",
    url: "/masters",
    icon: Database,
    roles: ["admin"],
  },
];

const settingsItems = [
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  // Filter menu items based on user role
  const visibleMainItems = mainMenuItems.filter((item) =>
    user?.role ? item.roles.includes(user.role) : true
  );

  const getUserInitials = () => {
    if (!user) return "U";
    const first = user.firstName?.[0] || "";
    const last = user.lastName?.[0] || "";
    return (first + last).toUpperCase() || user.email?.[0]?.toUpperCase() || "U";
  };

  const getUserDisplayName = () => {
    if (!user) return "User";
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email || "User";
  };

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold px-4 py-2">
            Microgenn CRM
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-2" />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid="nav-settings"
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.profileImageUrl || undefined} alt={getUserDisplayName()} />
            <AvatarFallback>{getUserInitials()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="user-name-display">
              {getUserDisplayName()}
            </p>
            <p className="text-xs text-muted-foreground capitalize" data-testid="user-role-display">
              {user?.role?.replace("_", " ")}
            </p>
          </div>
        </div>
        <SidebarMenuButton
          asChild
          data-testid="button-logout"
          className="w-full"
        >
          <a href="/api/logout">
            <LogOut className="h-4 w-4" />
            <span>Log Out</span>
          </a>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
