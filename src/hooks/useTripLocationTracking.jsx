/**
 * useTripLocationTracking — bridges the Trip State Machine's start/stop
 * actions to BackgroundLocationService, and feeds every incoming point
 * through GPSService's validation pipeline before it reaches trip state,
 * <MapView>, or the Trip Replay Engine.
 *
 * Call `start(tripId)` from the same handler that transitions the trip
 * into "in progress", and `stop()` from the same handler that closes or
 * cancels it. Do not start tracking independently of a trip state
 * transition — trip state and tracking lifecycle must stay 1:1.
 */

import { useCallback, useRef, useState } from 'react';
import { startTripTracking, stopTripTracking } from '@/services/BackgroundLocationService';
import { validateGeoPoint } from '@/services/GPSService';

/**
 * @returns {{ isTracking, trackingWarning, points, start, stop }}
 */
export function useTripLocationTracking() {
  const [isTracking, setIsTracking] = useState(false);
  const [trackingWarning, setTrackingWarning] = useState(null);
  const [points, setPoints] = useState([]);
  const historyRef = useRef([]);

  const start = useCallback(async (tripId) => {
    setTrackingWarning(null);
    historyRef.current = [];
    setPoints([]);

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
    setIsTracking(false);
  }, []);

  return { isTracking, trackingWarning, points, start, stop };
}

export default useTripLocationTracking;