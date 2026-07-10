import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, Car, MapPin, Route, Fuel,
  Wrench, FileText, BarChart3, Map, Settings, Shield, ClipboardList,
  ChevronLeft, ChevronRight, ChevronDown
} from 'lucide-react';

const KANAZ_LOGO = 'https://media.base44.com/images/public/6a4c8bd5aa47eccb6a382770/29e671028_Kanas.png';
import { cn } from '@/lib/utils';

const navGroups = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    ]
  },
  {
    label: 'Fleet',
    items: [
      { label: 'Trips', icon: Route, path: '/trips' },
      { label: 'Vehicles', icon: Car, path: '/vehicles' },
      { label: 'Reports', icon: Map, path: '/live-map' },
    ]
  },
  {
    label: 'Management',
    items: [
      { label: 'Employees', icon: Users, path: '/employees' },
      { label: 'Departments', icon: Building2, path: '/departments' },
      { label: 'Locations', icon: MapPin, path: '/locations' },
    ]
  },
  {
    label: 'Operations',
    items: [
      { label: 'Fuel Log', icon: Fuel, path: '/fuel' },
      { label: 'Maintenance', icon: Wrench, path: '/maintenance' },
      { label: 'Documents', icon: FileText, path: '/documents' },
    ]
  },
  {
    label: 'Insights',
    items: [
      { label: 'Audit Logs', icon: ClipboardList, path: '/audit-log' },
    ]
  },
  {
    label: 'Admin',
    items: [
      { label: 'Permissions', icon: Shield, path: '/permissions' },
      { label: 'Settings', icon: Settings, path: '/settings' },
    ]
  }
];

export default function Sidebar({ collapsed, onToggle, className }) {
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState(navGroups.map(g => g.label));

  const toggleGroup = (label) => {
    setOpenGroups(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-card border-r border-border flex flex-col transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[250px]",
        className
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <img src={KANAZ_LOGO} alt="KANAZ" className="w-8 h-8 rounded-lg object-cover shrink-0" />
          {!collapsed && (
            <span className="font-bold text-lg tracking-tight truncate">KANAZ</span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2">
        {navGroups.map(group => (
          <div key={group.label} className="mb-1">
            {!collapsed && (
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                {group.label}
                <ChevronDown className={cn(
                  "w-3 h-3 transition-transform",
                  !openGroups.includes(group.label) && "-rotate-90"
                )} />
              </button>
            )}
            {(collapsed || openGroups.includes(group.label)) && (
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <item.icon className={cn("w-[18px] h-[18px] shrink-0", isActive && "text-primary")} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t border-border p-2 shrink-0">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}