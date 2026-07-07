import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Route, Play, CheckCircle2, Clock, X } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import FormModal from '@/components/shared/FormModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import StatusBadge from '@/components/shared/StatusBadge';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import moment from 'moment';

const fields = [
  { key: 'employee_name', label: 'Employee Name', required: true },
  { key: 'vehicle_name', label: 'Vehicle', required: true },
  { key: 'department', label: 'Department' },
  { key: 'start_location', label: 'Start Location', required: true },
  { key: 'end_location', label: 'End Location', required: true },
  { key: 'purpose', label: 'Purpose', type: 'select', options: [
    { value: 'official', label: 'Official' }, { value: 'personal', label: 'Personal' }, { value: 'maintenance', label: 'Maintenance' },
  ]},
  { key: 'start_odometer', label: 'Start Odometer', type: 'number' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

export default function Trips() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => { const items = await base44.entities.Trip.list(); setData(items); setLoading(false); };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    const tripNum = `TRP-${String(data.length + 1).padStart(4, '0')}`;
    setEditing(null);
    setForm({ status: 'created', purpose: 'official', trip_number: tripNum });
    setModalOpen(true);
  };

  const openEdit = (row) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    if (editing) {
      await base44.entities.Trip.update(editing.id, form);
      toast({ title: 'Trip updated' });
    } else {
      await base44.entities.Trip.create(form);
      toast({ title: 'Trip created' });
    }
    setSaving(false); setModalOpen(false); load();
  };

  const handleDelete = async () => {
    setSaving(true);
    await base44.entities.Trip.delete(deleteDialog.id);
    toast({ title: 'Trip deleted' });
    setSaving(false); setDeleteDialog(null); load();
  };

  const startTrip = async (trip) => {
    await base44.entities.Trip.update(trip.id, { status: 'in_progress', started_at: new Date().toISOString() });
    toast({ title: 'Trip started' });
    load();
  };

  const completeTrip = async (trip) => {
    await base44.entities.Trip.update(trip.id, { status: 'completed', completed_at: new Date().toISOString() });
    toast({ title: 'Trip completed' });
    load();
  };

  const acknowledgeTrip = async (trip) => {
    await base44.entities.Trip.update(trip.id, { status: 'acknowledged', acknowledged_at: new Date().toISOString() });
    toast({ title: 'Trip acknowledged' });
    load();
  };

  const columns = [
    { key: 'trip_number', label: 'Trip #', render: (val) => <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{val || '—'}</span> },
    { key: 'employee_name', label: 'Employee', render: (val) => <span className="font-medium">{val}</span> },
    { key: 'vehicle_name', label: 'Vehicle' },
    { key: 'start_location', label: 'From' },
    { key: 'end_location', label: 'To' },
    { key: 'purpose', label: 'Purpose', render: (val) => <span className="capitalize">{val || '—'}</span> },
    { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> },
    { key: 'created_date', label: 'Date', render: (val) => val ? moment(val).format('MMM DD, HH:mm') : '—' },
    {
      key: 'id', label: '', sortable: false,
      render: (_, row) => (
        <div className="flex gap-1">
          {row.status === 'created' && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); startTrip(row); }} className="h-7 text-xs gap-1">
              <Play className="w-3 h-3" /> Start
            </Button>
          )}
          {row.status === 'in_progress' && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); completeTrip(row); }} className="h-7 text-xs gap-1">
              <CheckCircle2 className="w-3 h-3" /> Complete
            </Button>
          )}
          {row.status === 'completed' && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); acknowledgeTrip(row); }} className="h-7 text-xs gap-1">
              <Clock className="w-3 h-3" /> Acknowledge
            </Button>
          )}
        </div>
      )
    },
  ];

  if (loading) return <div className="space-y-6"><PageHeader title="Trips" /><TableSkeleton /></div>;

  return (
    <div>
      <PageHeader title="Trip Management" subtitle={`${data.length} total trips`} action={openCreate} actionLabel="Create Trip" actionIcon={Route} />
      <DataTable
        data={data} columns={columns} searchPlaceholder="Search trips..."
        filters={[
          { key: 'status', label: 'Status', options: [
            { value: 'created', label: 'Created' }, { value: 'in_progress', label: 'In Progress' },
            { value: 'completed', label: 'Completed' }, { value: 'acknowledged', label: 'Acknowledged' },
          ]},
          { key: 'purpose', label: 'Purpose', options: [
            { value: 'official', label: 'Official' }, { value: 'personal', label: 'Personal' },
          ]},
        ]}
        onEdit={openEdit} onDelete={setDeleteDialog}
        emptyTitle="No trips yet" emptyDescription="Create your first trip" emptyAction={openCreate} emptyActionLabel="Create Trip"
      />
      <FormModal open={modalOpen} onClose={setModalOpen} title={editing ? 'Edit Trip' : 'Create Trip'}
        fields={fields} values={form} onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSubmit={handleSave} loading={saving} />
      <ConfirmDialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} onConfirm={handleDelete}
        title="Delete Trip" description="Delete this trip record?" loading={saving} />
    </div>
  );
}