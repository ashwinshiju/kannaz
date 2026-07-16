import React from 'react';
import moment from 'moment';
import { Clock, User, Car } from 'lucide-react';

function formatDuration(mins) {
  if (mins == null) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function CompletedTripsList({ trips }) {
  const completed = trips.filter((t) => t.status === 'completed');
  const tz = 240;

  if (completed.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-semibold">No Completed Trips</h3>
        <p className="text-sm text-muted-foreground mt-1">Completed trips will appear here.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {completed.map((trip) => {
        const start = trip.started_at ? moment.utc(trip.started_at).utcOffset(tz) : null;
        const end = trip.completed_at ? moment.utc(trip.completed_at).utcOffset(tz) : null;
        return (
          <div key={trip.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{trip.trip_number || '—'}</span>
              <span className="text-xs text-muted-foreground capitalize">{trip.purpose}</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-medium">{trip.employee_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Car className="w-3.5 h-3.5" />
                <span>{trip.vehicle_name}</span>
              </div>
            </div>
            <div className="border-t border-border pt-2 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Start</span>
                <span className="font-medium">{start ? start.format('MMM D, HH:mm') : '—'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">End</span>
                <span className="font-medium">{end ? end.format('MMM D, HH:mm') : '—'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />Duration
                </span>
                <span className="font-semibold text-primary">{formatDuration(trip.duration_minutes)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}