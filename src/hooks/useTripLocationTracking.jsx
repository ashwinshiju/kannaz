/**
 * useTripLocationTracking — bridges the Trip State Machine's start/stop
 * actions to BackgroundLocationService, and feeds every incoming point
 * through GPSService's validation pipeline before it reaches trip state,
 * <MapView>, or the Trip Replay Engine.
 *
 * Additionally, persists validated GPS points to the TripTrackingLog entity
 * at a fixed interval (TRACKING_INTERVAL_MS) so the driven route trail is
 * stored server-side and can be used for actual-distance calculation on
 * trip end. This reuses the single existing BackgroundLocationService +
 * GPSService — no parallel GPS mechanism is introduced.
 *
 * Call `start(tripId)` from the same handler that transitions the trip
 * into "in progress", and `stop()` from the same handler that closes or
 * cancels it. Do not start tracking independently of a trip state
 * transition — trip state and tracking lifecycle must stay 1:1.
 */

import { useCallback, useRef, useState } from 'react';
import { startTripTracking, stopTripTracking } from '@/services/BackgroundLocationService';
import { validateGeoPoint } from '@/services/GPSService';
import { base44 } from '@/api/base44Client';

/** Minimum interval between persisted tracking-log points (ms). */
const TRACKING_INTERVAL_MS = 30_000;

/**
 * @returns {{ isTracking, trackingWarning, points, start, stop }}
 */
export function useTripLocationTracking() {
  const [isTracking, setIsTracking] = useState(false);
  const [trackingWarning, setTrackingWarning] = useState(null);
  const [points, setPoints] = useState([]);
  const historyRef = useRef([]);
  const activeTripIdRef = useRef(null);
  const lastPersistTsRef = useRef(0);

  const start = useCallback(async (tripId) => {
    setTrackingWarning(null);
    historyRef.current = [];
    lastPersistTsRef.current = 0;
    setPoints([]);

    activeTripIdRef.current = tripId;

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
          setPoints((prev) => [...prev, point]);

          // Throttle persistence to the tracking interval — only store
          // one point every TRACKING_INTERVAL_MS, regardless of how
          // frequently watchPosition fires.
          const now = point.timestamp ?? Date.now();
          if (now - lastPersistTsRef.current >= TRACKING_INTERVAL_MS) {
            lastPersistTsRef.current = now;

            // A point is valid for distance calculation if it passes
            // the same quality checks used for GPS warnings elsewhere
            // (StartTrip, EndTripDialog): not spoofed, not mocked, no
            // jump anomaly, and confidence is not low.
            const isValid =
              !point.spoofed &&
              !point.isMocked &&
              !point.isJump &&
              point.confidence !== 'low';

            const metadata = {
              trustScore: point.trustScore,
              confidence: point.confidence,
              accuracy: point.accuracy,
              isMocked: point.isMocked,
              spoofed: point.spoofed,
              spoofReasons: point.spoofReasons,
              isJump: point.isJump,
              impliedSpeedKmh: point.impliedSpeedKmh,
            };

            // Fire-and-forget — tracking must not stall on a network
            // failure. Errors are surfaced via trackingWarning.
            base44.entities.TripTrackingLog.create({
              trip_id: activeTripIdRef.current,
              latitude: point.lat,
              longitude: point.lng,
              timestamp: new Date(now).toISOString(),
              trust_score: point.trustScore ?? null,
              accuracy: point.accuracy ?? null,
              gps_metadata: JSON.stringify(metadata),
              is_valid: isValid,
            }).catch((err) => {
              setTrackingWarning(`Failed to log tracking point: ${err.message}`);
            });
          }
        } else if (errors.length) {
          setTrackingWarning(errors.join('; '));
        }
      },
      onError: (message) => {
        setTrackingWarning(message);
      },
    });

    setIsTracking(true);
  }, []);

  const stop = useCallback(async () => {
    await stopTripTracking();
    activeTripIdRef.current = null;
    lastPersistTsRef.current = 0;
    setIsTracking(false);
  }, []);

  return { isTracking, trackingWarning, points, start, stop };
}

export default useTripLocationTracking;