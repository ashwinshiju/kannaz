import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, MapPin, Pencil, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/shared/StatusBadge';
import PresetFormModal from '@/components/locations/PresetFormModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { useToast } from '@/components/ui/use-toast';
import MobileSelect from '@/components/shared/MobileSelect';

export const PRESET_CATEGORIES = [
  { value: 'office', label: 'Office' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'public', label: 'Public' },
  { value: 'customer', label: 'Client Site' },
  { value: 'other', label: 'Other' },
];

const QUERY_KEY = ['location-presets'];

export default function PresetsSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);

  const { data: presets = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => base44.entities.LocationPreset.list(),
  });

  const filtered = useMemo(() => {
    return presets.filter((p) => {
      const matchesSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [presets, search, categoryFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({ category: 'office', radius: 100 });
    setModalOpen(true);
  };

  const openEdit = (preset) => {
    setEditing(preset);
    setForm({ ...preset });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setModalOpen(false);
    const previous = queryClient.getQueryData(QUERY_KEY);
    try {
      if (editing) {
        queryClient.setQueryData(QUERY_KEY, (old) =>
          (old || []).map((item) => (item.id === editing.id ? { ...item, ...form } : item))
        );
        await base44.entities.LocationPreset.update(editing.id, form);
        toast({ title: 'Preset updated' });
      } else {
        const tempId = `temp-${Date.now()}`;
        queryClient.setQueryData(QUERY_KEY, (old) => [...(old || []), { ...form, id: tempId }]);
        const created = await base44.entities.LocationPreset.create(form);
        queryClient.setQueryData(QUERY_KEY, (old) =>
          (old || []).map((item) => (item.id === tempId ? created : item))
        );
        toast({ title: 'Preset added' });
      }
    } catch {
      queryClient.setQueryData(QUERY_KEY, previous);
      toast({ title: 'Failed to save preset', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    const previous = queryClient.getQueryData(QUERY_KEY);
    const item = deleteDialog;
    queryClient.setQueryData(QUERY_KEY, (old) => (old || []).filter((d) => d.id !== item.id));
    setDeleteDialog(null);
    try {
      await base44.entities.LocationPreset.delete(item.id);
      toast({ title: 'Preset deleted' });
    } catch {
      queryClient.setQueryData(QUERY_KEY, previous);
      toast({ title: 'Failed to delete preset', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-heading font-bold">Search Presets</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Search and manage saved locations used to auto-label trip start/end points.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search presets by name..."
            className="pl-9"
          />
        </div>
        <MobileSelect
          value={categoryFilter}
          onValueChange={setCategoryFilter}
          options={[{ value: 'all', label: 'All Categories' }, ...PRESET_CATEGORIES]}
        />
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Preset
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={3} cols={4} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-border rounded-xl">
          <MapPin className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No presets found. Add one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((preset) => (
            <div key={preset.id} className="bg-card rounded-lg border border-border p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5">
                  <p className="font-medium">{preset.name}</p>
                  <StatusBadge status={preset.category} />
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(preset)} aria-label="Edit preset">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteDialog(preset)} aria-label="Delete preset">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p className="font-mono">{preset.latitude?.toFixed(6)}, {preset.longitude?.toFixed(6)}</p>
                <p>Radius: {preset.radius ?? 100}m</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <PresetFormModal
        open={modalOpen}
        onClose={setModalOpen}
        editing={editing}
        form={form}
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