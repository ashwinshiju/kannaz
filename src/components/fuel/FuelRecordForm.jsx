import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MobileSelect from '@/components/shared/MobileSelect';

const FUEL_TYPES = [
  { value: 'super_98', label: 'Super 98' },
  { value: 'special_95', label: 'Special 95' },
  { value: 'eplus_91', label: 'EPlus 91' },
  { value: 'diesel', label: 'Diesel' },
];

export default function FuelRecordForm({ open, onClose, onSubmit, loading, editing, fuelPrices }) {
  const { user } = useAuth();
  const [form, setForm] = useState({});
  const [employee, setEmployee] = useState(null);

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  useEffect(() => {
    if (user?.email) {
      base44.entities.Employee.filter({ email: user.email }).then(emps => {
        if (emps.length > 0) setEmployee(emps[0]);
      }).catch(() => {});
    }
  }, [user?.email]);

  useEffect(() => {
    if (open) {
      const today = new Date().toISOString().split('T')[0];
      setForm(editing ? { ...editing } : {
        fuel_date: today,
        employee_name: employee?.full_name || user?.full_name || '',
        employee_id: employee?.id || user?.id || '',
      });
    }
  }, [open, editing, employee, user]);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleVehicleChange = (vehicleId) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      const updates = {
        vehicle_id: vehicle.id,
        vehicle_name: vehicle.name,
        odometer: vehicle.current_odometer,
      };
      if (vehicle.fuel_type === 'diesel') {
        updates.fuel_type = 'diesel';
      }
      setForm(prev => ({ ...prev, ...updates }));
    }
  };

  const currentRate = fuelPrices?.[form.fuel_type] || 0;
  const litres = parseFloat(form.litres) || 0;
  const calculatedCost = currentRate && litres ? (currentRate * litres).toFixed(2) : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      litres,
      cost: parseFloat(calculatedCost),
      fuel_rate: currentRate,
    };
    onSubmit(payload);
  };

  const vehicleOptions = vehicles.map(v => ({ value: v.id, label: `${v.name} (${v.reg_no})` }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Fuel Record' : 'Add Fuel Record'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Vehicle <span className="text-destructive">*</span></Label>
            <MobileSelect
              value={form.vehicle_id || ''}
              onValueChange={handleVehicleChange}
              options={vehicleOptions}
              placeholder="Select vehicle"
            />
            {form.vehicle_name && (
              <p className="text-xs text-muted-foreground">
                Auto-filled: {form.vehicle_name}{form.odometer ? ` · Odometer: ${Number(form.odometer).toLocaleString()} km` : ''}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fuel_date">Date <span className="text-destructive">*</span></Label>
            <Input id="fuel_date" type="date" value={form.fuel_date || ''} onChange={e => handleChange('fuel_date', e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label>Fuel Type <span className="text-destructive">*</span></Label>
            <MobileSelect
              value={form.fuel_type || ''}
              onValueChange={v => handleChange('fuel_type', v)}
              options={FUEL_TYPES}
              placeholder="Select fuel type"
            />
            {form.fuel_type && currentRate > 0 && (
              <p className="text-xs text-muted-foreground">Current rate: AED {currentRate.toFixed(2)}/L</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="litres">Litres <span className="text-destructive">*</span></Label>
            <Input
              id="litres"
              type="number"
              step="0.01"
              min="0"
              value={form.litres || ''}
              onChange={e => handleChange('litres', e.target.value)}
              placeholder="Enter litres fueled"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Cost (auto-calculated)</Label>
            <div className="h-9 flex items-center px-3 rounded-md border border-input bg-muted/50 text-sm font-medium">
              AED {calculatedCost || '0.00'}
            </div>
            {currentRate > 0 && litres > 0 && (
              <p className="text-xs text-muted-foreground">{currentRate.toFixed(2)} × {litres} L</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="station">Station</Label>
            <Input id="station" value={form.station || ''} onChange={e => handleChange('station', e.target.value)} placeholder="Fuel station name" />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onClose(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.vehicle_id || !form.fuel_type || !form.litres}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}