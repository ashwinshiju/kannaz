import React, { useState, useEffect } from 'react';
import { Loader2, Save, Satellite } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { getGpsTrackingConfig, saveGpsTrackingConfig, GPS_TRACKING_DEFAULTS } from '@/lib/configLoader';

const FIELDS = [
  {
    key: 'tracking_interval_ms',
    label: 'Tracking Interval (ms)',
    desc: 'Expected cadence between persisted GPS points.',
    min: 1000,
    max: 120000,
    step: 1000,
  },
  {
    key: 'gap_threshold_multiplier',
    label: 'Gap Threshold Multiplier',
    desc: 'A gap is flagged when time between points exceeds this × the interval.',
    min: 2,
    max: 60,
    step: 1,
  },
  {
    key: 'stationary_threshold_m',
    label: 'Stationary Threshold (m)',
    desc: 'Segments shorter than this are treated as stationary (GPS shimmer skipped).',
    min: 0,
    max: 50,
    step: 1,
  },
  {
    key: 'gap_incomplete_threshold_ms',
    label: 'Incomplete-Gap Threshold (ms)',
    desc: 'Gaps longer than this with no speed data are flagged incomplete.',
    min: 30000,
    max: 1800000,
    step: 10000,
  },
  {
    key: 'max_realistic_speed_kmh',
    label: 'Jump-Detection Ceiling (km/h)',
    desc: 'Implied speed above this is rejected as a GPS jump anomaly.',
    min: 40,
    max: 400,
    step: 5,
  },
  {
    key: 'mismatch_threshold_pct',
    label: 'Distance Mismatch Tolerance (%)',
    desc: 'Tracked vs odometer difference above this flags a mismatch.',
    min: 1,
    max: 100,
    step: 1,
  },
  {
    key: 'max_accuracy_meters',
    label: 'Low-Confidence Accuracy (m)',
    desc: 'Readings worse than this accuracy are marked low confidence.',
    min: 10,
    max: 500,
    step: 5,
  },
  {
    key: 'ema_alpha',
    label: 'Coordinate Smoothing (EMA α)',
    desc: 'Display-only smoothing factor (0–1). Higher = less smoothing.',
    min: 0,
    max: 1,
    step: 0.05,
  },
];

export default function GpsTrackingConfigSection() {
  const { toast } = useToast();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getGpsTrackingConfig()
      .then((c) => active && setConfig(c))
      .catch(() => active && setConfig({ ...GPS_TRACKING_DEFAULTS }))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const setField = (key, value) => {
    const num = parseFloat(value);
    if (Number.isNaN(num)) return;
    setConfig((prev) => ({ ...prev, [key]: num }));
  };

  const setTier = (index, value) => {
    const num = parseFloat(value);
    if (Number.isNaN(num)) return;
    setConfig((prev) => {
      const tiers = [...(prev.trust_penalty_accuracy_m || [])];
      tiers[index] = num;
      return { ...prev, trust_penalty_accuracy_m: tiers.sort((a, b) => a - b) };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveGpsTrackingConfig(config);
      toast({ title: 'GPS tracking config saved', description: 'Changes apply on next app refresh.' });
    } catch {
      toast({ title: 'Failed to save config', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading GPS tracking config…
      </div>
    );
  }

  const tiers = config.trust_penalty_accuracy_m || GPS_TRACKING_DEFAULTS.trust_penalty_accuracy_m;

  return (
    <div className="bg-card rounded-xl border border-border p-6 max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <Satellite className="w-4 h-4 text-primary" />
        <h3 className="text-lg font-semibold">GPS Tracking Configuration</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Admin-tunable thresholds for the GPS validation and gap-analysis pipeline. Values are read
        at runtime from the database, so changes take effect on the next app refresh — no redeploy required.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label>{f.label}</Label>
            <Input
              type="number"
              min={f.min}
              max={f.max}
              step={f.step}
              value={config[f.key]}
              onChange={(e) => setField(f.key, e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-2 border-t border-border">
        <Label>Trust-Score Accuracy Tiers (meters)</Label>
        <p className="text-xs text-muted-foreground">
          Readings above each tier lose trust points (low → −5, mid → −15, high → −30).
        </p>
        <div className="grid grid-cols-3 gap-3">
          {tiers.map((tier, i) => (
            <div key={i} className="space-y-1">
              <span className="text-xs text-muted-foreground">Tier {i + 1}</span>
              <Input
                type="number"
                min={1}
                max={1000}
                step={5}
                value={tier}
                onChange={(e) => setTier(i, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save GPS Config
      </Button>
    </div>
  );
}