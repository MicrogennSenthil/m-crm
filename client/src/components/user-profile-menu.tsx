import { LogOut, User, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, clearStoredUser } from "@/hooks/useAuth";
import { queryClient, clearAuthToken } from "@/lib/queryClient";

export function UserProfileMenu() {
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      // Call the logout API — server clears httpOnly JWT + session cookies in this response.
      // Using fetch (not navigation) means Set-Cookie headers are applied BEFORE we redirect.
      await fetch("/api/auth/logout", { credentials: "same-origin" });
    } catch (_) {
      // Ignore network errors — continue with client-side cleanup regardless
    }
    // Clear client-side state
    clearStoredUser();
    clearAuthToken();
    queryClient.clear();
    // Hard redirect to login — browser now has cleared cookies, so /api/auth/user returns 401
    window.location.replace("/auth/login");
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

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex items-center gap-2 px-2 h-10"
          data-testid="button-user-menu"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.profileImageUrl || undefined} alt={getUserDisplayName()} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col items-start">
            <span className="text-sm font-medium truncate max-w-[120px]" data-testid="user-name-display">
              {getUserDisplayName()}
            </span>
            <span className="text-xs text-muted-foreground capitalize" data-testid="user-role-display">
              {user.role?.replace("_", " ")}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 hidden sm:block text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{getUserDisplayName()}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/settings" className="cursor-pointer" data-testid="menu-settings">
            <User className="mr-2 h-4 w-4" />
            <span>Profile Settings</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-destructive focus:text-destructive"
          data-testid="button-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
