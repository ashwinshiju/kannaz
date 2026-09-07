import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { downloadReimbursementCSV, downloadReimbursementPDF } from '@/utils/reimbursementReport';

const REIMBURSEMENT_START = '2026-08';
const DEFAULT_MILEAGE = 14;

// Historical UAE fuel rates (AED/L) for months before the stored fuel_prices setting
const HISTORICAL_FUEL_RATES = {
  '2026-08': { super_98: 3.6, special_95: 3.49, eplus_91: 3.41, diesel: 3.8 },
};

const FUEL_TYPE_RATE_KEY = { petrol: 'super_98', diesel: 'diesel' };

const buildMonths = () => {
  const months = [];
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  const d = new Date(2026, 7, 1);
  while (d <= end) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() + 1);
  }
  if (months.length === 0) months.push(REIMBURSEMENT_START);
  return months;
};

const monthLabel = (key) => new Date(`${key}-01T00:00:00`).toLocaleDateString([], { month: 'short', year: 'numeric' });
const fmt2 = (n) => (Number(n) || 0).toFixed(2);

export default function ReimbursementDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const months = useMemo(buildMonths, []);
  const [selectedMonth, setSelectedMonth] = useState(months[months.length - 1]);
  const [rateOverrides, setRateOverrides] = useState({});
  const [mileageOverrides, setMileageOverrides] = useState({});
  const [paidDrafts, setPaidDrafts] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setRateOverrides({});
      setMileageOverrides({});
      setPaidDrafts({});
    }
  }, [open]);

  const { data: trips = [] } = useQuery({
    queryKey: ['trips'],
    queryFn: () => base44.entities.Trip.list().catch(() => []),
    enabled: open,
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list().catch(() => []),
    enabled: open,
  });
  const { data: fuelSettings = [] } = useQuery({
    queryKey: ['fuel-prices'],
    queryFn: () => base44.entities.Setting.filter({ key: 'fuel_prices' }).catch(() => []),
    enabled: open,
  });
  const { data: reimbursements = [] } = useQuery({
    queryKey: ['reimbursements'],
    queryFn: () => base44.entities.Reimbursement.list().catch(() => []),
    enabled: open,
  });

  const storedRates = useMemo(() => {
    try {
      const parsed = JSON.parse(fuelSettings[0]?.value || '{}');
      return parsed.super_98 ? parsed : null;
    } catch {
      return null;
    }
  }, [fuelSettings]);

  const getMonthRates = (month) =>
    HISTORICAL_FUEL_RATES[month] || storedRates || { super_98: 3.8, special_95: 3.69, eplus_91: 3.61, diesel: 4.3 };

  const vehiclesById = useMemo(() => Object.fromEntries(vehicles.map(v => [v.id, v])), [vehicles]);

  const rows = useMemo(() => {
    if (!open) return [];
    const records = reimbursements.filter(r => r.month === selectedMonth);
    const distMap = {};
    trips.forEach(t => {
      if (t.status === 'cancelled' || !t.vehicle_id) return;
      if (!t.started_at?.startsWith(selectedMonth)) return;
      distMap[t.vehicle_id] = (distMap[t.vehicle_id] || 0) + (t.distance_km || 0);
    });
    const rates = getMonthRates(selectedMonth);
    const ids = new Set([...Object.keys(distMap), ...records.map(r => r.vehicle_id)]);
    return [...ids].map(id => {
      const vehicle = vehiclesById[id];
      const record = records.find(r => r.vehicle_id === id);
      const oKey = `${selectedMonth}|${id}`;
      const rateKey = FUEL_TYPE_RATE_KEY[vehicle?.fuel_type] || 'super_98';
      const defaultRate = rates[rateKey] ?? rates.super_98 ?? 0;
      const fuelRate = record
        ? record.fuel_rate
        : (rateOverrides[oKey] !== undefined ? parseFloat(rateOverrides[oKey]) || 0 : defaultRate);
      const mileage = record
        ? record.mileage_kmpl
        : (mileageOverrides[oKey] !== undefined ? parseFloat(mileageOverrides[oKey]) || 0 : DEFAULT_MILEAGE);
      const distance = record ? record.total_distance_km : (distMap[id] || 0);
      const amount = record ? record.paid_amount : (mileage > 0 ? (distance * fuelRate) / mileage : 0);
      return {
        id,
        record,
        vehicleName: vehicle?.name || record?.vehicle_name || 'Unknown vehicle',
        distance,
        fuelRate,
        mileage,
        amount,
        status: record ? 'paid' : 'unpaid',
      };
    }).sort((a, b) => a.vehicleName.localeCompare(b.vehicleName));
  }, [open, selectedMonth, trips, vehiclesById, reimbursements, rateOverrides, mileageOverrides, storedRates]);

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const monthStats = (m) => {
    const recs = reimbursements.filter(r => r.month === m);
    const used = new Set(trips.filter(t => t.status !== 'cancelled' && t.vehicle_id && t.started_at?.startsWith(m)).map(t => t.vehicle_id));
    recs.forEach(r => used.add(r.vehicle_id));
    return { paid: recs.length, totalVehicles: used.size };
  };

  const markPaid = async (row) => {
    setSaving(true);
    try {
      await base44.entities.Reimbursement.create({
        vehicle_id: row.id,
        vehicle_name: row.vehicleName,
        month: selectedMonth,
        total_distance_km: row.distance,
        fuel_rate: row.fuelRate,
        mileage_kmpl: row.mileage,
        amount: row.amount,
        paid_amount: row.amount,
        status: 'paid',
        paid_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['reimbursements'] });
    } finally {
      setSaving(false);
    }
  };

  const unmarkPaid = async (record) => {
    if (!record) return;
    setSaving(true);
    try {
      await base44.entities.Reimbursement.delete(record.id);
      queryClient.invalidateQueries({ queryKey: ['reimbursements'] });
    } finally {
      setSaving(false);
    }
  };

  const savePaidAmount = async (record, value) => {
    const amt = parseFloat(value);
    if (!record || isNaN(amt) || amt === record.paid_amount) return;
    setSaving(true);
    try {
      await base44.entities.Reimbursement.update(record.id, { paid_amount: amt });
      queryClient.invalidateQueries({ queryKey: ['reimbursements'] });
    } finally {
      setSaving(false);
    }
  };

  const exportRows = rows.map(r => ({
    vehicle: r.vehicleName,
    distance_km: r.distance,
    fuel_rate: r.fuelRate,
    mileage: r.mileage,
    amount: r.amount,
    status: r.status,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Monthly Vehicle Cash Reimbursement</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {months.map(m => {
            const stats = monthStats(m);
            return (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={cn(
                  "shrink-0 rounded-lg border px-3 py-2 text-left transition-colors",
                  selectedMonth === m ? "border-primary bg-primary/10" : "border-border hover:bg-accent/50"
                )}
              >
                <span className="block text-sm font-semibold">{monthLabel(m)}</span>
                <span className="block text-xs text-muted-foreground">{stats.paid}/{stats.totalVehicles} paid</span>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          Amount = total distance × that month's fuel rate ÷ mileage (default {DEFAULT_MILEAGE} km/L, editable). Once marked paid, the distance, rate, mileage and amount are frozen — downloads always use the stored paid amount even if trips change later.
        </p>

        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <th className="p-2">Paid</th>
                  <th className="p-2">Vehicle</th>
                  <th className="p-2 text-right">Distance (km)</th>
                  <th className="p-2 text-right">Rate (AED/L)</th>
                  <th className="p-2 text-right">Mileage (km/L)</th>
                  <th className="p-2 text-right">Amount (AED)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(row => {
                  const oKey = `${selectedMonth}|${row.id}`;
                  return (
                    <tr key={row.id}>
                      <td className="p-2">
                        <Checkbox
                          checked={!!row.record}
                          disabled={saving}
                          onCheckedChange={(c) => c ? markPaid(row) : unmarkPaid(row.record)}
                        />
                      </td>
                      <td className="p-2 font-medium">{row.vehicleName}</td>
                      <td className="p-2 text-right tabular-nums">{Number(row.distance).toFixed(1)}</td>
                      <td className="p-2 text-right">
                        {row.record ? (
                          <span className="tabular-nums">{fmt2(row.fuelRate)}</span>
                        ) : (
                          <Input
                            type="number" step="0.01" min="0"
                            className="h-8 w-20 text-right"
                            value={rateOverrides[oKey] ?? String(row.fuelRate)}
                            onChange={e => setRateOverrides(p => ({ ...p, [oKey]: e.target.value }))}
                          />
                        )}
                      </td>
                      <td className="p-2 text-right">
                        {row.record ? (
                          <span className="tabular-nums">{fmt2(row.mileage)}</span>
                        ) : (
                          <Input
                            type="number" step="0.1" min="0"
                            className="h-8 w-20 text-right"
                            value={mileageOverrides[oKey] ?? String(row.mileage)}
                            onChange={e => setMileageOverrides(p => ({ ...p, [oKey]: e.target.value }))}
                          />
                        )}
                      </td>
                      <td className="p-2 text-right">
                        {row.record ? (
                          <Input
                            type="number" step="0.01" min="0"
                            className="h-8 w-24 text-right font-semibold"
                            value={paidDrafts[row.record.id] ?? String(row.record.paid_amount)}
                            onChange={e => setPaidDrafts(p => ({ ...p, [row.record.id]: e.target.value }))}
                            onBlur={() => savePaidAmount(row.record, paidDrafts[row.record.id])}
                          />
                        ) : (
                          <span className="tabular-nums font-semibold">{fmt2(row.amount)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No vehicles used in {monthLabel(selectedMonth)}
                    </td>
                  </tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="border-t border-border bg-muted/50">
                  <tr>
                    <td colSpan={5} className="p-2 font-semibold">Total</td>
                    <td className="p-2 text-right font-semibold tabular-nums">{fmt2(total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {saving ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving...
            </p>
          ) : <span />}
          <div className="flex gap-2">
            <Button
              variant="outline" className="gap-2" disabled={!rows.length}
              onClick={() => downloadReimbursementCSV(monthLabel(selectedMonth), exportRows)}
            >
              <FileSpreadsheet className="w-4 h-4" /> CSV
            </Button>
            <Button
              className="gap-2" disabled={!rows.length}
              onClick={() => downloadReimbursementPDF(monthLabel(selectedMonth), exportRows)}
            >
              <Download className="w-4 h-4" /> PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}