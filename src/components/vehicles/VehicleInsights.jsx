import React from 'react';
import { Trophy, User, Car } from 'lucide-react';

export default function VehicleInsights({ trips, vehicles }) {
  if (!trips || trips.length === 0) return null;

  // Most used vehicle — by total trip count
  const tripCountByVehicle = {};
  trips.forEach((t) => {
    const key = t.vehicle_id || t.vehicle_name;
    if (!key) return;
    tripCountByVehicle[key] = (tripCountByVehicle[key] || 0) + 1;
  });
  const topVehicleKey = Object.entries(tripCountByVehicle).sort((a, b) => b[1] - a[1])[0];
  const topVehicle = topVehicleKey
    ? vehicles.find((v) => v.id === topVehicleKey[0] || v.name === topVehicleKey[0])
    : null;
  const topVehicleName = topVehicle?.name || topVehicleKey?.[0] || '—';

  // Top driver this week — most trips in the last 7 days
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const tripCountByDriver = {};
  const distanceByDriver = {};
  trips.forEach((t) => {
    const tripDate = new Date(t.completed_at || t.created_date).getTime();
    if (tripDate >= weekAgo && t.employee_name) {
      tripCountByDriver[t.employee_name] = (tripCountByDriver[t.employee_name] || 0) + 1;
      distanceByDriver[t.employee_name] = (distanceByDriver[t.employee_name] || 0) + (t.distance_km || 0);
    }
  });
  const topDriver = Object.entries(tripCountByDriver).sort((a, b) => b[1] - a[1])[0];

  const cards = [
    {
      icon: Trophy,
      label: 'Most Used Vehicle',
      value: topVehicleName,
      sub: `${topVehicleKey?.[1] || 0} trips`,
      color: 'bg-amber-500/10 text-amber-600',
    },
    {
      icon: User,
      label: 'Top Driver (This Week)',
      value: topDriver?.[0] || '—',
      sub: `${topDriver?.[1] || 0} trips • ${(distanceByDriver[topDriver?.[0]] || 0).toFixed(0)} km`,
      color: 'bg-blue-500/10 text-blue-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-card rounded-xl border border-border p-4 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${c.color}`}>
            <c.icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-sm font-semibold truncate">{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}