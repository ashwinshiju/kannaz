import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import {
  Users, Car, MapPin, Route, Fuel, Wrench, FileText, AlertTriangle,
  Plus, ArrowRight, Activity, Clock, CheckCircle2, TrendingUp, StopCircle
} from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import KPICard from '@/components/shared/KPICard';
import ChartCard from '@/components/shared/ChartCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { CardSkeleton } from '@/components/shared/LoadingSkeleton';
import { Button } from '@/components/ui/button';
import EndTripDialog from '@/components/trips/EndTripDialog';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [endTripOpen, setEndTripOpen] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
    loadStats();
  }, []);

  const loadStats = async () => {
    const [employees, vehicles, locations, trips, fuel, maintenance, docs, presets] = await Promise.all([
      base44.entities.Employee.list().catch(() => []),
      base44.entities.Vehicle.list().catch(() => []),
      base44.entities.Location.list().catch(() => []),
      base44.entities.Trip.list().catch(() => []),
      base44.entities.FuelRecord.list().catch(() => []),
      base44.entities.Maintenance.list().catch(() => []),
      base44.entities.Document.list().catch(() => []),
      base44.entities.LocationPreset.list().catch(() => []),
    ]);
    setStats({ employees, vehicles, locations, trips, fuel, maintenance, docs, presets });
    setLoading(false);
  };

  if (loading) return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Dashboard</h1></div>
      <CardSkeleton count={4} />
      <CardSkeleton count={2} />
    </div>
  );

  const s = stats;
  const activeTrips = s.trips.filter(t => t.status === 'in_progress').length;
  const availableVehicles = s.vehicles.filter(v => v.status === 'available').length;
  const expiringDocs = s.docs.filter(d => d.status === 'expiring_soon' || d.status === 'expired').length;
  const pendingMaint = s.maintenance.filter(m => m.status === 'scheduled').length;

  const tripsByStatus = ['created', 'in_progress', 'completed', 'acknowledged', 'cancelled'].map(status => ({
    name: status.replace(/_/g, ' '),
    value: s.trips.filter(t => t.status === status).length
  })).filter(d => d.value > 0);

  const vehiclesByStatus = ['available', 'in_use', 'maintenance', 'inactive'].map(status => ({
    name: status.replace(/_/g, ' '),
    value: s.vehicles.filter(v => v.status === status).length
  })).filter(d => d.value > 0);

  const recentTrips = [...s.trips].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5);
  const presetMap = new Map((s.presets || []).map(p => [p.id, p]));
  const activeUserTrip = currentUser
    ? s.trips.find((t) => t.status === 'in_progress' && t.employee_id === currentUser.id)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Fleet operations overview</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {activeUserTrip ? (
            <Button variant="destructive" size="sm" onClick={() => setEndTripOpen(true)} className="h-11 w-11 md:h-8 md:w-auto md:px-3">
              <StopCircle className="w-5 h-5 md:w-4 md:h-4 md:mr-1" /><span className="hidden md:inline">End Trip</span>
            </Button>
          ) : (
            <Button asChild size="sm" className="h-11 w-11 md:h-8 md:w-auto md:px-3">
              <Link to="/trips/new"><Plus className="w-5 h-5 md:w-4 md:h-4 md:mr-1" /><span className="hidden md:inline">Start a Trip</span></Link>
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/employees" className="block rounded-xl active:bg-accent/40 transition-colors">
          <KPICard title="Total Employees" value={s.employees.length} icon={Users} subtitle={`${s.employees.filter(e => e.status === 'active').length} active`} />
        </Link>
        <Link to="/vehicles" className="block rounded-xl active:bg-accent/40 transition-colors">
          <KPICard title="Fleet Vehicles" value={s.vehicles.length} icon={Car} subtitle={`${availableVehicles} available`} trend="up" trendValue="+2" />
        </Link>
        <Link to="/trips" className="block rounded-xl active:bg-accent/40 transition-colors">
          <KPICard title="Active Trips" value={activeTrips} icon={Route} subtitle={`${s.trips.length} total trips`} />
        </Link>
        <Link to="/locations" className="block rounded-xl active:bg-accent/40 transition-colors">
          <KPICard title="Locations" value={s.presets.length} icon={MapPin} subtitle={`${s.locations.length} raw locations`} />
        </Link>
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/maintenance" className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{pendingMaint}</p>
            <p className="text-xs text-muted-foreground">Pending Maintenance</p>
          </div>
        </Link>
        <Link to="/documents" className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{expiringDocs}</p>
            <p className="text-xs text-muted-foreground">Expiring Documents</p>
          </div>
        </Link>
        <Link to="/fuel" className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Fuel className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{s.fuel.length}</p>
            <p className="text-xs text-muted-foreground">Fuel Records</p>
          </div>
        </Link>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Trips by Status" subtitle="Current distribution">
          {tripsByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={tripsByStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                  {tripsByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">No trip data yet</div>
          )}
        </ChartCard>
        <ChartCard title="Vehicle Utilization" subtitle="By status">
          {vehiclesByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={vehiclesByStatus}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">No vehicle data yet</div>
          )}
        </ChartCard>
      </div>

      {/* Recent Trips */}
      <ChartCard title="Recent Trips" subtitle="Latest trip activity" action={
        <Button variant="ghost" size="sm" asChild><Link to="/trips">View all <ArrowRight className="w-4 h-4 ml-1" /></Link></Button>
      }>
        {recentTrips.length > 0 ? (
          <div className="divide-y divide-border">
            {recentTrips.map(trip => (
              <div key={trip.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Route className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {(() => {
                        const sp = trip.start_location_preset_id ? presetMap.get(trip.start_location_preset_id) : null;
                        const ep = trip.end_location_preset_id ? presetMap.get(trip.end_location_preset_id) : null;
                        const from = sp ? sp.name : (trip.start_location || '—');
                        const to = ep ? ep.name : (trip.end_location || '—');
                        return `${from} → ${to}`;
                      })()}
                    </p>
                    <p className="text-xs text-muted-foreground">{trip.employee_name} • {trip.vehicle_name}</p>
                  </div>
                </div>
                <StatusBadge status={trip.status} />
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">No trips yet</div>
        )}
      </ChartCard>

      {/* System Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Database', status: 'Operational', color: 'bg-emerald-500' },
          { label: 'API Server', status: 'Operational', color: 'bg-emerald-500' },
          { label: 'GPS Service', status: 'Simulated', color: 'bg-amber-500' },
          { label: 'Notifications', status: 'Operational', color: 'bg-emerald-500' },
        ].map(item => (
          <div key={item.label} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.status}</p>
            </div>
          </div>
        ))}
      </div>

      {/* End Trip dialog — opens directly from the dashboard */}
      {activeUserTrip && (
        <EndTripDialog
          trip={activeUserTrip}
          open={endTripOpen}
          onClose={(v) => {
            setEndTripOpen(v);
            if (!v) loadStats();
          }}
        />
      )}
    </div>
  );
}