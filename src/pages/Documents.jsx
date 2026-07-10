import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { FileText } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import FormModal from '@/components/shared/FormModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import StatusBadge from '@/components/shared/StatusBadge';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import PullToRefresh from '@/components/shared/PullToRefresh';
import { useToast } from '@/components/ui/use-toast';
import moment from 'moment';

const docTypeLabels = {
  insurance: 'Insurance', registration: 'Registration', tire_certificate: 'Tire Certificate',
  battery_warranty: 'Battery Warranty', emission_test: 'Emission Test', fitness_certificate: 'Fitness Certificate', other: 'Other',
};

const fields = [
  { key: 'vehicle_name', label: 'Vehicle', required: true },
  { key: 'doc_type', label: 'Document Type', type: 'select', required: true, options: Object.entries(docTypeLabels).map(([v, l]) => ({ value: v, label: l })) },
  { key: 'doc_number', label: 'Document Number' },
  { key: 'issuer', label: 'Issuer' },
  { key: 'issue_date', label: 'Issue Date', type: 'date' },
  { key: 'expiry_date', label: 'Expiry Date', type: 'date' },
  { key: 'status', label: 'Status', type: 'select', options: [
    { value: 'valid', label: 'Valid' }, { value: 'expiring_soon', label: 'Expiring Soon' }, { value: 'expired', label: 'Expired' },
  ]},
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

const columns = [
  { key: 'vehicle_name', label: 'Vehicle', render: (val) => <span className="font-medium">{val}</span> },
  { key: 'doc_type', label: 'Type', render: (val) => docTypeLabels[val] || val },
  { key: 'doc_number', label: 'Doc #' },
  { key: 'issuer', label: 'Issuer' },
  { key: 'expiry_date', label: 'Expiry', render: (val) => {
    if (!val) return '—';
    const isExpired = moment(val).isBefore(moment());
    const isSoon = moment(val).isBefore(moment().add(30, 'days'));
    return (
      <span className={isExpired ? 'text-red-600 font-medium' : isSoon ? 'text-amber-600 font-medium' : ''}>
        {moment(val).format('MMM DD, YYYY')}
      </span>
    );
  }},
  { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> },
];

export default function Documents() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => { const items = await base44.entities.Document.list(); setData(items); setLoading(false); };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ status: 'valid' }); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    setModalOpen(false);
    if (editing) {
      const previous = data;
      setData(prev => prev.map(item => item.id === editing.id ? { ...item, ...form } : item));
      try {
        await base44.entities.Document.update(editing.id, form);
        toast({ title: 'Document updated' });
      } catch {
        setData(previous);
        toast({ title: 'Failed to update document', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    } else {
      const tempId = `temp-${Date.now()}`;
      const previous = data;
      setData(prev => [...prev, { ...form, id: tempId }]);
      try {
        const created = await base44.entities.Document.create(form);
        setData(prev => prev.map(item => item.id === tempId ? created : item));
        toast({ title: 'Document added' });
      } catch {
        setData(previous);
        toast({ title: 'Failed to add document', variant: 'destructive' });
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
      await base44.entities.Document.delete(item.id);
      toast({ title: 'Document deleted' });
    } catch {
      setData(previous);
      toast({ title: 'Failed to delete document', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="space-y-6"><PageHeader title="Documents" /><TableSkeleton /></div>;

  return (
    <div>
      <PullToRefresh onRefresh={load}>
      <PageHeader title="Documents & Compliance" subtitle={`${data.length} documents`} action={openCreate} actionLabel="Add Document" actionIcon={FileText} />
      <DataTable
        data={data} columns={columns} searchPlaceholder="Search documents..."
        filters={[
          { key: 'doc_type', label: 'Type', options: Object.entries(docTypeLabels).map(([v, l]) => ({ value: v, label: l })) },
          { key: 'status', label: 'Status', options: [
            { value: 'valid', label: 'Valid' }, { value: 'expiring_soon', label: 'Expiring Soon' }, { value: 'expired', label: 'Expired' },
          ]},
        ]}
        onEdit={openEdit} onDelete={setDeleteDialog}
        emptyTitle="No documents yet" emptyAction={openCreate} emptyActionLabel="Add Document"
      />
      </PullToRefresh>
      <FormModal open={modalOpen} onClose={setModalOpen} title={editing ? 'Edit Document' : 'Add Document'}
        fields={fields} values={form} onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSubmit={handleSave} loading={saving} />
      <ConfirmDialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} onConfirm={handleDelete}
        title="Delete Document" description="Delete this document?" loading={saving} />
    </div>
  );
}