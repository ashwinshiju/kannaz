import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { MapPin } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import FormModal from '@/components/shared/FormModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import StatusBadge from '@/components/shared/StatusBadge';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { useToast } from '@/components/ui/use-toast';

const fields = [
  { key: 'name', label: 'Location Name', required: true },
  { key: 'category', label: 'Category', type: 'select', required: true, options: [
    { value: 'office', label: 'Office' }, { value: 'customer', label: 'Customer' },
    { value: 'warehouse', label: 'Warehouse' }, { value: 'public', label: 'Public' }, { value: 'other', label: 'Other' },
  ]},
  { key: 'address', label: 'Address', required: true, type: 'textarea' },
  { key: 'latitude', label: 'Latitude', type: 'number' },
  { key: 'longitude', label: 'Longitude', type: 'number' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'status', label: 'Status', type: 'select', options: [
    { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' },
  ]},
];

const columns = [
  { key: 'name', label: 'Name', render: (val) => <span className="font-medium">{val}</span> },
  { key: 'category', label: 'Category', render: (val) => <StatusBadge status={val} /> },
  { key: 'address', label: 'Address', render: (val) => <span className="text-muted-foreground truncate max-w-[250px] block">{val || '—'}</span> },
  { key: 'latitude', label: 'Lat', render: (val) => val ? Number(val).toFixed(4) : '—' },
  { key: 'longitude', label: 'Lng', render: (val) => val ? Number(val).toFixed(4) : '—' },
  { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> },
];

export default function Locations() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => { const items = await base44.entities.Location.list(); setData(items); setLoading(false); };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ status: 'active', category: 'office' }); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    if (editing) {
      await base44.entities.Location.update(editing.id, form);
      toast({ title: 'Location updated' });
    } else {
      await base44.entities.Location.create(form);
      toast({ title: 'Location added' });
    }
    setSaving(false); setModalOpen(false); load();
  };

  const handleDelete = async () => {
    setSaving(true);
    await base44.entities.Location.delete(deleteDialog.id);
    toast({ title: 'Location deleted' });
    setSaving(false); setDeleteDialog(null); load();
  };

  if (loading) return <div className="space-y-6"><PageHeader title="Locations" /><TableSkeleton /></div>;

  return (
    <div>
      <PageHeader title="Locations" subtitle={`${data.length} locations`} action={openCreate} actionLabel="Add Location" actionIcon={MapPin} />
      <DataTable
        data={data} columns={columns} searchPlaceholder="Search locations..."
        filters={[
          { key: 'category', label: 'Category', options: [
            { value: 'office', label: 'Office' }, { value: 'customer', label: 'Customer' },
            { value: 'warehouse', label: 'Warehouse' }, { value: 'public', label: 'Public' },
          ]},
          { key: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
        ]}
        onEdit={openEdit} onDelete={setDeleteDialog}
        emptyTitle="No locations yet" emptyAction={openCreate} emptyActionLabel="Add Location"
      />
      <FormModal open={modalOpen} onClose={setModalOpen} title={editing ? 'Edit Location' : 'Add Location'}
        fields={fields} values={form} onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSubmit={handleSave} loading={saving} />
      <ConfirmDialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} onConfirm={handleDelete}
        title="Delete Location" description={`Delete "${deleteDialog?.name}"?`} loading={saving} />
    </div>
  );
}