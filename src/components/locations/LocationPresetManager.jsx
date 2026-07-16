import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { MapPin, Plus } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import FormModal from '@/components/shared/FormModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { useToast } from '@/components/ui/use-toast';

const PRESET_FIELDS = [
  { key: 'name', label: 'Preset Name', required: true, placeholder: 'e.g. Head Office, Warehouse - Al Quoz' },
  { key: 'latitude', label: 'Latitude', type: 'number', required: true, placeholder: '24.4854' },
  { key: 'longitude', label: 'Longitude', type: 'number', required: true, placeholder: '54.3650' },
  { key: 'radius', label: 'Radius (meters)', type: 'number', placeholder: '100' },
  { key: 'description', label: 'Description', type: 'textarea' },
];

const PRESET_COLUMNS = [
  { key: 'name', label: 'Name', render: (val) => <span className="font-medium">{val}</span> },
  {
    key: 'coordinates', label: 'Coordinates', sortable: false,
    render: (_, row) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.latitude != null && row.longitude != null
          ? `${Number(row.latitude).toFixed(4)}, ${Number(row.longitude).toFixed(4)}`
          : '—'}
      </span>
    ),
  },
  {
    key: 'radius', label: 'Radius',
    render: (val) => (
      <span className="text-sm">{val != null ? `${val} m` : '100 m'}</span>
    ),
  },
  {
    key: 'description', label: 'Description',
    render: (val) => <span className="text-muted-foreground text-sm truncate max-w-[200px] block">{val || '—'}</span>,
  },
];

export default function LocationPresetManager() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    try {
      const items = await base44.entities.LocationPreset.list();
      setData(items);
    } catch {
      toast({ title: 'Failed to load presets', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ radius: 100 });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({ ...row });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setModalOpen(false);
    if (editing) {
      const previous = data;
      setData((prev) => prev.map((item) => (item.id === editing.id ? { ...item, ...form } : item)));
      try {
        await base44.entities.LocationPreset.update(editing.id, form);
        toast({ title: 'Preset updated' });
      } catch {
        setData(previous);
        toast({ title: 'Failed to update preset', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    } else {
      const tempId = `temp-${Date.now()}`;
      const previous = data;
      setData((prev) => [...prev, { ...form, id: tempId }]);
      try {
        const created = await base44.entities.LocationPreset.create(form);
        setData((prev) => prev.map((item) => (item.id === tempId ? created : item)));
        toast({ title: 'Preset added' });
      } catch {
        setData(previous);
        toast({ title: 'Failed to add preset', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDelete = async () => {
    const previous = data;
    const item = deleteDialog;
    setData((prev) => prev.filter((d) => d.id !== item.id));
    setDeleteDialog(null);
    setSaving(true);
    try {
      await base44.entities.LocationPreset.delete(item.id);
      toast({ title: 'Preset deleted' });
    } catch {
      setData(previous);
      toast({ title: 'Failed to delete preset', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Location Presets"
        subtitle={`${data.length} presets — matched on trip start/end for friendly location names`}
        action={openCreate}
        actionLabel="Add Preset"
        actionIcon={Plus}
      />
      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          data={data}
          columns={PRESET_COLUMNS}
          searchPlaceholder="Search presets..."
          onEdit={openEdit}
          onDelete={setDeleteDialog}
          emptyTitle="No location presets yet"
          emptyDescription="Add presets like 'Head Office' or 'Warehouse - Al Quoz' to display friendly names on trips"
          emptyAction={openCreate}
          emptyActionLabel="Add Preset"
        />
      )}
      <FormModal
        open={modalOpen}
        onClose={setModalOpen}
        title={editing ? 'Edit Preset' : 'Add Preset'}
        fields={PRESET_FIELDS}
        values={form}
        onChange={(k, v) => setForm((p) => ({ ...p, [k]: v }))}
        onSubmit={handleSave}
        loading={saving}
      />
      <ConfirmDialog
        open={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={handleDelete}
        title="Delete Preset"
        description={`Delete "${deleteDialog?.name}"?`}
        loading={saving}
      />
    </div>
  );
}