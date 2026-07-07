import React from 'react';
import { cn } from '@/lib/utils';

export default function ChartCard({ title, subtitle, children, className, action }) {
  return (
    <div className={cn("bg-card rounded-xl border border-border p-5", className)}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}