import React from 'react';
import { MapPin } from 'lucide-react';
import { useLocationPresets } from '@/hooks/useLocationPresets';
import { cn } from '@/lib/utils';

/**
 * Displays a friendly preset name when the trip location matches a saved
 * LocationPreset, falling back to raw coordinates otherwise.
 * Raw coordinates are shown as a hover tooltip for verification.
 *
 * Props:
 * - presetId: string | null — the matched preset's ID stored on the Trip
 * - lat: number | null
 * - lng: number | null
 * - className: optional extra classes
 * - showLink: boolean — wrap in a Google Maps link (default true)
 */
export default function LocationLabel({ presetId, lat, lng, className, showLink = true }) {
  const { presetMap } = useLocationPresets();

  const preset = presetId ? presetMap.get(presetId) : null;
  const hasCoords = lat != null && lng != null;
  const coordsStr = hasCoords ? `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` : '—';
  const label = preset ? preset.name : coordsStr;

  const content = (
    <span
      className={cn('inline-flex items-center gap-1', className)}
      title={hasCoords ? `${label}${preset ? ` (${coordsStr})` : ''}` : undefined}
    >
      <MapPin className="w-3 h-3 shrink-0" />
      <span className={preset ? 'font-medium text-foreground' : 'font-mono text-xs text-muted-foreground'}>
        {label}
      </span>
    </span>
  );

  if (showLink && hasCoords) {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </a>
    );
  }

  return content;
}