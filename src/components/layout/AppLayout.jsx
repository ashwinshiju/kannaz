import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import AnimatedOutlet from '@/components/layout/AnimatedOutlet';
import { TabStackProvider } from '@/lib/tabStack';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import MobileNavHeader from '@/components/layout/MobileNavHeader';
import { useActiveTripTracking } from '@/hooks/useActiveTripTracking';
import { cn } from '@/lib/utils';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Start background GPS tracking for any in-progress trip — persists
  // across page navigation so waypoints are captured for the full trip.
  useActiveTripTracking();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <TabStackProvider>
      <div className="min-h-screen bg-background">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
        )}

        {/* Desktop sidebar */}
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          className="hidden lg:flex"
        />

        {/* Mobile sidebar */}
        <Sidebar
          collapsed={false}
          onToggle={() => setMobileOpen(false)}
          className={cn(
            "lg:hidden",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        />

        <Topbar
          onMenuToggle={() => setMobileOpen(!mobileOpen)}
          sidebarCollapsed={collapsed}
        />
        <main className={cn(
          "pt-[calc(4rem_+_env(safe-area-inset-top))] min-h-screen transition-all duration-300 pb-16 md:pb-0",
          collapsed ? "lg:ml-[68px]" : "lg:ml-[250px]"
        )}>
          <div className="p-4 lg:p-6">
            <MobileNavHeader />
            <AnimatedOutlet />
          </div>
        </main>

        <MobileBottomNav />
      </div>
    </TabStackProvider>
  );
}