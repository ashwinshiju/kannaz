import React, { useState, useRef, useEffect } from 'react';
import { GPSService } from '@/services/GPSService';
import { MapPin, Loader2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MobileSelect from '@/components/shared/MobileSelect';
import { useToast } from '@/components/ui/use-toast';
import { PRESET_CATEGORIES } from '@/components/locations/PresetsSection';

export default function PresetFormModal({ open, onClose, editing, form, onChange, onSubmit, loading }) {
  const { toast } = useToast();
  const gpsServiceRef = useRef(null);
  if (!gpsServiceRef.current) gpsServiceRef.current = new GPSService();

  const [gpsCapturing, setGpsCapturing] = useState(false);
  const [gpsWarning, setGpsWarning] = useState(null);
  const [gpsMetadata, setGpsMetadata] = useState(null);

  useEffect(() => {
    if (open) {
      setGpsCapturing(false);
      setGpsWarning(null);
      setGpsMetadata(null);
    }
  }, [open, editing?.id]);

  const handleCaptureGPS = async () => {
    setGpsCapturing(true);
    setGpsWarning(null);
    setGpsMetadata(null);

    const result = await gpsServiceRef.current.captureSinglePoint();

    if (result.error || !result.point) {
      setGpsWarning(result.error || 'Failed to capture GPS coordinates');
      setGpsCapturing(false);
      return;
    }

    const point = result.point;
    onChange('latitude', parseFloat(point.lat.toFixed(6)));
    onChange('longitude', parseFloat(point.lng.toFixed(6)));
    setGpsMetadata({
      trustScore: point.trustScore,
      accuracy: point.accuracy,
    });

    if (point.confidence === 'low' || point.isMocked || point.spoofed || point.isJump) {
      const reasons = [];
      if (point.confidence === 'low') reasons.push(`Low accuracy (${point.accuracy != null ? Math.round(point.accuracy) : '?'}m)`);
      if (point.isMocked) reasons.push('Mocked location flag detected');
      if (point.spoofed) reasons.push(`Spoofing detected: ${(point.spoofReasons || []).join(', ')}`);
      if (point.isJump) reasons.push('GPS jump anomaly detected');
      setGpsWarning(`GPS reading flagged (trust score: ${point.trustScore}/100) — ${reasons.join('; ')}`);
    }

    setGpsCapturing(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    if (form.latitude == null || form.longitude == null) {
      toast({ title: 'Please capture GPS or enter coordinates', variant: 'destructive' });
      return;
    }
    onSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose(false)}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Preset' : 'Add Preset'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="preset_name">Name</Label>
            <Input
              id="preset_name"
              value={form.name || ''}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="e.g. Head Office"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <MobileSelect
              value={form.category || 'office'}
              onValueChange={(v) => onChange('category', v)}
              options={PRESET_CATEGORIES}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Coordinates</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCaptureGPS}
                disabled={gpsCapturing}
                className="gap-1.5"
              >
                {gpsCapturing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
                {gpsCapturing ? 'Capturing...' : 'Capture GPS'}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="preset_lat" className="text-xs">Latitude</Label>
                <Input
                  id="preset_lat"
                  type="number"
                  step="0.000001"
                  value={form.latitude ?? ''}
                  onChange={(e) => onChange('latitude', e.target.value === '' ? null : parseFloat(e.target.value))}
                  placeholder="25.2048"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preset_lng" className="text-xs">Longitude</Label>
                <Input
                  id="preset_lng"
                  type="number"
                  step="0.000001"
                  value={form.longitude ?? ''}
                  onChange={(e) => onChange('longitude', e.target.value === '' ? null : parseFloat(e.target.value))}
                  placeholder="55.2708"
                />
              </div>
            </div>
            {gpsWarning && (
              <div className="flex items-start gap-2 text-xs text-warning bg-warning/10 border border-warning/30 rounded-md p-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{gpsWarning}</span>
              </div>
            )}
            {gpsMetadata && !gpsWarning && (
              <p className="text-xs text-muted-foreground">
                Trust score: {gpsMetadata.trustScore}/100 · Accuracy: {gpsMetadata.accuracy != null ? `${Math.round(gpsMetadata.accuracy)}m` : '—'}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="preset_radius">Radius (meters)</Label>
            <Input
              id="preset_radius"
              type="number"
              step="1"
              value={form.radius ?? 100}
              onChange={(e) => onChange('radius', e.target.value === '' ? null : parseFloat(e.target.value))}
              placeholder="100"
            />
            <p className="text-xs text-muted-foreground">Trips starting/ending within this radius will be auto-labeled with this preset.</p>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onClose(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : editing ? 'Save Changes' : 'Add Preset'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}