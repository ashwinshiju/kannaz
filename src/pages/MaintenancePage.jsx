import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Wrench } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import FormModal from '@/components/shared/FormModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import StatusBadge from '@/components/shared/StatusBadge';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import PullToRefresh from '@/components/shared/PullToRefresh';
import { useToast } from '@/components/ui/use-toast';
import moment from 'moment';

const serviceLabels = {
  oil_change: 'Oil Change', brakes: 'Brakes', tires: 'Tires', battery: 'Battery',
  engine: 'Engine', transmission: 'Transmission', general: 'General', inspection: 'Inspection', other: 'Other',
};

const baseFields = [
  { key: 'vehicle_name', label: 'Vehicle', type: 'select', required: true, options: [] },
  { key: 'service_type', label: 'Service Type', type: 'select', required: true, options: Object.entries(serviceLabels).map(([v, l]) => ({ value: v, label: l })) },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'cost', label: 'Cost', type: 'number' },
  { key: 'scheduled_date', label: 'Scheduled Date', type: 'date' },
  { key: 'completed_date', label: 'Completed Date', type: 'date' },
  { key: 'odometer', label: 'Odometer', type: 'number' },
  { key: 'next_service_odometer', label: 'Next Service Odometer', type: 'number' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'status', label: 'Status', type: 'select', options: [
    { value: 'scheduled', label: 'Scheduled' }, { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' },
  ]},
];

const columns = [
  { key: 'vehicle_name', label: 'Vehicle', render: (val) => <span className="font-medium">{val}</span> },
  { key: 'service_type', label: 'Service', render: (val) => serviceLabels[val] || val },
  { key: 'scheduled_date', label: 'Scheduled', render: (val) => val ? moment(val).format('MMM DD, YYYY') : '—' },
  { key: 'cost', label: 'Cost', render: (val) => val ? `$${Number(val).toFixed(2)}` : '—' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> },
];

export default function MaintenancePage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const { toast } = useToast();

  const load = async () => { const items = await base44.entities.Maintenance.list(); setData(items); setLoading(false); };
  const loadVehicles = async () => { try { const list = await base44.entities.Vehicle.list(); setVehicles(list); } catch { setVehicles([]); } };
  useEffect(() => { load(); loadVehicles(); }, []);

  const fields = useMemo(() => {
    const vehicleOptions = vehicles.map(v => ({ value: v.name, label: `${v.name} (${v.reg_no || '—'})` }));
    return baseFields.map(f => f.key === 'vehicle_name' ? { ...f, options: vehicleOptions } : f);
  }, [vehicles]);

  const openCreate = () => { setEditing(null); setForm({ status: 'scheduled' }); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    setModalOpen(false);
    const selectedVehicle = vehicles.find(v => v.name === form.vehicle_name);
    const payload = { ...form, vehicle_id: selectedVehicle?.id || form.vehicle_id };
    if (editing) {
      const previous = data;
      setData(prev => prev.map(item => item.id === editing.id ? { ...item, ...payload } : item));
      try {
        await base44.entities.Maintenance.update(editing.id, payload);
        toast({ title: 'Maintenance updated' });
      } catch {
        setData(previous);
        toast({ title: 'Failed to update maintenance', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    } else {
      const tempId = `temp-${Date.now()}`;
      const previous = data;
      setData(prev => [...prev, { ...payload, id: tempId }]);
      try {
        const created = await base44.entities.Maintenance.create(payload);
        setData(prev => prev.map(item => item.id === tempId ? created : item));
        toast({ title: 'Maintenance scheduled' });
      } catch {
        setData(previous);
        toast({ title: 'Failed to schedule maintenance', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDelete = async () => {
    const previous = data;
    const item = deleteDialog;
    setData(prev => prev.filter(d => d.id !== item.id));
    setDeleteDialog(null);
    setSaving(true);
    try {
      await base44.entities.Maintenance.delete(item.id);
      toast({ title: 'Record deleted' });
    } catch {
      setData(previous);
      toast({ title: 'Failed to delete record', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="space-y-6"><PageHeader title="Maintenance" /><TableSkeleton /></div>;

  return (
    <div>
      <PullToRefresh onRefresh={load}>
      <PageHeader title="Maintenance" subtitle={`${data.length} records`} action={openCreate} actionLabel="Schedule Maintenance" actionIcon={Wrench} />
      <DataTable
        data={data} columns={columns} searchPlaceholder="Search maintenance..."
        filters={[{ key: 'status', label: 'Status', options: [
          { value: 'scheduled', label: 'Scheduled' }, { value: 'in_progress', label: 'In Progress' },
          { value: 'completed', label: 'Completed' },
        ]}]}
        onEdit={openEdit} onDelete={setDeleteDialog}
        emptyTitle="No maintenance records" emptyAction={openCreate} emptyActionLabel="Schedule Maintenance"
      />
      </PullToRefresh>
      <FormModal open={modalOpen} onClose={setModalOpen} title={editing ? 'Edit Maintenance' : 'Schedule Maintenance'}
        fields={fields} values={form} onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSubmit={handleSave} loading={saving} />
      <ConfirmDialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} onConfirm={handleDelete}
        title="Delete Record" description="Delete this maintenance record?" loading={saving} />
    </div>
  );
}