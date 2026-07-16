import { calculateDistance } from '@/services/GPSService';

/**
 * Match a captured GPS point against saved location presets.
 * Returns the nearest preset whose center is within its defined radius,
 * or null if no preset matches.
 *
 * Overlapping zones are resolved by nearest center, not first-found.
 *
 * @param {number} lat - Captured latitude
 * @param {number} lng - Captured longitude
 * @param {Array} presets - LocationPreset records (each has latitude, longitude, radius)
 * @returns {{ id: string, name: string, distanceMeters: number } | null}
 */
export function matchLocationPreset(lat, lng, presets) {
  if (lat == null || lng == null || !Array.isArray(presets) || presets.length === 0) {
    return null;
  }

  let best = null;

  for (const preset of presets) {
    if (preset.latitude == null || preset.longitude == null) continue;
    const radius = preset.radius != null ? preset.radius : 100;
    const distMeters = calculateDistance(lat, lng, preset.latitude, preset.longitude);

    if (distMeters <= radius) {
      if (!best || distMeters < best.distanceMeters) {
        best = {
          id: preset.id,
          name: preset.name,
          distanceMeters: Math.round(distMeters),
        };
      }
    }
  }

  return best;
}