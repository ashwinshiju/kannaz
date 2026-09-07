import React from 'react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/shared/StatusBadge';
import { monthLabel } from './reimbursementReport';

// Checklist of all saved monthly reimbursement records (grouped by month),
// with a quick paid / unpaid toggle.
export default function MonthlyChecklist({ records, onToggle, togglingId }) {
  if (!records.length) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No reimbursement records yet. Generate and save a monthly report first.</p>;
  }

  const months = [...new Set(records.map(r => r.month))].sort().reverse();

  return (
    <div className="space-y-5">
      {months.map(month => (
        <div key={month}>
          <h4 className="text-sm font-semibold mb-2">{monthLabel(month)}</h4>
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">Vehicle</th>
                  <th className="px-3 py-2 font-semibold">Distance (km)</th>
                  <th className="px-3 py-2 font-semibold">Amount (AED)</th>
                  <th className="px-3 py-2 font-semibold">Paid Amount (AED)</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.filter(r => r.month === month).map(r => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{r.vehicle_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{Number(r.total_distance_km || 0).toFixed(1)}</td>
                    <td className="px-3 py-2">{Number(r.reimbursement_amount || 0).toFixed(2)}</td>
                    <td className="px-3 py-2">{r.paid_amount != null ? Number(r.paid_amount).toFixed(2) : '—'}</td>
                    <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="outline" size="sm" className="h-7 px-2.5 text-xs"
                        disabled={togglingId === r.id}
                        onClick={() => onToggle(r)}
                      >
                        {r.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}