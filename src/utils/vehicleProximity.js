import { calculateDistance } from '@/services/GPSService';

/**
 * Find the Skyline office LocationPreset from a list.
 * Matches by category "office" and name containing "skyline".
 */
export function findSkylinePreset(presets = []) {
  return (
    presets.find(
      (p) => p.category === 'office' && p.name?.toLowerCase().includes('skyline')
    ) || null
  );
}

/**
 * Build a map of vehicleKey → last known end-location from trips,
 * using the most recent trip (by completed_at / started_at / created_date)
 * that has end coordinates.
 */
export function buildLastLocationsByVehicle(trips = []) {
  const map = {};
  const sorted = [...trips].sort((a, b) => {
    const ta = new Date(a.completed_at || a.started_at || a.created_date).getTime();
    const tb = new Date(b.completed_at || b.started_at || b.created_date).getTime();
    return tb - ta;
  });
  for (const trip of sorted) {
    const key = trip.vehicle_id || trip.vehicle_name;
    if (!key || map[key]) continue;
    if (trip.end_lat != null && trip.end_lng != null) {
      map[key] = { lat: trip.end_lat, lng: trip.end_lng };
    }
  }
  return map;
}

/**
 * Compute the effective display status for a vehicle based on proximity
 * to the Skyline office.
 *
 * Rule: if stored status is "available" and the vehicle's last known
 * location is outside the Skyline preset radius, override to "inactive".
 * Vehicles with no location data or non-"available" stored status are
 * returned unchanged.
 */
export function computeEffectiveStatus(vehicle, trips = [], presets = []) {
  if (vehicle.status !== 'available') return vehicle.status;
  const skyline = findSkylinePreset(presets);
  if (!skyline) return vehicle.status;

  const lastLocs = buildLastLocationsByVehicle(trips);
  const key = vehicle.id || vehicle.name;
  const loc = lastLocs[key];
  if (!loc) return vehicle.status;

  const dist = calculateDistance(loc.lat, loc.lng, skyline.latitude, skyline.longitude);
  return dist <= (skyline.radius ?? 100) ? 'available' : 'inactive';
}