import React from 'react';
import { cn } from '@/lib/utils';

const statusStyles = {
  active: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  available: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  acknowledged: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  valid: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  in_use: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  in_progress: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  created: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  scheduled: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  expiring_soon: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  maintenance: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  disabled: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
  inactive: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
  cancelled: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
  expired: 'bg-red-500/10 text-red-700 dark:text-red-400',
  error: 'bg-red-500/10 text-red-700 dark:text-red-400',
};

export default function StatusBadge({ status, className }) {
  const normalized = status?.toLowerCase().replace(/\s+/g, '_');
  const style = statusStyles[normalized] || 'bg-gray-500/10 text-gray-600';
  const display = status?.replace(/_/g, ' ');

  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize whitespace-nowrap",
      style, className
    )}>
      {display}
    </span>
  );
}