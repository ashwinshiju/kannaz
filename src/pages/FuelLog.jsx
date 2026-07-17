import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Fuel, Plus, Download } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import PullToRefresh from '@/components/shared/PullToRefresh';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import FuelRecordForm from '@/components/fuel/FuelRecordForm';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { exportToCSV } from '@/utils/csvExport';
import moment from 'moment';

const QUERY_KEY = ['fuel-records'];

const FUEL_TYPE_LABELS = {
  super_98: 'Super 98',
  special_95: 'Special 95',
  eplus_91: 'EPlus 91',
  diesel: 'Diesel',
};

const exportColumns = [
  { key: 'fuel_date', label: 'Date' },
  { key: 'vehicle_name', label: 'Vehicle' },
  { key: 'employee_name', label: 'Employee' },
  { key: 'fuel_type', label: 'Fuel Type' },
  { key: 'litres', label: 'Litres' },
  { key: 'fuel_rate', label: 'Rate (AED/L)' },
  { key: 'cost', label: 'Cost (AED)' },
  { key: 'odometer', label: 'Odometer (km)' },
  { key: 'station', label: 'Station' },
  { key: 'efficiency_kmpl', label: 'Efficiency (km/L)' },
];

const columns = [
  { key: 'fuel_date', label: 'Date', render: (val) => val ? moment(val).format('MMM DD, YYYY') : '—' },
  { key: 'vehicle_name', label: 'Vehicle', render: (val) => <span className="font-medium">{val}</span> },
  { key: 'employee_name', label: 'Employee' },
  { key: 'fuel_type', label: 'Fuel', render: (val) => FUEL_TYPE_LABELS[val] || '—' },
  { key: 'litres', label: 'Litres', render: (val) => val ? `${Number(val).toFixed(1)} L` : '—' },
  { key: 'fuel_rate', label: 'Rate', render: (val) => val ? `AED ${Number(val).toFixed(2)}/L` : '—' },
  { key: 'cost', label: 'Cost', render: (val) => val ? `AED ${Number(val).toFixed(2)}` : '—' },
  { key: 'odometer', label: 'Odometer', render: (val) => val ? `${Number(val).toLocaleString()} km` : '—' },
];

export default function FuelLog() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data = [], isLoading: loading, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => base44.entities.FuelRecord.list('-fuel_date', 200),
  });

  const { data: fuelPrices } = useQuery({
    queryKey: ['fuel-prices'],
    queryFn: async () => {
      const settings = await base44.entities.Setting.filter({ key: 'fuel_prices' });
      return settings[0] ? JSON.parse(settings[0].value) : null;
    },
  });

  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (row) => { setEditing(row); setFormOpen(true); };

  const handleExport = () => {
    exportToCSV(data, exportColumns, `fuel-log-${moment().format('YYYYMMDD-HHmm')}`);
    toast({ title: 'Fuel log exported' });
  };

  const handleSave = async (formData) => {
    setSaving(true);
    const previous = queryClient.getQueryData(QUERY_KEY);
    try {
      if (editing) {
        queryClient.setQueryData(QUERY_KEY, (old) =>
          (old || []).map(item => item.id === editing.id ? { ...item, ...formData } : item)
        );
        await base44.entities.FuelRecord.update(editing.id, formData);
        toast({ title: 'Fuel record updated' });
      } else {
        const tempId = `temp-${Date.now()}`;
        queryClient.setQueryData(QUERY_KEY, (old) => [...(old || []), { ...formData, id: tempId }]);
        await base44.entities.FuelRecord.create(formData);
        toast({ title: 'Fuel record added' });
      }
    } catch {
      queryClient.setQueryData(QUERY_KEY, previous);
      toast({ title: 'Failed to save fuel record', variant: 'destructive' });
    } finally {
      setSaving(false);
      setFormOpen(false);
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
        <PageHeader title="Fuel Log" subtitle={`${data.length} records`} />
        <div className="flex justify-end gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!data.length}>
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Add Fuel Record
          </Button>
        </div>
        <DataTable
          data={data} columns={columns} searchPlaceholder="Search fuel records..."
          filters={[{ key: 'fuel_type', label: 'Fuel Type', options: [
            { value: 'super_98', label: 'Super 98' }, { value: 'special_95', label: 'Special 95' },
            { value: 'eplus_91', label: 'EPlus 91' }, { value: 'diesel', label: 'Diesel' },
          ]}]}
          onEdit={openEdit} onDelete={setDeleteDialog}
          emptyTitle="No fuel records yet" emptyAction={openCreate} emptyActionLabel="Add Fuel Record"
        />
        <FuelRecordForm
          open={formOpen}
          onClose={setFormOpen}
          onSubmit={handleSave}
          loading={saving}
          editing={editing}
          fuelPrices={fuelPrices}
        />
        <ConfirmDialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} onConfirm={handleDelete}
          title="Delete Record" description="Delete this fuel record?" loading={saving} />
      </div>
    </PullToRefresh>
  );
}