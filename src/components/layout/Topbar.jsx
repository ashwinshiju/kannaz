import React, { useState, useEffect } from 'react';
import { Search, Bell, Sun, Moon, Menu, LogOut, User, Settings } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import useTheme from '@/hooks/useTheme';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import VehicleAvailabilityPanel from '@/components/layout/VehicleAvailabilityPanel';

export default function Topbar({ onMenuToggle, sidebarCollapsed }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await base44.auth.logout();
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 h-[calc(4rem_+_env(safe-area-inset-top))] bg-card/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 lg:px-6 transition-all duration-300 left-0",
        sidebarCollapsed ? "lg:left-[68px]" : "lg:left-[250px]"
      )}
    >
      {/* Left: Mobile menu + Search */}
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle} className="lg:hidden p-2 rounded-lg active:bg-accent">
          <Menu className="w-5 h-5" />
        </button>
        <div className={cn(
          "hidden md:flex items-center gap-2 bg-muted/50 rounded-lg px-3 h-9 transition-all",
          searchOpen ? "w-80" : "w-64"
        )}>
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search anything..."
            className="bg-transparent text-sm w-full outline-none placeholder:text-muted-foreground"
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setSearchOpen(false)}
          />
          <kbd className="hidden lg:inline-flex h-5 items-center rounded border border-border px-1.5 text-[10px] font-mono text-muted-foreground">⌘K</kbd>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg active:bg-accent text-muted-foreground active:text-foreground transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative p-2 rounded-lg active:bg-accent text-muted-foreground active:text-foreground transition-colors">
              <Bell className="w-[18px] h-[18px]" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <DropdownMenuItem asChild>
              <Link to="/trips" className="px-3 py-2 font-semibold text-sm border-b border-border block cursor-pointer active:bg-accent/50">
                Fleet Status
              </Link>
            </DropdownMenuItem>
            <VehicleAvailabilityPanel />
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 p-1.5 rounded-lg active:bg-accent transition-colors ml-1">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">
                  {user?.full_name?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium leading-none">{user?.full_name || 'User'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{user?.email || ''}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">{user?.full_name || 'User'}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer">
                <Settings className="w-4 h-4 mr-2" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}