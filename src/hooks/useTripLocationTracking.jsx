/**
 * useTripLocationTracking — bridges the Trip State Machine's start/stop
 * actions to BackgroundLocationService, and feeds every incoming point
 * through GPSService's validation pipeline before it reaches trip state,
 * <MapView>, or the Trip Replay Engine.
 *
 * Additionally, persists a validated GPS point to the TripTrackingLog entity
 * every TRACKING_INTERVAL_MS (100 seconds) while a trip is in progress.
 * Points are appended — never overwritten — building an ordered trail
 * linked to the Trip record. This reuses the single existing background
 * tracking service (BackgroundLocationService) — no parallel GPS mechanism.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { startTripTracking, stopTripTracking } from '@/services/BackgroundLocationService';
import { validateGeoPoint } from '@/services/GPSService';
import { base44 } from '@/api/base44Client';

const TRACKING_INTERVAL_MS = 100_000; // 100 seconds
const TRACKING_TRUST_THRESHOLD = 50;

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

    // Persist a tracked point every 100 seconds — appends to TripTrackingLog,
    // does not overwrite previous points.
    intervalRef.current = setInterval(persistLatestPoint, TRACKING_INTERVAL_MS);

    setIsTracking(true);
  }, [persistLatestPoint]);

  const stop = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    await stopTripTracking();
    tripIdRef.current = null;
    setIsTracking(false);
  }, []);

  // Cleanup on unmount — ensures no orphaned watch or interval.
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      stopTripTracking();
    };
  }, []);

  return { isTracking, trackingWarning, points, start, stop };
}

export default useTripLocationTracking;