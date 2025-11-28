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
  ChevronRight,
  FileText,
  Package,
  TicketCheck,
  UserCog,
  Pin,
  PinOff,
  PanelLeftClose,
  PanelLeft,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
    title: "Masters",
    url: "/masters",
    icon: Database,
    roles: ["admin"],
  },
];

// Reports sub-menu items
const reportsSubItems = [
  {
    title: "Sales Reports",
    url: "/reports/sales",
    icon: TrendingUp,
  },
  {
    title: "Implementation Reports",
    url: "/reports/implementation",
    icon: Package,
  },
  {
    title: "Support Reports",
    url: "/reports/support",
    icon: TicketCheck,
  },
];

const settingsItems = [
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

const adminItems = [
  {
    title: "User Management",
    url: "/admin/user-management",
    icon: UserCog,
  },
];

interface AppSidebarProps {
  isPinned: boolean;
  onPinChange: (pinned: boolean) => void;
}

export function AppSidebar({ isPinned, onPinChange }: AppSidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { state, toggleSidebar, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed";

  // Filter menu items based on user role
  const visibleMainItems = mainMenuItems.filter((item) =>
    user?.role ? item.roles.includes(user.role) : true
  );

  // Check if user has access to reports (admin only)
  const canViewReports = user?.role === "admin";
  
  // Check if any reports sub-item is active
  const isReportsActive = location.startsWith("/reports");

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

  const handlePin = () => {
    onPinChange(!isPinned);
  };

  const handleCollapse = () => {
    if (!isMobile) {
      toggleSidebar();
    }
  };

  return (
    <Sidebar collapsible="icon" data-testid="sidebar-main">
      <SidebarHeader className="p-3">
        <div className="flex items-center justify-between gap-2">
          {!isCollapsed && (
            <h1 className="text-lg font-bold text-sidebar-primary truncate" data-testid="text-sidebar-title">
              Microgenn CRM
            </h1>
          )}
          <div className={`flex items-center gap-1 ${isCollapsed ? 'mx-auto' : ''}`}>
            {!isMobile && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handlePin}
                      className="h-7 w-7 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                      data-testid="button-sidebar-pin"
                    >
                      {isPinned ? (
                        <Pin className="h-4 w-4 fill-current" />
                      ) : (
                        <PinOff className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {isPinned ? "Unpin sidebar" : "Pin sidebar"}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCollapse}
                      className="h-7 w-7 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                      data-testid="button-sidebar-collapse"
                    >
                      {isCollapsed ? (
                        <PanelLeft className="h-4 w-4" />
                      ) : (
                        <PanelLeftClose className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>
      </SidebarHeader>
      <Separator className="bg-sidebar-border" />
      <SidebarContent>
        <SidebarGroup>
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
              
              {/* Reports with collapsible sub-menu */}
              {canViewReports && (
                <Collapsible defaultOpen={isReportsActive} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        isActive={isReportsActive}
                        data-testid="nav-reports"
                      >
                        <BarChart3 className="h-4 w-4" />
                        <span>Reports</span>
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {reportsSubItems.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={location === subItem.url}
                              data-testid={`nav-${subItem.title.toLowerCase().replace(/\s+/g, "-")}`}
                            >
                              <Link href={subItem.url}>
                                <subItem.icon className="h-3.5 w-3.5" />
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}
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
              
              {user?.role === "admin" && adminItems.map((item) => (
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
