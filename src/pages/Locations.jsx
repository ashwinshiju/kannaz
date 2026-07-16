import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { MapPin } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import FormModal from '@/components/shared/FormModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import StatusBadge from '@/components/shared/StatusBadge';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import PullToRefresh from '@/components/shared/PullToRefresh';
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
    setModalOpen(false);
    if (editing) {
      const previous = data;
      setData(prev => prev.map(item => item.id === editing.id ? { ...item, ...form } : item));
      try {
        await base44.entities.Location.update(editing.id, form);
        toast({ title: 'Location updated' });
      } catch {
        setData(previous);
        toast({ title: 'Failed to update location', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    } else {
      const tempId = `temp-${Date.now()}`;
      const previous = data;
      setData(prev => [...prev, { ...form, id: tempId }]);
      try {
        const created = await base44.entities.Location.create(form);
        setData(prev => prev.map(item => item.id === tempId ? created : item));
        toast({ title: 'Location added' });
      } catch {
        setData(previous);
        toast({ title: 'Failed to add location', variant: 'destructive' });
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
      await base44.entities.Location.delete(item.id);
      toast({ title: 'Location deleted' });
    } catch {
      setData(previous);
      toast({ title: 'Failed to delete location', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="space-y-6"><PageHeader title="Locations" /><TableSkeleton /></div>;

  return (
    <div>
      <PullToRefresh onRefresh={load}>
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
      </PullToRefresh>
      <FormModal open={modalOpen} onClose={setModalOpen} title={editing ? 'Edit Location' : 'Add Location'}
        fields={fields} values={form} onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSubmit={handleSave} loading={saving} />
      <ConfirmDialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} onConfirm={handleDelete}
        title="Delete Location" description={`Delete "${deleteDialog?.name}"?`} loading={saving} />
    </div>
  );
}