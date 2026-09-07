import React, { useEffect, useMemo, useState } from 'react';
import moment from 'moment';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MobileSelect from '@/components/shared/MobileSelect';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { toast } from '@/components/ui/use-toast';
import { downloadReimbursementPDF, downloadReimbursementCSV } from '@/utils/fuelReimbursementReport';
import { FileDown, Loader2 } from 'lucide-react';

// Vehicles included in the reimbursement checklist (add more names here later)
const REIMBURSABLE_VEHICLES = ["Binil's Deepal S05", "Joemon's Deepal S05"];
const REIMBURSEMENT_START_MONTH = '2026-08'; // checklist starts from August 2026
const DEFAULT_MILEAGE = 14; // km per litre
const TZ = 240; // Asia/Dubai (UTC+4)

// Special 95 price fallback (AED/L) per month — used when the stored
// fuel_prices setting is for a different month
const SPECIAL_95_FALLBACK = {
  '2025-10': 2.66, '2025-11': 2.51, '2025-12': 2.58,
  '2026-01': 2.42, '2026-02': 2.33, '2026-03': 2.48,
  '2026-04': 3.28, '2026-05': 3.55, '2026-06': 3.83,
  '2026-07': 3.29, '2026-08': 3.49, '2026-09': 3.69,
};

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

export default function ReimbursementDialog({ open, onOpenChange }) {
  const [data, setData] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState(null);
  const [downloading, setDownloading] = useState(null);

  const loadData = async () => {
    setLoading(true);
    const [trips, vehicles, employees, reimbRecords, fuelSetting] = await Promise.all([
      base44.entities.Trip.list().catch(() => []),
      base44.entities.Vehicle.list().catch(() => []),
      base44.entities.Employee.list().catch(() => []),
      base44.entities.Reimbursement.list().catch(() => []),
      base44.entities.Setting.filter({ key: 'fuel_prices' }).catch(() => []),
    ]);
    let fuelPrices = null;
    try { fuelPrices = fuelSetting[0] ? JSON.parse(fuelSetting[0].value) : null; } catch { fuelPrices = null; }
    setData({ trips, vehicles, employees, fuelPrices });
    setRecords(reimbRecords);
    setLoading(false);
  };

  useEffect(() => { if (open) loadData(); }, [open]);

  // Months from August 2026 to the current month, newest first
  const months = useMemo(() => {
    const list = [];
    let m = moment(REIMBURSEMENT_START_MONTH + '-01');
    const now = moment();
    while (m.isSameOrBefore(now, 'month')) {
      list.push(m.format('YYYY-MM'));
      m.add(1, 'month');
    }
    return list.reverse();
  }, []);

  const getRateForMonth = (month) => {
    const fp = data?.fuelPrices;
    if (fp && fp.month) {
      const storedMonth = moment(fp.month, 'MMMM YYYY').format('YYYY-MM');
      if (storedMonth === month && fp.special_95 != null) return fp.special_95;
    }
    return SPECIAL_95_FALLBACK[month] ?? null;
  };

  const employeeFor = (vehicleName) => {
    const base = vehicleName.split("'s")[0].trim();
    const emp = (data?.employees || []).find((e) =>
      (e.full_name || '').toLowerCase().startsWith(base.toLowerCase())
    );
    return emp?.full_name || base;
  };

  const rows = useMemo(() => {
    if (!data) return [];
    return months.flatMap((month) =>
      REIMBURSABLE_VEHICLES.map((name) => {
        const vehicle = data.vehicles.find((v) => v.name === name);
        const record = records.find((r) => r.month === month && r.vehicle_id === vehicle?.id);
        const monthTrips = data.trips.filter((t) =>
          t.vehicle_id === vehicle?.id
          && t.status !== 'cancelled'
          && t.started_at
          && moment.utc(t.started_at).utcOffset(TZ).format('YYYY-MM') === month
        );
        const distance = monthTrips.reduce((s, t) => s + (Number(t.distance_km) || 0), 0);
        const rate = record?.fuel_rate ?? getRateForMonth(month);
        const mileage = record?.mileage_kmpl ?? DEFAULT_MILEAGE;
        const litres = mileage > 0 ? distance / mileage : 0;
        const amount = litres * (rate || 0);
        return {
          key: `${month}_${vehicle?.id || name}`,
          month,
          monthLabel: moment(month + '-01').format('MMMM YYYY'),
          vehicle,
          vehicleName: name,
          employee: employeeFor(name),
          record,
          tripCount: monthTrips.length,
          distance, rate, mileage, litres, amount,
          status: record?.status || 'unpaid',
          paid: record?.paid_amount ?? 0,
          downloadedAt: record?.downloaded_at,
        };
      })
    );
  }, [data, records, months]);

  const saveRow = async (row, patch) => {
    setSavingKey(row.key);
    try {
      if (row.record) {
        const updated = await base44.entities.Reimbursement.update(row.record.id, patch);
        setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const created = await base44.entities.Reimbursement.create({
          month: row.month,
          vehicle_id: row.vehicle?.id || '',
          vehicle_name: row.vehicleName,
          employee_name: row.employee,
          fuel_type: 'special_95',
          fuel_rate: row.rate,
          mileage_kmpl: row.mileage,
          total_distance_km: round1(row.distance),
          fuel_litres: round2(row.litres),
          amount_due: round2(row.amount),
          paid_amount: row.paid,
          status: row.status,
          ...patch,
        });
        setRecords((prev) => [...prev, created]);
      }
    } catch (e) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally {
      setSavingKey(null);
    }
  };

  const handleDownload = async (format) => {
    setDownloading(format);
    try {
      const now = new Date().toISOString();
      const snapshotFields = (row) => ({
        fuel_rate: row.rate,
        mileage_kmpl: row.mileage,
        total_distance_km: round1(row.distance),
        fuel_litres: round2(row.litres),
        amount_due: round2(row.amount),
        paid_amount: round2(row.paid),
        status: row.status,
        downloaded_at: now,
      });
      const updates = [];
      const creates = [];
      rows.forEach((row) => {
        if (row.record) updates.push({ id: row.record.id, ...snapshotFields(row) });
        else creates.push({
          month: row.month,
          vehicle_id: row.vehicle?.id || '',
          vehicle_name: row.vehicleName,
          employee_name: row.employee,
          fuel_type: 'special_95',
          ...snapshotFields(row),
        });
      });
      if (updates.length) await base44.entities.Reimbursement.bulkUpdate(updates);
      if (creates.length) await base44.entities.Reimbursement.bulkCreate(creates);

      const reportRows = rows.map((r) => ({
        month: r.monthLabel,
        employee: r.employee,
        vehicle: r.vehicle?.name || r.vehicleName,
        distance: r.distance,
        rate: r.rate,
        mileage: r.mileage,
        litres: r.litres,
        amount: r.amount,
        status: r.status,
        paid: r.paid,
      }));
      const generatedAt = moment().utcOffset(TZ).format('MMM DD, YYYY HH:mm');
      if (format === 'pdf') downloadReimbursementPDF(reportRows, generatedAt);
      else downloadReimbursementCSV(reportRows, generatedAt);
      toast({ title: 'Reimbursement report downloaded' });
      loadData();
    } catch (e) {
      toast({ title: 'Download failed', description: e.message, variant: 'destructive' });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fuel Reimbursement Checklist</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Monthly cash reimbursement from August 2026 · Fuel: Special 95 · Amount = (Distance ÷ Mileage) × Fuel Rate
          </p>
        </DialogHeader>

        {loading || !data ? (
          <TableSkeleton rows={4} cols={6} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs font-semibold uppercase text-muted-foreground">
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2">Vehicle</th>
                  <th className="px-3 py-2 text-right">Distance</th>
                  <th className="px-3 py-2 text-right">Rate (AED/L)</th>
                  <th className="px-3 py-2 text-right">Mileage (km/L)</th>
                  <th className="px-3 py-2 text-right">Fuel (L)</th>
                  <th className="px-3 py-2 text-right">Amount (AED)</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Paid (AED)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.key} className={savingKey === row.key ? 'opacity-60' : ''}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {savingKey === row.key && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                        {row.monthLabel}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.vehicle?.name || row.vehicleName}</div>
                      <div className="text-xs text-muted-foreground">{row.employee}</div>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {row.distance.toFixed(1)} km
                      <div className="text-xs text-muted-foreground">{row.tripCount} trip(s)</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        key={`rate-${row.rate}`}
                        type="number" step="0.01" min="0"
                        className="h-8 w-20 text-right"
                        defaultValue={row.rate ?? ''}
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v !== row.rate) saveRow(row, { fuel_rate: v });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        key={`mileage-${row.mileage}`}
                        type="number" step="0.1" min="0"
                        className="h-8 w-20 text-right"
                        defaultValue={row.mileage}
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v !== row.mileage) saveRow(row, { mileage_kmpl: v });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.litres.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{row.amount.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <MobileSelect
                        value={row.status}
                        onValueChange={(v) => saveRow(row, {
                          status: v,
                          ...(v === 'paid' && !row.paid ? { paid_amount: round2(row.amount) } : {}),
                        })}
                        options={[
                          { value: 'unpaid', label: 'Not Paid' },
                          { value: 'paid', label: 'Paid' },
                        ]}
                        placeholder="Status"
                      />
                      {row.downloadedAt && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Report downloaded {moment(row.downloadedAt).format('MMM DD, HH:mm')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        key={`paid-${row.paid}`}
                        type="number" step="0.01" min="0"
                        className="h-8 w-24 text-right"
                        defaultValue={row.paid || ''}
                        placeholder="0.00"
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          if (v !== row.paid) saveRow(row, { paid_amount: round2(v) });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <p className="text-xs text-muted-foreground flex-1">
            Downloaded reports capture the paid amounts exactly as they are at download time.
          </p>
          <Button variant="outline" className="gap-2" onClick={() => handleDownload('csv')} disabled={!!downloading}>
            <FileDown className="w-4 h-4" />
            {downloading === 'csv' ? 'Generating...' : 'Download CSV'}
          </Button>
          <Button className="gap-2" onClick={() => handleDownload('pdf')} disabled={!!downloading}>
            <FileDown className="w-4 h-4" />
            {downloading === 'pdf' ? 'Generating...' : 'Download PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}