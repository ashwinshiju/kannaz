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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EndTripDialog from '@/components/trips/EndTripDialog';
import MaintenanceAlertPopup from '@/components/maintenance/MaintenanceAlertPopup';

const VEHICLE_COLORS = { 'Rental MG': '#3b82f6', 'Hyundai Tucson': '#10b981', 'Urvan': '#ec4899' };
const FALLBACK_COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#a855f7', '#14b8a6'];
const vehicleColorFor = (name, index) => VEHICLE_COLORS[name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [endTripOpen, setEndTripOpen] = useState(false);
  const [pieMonthOffset, setPieMonthOffset] = useState(0); // 0 = current month

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
    loadStats();
  }, []);

  const loadStats = async () => {
    const [employees, vehicles, locations, trips, fuel, maintenance, docs, presets, notifs] = await Promise.all([
      base44.entities.Employee.list().catch(() => []),
      base44.entities.Vehicle.list().catch(() => []),
      base44.entities.Location.list().catch(() => []),
      base44.entities.Trip.list().catch(() => []),
      base44.entities.FuelRecord.list().catch(() => []),
      base44.entities.Maintenance.list().catch(() => []),
      base44.entities.Document.list().catch(() => []),
      base44.entities.LocationPreset.list().catch(() => []),
      base44.entities.Notification.filter({ type: 'maintenance', is_read: false }).catch(() => []),
    ]);
    setStats({ employees, vehicles, locations, trips, fuel, maintenance, docs, presets, notifs });
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
  const now = new Date();
  const expiringDocs = s.docs.filter(d => {
    if (!d.expiry_date) return false;
    const expiry = new Date(d.expiry_date);
    const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30; // expired or expiring within 30 days
  }).length;
  const pendingMaint = s.maintenance.filter(m => m.status === 'scheduled' || m.status === 'in_progress').length + (s.notifs?.length || 0);

  const availableVehicleIds = new Set(s.vehicles.filter(v => v.status === 'available').map(v => v.name));
  const pieMonthDate = new Date(now.getFullYear(), now.getMonth() - pieMonthOffset, 1);
  const pieMonthLabel = pieMonthDate.toLocaleString('default', { month: 'short', year: '2-digit' });
  const tripsByVehicle = (() => {
    const map = {};
    s.trips.forEach(t => {
      const name = t.vehicle_name || 'Unknown';
      if (!availableVehicleIds.has(name)) return;
      const td = new Date(t.started_at || t.created_date);
      if (td.getFullYear() !== pieMonthDate.getFullYear() || td.getMonth() !== pieMonthDate.getMonth()) return;
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  })();
  const pieMonthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { offset: i, label: d.toLocaleString('default', { month: 'short', year: '2-digit' }) };
  });

  const vehiclesByStatus = ['available', 'in_use', 'maintenance', 'inactive'].map(status => ({
    name: status.replace(/_/g, ' '),
    value: s.vehicles.filter(v => v.status === status).length
  })).filter(d => d.value > 0);

  const monthlyTrips = (() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('default', { month: 'short' });
      const count = s.trips.filter(t => {
        const td = new Date(t.started_at || t.created_date);
        return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth();
      }).length;
      months.push({ name: label, trips: count });
    }
    return months;
  })();

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
        <ChartCard title="Trips by Available Vehicle" subtitle={`Distribution for ${pieMonthLabel}`} action={
          <Select value={String(pieMonthOffset)} onValueChange={v => setPieMonthOffset(Number(v))}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {pieMonthOptions.map(o => <SelectItem key={o.offset} value={String(o.offset)}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        }>
          {tripsByVehicle.length > 0 ? (
            <div className="flex flex-col items-center gap-3">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={tripsByVehicle} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                    {tripsByVehicle.map((entry, i) => <Cell key={i} fill={vehicleColorFor(entry.name, i)} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
                {tripsByVehicle.map((entry, i) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: vehicleColorFor(entry.name, i) }} />
                    <span className="text-xs text-muted-foreground">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">No trip data yet</div>
          )}
        </ChartCard>
        <ChartCard title="Monthly Vehicle Trips" subtitle="Trips per month (last 6 months)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyTrips}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip />
              <Bar dataKey="trips" name="Trips" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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

      <MaintenanceAlertPopup />

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