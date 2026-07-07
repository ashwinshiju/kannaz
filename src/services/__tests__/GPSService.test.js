/* eslint-env jest */
/**
 * Jest test suite for GPSService validation, trust scoring,
 * spoofing detection, and geofence hysteresis.
 *
 * Requires Jest + babel-jest (or @swc/jest) to be configured.
 * Run: npx jest src/services/__tests__/GPSService.test.js
 */

import {
  validateCoordinates,
  isNullIsland,
  calculateDistance,
  calculateSpeed,
  detectGPSJump,
  computeTrustScore,
  detectSpoofing,
  GPS_DEFAULTS,
  LOCATION_STATES,
  GPSService,
} from '../GPSService';
import { GeofenceMonitor } from '../geofence';
import { generateSimStream } from '@/components/dev/LocationSimulator';

// ---------------------------------------------------------------------------
// 1. INPUT VALIDATION
// ---------------------------------------------------------------------------

describe('validateCoordinates', () => {
  test('accepts valid lat/lng within bounds', () => {
    const r = validateCoordinates(40.7128, -74.006);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  test('rejects latitude out of range', () => {
    expect(validateCoordinates(95, 0).valid).toBe(false);
    expect(validateCoordinates(-91, 0).valid).toBe(false);
  });

  test('rejects longitude out of range', () => {
    expect(validateCoordinates(0, 181).valid).toBe(false);
    expect(validateCoordinates(0, -181).valid).toBe(false);
  });

  test('rejects (0,0) null-island by default', () => {
    const r = validateCoordinates(0, 0);
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/null island/i);
  });

  test('accepts (0,0) only with explicit confirmation flag', () => {
    const r = validateCoordinates(0, 0, { nullIslandAllowed: true });
    expect(r.valid).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  test('rejects non-numeric values', () => {
    expect(validateCoordinates('abc', 10).valid).toBe(false);
    expect(validateCoordinates(NaN, 10).valid).toBe(false);
  });
});

describe('isNullIsland', () => {
  test('returns true for exact (0,0)', () => {
    expect(isNullIsland(0, 0)).toBe(true);
  });
  test('returns false for any non-zero coordinate', () => {
    expect(isNullIsland(0.0001, 0)).toBe(false);
    expect(isNullIsland(0, 0.0001)).toBe(false);
    expect(isNullIsland(40, -74)).toBe(false);
  });
});

describe('calculateDistance', () => {
  test('returns ~0 for identical points', () => {
    expect(calculateDistance(40.7, -74.0, 40.7, -74.0)).toBeCloseTo(0, 1);
  });

  test('returns approximately correct distance for known route', () => {
    // NYC to Boston ~306km
    const d = calculateDistance(40.7128, -74.006, 42.3601, -71.0589);
    expect(d).toBeGreaterThan(290_000);
    expect(d).toBeLessThan(320_000);
  });
});

describe('calculateSpeed', () => {
  test('computes km/h between two timestamped points', () => {
    const prev = { lat: 40.7128, lng: -74.006, timestamp: 1000 };
    const curr = { lat: 40.7228, lng: -73.996, timestamp: 2000 };
    const speed = calculateSpeed(prev, curr);
    expect(speed).toBeGreaterThan(0);
    expect(speed).toBeLessThan(200);
  });
});

describe('detectGPSJump', () => {
  test('flags a teleport as a jump', () => {
    // Two points 1 second apart but ~55km apart → ~198,000 km/h
    const prev = { lat: 40.7128, lng: -74.006, timestamp: 1000 };
    const curr = { lat: 41.2, lng: -73.5, timestamp: 2000 };
    const r = detectGPSJump(prev, curr, GPS_DEFAULTS.maxRealisticSpeedKmh);
    expect(r.isJump).toBe(true);
    expect(r.impliedSpeedKmh).toBeGreaterThan(200);
  });

  test('does not flag normal-speed movement', () => {
    const prev = { lat: 40.7128, lng: -74.006, timestamp: 1000 };
    const curr = { lat: 40.7130, lng: -74.0062, timestamp: 2000 };
    const r = detectGPSJump(prev, curr);
    expect(r.isJump).toBe(false);
  });

  test('returns no jump when prev is null', () => {
    expect(detectGPSJump(null, { lat: 1, lng: 1, timestamp: 1 }).isJump).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. MOCK / SPOOFING DETECTION
// ---------------------------------------------------------------------------

describe('computeTrustScore', () => {
  test('returns 100 for ideal reading', () => {
    expect(computeTrustScore({ accuracy: 5 })).toBe(100);
  });

  test('penalizes low accuracy (>100m)', () => {
    const score = computeTrustScore({ accuracy: 150 });
    expect(score).toBeLessThan(75);
  });

  test('penalizes GPS jumps', () => {
    const score = computeTrustScore({ accuracy: 5, isJump: true });
    expect(score).toBeLessThanOrEqual(75);
  });

  test('penalizes isMocked flag', () => {
    const score = computeTrustScore({ accuracy: 5, isMocked: true });
    expect(score).toBeLessThanOrEqual(60);
  });

  test('never goes below 0', () => {
    const score = computeTrustScore({ accuracy: 500, isJump: true, isMocked: true, spoofed: true, confidence: 'low' });
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe('detectSpoofing', () => {
  test('flags isMocked=true in history', () => {
    const history = Array.from({ length: 5 }, (_, i) => ({
      lat: 40 + i * 0.001, lng: -74 + i * 0.001, timestamp: i * 1000, accuracy: 10, isMocked: true,
    }));
    const r = detectSpoofing(history);
    expect(r.isSpoofed).toBe(true);
    expect(r.reasons.some((x) => x.includes('isMocked'))).toBe(true);
  });

  test('flags identical accuracy repeated', () => {
    const history = Array.from({ length: 6 }, (_, i) => ({
      lat: 40 + i * 0.001, lng: -74 + i * 0.001, timestamp: i * 1000, accuracy: 12,
    }));
    const r = detectSpoofing(history);
    expect(r.reasons.some((x) => x.includes('Identical accuracy'))).toBe(true);
  });

  test('flags perfect straight-line path', () => {
    const history = Array.from({ length: 5 }, (_, i) => ({
      lat: 40 + i * 0.001, lng: -74 + i * 0.001, timestamp: i * 1000, accuracy: 10,
    }));
    const r = detectSpoofing(history);
    expect(r.reasons.some((x) => x.includes('straight-line'))).toBe(true);
  });

  test('returns no flags for natural movement', () => {
    const history = [
      { lat: 40.7128, lng: -74.006, timestamp: 1000, accuracy: 8 },
      { lat: 40.7130, lng: -74.0065, timestamp: 2000, accuracy: 9 },
      { lat: 40.7135, lng: -74.0070, timestamp: 3000, accuracy: 7 },
      { lat: 40.7140, lng: -74.0072, timestamp: 4000, accuracy: 10 },
      { lat: 40.7145, lng: -74.0068, timestamp: 5000, accuracy: 8 },
    ];
    const r = detectSpoofing(history);
    expect(r.isSpoofed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. GEOFENCE VALIDATION WITH HYSTERESIS
// ---------------------------------------------------------------------------

describe('GeofenceMonitor hysteresis', () => {
  const fence = { id: 'hq', lat: 40.7128, lng: -74.006, radiusM: 100 };
  const debounceMs = 30_000;

  test('emits enter when point is inside', () => {
    const mon = new GeofenceMonitor([fence], { exitDebounceMs: debounceMs });
    const ev = mon.process({ lat: 40.7128, lng: -74.006, timestamp: 1000 });
    expect(ev).toHaveLength(1);
    expect(ev[0].type).toBe('enter');
    expect(ev[0].fenceId).toBe('hq');
  });

  test('does NOT emit exit immediately when point leaves (debounce buffer)', () => {
    const mon = new GeofenceMonitor([fence], { exitDebounceMs: debounceMs });
    mon.process({ lat: 40.7128, lng: -74.006, timestamp: 1000 }); // enter
    const ev = mon.process({ lat: 40.7135, lng: -74.007, timestamp: 2000 }); // just outside, 1s later
    expect(ev).toHaveLength(0); // no exit yet — still within debounce
  });

  test('emits exit only after debounce window passes', () => {
    const mon = new GeofenceMonitor([fence], { exitDebounceMs: debounceMs });
    mon.process({ lat: 40.7128, lng: -74.006, timestamp: 1000 }); // enter
    mon.process({ lat: 40.7135, lng: -74.007, timestamp: 2000 }); // leave, but within debounce
    const ev = mon.process({ lat: 40.7135, lng: -74.007, timestamp: 2000 + debounceMs + 1000 }); // past debounce
    expect(ev).toHaveLength(1);
    expect(ev[0].type).toBe('exit');
  });

  test('does not flap: brief re-entry inside debounce cancels exit', () => {
    const mon = new GeofenceMonitor([fence], { exitDebounceMs: debounceMs });
    mon.process({ lat: 40.7128, lng: -74.006, timestamp: 1000 }); // enter
    mon.process({ lat: 40.7135, lng: -74.007, timestamp: 2000 }); // leave (inside debounce)
    mon.process({ lat: 40.7128, lng: -74.006, timestamp: 5000 }); // re-enter (cancels exit)
    const ev = mon.process({ lat: 40.7128, lng: -74.006, timestamp: 6000 });
    expect(ev).toHaveLength(0); // still inside, no exit
  });

  test('jump scenario does not produce false geofence events', () => {
    const mon = new GeofenceMonitor([fence], { exitDebounceMs: debounceMs });
    const stream = generateSimStream('jump', { origin: { lat: 40.7128, lng: -74.006 } });
    let events = [];
    stream.forEach((p) => {
      events = events.concat(mon.process(p));
    });
    // The jump teleports far away but within the debounce window —
    // no exit should fire (anti-flapping).
    const exits = events.filter((e) => e.type === 'exit');
    expect(exits).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. GPSService PIPELINE INTEGRATION
// ---------------------------------------------------------------------------

describe('GPSService pipeline', () => {
  test('rejects invalid coordinates and emits null', () => {
    const svc = new GPSService();
    let received = null;
    svc.subscribe((p) => { received = p; });
    const result = svc.processRawPosition({
      coords: { latitude: 200, longitude: 300, accuracy: 10 },
      timestamp: Date.now(),
    });
    expect(result).toBeNull();
    expect(received).toBeNull();
  });

  test('flags low-accuracy readings as low confidence', () => {
    const svc = new GPSService({ maxAccuracyMeters: 100 });
    const p = svc.processRawPosition({
      coords: { latitude: 40.7, longitude: -74.0, accuracy: 150 },
      timestamp: Date.now(),
    });
    expect(p).not.toBeNull();
    expect(p.confidence).toBe('low');
    expect(p.trustScore).toBeLessThan(75);
  });

  test('detects jump on simulator "jump" scenario', () => {
    const svc = new GPSService();
    let jumps = 0;
    svc.subscribe((p) => { if (p?.isJump) jumps++; });
    const stream = generateSimStream('jump');
    stream.forEach((p) => {
      svc.processRawPosition({
        coords: { latitude: p.lat, longitude: p.lng, accuracy: p.accuracy },
        timestamp: p.timestamp,
      });
    });
    expect(jumps).toBeGreaterThanOrEqual(1);
  });

  test('feedSimulatedStream processes all points', (done) => {
    const svc = new GPSService();
    let count = 0;
    svc.subscribe((p) => { if (p) count++; });
    const stream = generateSimStream('straight_line', { count: 5 });
    svc.feedSimulatedStream(stream, 50);
    setTimeout(() => {
      expect(count).toBe(5);
      svc.stopSimulation();
      done();
    }, 500);
  });
});