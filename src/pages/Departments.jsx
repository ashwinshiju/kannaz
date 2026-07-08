import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Building2 } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import FormModal from '@/components/shared/FormModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import StatusBadge from '@/components/shared/StatusBadge';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import PullToRefresh from '@/components/shared/PullToRefresh';
import { useToast } from '@/components/ui/use-toast';

const fields = [
  { key: 'name', label: 'Department Name', required: true },
  { key: 'code', label: 'Department Code', required: true },
  { key: 'manager_name', label: 'Manager' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'status', label: 'Status', type: 'select', options: [
    { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' },
  ]},
];

const columns = [
  { key: 'code', label: 'Code', render: (val) => <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{val}</span> },
  { key: 'name', label: 'Name', render: (val) => <span className="font-medium">{val}</span> },
  { key: 'manager_name', label: 'Manager' },
  { key: 'description', label: 'Description', render: (val) => <span className="text-muted-foreground truncate max-w-[200px] block">{val || '—'}</span> },
  { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> },
];

export default function Departments() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const items = await base44.entities.Department.list();
    setData(items);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ status: 'active' }); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    setModalOpen(false);
    if (editing) {
      const previous = data;
      setData(prev => prev.map(item => item.id === editing.id ? { ...item, ...form } : item));
      try {
        await base44.entities.Department.update(editing.id, form);
        toast({ title: 'Department updated' });
      } catch {
        setData(previous);
        toast({ title: 'Failed to update department', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    } else {
      const tempId = `temp-${Date.now()}`;
      const previous = data;
      setData(prev => [...prev, { ...form, id: tempId }]);
      try {
        const created = await base44.entities.Department.create(form);
        setData(prev => prev.map(item => item.id === tempId ? created : item));
        toast({ title: 'Department created' });
      } catch {
        setData(previous);
        toast({ title: 'Failed to create department', variant: 'destructive' });
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
      await base44.entities.Department.delete(item.id);
      toast({ title: 'Department deleted' });
    } catch {
      setData(previous);
      toast({ title: 'Failed to delete department', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="space-y-6"><PageHeader title="Departments" /><TableSkeleton /></div>;

  return (
    <div>
      <PullToRefresh onRefresh={load}>
      <PageHeader title="Departments" subtitle={`${data.length} departments`} action={openCreate} actionLabel="Add Department" actionIcon={Building2} />
      <DataTable
        data={data} columns={columns} searchPlaceholder="Search departments..."
        filters={[{ key: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] }]}
        onEdit={openEdit} onDelete={setDeleteDialog}
        emptyTitle="No departments yet" emptyAction={openCreate} emptyActionLabel="Add Department"
      />
      </PullToRefresh>
      <FormModal open={modalOpen} onClose={setModalOpen} title={editing ? 'Edit Department' : 'Add Department'}
        fields={fields} values={form} onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSubmit={handleSave} loading={saving} />
      <ConfirmDialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} onConfirm={handleDelete}
        title="Delete Department" description={`Delete "${deleteDialog?.name}"?`} loading={saving} />
    </div>
  );
}