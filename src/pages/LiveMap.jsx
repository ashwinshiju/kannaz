import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Route, Gauge, MapPin, Clock, AlertTriangle, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { cn } from '@/lib/utils';
import moment from 'moment';

export default function LiveMap() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightTripId = searchParams.get('trip');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const highlightRef = useRef(null);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list().catch(() => []),
  });
  const currentEmployee = employees.find((e) => e.email === user?.email);
  const canManage = currentEmployee?.role === 'manager' || currentEmployee?.role === 'admin';

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['trips', 'completed'],
    queryFn: async () => {
      const all = await base44.entities.Trip.list('-completed_at', 200);
      return all.filter((t) => t.status === 'completed');
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  // If a trip is highlighted via URL param but a vehicle filter would hide it,
  // reset to "all" so the highlighted trip is visible.
  useEffect(() => {
    if (highlightTripId && vehicleFilter !== 'all') {
      const trip = trips.find((t) => t.id === highlightTripId);
      if (trip && trip.vehicle_id !== vehicleFilter) {
        setVehicleFilter('all');
      }
    }
  }, [highlightTripId, vehicleFilter, trips]);

  // Scroll the highlighted trip card into view once loaded.
  useEffect(() => {
    if (highlightTripId && highlightRef.current && !isLoading) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightTripId, isLoading]);

  const clearHighlight = () => {
    if (highlightTripId) {
      searchParams.delete('trip');
      setSearchParams(searchParams);
    }
  };

  const filtered = useMemo(
    () =>
      vehicleFilter === 'all'
        ? trips
        : trips.filter((t) => t.vehicle_id === vehicleFilter),
    [trips, vehicleFilter]
  );

  // Aggregate totals
  const totalDistance = filtered.reduce((sum, t) => sum + (t.distance_km || 0), 0);
  const totalTrackedDistance = filtered.reduce(
    (sum, t) => sum + (t.tracked_distance_km || 0),
    0
  );
  const avgTrust =
    filtered.length > 0
      ? Math.round(
          filtered.reduce((s, t) => s + (t.end_trust_score || 0), 0) / filtered.length
        )
      : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Completed Trips</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Past trip summaries for all vehicles
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vehicles</SelectItem>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name} ({v.reg_no})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Aggregate summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Route className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-heading font-bold">{filtered.length}</p>
            <p className="text-xs text-muted-foreground">Completed Trips</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Gauge className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-heading font-bold">
              {Math.round(totalDistance * 100) / 100}
            </p>
            <p className="text-xs text-muted-foreground">Total Distance (km)</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Route className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-heading font-bold">
              {Math.round(totalTrackedDistance * 100) / 100}
            </p>
            <p className="text-xs text-muted-foreground">Tracked Distance (km)</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-heading font-bold">{avgTrust}</p>
            <p className="text-xs text-muted-foreground">Avg GPS Trust Score</p>
          </div>
        </div>
      </div>

      {/* Individual trip summary cards */}
      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Route className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No completed trips found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((trip) => (
            <div
              key={trip.id}
              ref={trip.id === highlightTripId ? highlightRef : undefined}
              onClick={clearHighlight}
              className={cn(
                "rounded-lg border bg-card p-3 space-y-2 transition-all",
                trip.id === highlightTripId
                  ? "border-primary ring-2 ring-primary shadow-lg"
                  : "border-border active:bg-muted/30 cursor-default",
                trip.id === highlightTripId && "cursor-pointer"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                    {trip.trip_number || '—'}
                  </span>
                  <p className="text-sm font-medium mt-1">{trip.vehicle_name || '—'}</p>
                </div>
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                {trip.completed_at
                  ? moment(trip.completed_at).format('MMM DD, YYYY · HH:mm')
                  : '—'}
                {(() => {
                  const mins = trip.duration_minutes != null
                    ? trip.duration_minutes
                    : (trip.started_at && trip.completed_at
                        ? Math.round(moment(trip.completed_at).diff(moment(trip.started_at), 'minutes', true))
                        : null);
                  if (mins == null) return null;
                  const h = Math.floor(mins / 60);
                  const m = mins % 60;
                  return (
                    <span className="ml-2 inline-flex items-center gap-1 text-primary">
                      <Clock className="w-3 h-3" />
                      {h > 0 ? `${h}h ${m}m` : `${m}m`}
                    </span>
                  );
                })()}
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Start:</span>
                  <span className="font-medium">
                    {trip.start_odometer != null ? `${trip.start_odometer} km` : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">End:</span>
                  <span className="font-medium">
                    {trip.end_odometer != null ? `${trip.end_odometer} km` : '—'}
                  </span>
                </div>
              </div>
              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Gauge className="w-3.5 h-3.5" />
                    <span className="text-sm">Total Distance</span>
                  </div>
                  <span className="text-base font-heading font-bold text-primary">
                    {trip.distance_km != null ? `${trip.distance_km} km` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Route className="w-3.5 h-3.5" />
                    <span className="text-sm">Tracked Distance</span>
                  </div>
                  <span className="text-base font-heading font-bold text-primary">
                    {trip.tracked_distance_km != null ? `${trip.tracked_distance_km} km` : '—'}
                  </span>
                </div>
                {trip.low_tracking_data && (
                  <div className="flex items-center gap-1.5 text-xs text-warning bg-warning/10 border border-warning/30 rounded-md px-2 py-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>Low tracking data — distance estimated from start/end points</span>
                  </div>
                )}
                {trip.distance_mismatch && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-2 py-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>⚠ Distance mismatch — possible tracking gaps</span>
                  </div>
                )}
                {trip.tracking_gap_count > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {trip.tracking_gap_count} tracking gap(s) detected
                    {trip.low_tracking_data ? ' — tracked distance may be incomplete' : ''}
                  </p>
                )}
                {trip.raw_points_captured != null && trip.valid_points_count != null && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">
                      GPS Points: {trip.valid_points_count}/{trip.raw_points_captured} valid
                      {trip.raw_points_captured - trip.valid_points_count > 0 && (
                        <span className="text-warning"> · {trip.raw_points_captured - trip.valid_points_count} discarded</span>
                      )}
                    </p>
                    {trip.raw_points_captured - trip.valid_points_count > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                        {(trip.discarded_spoofed_count ?? 0) > 0 && (
                          <span className="text-destructive">Spoofing: {trip.discarded_spoofed_count}</span>
                        )}
                        {(trip.discarded_jump_count ?? 0) > 0 && (
                          <span className="text-warning">Jumps: {trip.discarded_jump_count}</span>
                        )}
                        {(trip.discarded_low_trust_count ?? 0) > 0 && (
                          <span className="text-muted-foreground">Low trust: {trip.discarded_low_trust_count}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {trip.notes && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Remark</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">{trip.notes}</p>
                </div>
              )}
              {trip.end_trust_score != null && (
                <p className="text-xs text-muted-foreground">
                  GPS Trust Score: {trip.end_trust_score}/100
                </p>
              )}
              {trip.start_lat != null && trip.start_lng != null && trip.end_lat != null && trip.end_lng != null && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${trip.start_lat},${trip.start_lng}&destination=${trip.end_lat},${trip.end_lng}&travelmode=driving`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1">
                    <Navigation className="w-3.5 h-3.5" /> Route
                  </Button>
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}