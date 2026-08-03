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
import { Upload, X, FileText } from 'lucide-react';

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
  const [uploading, setUploading] = useState(false);

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

  const handleLitresChange = (value) => {
    const l = parseFloat(value) || 0;
    const cost = currentRate && l ? (currentRate * l).toFixed(2) : '';
    setForm(prev => ({ ...prev, litres: value, cost }));
  };

  const handleCostChange = (value) => {
    const c = parseFloat(value) || 0;
    const calcLitres = currentRate && c ? (c / currentRate).toFixed(2) : '';
    setForm(prev => ({ ...prev, cost: value, litres: calcLitres }));
  };

  const litres = parseFloat(form.litres) || 0;
  const costVal = parseFloat(form.cost) || 0;

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      handleChange('receipt_url', result.file_url);
    } catch {
      // ignore upload errors silently
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      litres,
      cost: costVal,
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
            <Label htmlFor="litres">Litres</Label>
            <Input
              id="litres"
              type="number"
              step="0.01"
              min="0"
              value={form.litres || ''}
              onChange={e => handleLitresChange(e.target.value)}
              placeholder={currentRate > 0 ? 'Enter litres or cost' : 'Enter litres'}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cost">Cost (AED)</Label>
            <Input
              id="cost"
              type="number"
              step="0.01"
              min="0"
              value={form.cost || ''}
              onChange={e => handleCostChange(e.target.value)}
              placeholder={currentRate > 0 ? 'Enter cost or litres' : 'Enter cost'}
            />
            {currentRate > 0 && (litres > 0 || costVal > 0) && (
              <p className="text-xs text-muted-foreground">{currentRate.toFixed(2)} AED/L {litres > 0 ? `× ${litres} L` : `÷ ${costVal} AED`}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="station">Station</Label>
            <Input id="station" value={form.station || ''} onChange={e => handleChange('station', e.target.value)} placeholder="Fuel station name" />
          </div>

          <div className="space-y-1.5">
            <Label>Receipt / Bill</Label>
            {form.receipt_url ? (
              <div className="flex items-center gap-2 rounded-md border border-input p-2">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <a href={form.receipt_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline truncate flex-1">
                  View uploaded receipt
                </a>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleChange('receipt_url', '')}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center gap-2 rounded-md border border-dashed border-input p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">
                  {uploading ? 'Uploading...' : 'Click to upload receipt'}
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onClose(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.vehicle_id || !form.fuel_type || (!form.litres && !form.cost)}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}