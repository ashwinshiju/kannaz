/**
 * useTripLocationTracking — bridges the Trip State Machine's start/stop
 * actions to BackgroundLocationService, and feeds every incoming point
 * through GPSService's validation pipeline before it reaches trip state,
 * <MapView>, or the Trip Replay Engine.
 *
 * Additionally, persists a validated GPS point to the TripTrackingLog entity
 * at an adaptive interval (15s default, 10s at high speed, 25s when
 * stationary) while a trip is in progress. Points are appended — never
 * overwritten — building an ordered trail linked to the Trip record. This
 * reuses the single existing background tracking service
 * (BackgroundLocationService) — no parallel GPS mechanism.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { startTripTracking, stopTripTracking } from '@/services/BackgroundLocationService';
import { validateGeoPoint } from '@/services/GPSService';
import { base44 } from '@/api/base44Client';

// Adaptive tracking intervals
const TRACKING_INTERVAL_DEFAULT_MS = 15_000; // 15 seconds (reduced from 100s)
const TRACKING_INTERVAL_FAST_MS = 10_000;    // 10s when speed is high
const TRACKING_INTERVAL_SLOW_MS = 25_000;    // 25s when stationary/slow
const SPEED_THRESHOLD_HIGH_MS = 16.7;        // ~60 km/h in m/s
const SPEED_THRESHOLD_LOW_MS = 4.2;          // ~15 km/h in m/s
const TRACKING_TRUST_THRESHOLD = 50;

export function useTripLocationTracking() {
  const [isTracking, setIsTracking] = useState(false);
  const [trackingWarning, setTrackingWarning] = useState(null);
  const [points, setPoints] = useState([]);
  const historyRef = useRef([]);
  const pointsRef = useRef([]);
  const timeoutRef = useRef(null);
  const tripIdRef = useRef(null);

  const persistLatestPoint = useCallback(async () => {
    const pts = pointsRef.current;
    if (pts.length === 0 || !tripIdRef.current) return;

    const point = pts[pts.length - 1];
    const is_valid =
      point.trustScore >= TRACKING_TRUST_THRESHOLD &&
      !point.spoofed &&
      !point.isJump &&
      !point.isMocked;

    try {
      await base44.entities.TripTrackingLog.create({
        trip_id: tripIdRef.current,
        latitude: point.lat,
        longitude: point.lng,
        speed: point.speed ?? null,
        timestamp_ms: point.timestamp,
        trust_score: point.trustScore,
        gps_metadata: JSON.stringify({
          confidence: point.confidence,
          accuracy: point.accuracy,
          isMocked: point.isMocked,
          spoofed: point.spoofed,
          spoofReasons: point.spoofReasons,
          isJump: point.isJump,
        }),
        is_valid,
      });
    } catch {
      // best-effort — don't break tracking on a single failed persist
    }
  }, []);

  // Recursive timeout instead of setInterval so the next interval can adapt
  // based on the latest GPS speed reading.
  const scheduleNextPersist = useCallback(() => {
    const pts = pointsRef.current;
    let interval = TRACKING_INTERVAL_DEFAULT_MS;

    if (pts.length > 0) {
      const speed = pts[pts.length - 1].speed; // m/s from Geolocation API
      if (speed != null) {
        if (speed > SPEED_THRESHOLD_HIGH_MS) interval = TRACKING_INTERVAL_FAST_MS;
        else if (speed < SPEED_THRESHOLD_LOW_MS) interval = TRACKING_INTERVAL_SLOW_MS;
      }
    }

    timeoutRef.current = setTimeout(async () => {
      await persistLatestPoint();
      scheduleNextPersist();
    }, interval);
  }, [persistLatestPoint]);

  const start = useCallback(async (tripId) => {
    setTrackingWarning(null);
    historyRef.current = [];
    pointsRef.current = [];
    setPoints([]);
    tripIdRef.current = tripId;

    await startTripTracking(tripId, {
      onPoint: (raw) => {
        const { valid, point, errors } = validateGeoPoint(
          historyRef.current,
          raw,
          raw.timestamp ?? Date.now()
        );

        // Always record the raw point in the bounded history window,
        // even if invalid — jump detection needs the previous fix.
        historyRef.current = [...historyRef.current, raw].slice(-50);

        if (valid && point) {
          pointsRef.current = [...pointsRef.current, point];
          setPoints((prev) => [...prev, point]);
        } else if (errors.length) {
          setTrackingWarning(errors.join('; '));
        }
      },
      onError: (message) => {
        setTrackingWarning(message);
      },
    });

    // Persist a tracked point at an adaptive interval — appends to
    // TripTrackingLog, does not overwrite previous points.
    scheduleNextPersist();

    setIsTracking(true);
  }, [scheduleNextPersist]);

  const stop = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    await stopTripTracking();
    tripIdRef.current = null;
    setIsTracking(false);
  }, []);

  // Cleanup on unmount — ensures no orphaned watch or timeout.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      stopTripTracking();
    };
  }, []);

  return { isTracking, trackingWarning, points, start, stop };
}

export default useTripLocationTracking;