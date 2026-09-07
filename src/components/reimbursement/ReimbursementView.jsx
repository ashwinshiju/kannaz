import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Info } from 'lucide-react';
import {
  DEFAULT_MILEAGE,
  getReimbursementMonths,
  monthKeyToLabel,
  getDefaultRate,
  getMonthVehicleDistance,
  computeAmount,
} from '@/utils/reimbursement';

// View-only reimbursement summary for ALL vehicles, by month.
// No paid status, no editing — amounts use the month's Special 95 rate and
// the default mileage, or the frozen stored amount for months already paid.
export default function ReimbursementView({ trips, vehicles, isLoadingTrips }) {
  const months = useMemo(() => getReimbursementMonths(), []);
  const [selectedMonth, setSelectedMonth] = useState(months[0]);

  const { data: records = [], isLoading: loadingRecords } = useQuery({
    queryKey: ['reimbursement-records'],
    queryFn: () => base44.entities.ReimbursementRecord.list().catch(() => []),
  });
  const { data: fuelPrices } = useQuery({
    queryKey: ['fuel-prices-setting'],
    queryFn: async () => {
      const s = await base44.entities.Setting.filter({ key: 'fuel_prices' }).catch(() => []);
      if (!s.length) return null;
      try { return JSON.parse(s[0].value); } catch { return null; }
    },
  });

  const vehicleNames = useMemo(
    () => vehicles.map((v) => v.name).filter(Boolean),
    [vehicles]
  );

  const rows = useMemo(() => {
    const distanceTotals = getMonthVehicleDistance(trips, vehicleNames, selectedMonth);
    return vehicleNames
      .map((name) => {
        const rec = records.find((r) => r.month_key === selectedMonth && r.vehicle_name === name);
        if (rec) {
          return {
            vehicleName: name,
            distance: Number(rec.distance_km) || 0,
            rate: Number(rec.rate) || 0,
            mileage: Number(rec.mileage) || 0,
            amount: Number(rec.amount) || 0,
          };
        }
        const distance = distanceTotals[name] || 0;
        const rate = getDefaultRate(selectedMonth, fuelPrices);
        return {
          vehicleName: name,
          distance,
          rate,
          mileage: DEFAULT_MILEAGE,
          amount: computeAmount(distance, rate, DEFAULT_MILEAGE),
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [trips, vehicleNames, records, selectedMonth, fuelPrices]);

  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  const loading = isLoadingTrips || loadingRecords;

  return (
    <div className="space-y-4">
      {/* Month selectors */}
      <div className="flex flex-wrap gap-2">
        {months.map((mk) => (
          <button
            key={mk}
            type="button"
            onClick={() => setSelectedMonth(mk)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors',
              mk === selectedMonth ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50'
            )}
          >
            {monthKeyToLabel(mk)}
          </button>
        ))}
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        View-only summary of all vehicles. Amount = total distance × that month's Special 95 rate ÷
        mileage (default {DEFAULT_MILEAGE} km/L); months already marked paid show the frozen amount.
      </p>

      {/* Reimbursement table */}
      <div className="overflow-x-auto max-h-72 overflow-y-auto scrollbar-thin rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="text-xs text-muted-foreground uppercase tracking-wide border-b border-border">
              <th className="px-2 py-2 text-left font-medium">Vehicle</th>
              <th className="px-2 py-2 text-right font-medium">Distance (km)</th>
              <th className="px-2 py-2 text-right font-medium">Rate (AED/L)</th>
              <th className="px-2 py-2 text-right font-medium">Mileage (km/L)</th>
              <th className="px-2 py-2 text-right font-medium">Amount (AED)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-secondary/20">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-2 py-2"><Skeleton className="h-6 w-full" /></td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-6 text-center text-sm text-muted-foreground">No vehicles found.</td>
              </tr>
            ) : (
              <>
                {rows.map((row) => (
                  <tr key={row.vehicleName}>
                    <td className="px-2 py-2 font-medium whitespace-nowrap">{row.vehicleName}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{row.distance.toFixed(1)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{row.rate}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{row.mileage}</td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">{row.amount.toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-muted/40 sticky bottom-0">
                  <td colSpan={4} className="px-2 py-2.5 font-semibold">Total</td>
                  <td className="px-2 py-2.5 text-right font-bold tabular-nums">{total.toFixed(2)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}