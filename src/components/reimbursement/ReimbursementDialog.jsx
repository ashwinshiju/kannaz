import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import moment from 'moment';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';
import ReimbursementRows from './ReimbursementRows';
import MonthlyChecklist from './MonthlyChecklist';
import { downloadReimbursementCSV, downloadReimbursementPDF } from './reimbursementReport';
import { RefreshCw, Save, FileText, FileSpreadsheet } from 'lucide-react';

const TZ = 240; // Asia/Dubai (UTC+4)
const START_MONTH = '2026-08'; // checklist starts from August onwards
const DEFAULT_MILEAGE = 14;

function getMonths() {
  const months = [];
  let m = moment(START_MONTH, 'YYYY-MM');
  const end = moment().startOf('month');
  while (m.isSameOrBefore(end)) { months.push(m.format('YYYY-MM')); m.add(1, 'month'); }
  return months.reverse(); // newest first
}

export default function ReimbursementDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(moment().format('YYYY-MM'));
  const [mileageDefault, setMileageDefault] = useState(DEFAULT_MILEAGE);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState(null); // null = all vehicles
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const selectionTouched = useRef(false);

  const months = getMonths();

  const { data: vehicles = [], isPending: loadingVehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list().catch(() => []),
  });
  const { data: trips = [], isPending: loadingTrips } = useQuery({
    queryKey: ['trips'],
    queryFn: () => base44.entities.Trip.list().catch(() => []),
  });
  const { data: reimbRecords = [], isPending: loadingRecords } = useQuery({
    queryKey: ['reimbursements'],
    queryFn: () => base44.entities.Reimbursement.list().catch(() => []),
    enabled: open,
  });
  const { data: fuelSetting } = useQuery({
    queryKey: ['fuel_prices_setting'],
    queryFn: () => base44.entities.Setting.filter({ key: 'fuel_prices' }).catch(() => []),
  });

  const fuelPrices = (() => {
    try { return JSON.parse(fuelSetting?.[0]?.value || '{}'); } catch { return {}; }
  })();
  const fuelRate = Number(fuelPrices.special_95) || 0; // default fuel: Special 95

  const dataReady = !loadingVehicles && !loadingTrips && !loadingRecords;

  const generateRows = useCallback(() => {
    if (!dataReady) return;
    const selected = selectedVehicleIds ?? vehicles.map(v => v.id);
    const monthTrips = trips.filter(t => {
      const ts = t.started_at || t.created_date;
      return ts && moment.utc(ts).utcOffset(TZ).format('YYYY-MM') === month;
    });
    const newRows = vehicles.filter(v => selected.includes(v.id)).map(v => {
      const saved = reimbRecords.find(r => r.vehicle_id === v.id && r.month === month);
      if (saved) return { ...saved, isNew: false };
      const dist = monthTrips
        .filter(t => t.vehicle_id === v.id || (!t.vehicle_id && t.vehicle_name === v.name))
        .reduce((s, t) => s + (Number(t.distance_km) || 0), 0);
      const mileage = Number(mileageDefault) || DEFAULT_MILEAGE;
      const amount = mileage > 0 ? (dist * fuelRate) / mileage : 0;
      return {
        vehicle_id: v.id,
        vehicle_name: v.name,
        month,
        total_distance_km: Number(dist.toFixed(1)),
        fuel_type: 'special_95',
        fuel_rate: fuelRate,
        mileage_kmpl: mileage,
        reimbursement_amount: Number(amount.toFixed(2)),
        paid_amount: Number(amount.toFixed(2)),
        status: 'unpaid',
        isNew: true,
      };
    });
    setRows(newRows);
  }, [dataReady, vehicles, trips, reimbRecords, selectedVehicleIds, month, mileageDefault, fuelRate]);

  // Generate whenever the month changes (or data becomes ready while open)
  useEffect(() => {
    if (open && dataReady) generateRows();
  }, [open, month, dataReady, generateRows]);

  const updateRow = (idx, patch) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const next = { ...r, ...patch };
      const dist = Number(next.total_distance_km) || 0;
      const rate = Number(next.fuel_rate) || 0;
      const mileage = Number(next.mileage_kmpl) || 0;
      const amount = mileage > 0 ? (dist * rate) / mileage : 0;
      next.reimbursement_amount = Number(amount.toFixed(2));
      // Paid amount follows the recalculated amount; direct edits override it
      if (patch.mileage_kmpl !== undefined || patch.fuel_rate !== undefined) {
        next.paid_amount = Number(amount.toFixed(2));
      }
      return next;
    }));
  };

  const toggleVehicle = (id, checked) => {
    selectionTouched.current = true;
    setSelectedVehicleIds(prev => {
      const current = prev ?? vehicles.map(v => v.id);
      const next = checked ? [...new Set([...current, id])] : current.filter(v => v !== id);
      return next.length === vehicles.length ? null : next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(rows.map(r => {
        const payload = {
          vehicle_id: r.vehicle_id,
          vehicle_name: r.vehicle_name,
          month: r.month,
          total_distance_km: r.total_distance_km,
          fuel_type: r.fuel_type,
          fuel_rate: r.fuel_rate,
          mileage_kmpl: r.mileage_kmpl,
          reimbursement_amount: r.reimbursement_amount,
          paid_amount: r.paid_amount,
          status: r.status,
        };
        return r.id
          ? base44.entities.Reimbursement.update(r.id, payload)
          : base44.entities.Reimbursement.create(payload);
      }));
      await queryClient.invalidateQueries({ queryKey: ['reimbursements'] });
      setRows(prev => prev.map(r => ({ ...r, isNew: false })));
      toast({ title: 'Reimbursement saved', description: `${rows.length} record(s) stored for ${month}` });
    } catch {
      toast({ title: 'Save failed', description: 'Could not save reimbursement records.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleChecklist = async (rec) => {
    setTogglingId(rec.id);
    try {
      await base44.entities.Reimbursement.update(rec.id, { status: rec.status === 'paid' ? 'unpaid' : 'paid' });
      await queryClient.invalidateQueries({ queryKey: ['reimbursements'] });
      generateRows();
    } finally {
      setTogglingId(null);
    }
  };

  const monthRecords = reimbRecords.filter(r => r.month === month);
  const allSelected = selectedVehicleIds === null || (selectedVehicleIds?.length === vehicles.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vehicle Cash Reimbursement</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="generate">
          <TabsList>
            <TabsTrigger value="generate">Generate &amp; Edit</TabsTrigger>
            <TabsTrigger value="checklist">Monthly Checklist</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Month</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                >
                  {months.map(m => <option key={m} value={m}>{moment(m, 'YYYY-MM').format('MMMM YYYY')}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mileage-default">Default Mileage (km/L)</Label>
                <Input
                  id="mileage-default" type="number" step="0.1" min="0"
                  value={mileageDefault}
                  onChange={e => setMileageDefault(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fuel Rate (Special 95)</Label>
                <div className="h-9 flex items-center px-3 rounded-md border border-input text-sm">
                  AED {fuelRate.toFixed(2)}/L
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Vehicles</Label>
              {!loadingVehicles && (
                <div className="flex items-center gap-2 mb-1">
                  <Checkbox
                    id="select-all"
                    checked={allSelected}
                    onCheckedChange={checked => {
                      selectionTouched.current = true;
                      setSelectedVehicleIds(checked ? null : []);
                    }}
                  />
                  <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">All vehicles</label>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-32 overflow-y-auto scrollbar-thin">
                {vehicles.map(v => (
                  <label key={v.id} className="flex items-center gap-2 text-sm rounded-md border border-input px-2.5 py-1.5 cursor-pointer hover:bg-accent/50">
                    <Checkbox
                      checked={allSelected || selectedVehicleIds?.includes(v.id)}
                      onCheckedChange={checked => toggleVehicle(v.id, checked)}
                    />
                    <span className="truncate">{v.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={generateRows} disabled={!dataReady} className="gap-2">
                <RefreshCw className="w-4 h-4" /> Generate
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm" className="gap-2"
                  disabled={!rows.length}
                  onClick={() => downloadReimbursementCSV(rows, month)}
                >
                  <FileSpreadsheet className="w-4 h-4" /> CSV
                </Button>
                <Button
                  variant="outline" size="sm" className="gap-2"
                  disabled={!rows.length}
                  onClick={() => downloadReimbursementPDF(rows, month)}
                >
                  <FileText className="w-4 h-4" /> PDF
                </Button>
                <Button size="sm" className="gap-2" onClick={handleSave} disabled={saving || !rows.length}>
                  <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>

            {!dataReady ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Loading trips and vehicle data...</p>
            ) : (
              <ReimbursementRows rows={rows} onRowChange={updateRow} saving={saving} />
            )}
            <p className="text-xs text-muted-foreground">
              Reimbursement = total distance × fuel rate (Special 95) ÷ mileage. Saved paid amounts are used as-is in downloads.
              {monthRecords.length > 0 && ` ${monthRecords.length} record(s) already saved for this month.`}
            </p>
          </TabsContent>

          <TabsContent value="checklist" className="pt-2">
            <MonthlyChecklist records={reimbRecords} onToggle={handleToggleChecklist} togglingId={togglingId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}