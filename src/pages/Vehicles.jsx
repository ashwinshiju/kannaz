import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Car } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import FormModal from '@/components/shared/FormModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import StatusBadge from '@/components/shared/StatusBadge';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { useToast } from '@/components/ui/use-toast';

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

const columns = [
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
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => { const items = await base44.entities.Vehicle.list(); setData(items); setLoading(false); };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ status: 'available', fuel_type: 'petrol' }); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    if (editing) {
      await base44.entities.Vehicle.update(editing.id, form);
      toast({ title: 'Vehicle updated' });
    } else {
      await base44.entities.Vehicle.create(form);
      toast({ title: 'Vehicle added' });
    }
    setSaving(false); setModalOpen(false); load();
  };

  const handleDelete = async () => {
    setSaving(true);
    await base44.entities.Vehicle.delete(deleteDialog.id);
    toast({ title: 'Vehicle deleted' });
    setSaving(false); setDeleteDialog(null); load();
  };

  if (loading) return <div className="space-y-6"><PageHeader title="Vehicles" /><TableSkeleton /></div>;

  return (
    <div>
      <PageHeader title="Vehicles" subtitle={`${data.length} vehicles in fleet`} action={openCreate} actionLabel="Add Vehicle" actionIcon={Car} />
      <DataTable
        data={data} columns={columns} searchPlaceholder="Search vehicles..."
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
        onEdit={openEdit} onDelete={setDeleteDialog} onView={(row) => window.location.href = `/vehicles/${row.id}`}
        emptyTitle="No vehicles yet" emptyAction={openCreate} emptyActionLabel="Add Vehicle"
      />
      <FormModal open={modalOpen} onClose={setModalOpen} title={editing ? 'Edit Vehicle' : 'Add Vehicle'}
        fields={fields} values={form} onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSubmit={handleSave} loading={saving} />
      <ConfirmDialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} onConfirm={handleDelete}
        title="Delete Vehicle" description={`Delete "${deleteDialog?.name}" (${deleteDialog?.reg_no})?`} loading={saving} />
    </div>
  );
}