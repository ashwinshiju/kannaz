import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Car, Gauge } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import FormModal from '@/components/shared/FormModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import StatusBadge from '@/components/shared/StatusBadge';
import PullToRefresh from '@/components/shared/PullToRefresh';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import VehicleInsights from '@/components/vehicles/VehicleInsights';
import { useToast } from '@/components/ui/use-toast';

const QUERY_KEY = ['vehicles'];

const fields = [
  { key: 'reg_no', label: 'Registration No', required: true },
  { key: 'name', label: 'Vehicle Name', required: true },
  { key: 'make', label: 'Make', required: true },
  { key: 'model', label: 'Model', required: true },
  { key: 'year', label: 'Year', type: 'number' },
  { key: 'color', label: 'Color' },
  { key: 'fuel_type', label: 'Fuel Type', type: 'select', options: [
    { value: 'petrol', label: 'Petrol' }, { value: 'diesel', label: 'Diesel' },
    { value: 'electric', label: 'Electric' }, { value: 'hybrid', label: 'Hybrid' }, { value: 'cng', label: 'CNG' },
  ]},
  { key: 'assigned_department', label: 'Assigned Department' },
  { key: 'current_odometer', label: 'Current Odometer (km)', type: 'number' },
  { key: 'insurance_expiry', label: 'Insurance Expiry', type: 'date' },
  { key: 'registration_expiry', label: 'Registration Expiry', type: 'date' },
  { key: 'status', label: 'Status', type: 'select', options: [
    { value: 'available', label: 'Available' }, { value: 'in_use', label: 'In Use' },
    { value: 'maintenance', label: 'Maintenance' }, { value: 'inactive', label: 'Inactive' },
  ]},
];

const baseColumns = [
  { key: 'reg_no', label: 'Reg No', render: (val) => <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{val}</span> },
  { key: 'name', label: 'Vehicle', render: (val, row) => (
    <Link to={`/vehicles/${row.id}`} className="font-medium text-primary hover:underline">{val}</Link>
  )},
  { key: 'make', label: 'Make' },
  { key: 'model', label: 'Model' },
  { key: 'fuel_type', label: 'Fuel', render: (val) => <span className="capitalize">{val || '—'}</span> },
  { key: 'assigned_department', label: 'Department' },
  { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> },
];

export default function Vehicles() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data = [], isLoading: loading, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => base44.entities.Vehicle.list(),
  });

  // Fetch trips to compute per-vehicle distance and weekly insights.
  const { data: trips = [] } = useQuery({
    queryKey: ['trips'],
    queryFn: () => base44.entities.Trip.list().catch(() => []),
  });

  const distanceByVehicle = useMemo(() => {
    const m = {};
    trips.forEach((t) => {
      const key = t.vehicle_id || t.vehicle_name;
      if (!key) return;
      m[key] = (m[key] || 0) + (t.distance_km || 0);
    });
    return m;
  }, [trips]);

  const columns = useMemo(() => [
    ...baseColumns.slice(0, 2),
    {
      key: '_distance', label: 'Distance',
      render: (_, row) => {
        const km = row._distance || 0;
        return <span className="text-sm font-medium">{km > 0 ? `${km.toFixed(0)} km` : '—'}</span>;
      },
    },
    ...baseColumns.slice(2),
  ], []);

  const tableData = useMemo(() =>
    data.map((v) => ({
      ...v,
      _distance: distanceByVehicle[v.id] ?? distanceByVehicle[v.name] ?? 0,
    })),
  [data, distanceByVehicle]);

  // Fetch Employee records to resolve the current user's role and department.
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list().catch(() => []),
  });
  const currentEmployee = employees.find((e) => e.email === user?.email);
  const canManage = currentEmployee?.role === 'manager' || currentEmployee?.role === 'admin';

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const openCreate = () => { setEditing(null); setForm({ status: 'available', fuel_type: 'petrol' }); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    const previous = queryClient.getQueryData(QUERY_KEY);
    try {
      if (editing) {
        queryClient.setQueryData(QUERY_KEY, (old) =>
          (old || []).map(item => item.id === editing.id ? { ...item, ...form } : item)
        );
        await base44.entities.Vehicle.update(editing.id, form);
        toast({ title: 'Vehicle updated' });
      } else {
        const tempId = `temp-${Date.now()}`;
        queryClient.setQueryData(QUERY_KEY, (old) => [...(old || []), { ...form, id: tempId }]);
        await base44.entities.Vehicle.create(form);
        toast({ title: 'Vehicle added' });
      }
    } catch {
      // Rollback: restore previous cache if the base44 transaction failed
      queryClient.setQueryData(QUERY_KEY, previous);
      toast({ title: 'Failed to save vehicle', variant: 'destructive' });
    } finally {
      setSaving(false);
      setModalOpen(false);
      queryClient.invalidateQueries(QUERY_KEY);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    const previous = queryClient.getQueryData(QUERY_KEY);
    queryClient.setQueryData(QUERY_KEY, (old) => (old || []).filter(item => item.id !== deleteDialog.id));
    try {
      await base44.entities.Vehicle.delete(deleteDialog.id);
      toast({ title: 'Vehicle deleted' });
    } catch {
      // Rollback: restore previous cache if the base44 transaction failed
      queryClient.setQueryData(QUERY_KEY, previous);
      toast({ title: 'Failed to delete vehicle', variant: 'destructive' });
    } finally {
      setSaving(false);
      setDeleteDialog(null);
      queryClient.invalidateQueries(QUERY_KEY);
    }
  };

  if (loading) return <div className="space-y-6"><PageHeader title="Vehicles" /><TableSkeleton /></div>;

  return (
    <PullToRefresh onRefresh={refetch}>
      <div>
        <PageHeader title="Vehicles" subtitle={`${data.length} vehicles in fleet`} action={canManage ? openCreate : undefined} actionLabel="Add Vehicle" actionIcon={Car} />
        <VehicleInsights trips={trips} vehicles={data} />
        <DataTable
          data={tableData} columns={columns} searchPlaceholder="Search vehicles..."
          filters={[
            { key: 'status', label: 'Status', options: [
              { value: 'available', label: 'Available' }, { value: 'in_use', label: 'In Use' },
              { value: 'maintenance', label: 'Maintenance' }, { value: 'inactive', label: 'Inactive' },
            ]},
            { key: 'fuel_type', label: 'Fuel', options: [
              { value: 'petrol', label: 'Petrol' }, { value: 'diesel', label: 'Diesel' },
              { value: 'electric', label: 'Electric' }, { value: 'hybrid', label: 'Hybrid' },
            ]},
          ]}
          onEdit={canManage ? openEdit : undefined} onDelete={canManage ? setDeleteDialog : undefined} onView={(row) => navigate(`/vehicles/${row.id}`)}
          emptyTitle="No vehicles yet" emptyAction={canManage ? openCreate : undefined} emptyActionLabel="Add Vehicle"
        />
        <FormModal open={modalOpen} onClose={setModalOpen} title={editing ? 'Edit Vehicle' : 'Add Vehicle'}
          fields={fields} values={form} onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSubmit={handleSave} loading={saving} />
        <ConfirmDialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} onConfirm={handleDelete}
          title="Delete Vehicle" description={`Delete "${deleteDialog?.name}" (${deleteDialog?.reg_no})?`} loading={saving} />
      </div>
    </PullToRefresh>
  );
}