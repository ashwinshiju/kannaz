import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Editable per-vehicle reimbursement rows for the selected month.
// Amount = distance × fuel rate ÷ mileage; paid amount follows the amount
// until the user overrides it directly.
export default function ReimbursementRows({ rows, onRowChange, saving }) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No vehicles selected. Select at least one vehicle and generate.</p>;
  }

  return (
    <div className="overflow-x-auto border border-border rounded-lg">
      <table className="w-full text-sm min-w-[820px]">
        <thead>
          <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-semibold">Vehicle</th>
            <th className="px-3 py-2 font-semibold">Distance (km)</th>
            <th className="px-3 py-2 font-semibold">Fuel Rate (AED/L)</th>
            <th className="px-3 py-2 font-semibold">Mileage (km/L)</th>
            <th className="px-3 py-2 font-semibold">Amount (AED)</th>
            <th className="px-3 py-2 font-semibold">Paid Amount</th>
            <th className="px-3 py-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={r.vehicle_id || r.vehicle_name} className="hover:bg-muted/30">
              <td className="px-3 py-2">
                <span className="font-medium">{r.vehicle_name}</span>
                {!r.id && <span className="ml-2 text-[10px] text-amber-600">new</span>}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{Number(r.total_distance_km || 0).toFixed(1)}</td>
              <td className="px-3 py-2">
                <Input
                  type="number" step="0.01" min="0" className="h-8 w-24"
                  value={r.fuel_rate ?? ''}
                  onChange={e => onRowChange(i, { fuel_rate: parseFloat(e.target.value) || 0 })}
                  disabled={saving}
                />
              </td>
              <td className="px-3 py-2">
                <Input
                  type="number" step="0.1" min="0" className="h-8 w-24"
                  value={r.mileage_kmpl ?? ''}
                  onChange={e => onRowChange(i, { mileage_kmpl: parseFloat(e.target.value) || 0 })}
                  disabled={saving}
                />
              </td>
              <td className="px-3 py-2 font-semibold">{Number(r.reimbursement_amount || 0).toFixed(2)}</td>
              <td className="px-3 py-2">
                <Input
                  type="number" step="0.01" min="0" className="h-8 w-28"
                  value={r.paid_amount ?? ''}
                  onChange={e => onRowChange(i, { paid_amount: parseFloat(e.target.value) || 0 })}
                  disabled={saving}
                />
              </td>
              <td className="px-3 py-2">
                <Button
                  type="button" variant="outline" size="sm"
                  disabled={saving}
                  onClick={() => onRowChange(i, { status: r.status === 'paid' ? 'unpaid' : 'paid' })}
                  className={cn('h-7 px-2.5 text-xs capitalize',
                    r.status === 'paid' ? 'text-emerald-600 border-emerald-300' : 'text-amber-600 border-amber-300')}
                >
                  {r.status}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}