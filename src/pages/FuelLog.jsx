import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Fuel } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import FormModal from '@/components/shared/FormModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import PullToRefresh from '@/components/shared/PullToRefresh';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { useToast } from '@/components/ui/use-toast';
import moment from 'moment';

const QUERY_KEY = ['fuel-records'];

const fields = [
  { key: 'vehicle_name', label: 'Vehicle', required: true },
  { key: 'employee_name', label: 'Employee', required: true },
  { key: 'fuel_date', label: 'Date', type: 'date', required: true },
  { key: 'station', label: 'Station' },
  { key: 'fuel_type', label: 'Fuel Type', type: 'select', options: [
    { value: 'petrol', label: 'Petrol' }, { value: 'diesel', label: 'Diesel' },
    { value: 'electric', label: 'Electric' }, { value: 'cng', label: 'CNG' },
  ]},
  { key: 'litres', label: 'Litres', type: 'number', required: true },
  { key: 'cost', label: 'Cost', type: 'number', required: true },
  { key: 'odometer', label: 'Odometer Reading', type: 'number' },
];

const columns = [
  { key: 'fuel_date', label: 'Date', render: (val) => val ? moment(val).format('MMM DD, YYYY') : '—' },
  { key: 'vehicle_name', label: 'Vehicle', render: (val) => <span className="font-medium">{val}</span> },
  { key: 'employee_name', label: 'Employee' },
  { key: 'fuel_type', label: 'Fuel', render: (val) => <span className="capitalize">{val || '—'}</span> },
  { key: 'litres', label: 'Litres', render: (val) => val ? `${Number(val).toFixed(1)} L` : '—' },
  { key: 'cost', label: 'Cost', render: (val) => val ? `$${Number(val).toFixed(2)}` : '—' },
  { key: 'efficiency_kmpl', label: 'Efficiency', render: (val) => val ? `${Number(val).toFixed(1)} km/l` : '—' },
  { key: 'odometer', label: 'Odometer', render: (val) => val ? `${Number(val).toLocaleString()} km` : '—' },
];

export default function FuelLog() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data = [], isLoading: loading, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => base44.entities.FuelRecord.list(),
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const openCreate = () => { setEditing(null); setForm({ fuel_type: 'petrol' }); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    const previous = queryClient.getQueryData(QUERY_KEY);
    try {
      if (editing) {
        queryClient.setQueryData(QUERY_KEY, (old) =>
          (old || []).map(item => item.id === editing.id ? { ...item, ...form } : item)
        );
        await base44.entities.FuelRecord.update(editing.id, form);
        toast({ title: 'Fuel record updated' });
      } else {
        const tempId = `temp-${Date.now()}`;
        queryClient.setQueryData(QUERY_KEY, (old) => [...(old || []), { ...form, id: tempId }]);
        await base44.entities.FuelRecord.create(form);
        toast({ title: 'Fuel record added' });
      }
    } catch {
      queryClient.setQueryData(QUERY_KEY, previous);
      toast({ title: 'Failed to save fuel record', variant: 'destructive' });
    } finally {
      setSaving(false);
      setModalOpen(false);
      queryClient.invalidateQueries(QUERY_KEY);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    const previous = queryClient.getQueryData(QUERY_KEY);
    queryClient.setQueryData(QUERY_KEY, (old) => (old || []).filter(item => item.id !== deleteDialog.id));
    try {
      await base44.entities.FuelRecord.delete(deleteDialog.id);
      toast({ title: 'Fuel record deleted' });
    } catch {
      queryClient.setQueryData(QUERY_KEY, previous);
      toast({ title: 'Failed to delete fuel record', variant: 'destructive' });
    } finally {
      setSaving(false);
      setDeleteDialog(null);
      queryClient.invalidateQueries(QUERY_KEY);
    }
  };

  if (loading) return <div className="space-y-6"><PageHeader title="Fuel Log" /><TableSkeleton /></div>;

  return (
    <PullToRefresh onRefresh={refetch}>
      <div>
        <PageHeader title="Fuel Log" subtitle={`${data.length} records`} action={openCreate} actionLabel="Add Fuel Record" actionIcon={Fuel} />
        <DataTable
          data={data} columns={columns} searchPlaceholder="Search fuel records..."
          filters={[{ key: 'fuel_type', label: 'Fuel Type', options: [
            { value: 'petrol', label: 'Petrol' }, { value: 'diesel', label: 'Diesel' },
          ]}]}
          onEdit={openEdit} onDelete={setDeleteDialog}
          emptyTitle="No fuel records yet" emptyAction={openCreate} emptyActionLabel="Add Fuel Record"
        />
        <FormModal open={modalOpen} onClose={setModalOpen} title={editing ? 'Edit Record' : 'Add Fuel Record'}
          fields={fields} values={form} onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSubmit={handleSave} loading={saving} />
        <ConfirmDialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} onConfirm={handleDelete}
          title="Delete Record" description="Delete this fuel record?" loading={saving} />
      </div>
    </PullToRefresh>
  );
}