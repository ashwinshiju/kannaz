import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Route, Play, CheckCircle2, Clock } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import FormModal from '@/components/shared/FormModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import EndTripDialog from '@/components/trips/EndTripDialog';
import StatusBadge from '@/components/shared/StatusBadge';
import PullToRefresh from '@/components/shared/PullToRefresh';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import moment from 'moment';

const QUERY_KEY = ['trips'];

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  // If the current user already has an in-progress trip, the primary action
  // becomes "End Trip" instead of "Create Trip".
  const activeTrip = data.find(
    (t) => t.status === 'in_progress' && t.employee_id === user?.id
  );
  const { data = [], isLoading: loading, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => base44.entities.Trip.list(),
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [endTripDialog, setEndTripDialog] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    navigate('/trips/new');
  };

  const openEdit = (row) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    const previous = queryClient.getQueryData(QUERY_KEY);
    try {
      if (editing) {
        queryClient.setQueryData(QUERY_KEY, (old) =>
          (old || []).map(item => item.id === editing.id ? { ...item, ...form } : item)
        );
        await base44.entities.Trip.update(editing.id, form);
        toast({ title: 'Trip updated' });
      } else {
        const tempId = `temp-${Date.now()}`;
        queryClient.setQueryData(QUERY_KEY, (old) => [...(old || []), { ...form, id: tempId }]);
        await base44.entities.Trip.create(form);
        toast({ title: 'Trip created' });
      }
    } catch {
      queryClient.setQueryData(QUERY_KEY, previous);
      toast({ title: 'Failed to save trip', variant: 'destructive' });
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
      await base44.entities.Trip.delete(deleteDialog.id);
      toast({ title: 'Trip deleted' });
    } catch {
      queryClient.setQueryData(QUERY_KEY, previous);
      toast({ title: 'Failed to delete trip', variant: 'destructive' });
    } finally {
      setSaving(false);
      setDeleteDialog(null);
      queryClient.invalidateQueries(QUERY_KEY);
    }
  };

  const updateTripStatus = async (trip, updates, message) => {
    const previous = queryClient.getQueryData(QUERY_KEY);
    queryClient.setQueryData(QUERY_KEY, (old) =>
      (old || []).map(item => item.id === trip.id ? { ...item, ...updates } : item)
    );
    try {
      await base44.entities.Trip.update(trip.id, updates);
      toast({ title: message });
    } catch {
      queryClient.setQueryData(QUERY_KEY, previous);
      toast({ title: 'Failed to update trip', variant: 'destructive' });
    } finally {
      queryClient.invalidateQueries(QUERY_KEY);
    }
  };

  const startTrip = async (trip) => {
    await updateTripStatus(trip, { status: 'in_progress', started_at: new Date().toISOString() }, 'Trip started');
    // Mark the vehicle as in-use so it no longer appears as available.
    if (trip.vehicle_id) {
      try {
        await base44.entities.Vehicle.update(trip.vehicle_id, { status: 'in_use' });
        queryClient.invalidateQueries({ queryKey: ['vehicles'] });
        queryClient.invalidateQueries({ queryKey: ['vehicles', 'available'] });
      } catch { /* vehicle status update is best-effort */ }
    }
  };

  const acknowledgeTrip = (trip) => updateTripStatus(trip, { status: 'acknowledged', acknowledged_at: new Date().toISOString() }, 'Trip acknowledged');

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
          {row.status === 'in_progress' && row.id !== activeTrip?.id && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setEndTripDialog(row); }} className="h-7 text-xs gap-1">
              <CheckCircle2 className="w-3 h-3" /> End Trip
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
    <PullToRefresh onRefresh={refetch}>
      <div>
        <PageHeader
          title="Trip Management"
          subtitle={`${data.length} total trips`}
          action={activeTrip ? () => setEndTripDialog(activeTrip) : openCreate}
          actionLabel={activeTrip ? 'End Trip' : 'Create Trip'}
          actionIcon={activeTrip ? CheckCircle2 : Route}
        />
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
        <EndTripDialog trip={endTripDialog} open={!!endTripDialog} onClose={() => setEndTripDialog(null)} />
      </div>
    </PullToRefresh>
  );
}