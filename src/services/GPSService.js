/**
 * GPSService — Core GPS validation, trust scoring, spoofing detection,
 * permission/fallback management, and synthetic-feed ingestion.
 *
 * All validation functions are pure (no side effects) so they are unit-testable.
 */

import { GeofenceMonitor } from './geofence';
import { GPS_TRACKING_DEFAULTS } from '@/lib/configLoader';

/**
 * GPS_DEFAULTS — legacy camelCase config consumed by the GPSService class
 * constructor and the unit tests. Derived from the single source of truth
 * (GPS_TRACKING_DEFAULTS in configLoader.js) so no hardcoded value is
 * duplicated. Admin overrides flow in at runtime via getGpsTrackingConfig()
 * and are passed to the GPSService constructor / validateGeoPoint opts.
 */
export const GPS_DEFAULTS = {
  maxAccuracyMeters: GPS_TRACKING_DEFAULTS.max_accuracy_meters,
  // Highway ceiling: legitimate driving up to ~160 km/h + 20 km/h buffer
  // for GPS measurement noise. Only the raw speed ceiling is loosened —
  // spoofing detection heuristics are untouched.
  maxRealisticSpeedKmh: GPS_TRACKING_DEFAULTS.max_realistic_speed_kmh,
  nullIslandAllowed: false,
  watchTimeoutMs: 15_000,
  enableHighAccuracy: true,
  exitDebounceMs: 30_000,
};

export const LOCATION_STATES = {
  IDLE: 'idle',
  REQUESTING: 'requesting',
  GRANTED: 'granted',
  DENIED: 'denied',
  TIMEOUT: 'timeout',
  SERVICES_DISABLED: 'services_disabled',
  FALLBACK_WIFI: 'fallback_wifi',
  FALLBACK_IP: 'fallback_ip',
  SIMULATED: 'simulated',
};

// ---------------------------------------------------------------------------
// 1. INPUT VALIDATION (pure)
// ---------------------------------------------------------------------------

/**
 * Validate a lat/lng pair against geographic bounds and the "null island" rule.
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateCoordinates(lat, lng, opts = {}) {
  const { nullIslandAllowed = false } = { ...GPS_DEFAULTS, ...opts };
  const errors = [];
  const warnings = [];

  if (typeof lat !== 'number' || Number.isNaN(lat)) {
    errors.push('Latitude must be a number');
  } else if (lat < -90 || lat > 90) {
    errors.push(`Latitude ${lat} is out of range [-90, 90]`);
  }

  if (typeof lng !== 'number' || Number.isNaN(lng)) {
    errors.push('Longitude must be a number');
  } else if (lng < -180 || lng > 180) {
    errors.push(`Longitude ${lng} is out of range [-180, 180]`);
  }

  if (isNullIsland(lat, lng) && !nullIslandAllowed) {
    errors.push('Coordinates (0, 0) rejected — likely a null GPS fix (null island)');
  } else if (isNullIsland(lat, lng) && nullIslandAllowed) {
    warnings.push('Coordinates (0, 0) accepted with explicit confirmation flag');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/** Classic null-island check. */
export function isNullIsland(lat, lng) {
  return lat === 0 && lng === 0;
}

/**
 * Haversine distance in meters between two points.
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6_371_000; // Earth radius (m)
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Implied speed (km/h) between two timestamped GPS points.
 * Points: { lat, lng, timestamp }
 */
export function calculateSpeed(prev, curr) {
  const distM = calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
  const dtSec = Math.max((curr.timestamp - prev.timestamp) / 1000, 1);
  return (distM / 1000) / (dtSec / 3600); // km/h
}

/**
 * Detect a GPS "jump" — implied speed exceeds realistic max for road vehicles.
 * @returns {{ isJump: boolean, impliedSpeedKmh: number, distanceM: number }}
 */
export function detectGPSJump(prev, curr, maxSpeedKmh = GPS_DEFAULTS.maxRealisticSpeedKmh) {
  if (!prev || !curr || typeof prev.lat !== 'number' || typeof curr.lat !== 'number') {
    return { isJump: false, impliedSpeedKmh: 0, distanceM: 0 };
  }
  const distanceM = calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
  const impliedSpeedKmh = calculateSpeed(prev, curr);
  return { isJump: impliedSpeedKmh > maxSpeedKmh, impliedSpeedKmh, distanceM };
}

// ---------------------------------------------------------------------------
// 2. MOCK / SPOOFING DETECTION
// ---------------------------------------------------------------------------

/**
 * Heuristic spoofing detection across a history of processed points.
 * @param {Array} history — recent processed GPS points
 * @returns {{ isSpoofed: boolean, reasons: string[] }}
 */
export function detectSpoofing(history) {
  const reasons = [];
  if (!history || history.length < 5) return { isSpoofed: false, reasons };

  // a) isMocked flag from the Geolocation API (Android)
  if (history.some((p) => p.isMocked === true)) {
    reasons.push('Geolocation API reported isMocked=true');
  }

  // b) Identical accuracy repeated many times (unnaturally stable)
  const accs = history.map((p) => p.accuracy).filter((a) => a != null);
  if (accs.length >= 5) {
    const allSame = accs.every((a) => a === accs[0]);
    if (allSame && accs[0] !== 0) reasons.push('Identical accuracy value repeated across 5+ readings');
  }

  // c) Perfect straight-line path (3+ collinear points with near-zero deviation)
  if (history.length >= 4) {
    let collinearCount = 0;
    for (let i = 2; i < history.length; i++) {
      const a = history[i - 2], b = history[i - 1], c = history[i];
      const area = Math.abs(
        (b.lat - a.lat) * (c.lng - a.lng) - (c.lat - a.lat) * (b.lng - a.lng)
      );
      if (area < 1e-9) collinearCount++;
    }
    if (collinearCount >= 3) reasons.push('Unnaturally perfect straight-line path detected');
  }

  // d) Speed exactly 0 while lat/lng still changing
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1], curr = history[i];
    const moved = prev.lat !== curr.lat || prev.lng !== curr.lng;
    const speed = calculateSpeed(prev, curr);
    if (moved && speed === 0) {
      reasons.push('Speed reported as 0 while coordinates changed');
      break;
    }
  }

  return { isSpoofed: reasons.length > 0, reasons };
}

/**
 * Compute a 0-100 trust score from accuracy, jump status, and spoof flags.
 * @param {{ accuracy?: number, isJump?: boolean, isMocked?: boolean, spoofed?: boolean, confidence?: string }} input
 * @returns {number}
 */
export function computeTrustScore(input = {}, config = {}) {
  let score = 100;

  // Accuracy penalty — tiers are sorted descending [high, mid, low] with
  // penalties [30, 15, 5]. The first (highest) tier the accuracy exceeds
  // wins, preserving the original cascading if/else behaviour. Tiers are
  // admin-configurable via the gps_tracking_config Setting record.
  if (input.accuracy != null) {
    const tiers = (config.trustPenaltyAccuracyM ?? GPS_TRACKING_DEFAULTS.trust_penalty_accuracy_m)
      .map(Number)
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => b - a);
    const penalties = [30, 15, 5];
    for (let i = 0; i < tiers.length && i < penalties.length; i++) {
      if (input.accuracy > tiers[i]) { score -= penalties[i]; break; }
    }
  }

  // Jump penalty
  if (input.isJump) score -= 25;

  // Mock flag
  if (input.isMocked === true) score -= 40;

  // Spoofing heuristics
  if (input.spoofed) score -= 20;

  // Low-confidence label
  if (input.confidence === 'low') score -= 10;

  return Math.max(0, Math.min(100, score));
}

// ---------------------------------------------------------------------------
// 3. PERMISSION & FALLBACK STATES
// ---------------------------------------------------------------------------

/**
 * Request geolocation permission and return a structured state.
 * Falls back through GPS → Wi-Fi/Cell → IP.
 */
export async function requestPermission() {
  if (!('geolocation' in navigator)) {
    return { state: LOCATION_STATES.SERVICES_DISABLED, error: 'Geolocation API not available' };
  }

  if (navigator.permissions) {
    try {
      const perm = await navigator.permissions.query({ name: 'geolocation' });
      if (perm.state === 'denied') return { state: LOCATION_STATES.DENIED };
    } catch { /* permissions API not supported — fall through */ }
  }

  return { state: LOCATION_STATES.REQUESTING };
}

/**
 * IP-based geolocation fallback using a public API.
 * Marked as "approximate" — excluded from trip-distance calculations.
 */
export async function fallbackToIPGeolocation() {
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    return {
      lat: data.latitude,
      lng: data.longitude,
      accuracy: 50_000, // ~50km — city level
      confidence: 'approximate',
      source: 'ip',
      state: LOCATION_STATES.FALLBACK_IP,
      isApproximate: true,
    };
  } catch {
    return { state: LOCATION_STATES.TIMEOUT, error: 'IP geolocation fallback failed' };
  }
}

// ---------------------------------------------------------------------------
// SERVICE CLASS
// ---------------------------------------------------------------------------

/**
 * GPSService — wraps navigator.geolocation with full validation pipeline.
 * Accepts a `simulatedFeed` in dev to bypass the real Geolocation API.
 */
export class GPSService {
  constructor(config = {}) {
    this.config = { ...GPS_DEFAULTS, ...config };
    this.geofence = new GeofenceMonitor([], { exitDebounceMs: this.config.exitDebounceMs });
    this._watchId = null;
    this._lastPoint = null;
    this._history = [];
    this._simulatedFeed = null;
    this._simInterval = null;
    this._listeners = new Set();
  }

  /** Subscribe to processed location updates. Returns unsubscribe fn. */
  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit(point, meta = {}) {
    this._listeners.forEach((fn) => fn(point, meta));
  }

  /**
   * Process a raw GeolocationPosition (or simulated point) through the
   * full validation pipeline.
   * @returns a validated, enriched point object
   */
  processRawPosition(rawPos) {
    const coords = rawPos.coords || rawPos;
    const lat = coords.latitude ?? coords.lat;
    const lng = coords.longitude ?? coords.lng;
    const accuracy = coords.accuracy ?? null;
    const isMocked = rawPos.isMocked ?? coords.isMocked ?? false;
    const timestamp = rawPos.timestamp ?? Date.now();

    const validation = validateCoordinates(lat, lng, {
      nullIslandAllowed: this.config.nullIslandAllowed,
    });
    if (!validation.valid) {
      this._emit(null, { error: validation.errors.join('; '), validation });
      return null;
    }

    const point = { lat, lng, accuracy, isMocked, timestamp };

    // Jump detection
    const jump = this._lastPoint ? detectGPSJump(this._lastPoint, point, this.config.maxRealisticSpeedKmh) : { isJump: false, impliedSpeedKmh: 0, distanceM: 0 };
    point.isJump = jump.isJump;
    point.impliedSpeedKmh = jump.impliedSpeedKmh;
    point.distanceM = jump.distanceM;

    // Accuracy-based confidence
    point.confidence = accuracy != null && accuracy > this.config.maxAccuracyMeters ? 'low' : 'high';

    // Spoofing detection
    this._history.push(point);
    if (this._history.length > 20) this._history.shift();
    const spoof = detectSpoofing(this._history);
    point.spoofed = spoof.isSpoofed;
    point.spoofReasons = spoof.reasons;

    // Trust score
    point.trustScore = computeTrustScore({
      accuracy,
      isJump: point.isJump,
      isMocked,
      spoofed: spoof.isSpoofed,
      confidence: point.confidence,
    }, { trustPenaltyAccuracyM: this.config.trustPenaltyAccuracyM });

    // Geofence events
    const fenceEvents = this.geofence.process(point);
    point.geofenceEvents = fenceEvents;

    this._lastPoint = point;
    this._emit(point, { geofenceEvents: fenceEvents });
    return point;
  }

  /** Start watching position via the real Geolocation API. */
  startWatch() {
    if (!('geolocation' in navigator)) {
      this._emit(null, { error: 'Geolocation not supported', state: LOCATION_STATES.SERVICES_DISABLED });
      return LOCATION_STATES.SERVICES_DISABLED;
    }

    this._watchId = navigator.geolocation.watchPosition(
      (pos) => this.processRawPosition(pos),
      (err) => {
        const state =
          err.code === err.PERMISSION_DENIED ? LOCATION_STATES.DENIED :
          err.code === err.TIMEOUT ? LOCATION_STATES.TIMEOUT :
          LOCATION_STATES.SERVICES_DISABLED;
        this._emit(null, { error: err.message, state });
      },
      { enableHighAccuracy: this.config.enableHighAccuracy, timeout: this.config.watchTimeoutMs, maximumAge: 5000 }
    );
    return LOCATION_STATES.REQUESTING;
  }

  stopWatch() {
    if (this._watchId != null) navigator.geolocation.clearWatch(this._watchId);
    this._watchId = null;
    this.stopSimulation();
  }

  /**
   * Capture a single validated GPS point. Acquires one raw fix via the
   * Geolocation API and pipes it through the full validation pipeline
   * (coordinate bounds, null-island, jump detection, spoofing, trust score).
   * Returns a promise that resolves to { point, error, permissionState }.
   */
  captureSinglePoint(opts = {}) {
    const { timeoutMs = this.config.watchTimeoutMs, enableHighAccuracy = this.config.enableHighAccuracy } = opts;

    return new Promise(async (resolve) => {
      if (!('geolocation' in navigator)) {
        resolve({ point: null, error: 'Geolocation API not available', permissionState: LOCATION_STATES.SERVICES_DISABLED });
        return;
      }

      const permResult = await requestPermission();
      if (permResult.state === LOCATION_STATES.DENIED) {
        resolve({ point: null, error: 'Location permission denied', permissionState: LOCATION_STATES.DENIED });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const point = this.processRawPosition(pos);
          if (!point) {
            resolve({ point: null, error: 'GPS reading failed coordinate validation', permissionState: LOCATION_STATES.GRANTED });
            return;
          }
          resolve({ point, error: null, permissionState: LOCATION_STATES.GRANTED });
        },
        (err) => {
          const message =
            err.code === err.PERMISSION_DENIED ? 'Location permission denied' :
            err.code === err.TIMEOUT ? 'GPS fix timed out — check sky visibility' :
            err.code === err.POSITION_UNAVAILABLE ? 'Position unavailable — location services may be disabled' :
            err.message;
          const state =
            err.code === err.PERMISSION_DENIED ? LOCATION_STATES.DENIED :
            err.code === err.TIMEOUT ? LOCATION_STATES.TIMEOUT :
            LOCATION_STATES.SERVICES_DISABLED;
          resolve({ point: null, error: message, permissionState: state });
        },
        { enableHighAccuracy, timeout: timeoutMs, maximumAge: 0 }
      );
    });
  }

  /**
   * Feed a synthetic point stream (from LocationSimulator) into the pipeline.
   * @param {Array} points — array of { lat, lng, accuracy?, timestamp?, isMocked? }
   * @param {number} intervalMs — emit interval
   */
  feedSimulatedStream(points, intervalMs = 1000) {
    this.stopSimulation();
    this._simulatedFeed = points;
    let i = 0;
    this._simInterval = setInterval(() => {
      if (i >= points.length) { this.stopSimulation(); return; }
      const p = points[i++];
      this.processRawPosition({
        coords: { latitude: p.lat, longitude: p.lng, accuracy: p.accuracy ?? 10 },
        isMocked: p.isMocked ?? false,
        timestamp: p.timestamp ?? Date.now(),
      });
    }, intervalMs);
  }

  stopSimulation() {
    if (this._simInterval) clearInterval(this._simInterval);
    this._simInterval = null;
    this._simulatedFeed = null;
  }

  setGeofences(fences) {
    this.geofence = new GeofenceMonitor(fences, { exitDebounceMs: this.config.exitDebounceMs });
  }

  reset() {
    this._lastPoint = null;
    this._history = [];
    this.stopSimulation();
    this.geofence.reset();
  }
}

// ---------------------------------------------------------------------------
// PURE VALIDATION ENTRY POINT (for hooks / state machines)
// ---------------------------------------------------------------------------

/**
 * Validate a single raw GPS point against a bounded history window.
 * Pure function — no side effects, no instance state.
 *
 * @param {Array} history — recent raw points (bounded window, e.g. last 50)
 * @param {{ lat: number, lng: number, accuracy?: number, isMocked?: boolean }} raw
 * @param {number} timestamp
 * @param {object} [opts] — override defaults
 * @returns {{ valid: boolean, point: object|null, errors: string[], warnings: string[] }}
 */
export function validateGeoPoint(history, raw, timestamp, opts = {}) {
  // Accepts the normalized runtime config (snake_case keys from
  // getGpsTrackingConfig) and/or legacy camelCase GPS_DEFAULTS overrides.
  const maxRealisticSpeedKmh = opts.max_realistic_speed_kmh ?? opts.maxRealisticSpeedKmh ?? GPS_DEFAULTS.maxRealisticSpeedKmh;
  const maxAccuracyMeters = opts.max_accuracy_meters ?? opts.maxAccuracyMeters ?? GPS_DEFAULTS.maxAccuracyMeters;
  const nullIslandAllowed = opts.null_island_allowed ?? opts.nullIslandAllowed ?? GPS_DEFAULTS.nullIslandAllowed;
  const trustPenaltyAccuracyM = opts.trust_penalty_accuracy_m ?? opts.trustPenaltyAccuracyM ?? GPS_TRACKING_DEFAULTS.trust_penalty_accuracy_m;
  const lat = raw.lat;
  const lng = raw.lng;
  const accuracy = raw.accuracy ?? null;
  const isMocked = raw.isMocked ?? false;

  const validation = validateCoordinates(lat, lng, {
    nullIslandAllowed,
  });
  if (!validation.valid) {
    return { valid: false, point: null, errors: validation.errors, warnings: validation.warnings };
  }

  const point = { lat, lng, accuracy, isMocked, timestamp };

  // Jump detection against the previous point
  const prev = history.length > 0 ? history[history.length - 1] : null;
  const prevValidated = prev
    ? { lat: prev.lat, lng: prev.lng, timestamp: prev.timestamp ?? timestamp - 1000 }
    : null;
  const jump = prevValidated ? detectGPSJump(prevValidated, point, maxRealisticSpeedKmh) : { isJump: false, impliedSpeedKmh: 0, distanceM: 0 };
  point.isJump = jump.isJump;
  point.impliedSpeedKmh = jump.impliedSpeedKmh;
  point.distanceM = jump.distanceM;

  // Accuracy-based confidence
  point.confidence = accuracy != null && accuracy > maxAccuracyMeters ? 'low' : 'high';

  // Spoofing detection across the history window
  const historyWithPoint = [...history, point].slice(-20);
  const spoof = detectSpoofing(historyWithPoint);
  point.spoofed = spoof.isSpoofed;
  point.spoofReasons = spoof.reasons;

  // Trust score
  point.trustScore = computeTrustScore({
    accuracy,
    isJump: point.isJump,
    isMocked,
    spoofed: spoof.isSpoofed,
    confidence: point.confidence,
  }, { trustPenaltyAccuracyM });

  return { valid: true, point, errors: [], warnings: validation.warnings };
}