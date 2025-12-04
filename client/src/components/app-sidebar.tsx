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
  KeyRound,
  UserCheck,
  Home,
  Briefcase,
  Cog,
  BookOpen,
  Search,
  Mail,
  ServerCog,
  Star,
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
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";

// Menu groups with collapsible sections and colors
const menuGroups = [
  {
    id: "main",
    label: "Main",
    icon: Home,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    items: [
      {
        title: "Dashboard",
        url: "/",
        icon: LayoutDashboard,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        roles: ["sales_executive", "engineer", "support", "admin"],
      },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: TrendingUp,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    items: [
      {
        title: "Sales Pipeline",
        url: "/sales",
        icon: TrendingUp,
        color: "text-green-500",
        bgColor: "bg-green-500/10",
        roles: ["sales_executive", "admin"],
      },
      {
        title: "Sales Dashboard",
        url: "/sales-dashboard",
        icon: BarChart3,
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
        roles: ["sales_executive", "admin"],
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: Briefcase,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    items: [
      {
        title: "Implementations",
        url: "/implementations",
        icon: Wrench,
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
        roles: ["engineer", "admin"],
      },
      {
        title: "Work Tracking",
        url: "/implementation-dashboard",
        icon: ClipboardCheck,
        color: "text-yellow-500",
        bgColor: "bg-yellow-500/10",
        roles: ["engineer", "admin"],
      },
    ],
  },
  {
    id: "support",
    label: "Support",
    icon: Headphones,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    items: [
      {
        title: "Support Tickets",
        url: "/support",
        icon: Headphones,
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
        roles: ["support", "admin"],
      },
      {
        title: "Support Dashboard",
        url: "/support-dashboard",
        icon: ClipboardCheck,
        color: "text-red-500",
        bgColor: "bg-red-500/10",
        roles: ["support", "admin"],
      },
    ],
  },
  {
    id: "knowledge",
    label: "Knowledge Base",
    icon: BookOpen,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    items: [
      {
        title: "Search",
        url: "/knowledge-base",
        icon: Search,
        color: "text-cyan-500",
        bgColor: "bg-cyan-500/10",
        roles: ["sales_executive", "engineer", "support", "admin"],
      },
      {
        title: "Manage Documents",
        url: "/admin/knowledge-base",
        icon: FileText,
        color: "text-teal-500",
        bgColor: "bg-teal-500/10",
        roles: ["admin"],
      },
    ],
  },
];

// Tasks sub-menu items (visible to all authenticated users)
const tasksSubItems = [
  {
    title: "All Tasks",
    url: "/tasks",
    icon: ListTodo,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    title: "Today's Task",
    url: "/tasks/today",
    icon: ClipboardCheck,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
  },
];

// Reports sub-menu items
const reportsSubItems = [
  {
    title: "Sales Reports",
    url: "/reports/sales",
    icon: TrendingUp,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    title: "Implementation Reports",
    url: "/reports/implementation",
    icon: Package,
    color: "text-lime-500",
    bgColor: "bg-lime-500/10",
  },
  {
    title: "Support Reports",
    url: "/reports/support",
    icon: TicketCheck,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
];

// User Management sub-menu items
const userManagementSubItems = [
  {
    title: "User",
    url: "/admin/users",
    icon: Users,
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
  },
  {
    title: "User Role",
    url: "/admin/user-roles",
    icon: Shield,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "User Rights Allocation",
    url: "/admin/user-rights",
    icon: Key,
    color: "text-sky-500",
    bgColor: "bg-sky-500/10",
  },
  {
    title: "User Approval",
    url: "/admin/user-approval",
    icon: UserCheck,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
  },
  {
    title: "Reset Password",
    url: "/department-users",
    icon: KeyRound,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
];

// System Settings sub-menu items
const systemSettingsSubItems = [
  {
    title: "SMTP Configuration",
    url: "/admin/smtp-config",
    icon: Mail,
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
  },
  {
    title: "Point Categories",
    url: "/admin/point-categories",
    icon: Star,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
  {
    title: "Database Control",
    url: "/admin/database-control",
    icon: Database,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
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
  
  // Check if any system settings sub-item is active
  const isSystemSettingsActive = location === "/admin/smtp-config" || location === "/admin/point-categories" || location === "/admin/database-control";

  // Check if a group has any visible items and if any item is active
  const getGroupVisibility = (groupId: string, items: typeof menuGroups[0]["items"]) => {
    const visibleItems = items.filter((item) =>
      user?.role ? item.roles.includes(user.role) : true
    );
    const hasActiveItem = visibleItems.some((item) => location === item.url);
    return { visibleItems, hasActiveItem, hasItems: visibleItems.length > 0 };
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
      <SidebarHeader className="h-[52px] px-2 flex items-center border-b-2 border-b-white">
        <div className="flex items-center justify-between gap-1 w-full">
          {!isCollapsed && (
            <h1 className="text-lg font-bold text-[#FF9933] truncate" data-testid="text-sidebar-title">
              M-CRM
            </h1>
          )}
          <div className={`flex items-center gap-0.5 ${isCollapsed ? 'mx-auto' : 'ml-auto'}`}>
            {!isMobile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePin}
                    className={`h-7 w-7 transition-colors ${
                      isPinned 
                        ? 'text-[#FF9933] hover:text-[#FF9933] hover:bg-sidebar-accent' 
                        : 'text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                    }`}
                    data-testid="button-sidebar-pin"
                  >
                    {isPinned ? (
                      <Pin className="h-4 w-4" />
                    ) : (
                      <PinOff className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {isPinned ? "Unpin sidebar (auto-hide)" : "Pin sidebar (keep open)"}
                </TooltipContent>
              </Tooltip>
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
      
      <SidebarContent className="overflow-hidden p-0">
        <div 
          ref={scrollContainerRef}
          className="overflow-y-auto h-full px-2 py-1"
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
                          className={isCollapsed ? "flex flex-col items-center justify-center h-12 px-0" : ""}
                        >
                          <div className={`flex items-center justify-center rounded-lg p-1.5 ${hasActiveItem ? group.bgColor : ""}`}>
                            <group.icon className={`h-4 w-4 ${group.color} ${hasActiveItem ? "" : "opacity-70"}`} />
                          </div>
                          {!isCollapsed && <span>{group.label}</span>}
                          {!isCollapsed && <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />}
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
                                  <div className={`flex items-center justify-center rounded-md p-1 ${location === item.url ? item.bgColor : ""}`}>
                                    <item.icon className={`h-3.5 w-3.5 ${item.color} ${location === item.url ? "" : "opacity-70"}`} />
                                  </div>
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
              
              {/* Tasks with collapsible sub-menu (visible to all) */}
              <Collapsible defaultOpen={location.startsWith("/tasks")} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={location.startsWith("/tasks")}
                      data-testid="nav-tasks"
                      className={isCollapsed ? "flex flex-col items-center justify-center h-12 px-0" : ""}
                    >
                      <div className={`flex items-center justify-center rounded-lg p-1.5 ${location.startsWith("/tasks") ? "bg-purple-500/10" : ""}`}>
                        <ListTodo className={`h-4 w-4 text-purple-500 ${location.startsWith("/tasks") ? "" : "opacity-70"}`} />
                      </div>
                      {!isCollapsed && <span>Tasks</span>}
                      {!isCollapsed && <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {tasksSubItems.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={location === subItem.url}
                            data-testid={`nav-${subItem.title.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            <Link href={subItem.url}>
                              <div className={`flex items-center justify-center rounded-md p-1 ${location === subItem.url ? subItem.bgColor : ""}`}>
                                <subItem.icon className={`h-3.5 w-3.5 ${subItem.color} ${location === subItem.url ? "" : "opacity-70"}`} />
                              </div>
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Reports with collapsible sub-menu */}
              {canViewReports && (
                <Collapsible defaultOpen={isReportsActive} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        isActive={isReportsActive}
                        data-testid="nav-reports"
                        className={isCollapsed ? "flex flex-col items-center justify-center h-12 px-0" : ""}
                      >
                        <div className={`flex items-center justify-center rounded-lg p-1.5 ${isReportsActive ? "bg-emerald-500/10" : ""}`}>
                          <BarChart3 className={`h-4 w-4 text-emerald-500 ${isReportsActive ? "" : "opacity-70"}`} />
                        </div>
                        {!isCollapsed && <span>Reports</span>}
                        {!isCollapsed && <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />}
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
                                <div className={`flex items-center justify-center rounded-md p-1 ${location === subItem.url ? subItem.bgColor : ""}`}>
                                  <subItem.icon className={`h-3.5 w-3.5 ${subItem.color} ${location === subItem.url ? "" : "opacity-70"}`} />
                                </div>
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
                  defaultOpen={location === "/masters" || location === "/settings" || isUserManagementActive || isSystemSettingsActive} 
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        isActive={location === "/masters" || location === "/settings" || isUserManagementActive || isSystemSettingsActive}
                        data-testid="nav-group-admin"
                        className={isCollapsed ? "flex flex-col items-center justify-center h-12 px-0" : ""}
                      >
                        <div className={`flex items-center justify-center rounded-lg p-1.5 ${(location === "/masters" || location === "/settings" || isUserManagementActive || isSystemSettingsActive) ? "bg-red-500/10" : ""}`}>
                          <Cog className={`h-4 w-4 text-red-500 ${(location === "/masters" || location === "/settings" || isUserManagementActive || isSystemSettingsActive) ? "" : "opacity-70"}`} />
                        </div>
                        {!isCollapsed && <span>Administration</span>}
                        {!isCollapsed && <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />}
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
                              <div className={`flex items-center justify-center rounded-md p-1 ${location === "/masters" ? "bg-pink-500/10" : ""}`}>
                                <Database className={`h-3.5 w-3.5 text-pink-500 ${location === "/masters" ? "" : "opacity-70"}`} />
                              </div>
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
                              <div className={`flex items-center justify-center rounded-md p-1 ${location === "/settings" ? "bg-slate-500/10" : ""}`}>
                                <Settings className={`h-3.5 w-3.5 text-slate-500 ${location === "/settings" ? "" : "opacity-70"}`} />
                              </div>
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
                                className="cursor-pointer whitespace-nowrap"
                              >
                                <div className={`flex items-center justify-center rounded-md p-1 ${isUserManagementActive ? "bg-indigo-500/10" : ""}`}>
                                  <UserCog className={`h-3.5 w-3.5 shrink-0 text-indigo-500 ${isUserManagementActive ? "" : "opacity-70"}`} />
                                </div>
                                <span className="truncate">User Management</span>
                                <ChevronRight className="ml-auto h-3 w-3 shrink-0 transition-transform group-data-[state=open]/usermgmt:rotate-90" />
                              </SidebarMenuSubButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="pl-4 space-y-0.5 mt-1">
                                {userManagementSubItems.map((subItem) => (
                                  <Tooltip key={subItem.title}>
                                    <TooltipTrigger asChild>
                                      <SidebarMenuSubButton
                                        asChild
                                        isActive={location === subItem.url}
                                        data-testid={`nav-${subItem.title.toLowerCase().replace(/\s+/g, "-")}`}
                                        className="text-xs whitespace-nowrap"
                                      >
                                        <Link href={subItem.url}>
                                          <div className={`flex items-center justify-center rounded-md p-0.5 ${location === subItem.url ? subItem.bgColor : ""}`}>
                                            <subItem.icon className={`h-3 w-3 shrink-0 ${subItem.color} ${location === subItem.url ? "" : "opacity-70"}`} />
                                          </div>
                                          <span className="truncate">{subItem.title}</span>
                                        </Link>
                                      </SidebarMenuSubButton>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="text-xs">
                                      {subItem.title}
                                    </TooltipContent>
                                  </Tooltip>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </SidebarMenuSubItem>
                        </Collapsible>

                        {/* System Settings nested collapsible */}
                        <Collapsible defaultOpen={isSystemSettingsActive} className="group/syssettings">
                          <SidebarMenuSubItem>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuSubButton
                                isActive={isSystemSettingsActive}
                                data-testid="nav-system-settings"
                                className="cursor-pointer whitespace-nowrap"
                              >
                                <div className={`flex items-center justify-center rounded-md p-1 ${isSystemSettingsActive ? "bg-rose-500/10" : ""}`}>
                                  <ServerCog className={`h-3.5 w-3.5 shrink-0 text-rose-500 ${isSystemSettingsActive ? "" : "opacity-70"}`} />
                                </div>
                                <span className="truncate">System Settings</span>
                                <ChevronRight className="ml-auto h-3 w-3 shrink-0 transition-transform group-data-[state=open]/syssettings:rotate-90" />
                              </SidebarMenuSubButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="pl-4 space-y-0.5 mt-1">
                                {systemSettingsSubItems.map((subItem) => (
                                  <Tooltip key={subItem.title}>
                                    <TooltipTrigger asChild>
                                      <SidebarMenuSubButton
                                        asChild
                                        isActive={location === subItem.url}
                                        data-testid={`nav-${subItem.title.toLowerCase().replace(/\s+/g, "-")}`}
                                        className="text-xs whitespace-nowrap"
                                      >
                                        <Link href={subItem.url}>
                                          <div className={`flex items-center justify-center rounded-md p-0.5 ${location === subItem.url ? subItem.bgColor : ""}`}>
                                            <subItem.icon className={`h-3 w-3 shrink-0 ${subItem.color} ${location === subItem.url ? "" : "opacity-70"}`} />
                                          </div>
                                          <span className="truncate">{subItem.title}</span>
                                        </Link>
                                      </SidebarMenuSubButton>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="text-xs">
                                      {subItem.title}
                                    </TooltipContent>
                                  </Tooltip>
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
                    className={isCollapsed ? "flex flex-col items-center justify-center h-12 px-0" : ""}
                  >
                    <Link href="/settings">
                      <div className={`flex items-center justify-center rounded-lg p-1.5 ${location === "/settings" ? "bg-slate-500/10" : ""}`}>
                        <Settings className={`h-4 w-4 text-slate-500 ${location === "/settings" ? "" : "opacity-70"}`} />
                      </div>
                      {!isCollapsed && <span>Settings</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        </div>
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
    </Sidebar>
  );
}
