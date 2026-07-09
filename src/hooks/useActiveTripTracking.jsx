/**
 * useActiveTripTracking — persists at the AppLayout level so GPS tracking
 * survives page navigation during an in-progress trip.
 *
 * Reuses the single existing BackgroundLocationService (startTripTracking /
 * stopTripTracking) and GPSService.validateGeoPoint pipeline — no new GPS
 * acquisition or validation logic is introduced.
 *
 * Each validated point is appended (never overwritten) to the TripPoint
 * entity at a fixed interval, storing lat/lng/timestamp/trust_score and
 * the full validation metadata so the distance calculation on trip-end can
 * filter out bad readings.
 */

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { startTripTracking, stopTripTracking } from '@/services/BackgroundLocationService';
import { validateGeoPoint } from '@/services/GPSService';

const TRACKING_INTERVAL_MS = 30_000; // 30 seconds between saved points
const TRUST_SCORE_THRESHOLD = 50;

export function useActiveTripTracking() {
  const { user } = useAuth();
  const historyRef = useRef([]);
  const lastSaveRef = useRef(0);
  const activeTripIdRef = useRef(null);

  // Detect the current user's in-progress trip.
  const { data: activeTrip } = useQuery({
    queryKey: ['active-trip', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const trips = await base44.entities.Trip.filter({
        employee_id: user.id,
        status: 'in_progress',
      });
      return trips[0] || null;
    },
    enabled: !!user?.id,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const tripId = activeTrip?.id;

    // Only start tracking when there's an active in-progress trip that
    // isn't already being tracked.
    if (!tripId || tripId === activeTripIdRef.current) return;

    activeTripIdRef.current = tripId;
    historyRef.current = [];
    lastSaveRef.current = 0;

    let cancelled = false;

    startTripTracking(tripId, {
      onPoint: (raw) => {
        if (cancelled) return;

        const { valid, point } = validateGeoPoint(
          historyRef.current,
          raw,
          raw.timestamp ?? Date.now()
        );

        // Always record the raw point in the bounded history window —
        // jump detection needs the previous fix.
        historyRef.current = [...historyRef.current, raw].slice(-50);

        if (!valid || !point) return;

        // Throttle saves to the tracking interval
        const now = Date.now();
        if (now - lastSaveRef.current < TRACKING_INTERVAL_MS) return;
        lastSaveRef.current = now;

        // Append to TripPoint entity — never overwrite
        const isValid =
          point.trustScore >= TRUST_SCORE_THRESHOLD &&
          !point.isJump &&
          !point.spoofed &&
          !point.isMocked;

        base44.entities.TripPoint.create({
          trip_id: tripId,
          latitude: point.lat,
          longitude: point.lng,
          timestamp: new Date(point.timestamp).toISOString(),
          trust_score: point.trustScore,
          gps_metadata: JSON.stringify({
            accuracy: point.accuracy,
            isMocked: point.isMocked,
            spoofed: point.spoofed,
            isJump: point.isJump,
            confidence: point.confidence,
            spoofReasons: point.spoofReasons,
          }),
          is_valid: isValid,
        }).catch(() => {
          // best-effort — don't crash tracking on a save failure
        });
      },
      onError: () => {},
    });

    return () => {
      cancelled = true;
      stopTripTracking();
      activeTripIdRef.current = null;
    };
  }, [activeTrip?.id]);
}

export default useActiveTripTracking;