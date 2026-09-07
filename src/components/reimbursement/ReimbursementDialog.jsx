import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Download, Info } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import {
  REIMBURSEMENT_VEHICLES,
  DEFAULT_MILEAGE,
  getReimbursementMonths,
  monthKeyToLabel,
  getDefaultRate,
  getMonthVehicleDistance,
  computeAmount,
  downloadReimbursementCSV,
  downloadReimbursementPDF,
} from '@/utils/reimbursement';

export default function ReimbursementDialog({ open, onOpenChange }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const months = useMemo(() => getReimbursementMonths(), []);
  const [selectedMonth, setSelectedMonth] = useState(months[0]);
  const [edits, setEdits] = useState({}); // { monthKey: { vehicleName: { rate, mileage } } }
  const [toggling, setToggling] = useState(false);

  const { data: trips = [], isLoading: loadingTrips } = useQuery({
    queryKey: ['trips'],
    queryFn: () => base44.entities.Trip.list().catch(() => []),
    enabled: open,
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list().catch(() => []),
    enabled: open,
  });
  const { data: records = [], isLoading: loadingRecords } = useQuery({
    queryKey: ['reimbursement-records'],
    queryFn: () => base44.entities.ReimbursementRecord.list().catch(() => []),
    enabled: open,
  });
  const { data: fuelPrices } = useQuery({
    queryKey: ['fuel-prices-setting'],
    queryFn: async () => {
      const s = await base44.entities.Setting.filter({ key: 'fuel_prices' }).catch(() => []);
      if (!s.length) return null;
      try { return JSON.parse(s[0].value); } catch { return null; }
    },
    enabled: open,
  });

  const loading = loadingTrips || loadingRecords;

  // One row per vehicle. Paid rows use the frozen stored values; unpaid rows
  // are computed live from trips, with any local rate/mileage edits applied.
  const rows = useMemo(() => {
    const distanceTotals = getMonthVehicleDistance(trips, REIMBURSEMENT_VEHICLES, selectedMonth);
    return REIMBURSEMENT_VEHICLES.map((name) => {
      const vehicle = vehicles.find((v) => v.name === name);
      const rec = records.find((r) => r.month_key === selectedMonth && r.vehicle_name === name);
      if (rec) {
        return {
          vehicleName: name,
          vehicleId: vehicle?.id || rec.vehicle_id,
          paid: true,
          recordId: rec.id,
          distance: Number(rec.distance_km) || 0,
          rate: Number(rec.rate) || 0,
          mileage: Number(rec.mileage) || 0,
          amount: Number(rec.amount) || 0,
        };
      }
      const edit = edits[selectedMonth]?.[name] || {};
      const distance = distanceTotals[name] || 0;
      const rate = edit.rate != null ? edit.rate : getDefaultRate(selectedMonth, fuelPrices);
      const mileage = edit.mileage != null ? edit.mileage : DEFAULT_MILEAGE;
      return {
        vehicleName: name,
        vehicleId: vehicle?.id || '',
        paid: false,
        recordId: null,
        distance,
        rate,
        mileage,
        amount: computeAmount(distance, rate, mileage),
      };
    });
  }, [trips, vehicles, records, edits, selectedMonth, fuelPrices]);

  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  const paidCountFor = (mk) => records.filter((r) => r.month_key === mk).length;

  const setEdit = (vehicleName, field, value) => {
    setEdits((prev) => ({
      ...prev,
      [selectedMonth]: {
        ...(prev[selectedMonth] || {}),
        [vehicleName]: { ...(prev[selectedMonth]?.[vehicleName] || {}), [field]: value },
      },
    }));
  };

  // Marking paid freezes distance, rate, mileage and amount into a stored
  // record; unmarking removes the record so values recalculate live.
  const handlePaidChange = async (row, checked) => {
    setToggling(true);
    try {
      if (checked) {
        await base44.entities.ReimbursementRecord.create({
          vehicle_id: row.vehicleId || '',
          vehicle_name: row.vehicleName,
          month_key: selectedMonth,
          month_label: monthKeyToLabel(selectedMonth),
          distance_km: Number(row.distance.toFixed(1)),
          rate: row.rate,
          mileage: row.mileage,
          amount: Number(row.amount.toFixed(2)),
          is_paid: true,
          paid_at: new Date().toISOString(),
          paid_by: user?.full_name || user?.email || '',
        });
        toast({
          title: 'Marked as paid',
          description: `${row.vehicleName} — ${monthKeyToLabel(selectedMonth)} amount frozen at AED ${row.amount.toFixed(2)}.`,
        });
      } else if (row.recordId) {
        await base44.entities.ReimbursementRecord.delete(row.recordId);
        toast({
          title: 'Marked as unpaid',
          description: 'The amount will be recalculated from live trip data.',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['reimbursement-records'] });
    } catch {
      toast({ title: 'Could not update paid status', variant: 'destructive' });
    } finally {
      setToggling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Monthly Vehicle Cash Reimbursement</DialogTitle>
        </DialogHeader>

        {/* Month selectors */}
        <div className="flex flex-wrap gap-2">
          {months.map((mk) => {
            const active = mk === selectedMonth;
            return (
              <button
                key={mk}
                type="button"
                onClick={() => setSelectedMonth(mk)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-left transition-colors',
                  active ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50'
                )}
              >
                <span className="block text-sm font-semibold leading-tight">{monthKeyToLabel(mk)}</span>
                <span className="block text-xs text-muted-foreground">
                  {paidCountFor(mk)}/{REIMBURSEMENT_VEHICLES.length} paid
                </span>
              </button>
            );
          })}
        </div>

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Amount = total distance × that month's fuel rate (Special 95) ÷ mileage (default {DEFAULT_MILEAGE} km/L, editable).
          Once marked paid, the distance, rate, mileage and amount are frozen — downloads always use the stored paid amount even if trips change later.
        </p>

        {/* Reimbursement table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-2 py-2 text-left font-medium">Paid</th>
                <th className="px-2 py-2 text-left font-medium">Vehicle</th>
                <th className="px-2 py-2 text-right font-medium">Distance (km)</th>
                <th className="px-2 py-2 text-right font-medium">Rate (AED/L)</th>
                <th className="px-2 py-2 text-right font-medium">Mileage (km/L)</th>
                <th className="px-2 py-2 text-right font-medium">Amount (AED)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-secondary/30 rounded-lg">
              {loading
                ? Array.from({ length: REIMBURSEMENT_VEHICLES.length }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-2 py-2"><Skeleton className="h-8 w-full" /></td>
                    </tr>
                  ))
                : rows.map((row) => (
                    <tr key={row.vehicleName}>
                      <td className="px-2 py-2">
                        <Checkbox
                          checked={row.paid}
                          onCheckedChange={(v) => handlePaidChange(row, !!v)}
                          disabled={toggling}
                          aria-label={`Mark ${row.vehicleName} as paid`}
                        />
                      </td>
                      <td className="px-2 py-2 font-medium whitespace-nowrap">{row.vehicleName}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{row.distance.toFixed(1)}</td>
                      <td className="px-2 py-2 text-right">
                        {row.paid ? (
                          <span className="tabular-nums">{row.rate}</span>
                        ) : (
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.rate}
                            onChange={(e) => setEdit(row.vehicleName, 'rate', parseFloat(e.target.value) || 0)}
                            className="h-8 w-20 text-right bg-card ml-auto"
                          />
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {row.paid ? (
                          <span className="tabular-nums">{row.mileage}</span>
                        ) : (
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            value={row.mileage}
                            onChange={(e) => setEdit(row.vehicleName, 'mileage', parseFloat(e.target.value) || 0)}
                            className="h-8 w-20 text-right bg-card ml-auto"
                          />
                        )}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums">{row.amount.toFixed(2)}</td>
                    </tr>
                  ))}
              {!loading && (
                <tr className="border-t border-border">
                  <td colSpan={5} className="px-2 py-2.5 font-semibold">Total</td>
                  <td className="px-2 py-2.5 text-right font-bold tabular-nums">{total.toFixed(2)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            className="gap-2"
            disabled={loading}
            onClick={() => downloadReimbursementCSV(rows, selectedMonth)}
          >
            <FileText className="w-4 h-4" />
            CSV
          </Button>
          <Button
            className="gap-2"
            disabled={loading}
            onClick={() => downloadReimbursementPDF(rows, selectedMonth, new Date().toLocaleString())}
          >
            <Download className="w-4 h-4" />
            PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}