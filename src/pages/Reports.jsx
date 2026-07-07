import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  BarChart3, Download, Filter, ChevronDown, Route, Car, Users, Building2, MapPin
} from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ChartCard from '@/components/shared/ChartCard';
import KPICard from '@/components/shared/KPICard';
import { CardSkeleton } from '@/components/shared/LoadingSkeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Reports() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    const load = async () => {
      const [trips, vehicles, employees, fuel, maintenance] = await Promise.all([
        base44.entities.Trip.list().catch(() => []),
        base44.entities.Vehicle.list().catch(() => []),
        base44.entities.Employee.list().catch(() => []),
        base44.entities.FuelRecord.list().catch(() => []),
        base44.entities.Maintenance.list().catch(() => []),
      ]);
      setStats({ trips, vehicles, employees, fuel, maintenance });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Reports</h1></div><CardSkeleton count={4} /></div>;

  const s = stats;
  const totalFuelCost = s.fuel.reduce((a, f) => a + (f.cost || 0), 0);
  const totalMaintCost = s.maintenance.reduce((a, m) => a + (m.cost || 0), 0);

  const tripsByPurpose = ['official', 'personal', 'maintenance'].map(p => ({
    name: p.charAt(0).toUpperCase() + p.slice(1),
    value: s.trips.filter(t => t.purpose === p).length,
  })).filter(d => d.value > 0);

  const vehiclesByFuel = ['petrol', 'diesel', 'electric', 'hybrid', 'cng'].map(f => ({
    name: f.charAt(0).toUpperCase() + f.slice(1),
    value: s.vehicles.filter(v => v.fuel_type === f).length,
  })).filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Report Center</h1>
          <p className="text-sm text-muted-foreground mt-1">Fleet analytics and insights</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1"><Download className="w-4 h-4" /> Export</Button>
        </div>
      </div>

      {/* Collapsible Filters */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            Advanced Filters
            <ChevronDown className={cn("w-4 h-4 transition-transform", filtersOpen && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="bg-card rounded-lg border border-border p-4 mt-2 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Select><SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger><SelectContent><SelectItem value="all">All Departments</SelectItem></SelectContent></Select>
            <Select><SelectTrigger><SelectValue placeholder="Vehicle" /></SelectTrigger><SelectContent><SelectItem value="all">All Vehicles</SelectItem></SelectContent></Select>
            <Select><SelectTrigger><SelectValue placeholder="Employee" /></SelectTrigger><SelectContent><SelectItem value="all">All Employees</SelectItem></SelectContent></Select>
            <Select><SelectTrigger><SelectValue placeholder="Trip Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem></SelectContent></Select>
            <Button className="h-9">Apply Filters</Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Trips" value={s.trips.length} icon={Route} />
        <KPICard title="Fleet Size" value={s.vehicles.length} icon={Car} />
        <KPICard title="Fuel Spend" value={`$${totalFuelCost.toFixed(0)}`} icon={BarChart3} />
        <KPICard title="Maintenance Spend" value={`$${totalMaintCost.toFixed(0)}`} icon={BarChart3} />
      </div>

      <Tabs defaultValue="trips">
        <TabsList>
          <TabsTrigger value="trips">Trip Reports</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicle Reports</TabsTrigger>
          <TabsTrigger value="employees">Employee Reports</TabsTrigger>
          <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="trips" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Trips by Purpose">
              {tripsByPurpose.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={tripsByPurpose} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" label>
                      {tripsByPurpose.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">No trip data</div>}
            </ChartCard>
            <ChartCard title="Trip Status Distribution">
              {s.trips.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={['created', 'in_progress', 'completed', 'acknowledged'].map(st => ({
                    name: st.replace(/_/g, ' '),
                    count: s.trips.filter(t => t.status === st).length,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip /><Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">No trip data</div>}
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="vehicles" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Vehicles by Fuel Type">
              {vehiclesByFuel.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={vehiclesByFuel} cx="50%" cy="50%" outerRadius={85} dataKey="value" label>
                      {vehiclesByFuel.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">No vehicle data</div>}
            </ChartCard>
            <ChartCard title="Vehicle Status">
              {s.vehicles.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={['available', 'in_use', 'maintenance', 'inactive'].map(st => ({
                    name: st.replace(/_/g, ' '),
                    count: s.vehicles.filter(v => v.status === st).length,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip /><Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">No vehicle data</div>}
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="employees" className="mt-4">
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold">Employee Analytics</h3>
            <p className="text-sm text-muted-foreground mt-1">Trip history, performance metrics, and vehicle usage will appear here as data grows.</p>
          </div>
        </TabsContent>

        <TabsContent value="costs" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Cost Breakdown">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={[
                    { name: 'Fuel', value: totalFuelCost || 1 },
                    { name: 'Maintenance', value: totalMaintCost || 1 },
                  ]} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" label>
                    <Cell fill="#3b82f6" /><Cell fill="#f59e0b" />
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <div className="bg-card rounded-xl border border-border p-8 text-center flex items-center justify-center">
              <div>
                <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold">Cost Trends</h3>
                <p className="text-sm text-muted-foreground mt-1">Monthly cost trends will display as more data is collected.</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Export Placeholders */}
      <div className="bg-card rounded-xl border border-border p-4 flex items-center justify-between">
        <span className="text-sm font-medium">Export Reports</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1"><Download className="w-3 h-3" /> Excel</Button>
          <Button variant="outline" size="sm" className="gap-1"><Download className="w-3 h-3" /> PDF</Button>
          <Button variant="outline" size="sm" className="gap-1"><Download className="w-3 h-3" /> CSV</Button>
        </div>
      </div>
    </div>
  );
}