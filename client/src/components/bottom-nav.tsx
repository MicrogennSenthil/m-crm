import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  TrendingUp, 
  ListTodo, 
  Headphones, 
  Settings,
  Wrench,
  BookOpen
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  {
    title: "Home",
    url: "/",
    icon: LayoutDashboard,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    roles: ["sales_executive", "engineer", "support", "admin"],
  },
  {
    title: "Sales",
    url: "/sales",
    icon: TrendingUp,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    roles: ["sales_executive", "admin"],
  },
  {
    title: "Tasks",
    url: "/tasks",
    icon: ListTodo,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    roles: ["sales_executive", "engineer", "support", "admin"],
  },
  {
    title: "Support",
    url: "/support",
    icon: Headphones,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    roles: ["support", "admin"],
  },
  {
    title: "More",
    url: "/settings",
    icon: Settings,
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    roles: ["sales_executive", "engineer", "support", "admin"],
  },
];

export function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();

  const visibleItems = navItems.filter((item) =>
    user?.role ? item.roles.includes(user.role) : true
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {visibleItems.map((item) => {
          const isActive = location === item.url || 
            (item.url !== "/" && location.startsWith(item.url));
          const Icon = item.icon;
          
          return (
            <Link key={item.url} href={item.url}>
              <button
                className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] px-2 py-1 rounded-xl transition-all ${
                  isActive 
                    ? `${item.bgColor} scale-105` 
                    : "hover:bg-muted/50"
                }`}
                data-testid={`nav-mobile-${item.title.toLowerCase()}`}
              >
                <div className={`p-1.5 rounded-lg ${isActive ? item.bgColor : ""}`}>
                  <Icon 
                    className={`h-5 w-5 ${isActive ? item.color : "text-muted-foreground"}`} 
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </div>
                <span 
                  className={`text-[10px] font-medium mt-0.5 ${
                    isActive ? item.color : "text-muted-foreground"
                  }`}
                >
                  {item.title}
                </span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
