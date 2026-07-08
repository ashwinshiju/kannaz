import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigation } from 'lucide-react';

/**
 * Fetches the driving-route distance between a trip's start and end GPS
 * coordinates using the OpenStreetMap OSRM public API, then displays it
 * alongside the odometer-based total distance.
 */
export default function TripRouteDistance({ trip }) {
  const hasCoords =
    trip.start_lat != null && trip.start_lng != null &&
    trip.end_lat != null && trip.end_lng != null;

  const { data: routeKm, isLoading, isError } = useQuery({
    queryKey: ['osrm-route', trip.id, trip.start_lat, trip.start_lng, trip.end_lat, trip.end_lng],
    queryFn: async () => {
      const url = `https://router.project-osrm.org/route/v1/driving/` +
        `${trip.start_lng},${trip.start_lat};${trip.end_lng},${trip.end_lat}?overview=false`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('OSRM request failed');
      const json = await res.json();
      const meters = json?.routes?.[0]?.distance;
      if (meters == null) throw new Error('No route found');
      return Math.round((meters / 1000) * 100) / 100;
    },
    enabled: hasCoords,
    staleTime: 1000 * 60 * 10,
  });

  if (!hasCoords) return null;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Navigation className="w-3.5 h-3.5" />
        <span className="text-sm">Map Route Distance</span>
      </div>
      <span className="text-sm font-heading font-bold text-accent-foreground">
        {isLoading ? (
          <span className="text-muted-foreground">…</span>
        ) : isError ? (
          <span className="text-xs text-destructive">N/A</span>
        ) : (
          `${routeKm} km`
        )}
      </span>
    </div>
  );
}