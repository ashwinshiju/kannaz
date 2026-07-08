import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Route, Gauge, MapPin, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import moment from 'moment';

export default function LiveMap() {
  const [vehicleFilter, setVehicleFilter] = useState('all');

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

  const filtered =
    vehicleFilter === 'all'
      ? trips
      : trips.filter((t) => t.vehicle_id === vehicleFilter);

  // Aggregate totals
  const totalDistance = filtered.reduce((sum, t) => sum + (t.distance_km || 0), 0);
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

      {/* Aggregate summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <div key={trip.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
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
              <div className="flex items-center justify-between border-t border-border pt-3">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="text-sm">Total Distance</span>
                </div>
                <span className="text-lg font-heading font-bold text-primary">
                  {trip.distance_km != null ? `${trip.distance_km} km` : '—'}
                </span>
              </div>
              {trip.end_trust_score != null && (
                <p className="text-xs text-muted-foreground">
                  GPS Trust Score: {trip.end_trust_score}/100
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}