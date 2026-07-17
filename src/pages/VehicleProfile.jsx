import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Car, Route, Fuel, Wrench, FileText, DollarSign } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/shared/StatusBadge';
import KPICard from '@/components/shared/KPICard';
import DataTable from '@/components/shared/DataTable';
import { CardSkeleton } from '@/components/shared/LoadingSkeleton';
import moment from 'moment';

export default function VehicleProfile() {
  const { id } = useParams();
  const [vehicle, setVehicle] = useState(null);
  const [trips, setTrips] = useState([]);
  const [fuel, setFuel] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [v, allTrips, allFuel, allMaint, allDocs] = await Promise.all([
        base44.entities.Vehicle.get(id),
        base44.entities.Trip.filter({ vehicle_id: id }).catch(() => []),
        base44.entities.FuelRecord.filter({ vehicle_id: id }).catch(() => []),
        base44.entities.Maintenance.filter({ vehicle_id: id }).catch(() => []),
        base44.entities.Document.filter({ vehicle_id: id }).catch(() => []),
      ]);
      setVehicle(v);
      setTrips(allTrips);
      setFuel(allFuel);
      setMaintenance(allMaint);
      setDocs(allDocs);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return <div className="space-y-6"><CardSkeleton count={4} /></div>;
  if (!vehicle) return <div className="text-center py-16 text-muted-foreground">Vehicle not found</div>;

  const totalFuelCost = fuel.reduce((s, f) => s + (f.cost || 0), 0);
  const totalMaintCost = maintenance.reduce((s, m) => s + (m.cost || 0), 0);
  const totalDistance = trips.reduce((sum, t) => sum + (t.distance_km || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild><Link to="/vehicles"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link></Button>
      </div>

      {/* Vehicle Header */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <Car className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{vehicle.name}</h1>
              <StatusBadge status={vehicle.status} />
            </div>
            <p className="text-muted-foreground mt-1">
              {vehicle.make} {vehicle.model} {vehicle.year && `(${vehicle.year})`} • {vehicle.reg_no}
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>Odometer: <span className="font-semibold text-foreground">{vehicle.current_odometer?.toLocaleString() || 0} km</span></p>
            <p>Fuel: <span className="capitalize">{vehicle.fuel_type || '—'}</span></p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Trips" value={trips.length} icon={Route} />
        <KPICard title="Distance Travelled" value={`${totalDistance.toFixed(0)} km`} icon={Route} />
        <KPICard title="Fuel Records" value={fuel.length} icon={Fuel} subtitle={`$${totalFuelCost.toFixed(0)} total`} />
        <KPICard title="Maintenance" value={maintenance.length} icon={Wrench} subtitle={`$${totalMaintCost.toFixed(0)} total`} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="trips">
        <TabsList>
          <TabsTrigger value="trips">Trips ({trips.length})</TabsTrigger>
          <TabsTrigger value="fuel">Fuel ({fuel.length})</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance ({maintenance.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({docs.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="trips" className="mt-4">
          <DataTable
            data={trips}
            columns={[
              { key: 'trip_number', label: 'Trip #' },
              { key: 'employee_name', label: 'Employee' },
              { key: 'start_location', label: 'From' },
              { key: 'end_location', label: 'To' },
              { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
              { key: 'created_date', label: 'Date', render: (v) => v ? moment(v).format('MMM DD') : '—' },
            ]}
            emptyTitle="No trips for this vehicle"
          />
        </TabsContent>
        <TabsContent value="fuel" className="mt-4">
          <DataTable
            data={fuel}
            columns={[
              { key: 'fuel_date', label: 'Date', render: (v) => v ? moment(v).format('MMM DD, YYYY') : '—' },
              { key: 'litres', label: 'Litres', render: (v) => v ? `${v} L` : '—' },
              { key: 'cost', label: 'Cost', render: (v) => v ? `$${v}` : '—' },
              { key: 'station', label: 'Station' },
            ]}
            emptyTitle="No fuel records"
          />
        </TabsContent>
        <TabsContent value="maintenance" className="mt-4">
          <DataTable
            data={maintenance}
            columns={[
              { key: 'service_type', label: 'Service', render: (v) => <span className="capitalize">{v?.replace(/_/g, ' ')}</span> },
              { key: 'scheduled_date', label: 'Date', render: (v) => v ? moment(v).format('MMM DD, YYYY') : '—' },
              { key: 'cost', label: 'Cost', render: (v) => v ? `$${v}` : '—' },
              { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
            ]}
            emptyTitle="No maintenance records"
          />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <DataTable
            data={docs}
            columns={[
              { key: 'doc_type', label: 'Type', render: (v) => <span className="capitalize">{v?.replace(/_/g, ' ')}</span> },
              { key: 'doc_number', label: 'Doc #' },
              { key: 'expiry_date', label: 'Expiry', render: (v) => v ? moment(v).format('MMM DD, YYYY') : '—' },
              { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
            ]}
            emptyTitle="No documents"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}