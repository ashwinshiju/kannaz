/**
 * useTripLocationTracking — bridges the Trip State Machine's start/stop
 * actions to BackgroundLocationService, and feeds every incoming point
 * through GPSService's validation pipeline before it reaches trip state,
 * <MapView>, or the Trip Replay Engine.
 *
 * Additionally, persists a validated GPS point to the TripTrackingLog entity
 * every TRACKING_INTERVAL_MS (15 seconds, adaptive) while a trip is in progress.
 * The interval adapts to speed: 10s at high speed (>60 km/h), 25s when
 * stationary (<10 km/h), 15s otherwise — balancing accuracy against battery.
 * Speed (impliedSpeedKmh) from GPSService's validation pipeline is stored on
 * each point for gap-distance estimation. Points are appended — never
 * overwritten — building an ordered trail linked to the Trip record. This
 * reuses the single existing background tracking service
 * (BackgroundLocationService) — no parallel GPS mechanism.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { startTripTracking, stopTripTracking } from '@/services/BackgroundLocationService';
import { validateGeoPoint } from '@/services/GPSService';
import { base44 } from '@/api/base44Client';
import { TRACKING_INTERVAL_MS } from '@/services/trackingGapAnalysis';

const TRACKING_TRUST_THRESHOLD = 50;
const HIGH_SPEED_INTERVAL_MS = 10_000; // 10s when speed > 60 km/h
const STATIONARY_INTERVAL_MS = 25_000;  // 25s when speed < 10 km/h
const HIGH_SPEED_THRESHOLD = 60;       // km/h
const STATIONARY_SPEED_THRESHOLD = 10; // km/h

export function useTripLocationTracking() {
  const [isTracking, setIsTracking] = useState(false);
  const [trackingWarning, setTrackingWarning] = useState(null);
  const [points, setPoints] = useState([]);
  const historyRef = useRef([]);
  const pointsRef = useRef([]);
  const intervalRef = useRef(null);
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
        timestamp_ms: point.timestamp,
        speed_kmh: point.impliedSpeedKmh ?? null,
        trust_score: point.trustScore,
        gps_metadata: JSON.stringify({
          confidence: point.confidence,
          accuracy: point.accuracy,
          isMocked: point.isMocked,
          spoofed: point.spoofed,
          spoofReasons: point.spoofReasons,
          isJump: point.isJump,
          impliedSpeedKmh: point.impliedSpeedKmh,
        }),
        is_valid,
      });
    } catch {
      // best-effort — don't break tracking on a single failed persist
    }
  }, []);

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

    // Persist tracked points with an adaptive interval — shorter (10s) when
    // speed is high for better turn/curve resolution, longer (25s) when
    // stationary to save battery. Uses setTimeout (not setInterval) so each
    // cycle can read the latest speed and adjust. Reuses the same
    // persistLatestPoint and TripTrackingLog entity — no parallel system.
    const scheduleNextPersist = () => {
      const lastPoint = pointsRef.current[pointsRef.current.length - 1];
      const speed = lastPoint?.impliedSpeedKmh ?? 0;
      const interval = speed > HIGH_SPEED_THRESHOLD
        ? HIGH_SPEED_INTERVAL_MS
        : speed < STATIONARY_SPEED_THRESHOLD
          ? STATIONARY_INTERVAL_MS
          : TRACKING_INTERVAL_MS;
      intervalRef.current = setTimeout(async () => {
        await persistLatestPoint();
        scheduleNextPersist();
      }, interval);
    };
    scheduleNextPersist();

    setIsTracking(true);
  }, [persistLatestPoint]);

  const stop = useCallback(async () => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
    await stopTripTracking();
    tripIdRef.current = null;
    setIsTracking(false);
  }, []);

  // Cleanup on unmount — ensures no orphaned watch or interval.
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
      stopTripTracking();
    };
  }, []);

  return { isTracking, trackingWarning, points, start, stop };
}

export default useTripLocationTracking;