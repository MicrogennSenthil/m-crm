import { useRef, useState, useEffect } from "react";
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
  ChevronUp,
  ChevronDown,
  FileText,
  Package,
  TicketCheck,
  UserCog,
  Pin,
  PinOff,
  PanelLeftClose,
  PanelLeft,
  Users,
  Shield,
  Key,
  UserCheck,
  Home,
  Briefcase,
  Cog,
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

// Menu groups with collapsible sections
const menuGroups = [
  {
    id: "main",
    label: "Main",
    icon: Home,
    items: [
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
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: TrendingUp,
    items: [
      {
        title: "Sales Pipeline",
        url: "/sales",
        icon: TrendingUp,
        roles: ["sales_executive", "admin"],
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: Briefcase,
    items: [
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
    ],
  },
  {
    id: "support",
    label: "Support",
    icon: Headphones,
    items: [
      {
        title: "Support Tickets",
        url: "/support",
        icon: Headphones,
        roles: ["support", "admin"],
      },
    ],
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

// User Management sub-menu items
const userManagementSubItems = [
  {
    title: "User",
    url: "/admin/users",
    icon: Users,
  },
  {
    title: "User Role",
    url: "/admin/user-roles",
    icon: Shield,
  },
  {
    title: "User Rights Allocation",
    url: "/admin/user-rights",
    icon: Key,
  },
  {
    title: "User Approval",
    url: "/admin/user-approval",
    icon: UserCheck,
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
  
  // Scroll navigation
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScrollability = () => {
    const container = scrollContainerRef.current;
    if (container) {
      setCanScrollUp(container.scrollTop > 0);
      setCanScrollDown(container.scrollTop + container.clientHeight < container.scrollHeight - 5);
    }
  };

  useEffect(() => {
    checkScrollability();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollability);
      // Check on resize too
      const resizeObserver = new ResizeObserver(checkScrollability);
      resizeObserver.observe(container);
      return () => {
        container.removeEventListener('scroll', checkScrollability);
        resizeObserver.disconnect();
      };
    }
  }, []);

  const scrollUp = () => {
    scrollContainerRef.current?.scrollBy({ top: -100, behavior: 'smooth' });
  };

  const scrollDown = () => {
    scrollContainerRef.current?.scrollBy({ top: 100, behavior: 'smooth' });
  };

  // Check if user has access to reports (admin only)
  const canViewReports = user?.role === "admin";
  
  // Check if any reports sub-item is active
  const isReportsActive = location.startsWith("/reports");
  
  // Check if any user management sub-item is active
  const isUserManagementActive = location.startsWith("/admin/user");

  // Check if a group has any visible items and if any item is active
  const getGroupVisibility = (groupId: string, items: typeof menuGroups[0]["items"]) => {
    const visibleItems = items.filter((item) =>
      user?.role ? item.roles.includes(user.role) : true
    );
    const hasActiveItem = visibleItems.some((item) => location === item.url);
    return { visibleItems, hasActiveItem, hasItems: visibleItems.length > 0 };
  };

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
      <SidebarHeader className="h-[52px] px-3 flex items-center border-b-2 border-b-[#FF9933]">
        <div className="flex items-center justify-between gap-2 w-full">
          {!isCollapsed && (
            <h1 className="text-lg font-bold text-sidebar-primary truncate" data-testid="text-sidebar-title">
              M-CRM
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
      
      {/* Scroll Up Arrow - only show when can scroll up */}
      {canScrollUp && !isCollapsed && (
        <div className="flex justify-center py-1 bg-sidebar border-b border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={scrollUp}
            className="h-6 w-full max-w-[80%] text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            data-testid="button-scroll-up"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <SidebarContent 
        ref={scrollContainerRef}
        className="overflow-y-auto"
      >
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Dynamic Menu Groups */}
              {menuGroups.map((group) => {
                const { visibleItems, hasActiveItem, hasItems } = getGroupVisibility(group.id, group.items);
                
                if (!hasItems) return null;

                return (
                  <Collapsible 
                    key={group.id} 
                    defaultOpen={hasActiveItem || group.id === "main"} 
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          isActive={hasActiveItem}
                          data-testid={`nav-group-${group.id}`}
                        >
                          <group.icon className="h-4 w-4" />
                          <span>{group.label}</span>
                          <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {visibleItems.map((item) => (
                            <SidebarMenuSubItem key={item.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={location === item.url}
                                data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                              >
                                <Link href={item.url}>
                                  <item.icon className="h-3.5 w-3.5" />
                                  <span>{item.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
              
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

              {/* Administration Group */}
              {user?.role === "admin" && (
                <Collapsible 
                  defaultOpen={location === "/masters" || location === "/settings" || isUserManagementActive} 
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        isActive={location === "/masters" || location === "/settings" || isUserManagementActive}
                        data-testid="nav-group-admin"
                      >
                        <Cog className="h-4 w-4" />
                        <span>Administration</span>
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={location === "/masters"}
                            data-testid="nav-masters"
                          >
                            <Link href="/masters">
                              <Database className="h-3.5 w-3.5" />
                              <span>Masters</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={location === "/settings"}
                            data-testid="nav-settings"
                          >
                            <Link href="/settings">
                              <Settings className="h-3.5 w-3.5" />
                              <span>Settings</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        
                        {/* User Management nested collapsible */}
                        <Collapsible defaultOpen={isUserManagementActive} className="group/usermgmt">
                          <SidebarMenuSubItem>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuSubButton
                                isActive={isUserManagementActive}
                                data-testid="nav-user-management"
                                className="cursor-pointer"
                              >
                                <UserCog className="h-3.5 w-3.5" />
                                <span>User Management</span>
                                <ChevronRight className="ml-auto h-3 w-3 transition-transform group-data-[state=open]/usermgmt:rotate-90" />
                              </SidebarMenuSubButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="pl-4 space-y-1 mt-1">
                                {userManagementSubItems.map((subItem) => (
                                  <SidebarMenuSubButton
                                    key={subItem.title}
                                    asChild
                                    isActive={location === subItem.url}
                                    data-testid={`nav-${subItem.title.toLowerCase().replace(/\s+/g, "-")}`}
                                    className="text-xs"
                                  >
                                    <Link href={subItem.url}>
                                      <subItem.icon className="h-3 w-3" />
                                      <span>{subItem.title}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </SidebarMenuSubItem>
                        </Collapsible>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}

              {/* Settings for non-admin users */}
              {user?.role !== "admin" && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/settings"}
                    data-testid="nav-settings"
                  >
                    <Link href="/settings">
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Scroll Down Arrow - only show when can scroll down */}
      {canScrollDown && !isCollapsed && (
        <div className="flex justify-center py-1 bg-sidebar border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={scrollDown}
            className="h-6 w-full max-w-[80%] text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            data-testid="button-scroll-down"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}

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
