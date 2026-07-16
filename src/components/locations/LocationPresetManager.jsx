import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus } from 'lucide-react';
import DataTable from '@/components/shared/DataTable';
import FormModal from '@/components/shared/FormModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { useToast } from '@/components/ui/use-toast';

const CATEGORY_STYLES = {
  office: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  warehouse: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  customer: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  public: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  other: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
};

function CategoryBadge({ value }) {
  const style = CATEGORY_STYLES[value] || CATEGORY_STYLES.other;
  const label = (value || 'other').replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize whitespace-nowrap ${style}`}>
      {label}
    </span>
  );
}

const PRESET_FIELDS = [
  { key: 'name', label: 'Preset Name', required: true, placeholder: 'e.g. Head Office, Warehouse - Al Quoz' },
  { key: 'category', label: 'Category', type: 'select', required: true, options: [
    { value: 'office', label: 'Office' }, { value: 'warehouse', label: 'Warehouse' },
    { value: 'customer', label: 'Customer' }, { value: 'public', label: 'Public' }, { value: 'other', label: 'Other' },
  ]},
  { key: 'latitude', label: 'Latitude', type: 'number', required: true, placeholder: '24.4854' },
  { key: 'longitude', label: 'Longitude', type: 'number', required: true, placeholder: '54.3650' },
  { key: 'radius', label: 'Radius (meters)', type: 'number', placeholder: '100' },
  { key: 'description', label: 'Description', type: 'textarea' },
];

const PRESET_COLUMNS = [
  { key: 'name', label: 'Name', render: (val) => <span className="font-medium">{val}</span> },
  { key: 'category', label: 'Category', render: (val) => <CategoryBadge value={val} /> },
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
    setForm({ radius: 100, category: 'office' });
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-heading font-semibold">Search Presets</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define named geographic zones — when a trip starts or ends within a preset's radius, its friendly name is shown instead of raw coordinates.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium shadow hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Preset
        </button>
      </div>
      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          data={data}
          columns={PRESET_COLUMNS}
          searchPlaceholder="Search presets..."
          filters={[
            { key: 'category', label: 'Category', options: [
              { value: 'office', label: 'Office' }, { value: 'warehouse', label: 'Warehouse' },
              { value: 'customer', label: 'Customer' }, { value: 'public', label: 'Public' }, { value: 'other', label: 'Other' },
            ]},
          ]}
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