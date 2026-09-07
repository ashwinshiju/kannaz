import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import MobileSelect from '@/components/shared/MobileSelect';
import { Download, FileText } from 'lucide-react';
import moment from 'moment';
import { downloadDisbursementCSV, downloadDisbursementPDF } from '@/utils/cashDisbursementReport';

const TZ = 240; // Asia/Dubai (UTC+4)
const DEFAULT_MILEAGE = 14;
const PRESELECT_NAMES = ['joemon', 'binil'];
const FUEL_TYPES = [
  { value: 'super_98', label: 'Super 98' },
  { value: 'special_95', label: 'Special 95' },
  { value: 'eplus_91', label: 'EPlus 91' },
  { value: 'diesel', label: 'Diesel' },
];

export default function CashDisbursementDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [fuelType, setFuelType] = useState('super_98');
  const [mileage, setMileage] = useState(DEFAULT_MILEAGE);
  const [selectedIds, setSelectedIds] = useState(null);
  const [rateOverrides, setRateOverrides] = useState({});
  const [savingKey, setSavingKey] = useState(null);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list().catch(() => []),
  });
  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ['trips'],
    queryFn: () => base44.entities.Trip.list().catch(() => []),
    enabled: open,
  });
  const { data: fuelPrices } = useQuery({
    queryKey: ['fuel-prices'],
    queryFn: async () => {
      const settings = await base44.entities.Setting.filter({ key: 'fuel_prices' });
      return settings[0] ? JSON.parse(settings[0].value) : null;
    },
  });
  const { data: disbursements = [] } = useQuery({
    queryKey: ['disbursements'],
    queryFn: () => base44.entities.Disbursement.list().catch(() => []),
    enabled: open,
  });

  // Preselect Joemon + Binil the first time employees load
  useEffect(() => {
    if (selectedIds === null && employees.length > 0) {
      setSelectedIds(
        employees
          .filter((e) => PRESELECT_NAMES.some((n) => e.full_name?.toLowerCase().includes(n)))
          .map((e) => e.id)
      );
    }
  }, [employees, selectedIds]);

  const selectedEmployees = useMemo(
    () => employees.filter((e) => selectedIds?.includes(e.id)),
    [employees, selectedIds]
  );

  const monthOf = (trip) => {
    const ts = trip.started_at || trip.created_date;
    return ts ? moment.utc(ts).utcOffset(TZ).format('YYYY-MM') : null;
  };

  const matchesEmployee = (trip, emp) =>
    trip.employee_ref_id === emp.id || trip.employee_name === emp.full_name;

  const disbMap = useMemo(() => {
    const m = new Map();
    disbursements.forEach((d) => m.set(`${d.month}|${d.employee_name}`, d));
    return m;
  }, [disbursements]);

  const rows = useMemo(() => {
    if (selectedEmployees.length === 0) return [];
    const months = new Set();
    trips.forEach((t) => {
      if (t.status === 'cancelled') return;
      if (selectedEmployees.some((e) => matchesEmployee(t, e))) {
        const m = monthOf(t);
        if (m) months.add(m);
      }
    });
    disbursements.forEach((d) => {
      if (selectedEmployees.some((e) => e.full_name === d.employee_name)) months.add(d.month);
    });

    const defaultRate = fuelPrices?.[fuelType] || 0;
    const out = [];
    [...months].sort().reverse().forEach((month) => {
      const monthTrips = trips.filter(
        (t) => t.status !== 'cancelled' && monthOf(t) === month &&
          selectedEmployees.some((e) => matchesEmployee(t, e))
      );
      selectedEmployees.forEach((emp) => {
        const empTrips = monthTrips.filter((t) => matchesEmployee(t, emp));
        const distance = empTrips.reduce((s, t) => s + (Number(t.distance_km) || 0), 0);
        const key = `${month}|${emp.id}`;
        const saved = disbMap.get(`${month}|${emp.full_name}`);
        const rate = rateOverrides[key] ?? saved?.fuel_rate ?? defaultRate;
        const amount = mileage > 0 ? (distance / mileage) * rate : 0;
        out.push({
          key,
          month,
          monthLabel: moment(`${month}-01`).format('MMMM YYYY'),
          employee: emp,
          tripCount: empTrips.length,
          distance,
          rate,
          amount,
          saved,
        });
      });
    });
    return out;
  }, [trips, disbursements, selectedEmployees, fuelPrices, fuelType, mileage, rateOverrides]);

  const unpaidRows = rows.filter((r) => !r.saved?.paid);
  const unpaidTotal = unpaidRows.reduce((s, r) => s + r.amount, 0);

  const toggleEmployee = (id) => {
    setSelectedIds((prev) => {
      const current = prev || [];
      return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    });
  };

  const handleRateChange = (row, value) => {
    const rate = parseFloat(value) || 0;
    setRateOverrides((prev) => ({ ...prev, [row.key]: rate }));
  };

  const togglePaid = async (row) => {
    setSavingKey(row.key);
    try {
      const nowPaid = !row.saved?.paid;
      const payload = {
        employee_name: row.employee.full_name,
        month: row.month,
        total_distance_km: Number(row.distance.toFixed(1)),
        fuel_rate: Number(row.rate.toFixed(3)),
        mileage_km_per_litre: mileage,
        amount: Number(row.amount.toFixed(2)),
        paid: nowPaid,
        paid_at: nowPaid ? new Date().toISOString() : null,
      };
      if (row.saved) {
        await base44.entities.Disbursement.update(row.saved.id, payload);
      } else {
        await base44.entities.Disbursement.create(payload);
      }
      await queryClient.invalidateQueries({ queryKey: ['disbursements'] });
    } finally {
      setSavingKey(null);
    }
  };

  const exportRows = () =>
    rows.map((r) => ({
      monthLabel: r.monthLabel,
      employeeName: r.employee.full_name,
      tripCount: r.tripCount,
      distance: r.distance,
      rate: r.rate,
      mileage,
      amount: r.amount,
      paidLabel: r.saved?.paid ? 'Paid' : 'Unpaid',
      paidAtLabel: r.saved?.paid_at
        ? moment.utc(r.saved.paid_at).utcOffset(TZ).format('MMM DD, YYYY')
        : '',
    }));

  const downloadCSV = () => {
    downloadDisbursementCSV(exportRows(), {
      fuelTypeLabel: FUEL_TYPES.find((f) => f.value === fuelType)?.label || fuelType,
      mileage,
      generatedAt: moment().format('MMM DD, YYYY HH:mm'),
    });
  };

  const downloadPDF = () => {
    downloadDisbursementPDF(exportRows(), {
      fuelTypeLabel: FUEL_TYPES.find((f) => f.value === fuelType)?.label || fuelType,
      mileage,
      generatedAt: moment().format('MMM DD, YYYY HH:mm'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cash Disbursement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Employees</Label>
            <div className="flex flex-wrap gap-1.5">
              {employees.filter((e) => e.status !== 'disabled').map((e) => {
                const active = selectedIds?.includes(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggleEmployee(e.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-transparent text-muted-foreground border-input hover:bg-accent'
                    }`}
                  >
                    {e.full_name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fuel rate (type)</Label>
              <MobileSelect
                value={fuelType}
                onValueChange={setFuelType}
                options={FUEL_TYPES}
              />
              {fuelPrices && (
                <p className="text-xs text-muted-foreground">
                  {fuelPrices.month}: AED {Number(fuelPrices[fuelType] || 0).toFixed(2)}/L
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mileage">Mileage (km/L)</Label>
              <Input
                id="mileage"
                type="number"
                step="0.1"
                min="0.1"
                value={mileage}
                onChange={(e) => setMileage(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Amount = Distance ÷ mileage × fuel rate. Adjust the rate per month if needed.
          </p>

          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              Unpaid total: <span className="text-destructive">AED {unpaidTotal.toFixed(2)}</span>
            </span>
            <span className="text-muted-foreground text-xs">
              {unpaidRows.length} of {rows.length} unpaid
            </span>
          </div>

          {tripsLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading trips...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Select employees to see their monthly disbursement checklist.
            </p>
          ) : (
            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <th className="p-2.5 w-10">Paid</th>
                    <th className="p-2.5">Month</th>
                    <th className="p-2.5">Employee</th>
                    <th className="p-2.5 text-right">Trips</th>
                    <th className="p-2.5 text-right">Distance</th>
                    <th className="p-2.5 text-right">Rate (AED/L)</th>
                    <th className="p-2.5 text-right">Amount (AED)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.key} className="hover:bg-accent/30">
                      <td className="p-2.5">
                        <Checkbox
                          checked={!!r.saved?.paid}
                          onCheckedChange={() => togglePaid(r)}
                          disabled={savingKey === r.key}
                          aria-label={`Mark ${r.employee.full_name} ${r.monthLabel} as paid`}
                        />
                        {r.saved?.paid && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {moment.utc(r.saved.paid_at).utcOffset(TZ).format('MMM DD')}
                          </p>
                        )}
                      </td>
                      <td className="p-2.5 whitespace-nowrap">{r.monthLabel}</td>
                      <td className="p-2.5 font-medium whitespace-nowrap">{r.employee.full_name}</td>
                      <td className="p-2.5 text-right text-muted-foreground">{r.tripCount}</td>
                      <td className="p-2.5 text-right whitespace-nowrap">{r.distance.toFixed(1)} km</td>
                      <td className="p-2.5 text-right">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={r.rate}
                          onChange={(e) => handleRateChange(r, e.target.value)}
                          className="h-7 w-20 text-right ml-auto"
                        />
                      </td>
                      <td className="p-2.5 text-right font-semibold whitespace-nowrap">
                        {r.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={downloadCSV} disabled={rows.length === 0} className="gap-2">
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button variant="outline" onClick={downloadPDF} disabled={rows.length === 0} className="gap-2">
            <FileText className="w-4 h-4" /> PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}