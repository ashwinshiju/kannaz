import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Wrench } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import FormModal from '@/components/shared/FormModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import StatusBadge from '@/components/shared/StatusBadge';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { useToast } from '@/components/ui/use-toast';
import moment from 'moment';

const serviceLabels = {
  oil_change: 'Oil Change', brakes: 'Brakes', tires: 'Tires', battery: 'Battery',
  engine: 'Engine', transmission: 'Transmission', general: 'General', inspection: 'Inspection', other: 'Other',
};

const fields = [
  { key: 'vehicle_name', label: 'Vehicle', required: true },
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
  const { toast } = useToast();

  const load = async () => { const items = await base44.entities.Maintenance.list(); setData(items); setLoading(false); };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ status: 'scheduled' }); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    if (editing) {
      await base44.entities.Maintenance.update(editing.id, form);
      toast({ title: 'Maintenance updated' });
    } else {
      await base44.entities.Maintenance.create(form);
      toast({ title: 'Maintenance scheduled' });
    }
    setSaving(false); setModalOpen(false); load();
  };

  const handleDelete = async () => {
    setSaving(true);
    await base44.entities.Maintenance.delete(deleteDialog.id);
    toast({ title: 'Record deleted' });
    setSaving(false); setDeleteDialog(null); load();
  };

  if (loading) return <div className="space-y-6"><PageHeader title="Maintenance" /><TableSkeleton /></div>;

  return (
    <div>
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
      <FormModal open={modalOpen} onClose={setModalOpen} title={editing ? 'Edit Maintenance' : 'Schedule Maintenance'}
        fields={fields} values={form} onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSubmit={handleSave} loading={saving} />
      <ConfirmDialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} onConfirm={handleDelete}
        title="Delete Record" description="Delete this maintenance record?" loading={saving} />
    </div>
  );
}