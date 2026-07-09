/**
 * BackgroundLocationService — bridges trip lifecycle to the device's
 * geolocation stream. On web this uses navigator.geolocation.watchPosition;
 * on native (Capacitor / Expo) this would delegate to a background task
 * plugin. The interface (startTripTracking / stopTripTracking) stays the
 * same so the hook doesn't care about the platform.
 *
 * Every raw point is handed to the caller via `onPoint`; errors surface
 * through `onError`. The service does NOT validate — that's GPSService's
 * job — it only acquires and forwards raw fixes.
 */

import { LOCATION_STATES } from './GPSService';

let _watchId = null;
let _activeTripId = null;

/**
 * Start watching position for a trip.
 * @param {string} tripId
 * @param {{ onPoint: Function, onError: Function, enableHighAccuracy?: boolean, timeoutMs?: number }} handlers
 */
export async function startTripTracking(tripId, handlers = {}) {
  const { onPoint, onError, enableHighAccuracy = true, timeoutMs = 15_000 } = handlers;

  if (_watchId != null) {
    // Already tracking — stop the previous watch before starting a new one.
    stopTripTracking();
  }

  _activeTripId = tripId;

  if (!('geolocation' in navigator)) {
    onError?.('Geolocation API not available on this device');
    return LOCATION_STATES.SERVICES_DISABLED;
  }

  _watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const coords = pos.coords;
      onPoint?.({
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        speed: coords.speed ?? null,
        isMocked: pos.isMocked ?? false,
        timestamp: pos.timestamp ?? Date.now(),
      });
    },
    (err) => {
      const message =
        err.code === err.PERMISSION_DENIED ? 'Location permission denied' :
        err.code === err.TIMEOUT ? 'GPS fix timed out — check sky visibility' :
        err.code === err.POSITION_UNAVAILABLE ? 'Position unavailable — location services may be disabled' :
        err.message;
      onError?.(message);
    },
    { enableHighAccuracy, timeout: timeoutMs, maximumAge: 5000 }
  );

  return LOCATION_STATES.REQUESTING;
}

/**
 * Stop the active trip watch. Safe to call even if no watch is active.
 */
export async function stopTripTracking() {
  if (_watchId != null && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(_watchId);
  }
  _watchId = null;
  _activeTripId = null;
}

/** Returns the tripId currently being tracked, or null. */
export function getActiveTripId() {
  return _activeTripId;
}