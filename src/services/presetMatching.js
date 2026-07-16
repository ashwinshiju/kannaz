import { base44 } from '@/api/base44Client';
import { calculateDistance } from '@/services/GPSService';

/**
 * Find the nearest LocationPreset whose center is within its radius of the
 * given coordinates. Uses Haversine distance (reused from GPSService — no
 * duplicate distance logic). If multiple presets overlap, matches to the
 * nearest center. Returns the preset object or null.
 */
export async function findMatchingPreset(lat, lng) {
  if (lat == null || lng == null) return null;
  let presets = [];
  try {
    presets = await base44.entities.LocationPreset.list();
  } catch {
    return null;
  }
  let bestMatch = null;
  let bestDistance = Infinity;
  for (const preset of presets) {
    if (preset.latitude == null || preset.longitude == null) continue;
    const dist = calculateDistance(lat, lng, preset.latitude, preset.longitude);
    const radius = preset.radius ?? 100;
    if (dist <= radius && dist < bestDistance) {
      bestDistance = dist;
      bestMatch = preset;
    }
  }
  return bestMatch;
}