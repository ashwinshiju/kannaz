import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTripLocationTracking } from '@/hooks/useTripLocationTracking';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Route, Play, CheckCircle2, Clock, MapPin, Navigation } from 'lucide-react';
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

  const { data = [], isLoading: loading, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => base44.entities.Trip.list(),
  });

  const { data: presets = [] } = useQuery({
    queryKey: ['location-presets'],
    queryFn: () => base44.entities.LocationPreset.list(),
  });
  const presetMap = useMemo(() => {
    const m = new Map();
    presets.forEach((p) => m.set(p.id, p));
    return m;
  }, [presets]);

  // If the current user already has an in-progress trip, the primary action
  // becomes "End Trip" instead of "Create Trip".
  const activeTrip = data.find(
    (t) => t.status === 'in_progress' && t.employee_id === user?.id
  );

  // Background GPS tracking — starts when the current user has an in-progress
  // trip, stops when the trip ends or is no longer active. Reuses the single
  // existing tracking service; persists a point every 100s to TripTrackingLog.
  const { start: startTracking, stop: stopTracking } = useTripLocationTracking();

  useEffect(() => {
    if (activeTrip) {
      startTracking(activeTrip.id);
    } else {
      stopTracking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTrip?.id]);

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
    { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> },
    { key: 'employee_name', label: 'Employee', render: (val) => <span className="font-medium">{val}</span> },
    { key: 'vehicle_name', label: 'Vehicle' },
    {
      key: 'start_lat', label: 'From',
      render: (_, row) => {
        if (row.start_lat == null || row.start_lng == null) return <span className="text-muted-foreground">—</span>;
        const url = `https://www.google.com/maps/search/?api=1&query=${row.start_lat},${row.start_lng}`;
        const preset = row.start_location_preset_id ? presetMap.get(row.start_location_preset_id) : null;
        return (
          <a href={url} target="_blank" rel="noopener noreferrer" title={`GPS: ${row.start_lat.toFixed(6)}, ${row.start_lng.toFixed(6)}`} className="inline-flex items-center gap-1 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
            <MapPin className="w-3 h-3" />
            {preset ? <span className="text-xs font-medium">{preset.name}</span> : <span className="font-mono text-xs">{row.start_lat.toFixed(4)}, {row.start_lng.toFixed(4)}</span>}
          </a>
        );
      }
    },
    {
      key: 'end_lat', label: 'To',
      render: (_, row) => {
        if (row.end_lat == null || row.end_lng == null) return <span className="text-muted-foreground">—</span>;
        const url = `https://www.google.com/maps/search/?api=1&query=${row.end_lat},${row.end_lng}`;
        const preset = row.end_location_preset_id ? presetMap.get(row.end_location_preset_id) : null;
        return (
          <a href={url} target="_blank" rel="noopener noreferrer" title={`GPS: ${row.end_lat.toFixed(6)}, ${row.end_lng.toFixed(6)}`} className="inline-flex items-center gap-1 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
            <MapPin className="w-3 h-3" />
            {preset ? <span className="text-xs font-medium">{preset.name}</span> : <span className="font-mono text-xs">{row.end_lat.toFixed(4)}, {row.end_lng.toFixed(4)}</span>}
          </a>
        );
      }
    },
    { key: 'purpose', label: 'Purpose', render: (val) => <span className="capitalize">{val || '—'}</span> },
    { key: 'trip_number', label: 'Trip #', render: (val) => <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{val || '—'}</span> },
    { key: 'created_date', label: 'Date', render: (val, row) => {
      const tz = 240;
      const start = row.started_at ? moment.utc(row.started_at).utcOffset(tz) : (val ? moment.utc(val).utcOffset(tz) : null);
      if (!start || !start.isValid()) return '—';
      const startStr = start.format('MMM DD, HH:mm');
      if (row.status === 'completed' && row.completed_at) {
        return `${startStr} - ${moment.utc(row.completed_at).utcOffset(tz).format('HH:mm')}`;
      }
      return startStr;
    }},
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
          {row.status === 'completed' && row.start_lat != null && row.start_lng != null && row.end_lat != null && row.end_lng != null && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&origin=${row.start_lat},${row.start_lng}&destination=${row.end_lat},${row.end_lng}&travelmode=driving`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                <Navigation className="w-3 h-3" /> Route
              </Button>
            </a>
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
          onRowClick={(row) => {
            if (row.status === 'completed') {
              navigate(`/live-map?trip=${row.id}`);
            }
          }}
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