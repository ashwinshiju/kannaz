import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EmptyState({ icon: Icon = Inbox, title = 'No data found', description, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && (
        <Button onClick={action} className="mt-4">{actionLabel || 'Get Started'}</Button>
      )}
    </div>
  );
}