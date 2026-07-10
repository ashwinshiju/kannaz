import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Route, Car, Map, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTabStack } from '@/lib/tabStack';

const tabs = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Trips', icon: Route, path: '/trips' },
  { label: 'Vehicles', icon: Car, path: '/vehicles' },
  { label: 'Reports', icon: Map, path: '/live-map' },
  { label: 'Settings', icon: SettingsIcon, path: '/settings' },
];

export default function MobileBottomNav() {
  const location = useLocation();
  const { lastTabPaths } = useTabStack();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border flex items-center justify-around px-1"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)', height: 'auto' }}
    >
      {tabs.map(tab => {
        const isActive = tab.path === '/'
          ? location.pathname === '/'
          : location.pathname === tab.path || location.pathname.startsWith(tab.path + '/');
        const targetPath = lastTabPaths[tab.path] || tab.path;
        return (
          <Link
            key={tab.path}
            to={targetPath}
            className={cn(
              "flex flex-col items-center gap-1 py-2 px-2 min-w-[56px] transition-colors",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <tab.icon className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-medium leading-none">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}