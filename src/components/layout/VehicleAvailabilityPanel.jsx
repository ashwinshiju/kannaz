import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Car, User, Loader2, CircleDot } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

/**
 * VehicleAvailabilityPanel — live board of vehicle usage status.
 *
 * Reuses the same Vehicle entity and Trip entity used by the Start Trip
 * dropdown and vehicle availability logic. No new status fields or parallel
 * data source introduced — "in use" is derived from the active in-progress
 * Trip record referencing that vehicle (employee_name field).
 */
export default function VehicleAvailabilityPanel() {
  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const { data: recentTrips = [] } = useQuery({
    queryKey: ['trips', 'recent'],
    queryFn: async () => {
      const all = await base44.entities.Trip.list('-created_date', 200);
      return all;
    },
  });

  const activeTrips = recentTrips.filter((t) => t.status === 'in_progress');
  const completedTrips = recentTrips.filter((t) => t.status === 'completed');

  // Map vehicle_id → driver name from the active trip (in-progress)
  const usageByVehicleId = {};
  activeTrips.forEach((trip) => {
    if (trip.vehicle_id) usageByVehicleId[trip.vehicle_id] = trip.employee_name || '—';
  });

  // Map vehicle_id → driver name from the most recently completed trip (for reserved vehicles)
  const reservedByVehicleId = {};
  completedTrips.forEach((trip) => {
    if (trip.vehicle_id && !reservedByVehicleId[trip.vehicle_id]) {
      reservedByVehicleId[trip.vehicle_id] = trip.employee_name || '—';
    }
  });

  const inUse = vehicles.filter((v) => v.status === 'in_use' && usageByVehicleId[v.id]);
  const available = vehicles.filter((v) => v.status === 'available');
  const reserved = vehicles.filter((v) => v.status === 'reserved');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Available now */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 mb-1.5">
          <CircleDot className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-semibold text-foreground">Available now</span>
          <span className="ml-auto text-xs text-muted-foreground">{available.length}</span>
        </div>
        {available.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1 py-2">No vehicles free right now</p>
        ) : (
          <div className="space-y-1">
            {available.map((v) => (
              <Link key={v.id} to="/trips" className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-accent/50 transition-colors">
                <Car className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{v.name || `${v.make} ${v.model}`}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{v.reg_no}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Reserved / Held */}
      {reserved.length > 0 && (
        <>
          <div className="border-t border-border" />
          <div className="px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <CircleDot className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-xs font-semibold text-foreground">Reserved / Held</span>
              <span className="ml-auto text-xs text-muted-foreground">{reserved.length}</span>
            </div>
            <div className="space-y-1">
              {reserved.map((v) => (
                <Link key={v.id} to="/trips" className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-accent/50 transition-colors">
                  <Car className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{v.name || `${v.make} ${v.model}`}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{v.reg_no}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <User className="w-3 h-3" />
                    <span className="max-w-[80px] truncate">{reservedByVehicleId[v.id] || '—'}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Currently in use */}
      {inUse.length > 0 && (
        <>
          <div className="border-t border-border" />
          <div className="px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <CircleDot className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-foreground">Currently in use</span>
              <span className="ml-auto text-xs text-muted-foreground">{inUse.length}</span>
            </div>
            <div className="space-y-1">
              {inUse.map((v) => (
                <Link key={v.id} to="/trips" className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-accent/50 transition-colors">
                  <Car className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{v.name || `${v.make} ${v.model}`}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{v.reg_no}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <User className="w-3 h-3" />
                    <span className="max-w-[80px] truncate">{usageByVehicleId[v.id]}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}