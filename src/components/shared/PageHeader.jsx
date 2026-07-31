import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function PageHeader({ title, subtitle, action, actionLabel, actionIcon, children }) {
  const Icon = actionIcon || Plus;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1 hidden">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {children}
        {action &&
        <Button onClick={action} className="gap-2">
            <Icon className="w-4 h-4" />
            {actionLabel || 'Add New'}
          </Button>
        }
      </div>
    </div>);

}