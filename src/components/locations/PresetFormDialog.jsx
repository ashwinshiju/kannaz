import React, { useRef, useState } from 'react';
import useModalHistory from '@/hooks/useModalHistory';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import MobileSelect from '@/components/shared/MobileSelect';
import { Crosshair, Loader2, AlertTriangle } from 'lucide-react';
import { GPSService } from '@/services/GPSService';
import { useToast } from '@/components/ui/use-toast';

const CATEGORY_OPTIONS = [
  { value: 'office', label: 'Office' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'site', label: 'Site' },
  { value: 'customer', label: 'Customer' },
  { value: 'public', label: 'Public' },
  { value: 'other', label: 'Other' },
];

export default function PresetFormDialog({ open, onClose, title, values, onChange, onSubmit, loading }) {
  useModalHistory(open, () => onClose(false), 'preset-form');
  const { toast } = useToast();

  const gpsServiceRef = useRef(null);
  if (!gpsServiceRef.current) {
    gpsServiceRef.current = new GPSService();
  }

  const [gpsCapturing, setGpsCapturing] = useState(false);
  const [gpsWarning, setGpsWarning] = useState(null);
  const [gpsMetadata, setGpsMetadata] = useState(null);

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
    onChange('latitude', point.lat.toFixed(6));
    onChange('longitude', point.lng.toFixed(6));

    setGpsMetadata({
      trustScore: point.trustScore,
      accuracy: point.accuracy,
      confidence: point.confidence,
      isMocked: point.isMocked,
    });

    if (point.confidence === 'low' || point.isMocked) {
      const reasons = [];
      if (point.confidence === 'low') reasons.push(`Low accuracy (${point.accuracy != null ? Math.round(point.accuracy) : '?'}m)`);
      if (point.isMocked) reasons.push('Mocked location flag detected');
      setGpsWarning(`GPS reading flagged (trust score: ${point.trustScore}/100) — ${reasons.join('; ')}`);
    } else {
      toast({ title: 'GPS captured', description: `Trust score: ${point.trustScore}/100` });
    }

    setGpsCapturing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Preset Name <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              value={values.name || ''}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="e.g. Head Office, Warehouse - Al Quoz"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category">Category <span className="text-destructive">*</span></Label>
            <MobileSelect
              id="category"
              value={values.category || 'office'}
              onValueChange={(v) => onChange('category', v)}
              options={CATEGORY_OPTIONS}
              placeholder="Select category"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Latitude &amp; Longitude <span className="text-destructive">*</span></Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCaptureGPS}
                disabled={gpsCapturing}
                className="h-7 gap-1.5 text-xs"
              >
                {gpsCapturing ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Capturing...</>
                ) : (
                  <><Crosshair className="w-3.5 h-3.5" /> Capture GPS</>
                )}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                id="latitude"
                type="number"
                step="any"
                value={values.latitude != null ? values.latitude : ''}
                onChange={(e) => onChange('latitude', e.target.value)}
                placeholder="24.4854"
                required
              />
              <Input
                id="longitude"
                type="number"
                step="any"
                value={values.longitude != null ? values.longitude : ''}
                onChange={(e) => onChange('longitude', e.target.value)}
                placeholder="54.3650"
                required
              />
            </div>
            {gpsWarning && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {gpsWarning}
              </p>
            )}
            {gpsMetadata && !gpsWarning && (
              <p className="text-xs text-muted-foreground">
                Trust: {gpsMetadata.trustScore}/100 · Accuracy: {gpsMetadata.accuracy != null ? `${Math.round(gpsMetadata.accuracy)}m` : '—'}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="radius">Radius (meters)</Label>
            <Input
              id="radius"
              type="number"
              value={values.radius != null ? values.radius : ''}
              onChange={(e) => onChange('radius', e.target.value)}
              placeholder="100"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={values.description || ''}
              onChange={(e) => onChange('description', e.target.value)}
              placeholder="Optional notes about this location"
              rows={3}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onClose(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}