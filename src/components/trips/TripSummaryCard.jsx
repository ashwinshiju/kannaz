import React from 'react';
import { Route, Gauge, MapPin, Clock } from 'lucide-react';

/**
 * Displays a compact summary of a completed trip — start/end odometer,
 * total distance, and GPS trust score.
 */
export default function TripSummaryCard({ trip }) {
  if (!trip) return null;

  const startOdo = trip.start_odometer;
  const endOdo = trip.end_odometer;
  const distance = trip.distance_km;
  const hasDistance = distance != null;
  const computedDistance =
    !hasDistance && startOdo != null && endOdo != null
      ? Math.round((endOdo - startOdo) * 100) / 100
      : distance;

  const trust = trip.end_trust_score;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-primary">
        <Route className="w-4 h-4" />
        <span className="text-sm font-heading font-semibold">Trip Summary</span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Start:</span>
          <span className="font-medium">{startOdo != null ? `${startOdo} km` : '—'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">End:</span>
          <span className="font-medium">{endOdo != null ? `${endOdo} km` : '—'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-primary/15 pt-3">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="w-3.5 h-3.5" />
          <span className="text-sm">Total Distance</span>
        </div>
        <span className="text-lg font-heading font-bold text-primary">
          {computedDistance != null ? `${computedDistance} km` : '—'}
        </span>
      </div>

      {trust != null && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          GPS Trust Score: {trust}/100
        </div>
      )}
    </div>
  );
}