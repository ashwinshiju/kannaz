import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useTripLocationTracking } from '@/hooks/useTripLocationTracking';

/**
 * TripTrackingManager — invisible component that keeps the background
 * GPS tracking service running while the current user has an in-progress
 * trip. Mounted once in AppLayout so tracking survives page navigation
 * within the app session.
 *
 * Reuses the single existing useTripLocationTracking hook →
 * BackgroundLocationService → GPSService pipeline. No new GPS logic.
 */
export default function TripTrackingManager() {
  const { user } = useAuth();
  const { isTracking, start, stop } = useTripLocationTracking();

  // Poll for an active in-progress trip for the current user.
  const { data: activeTrip } = useQuery({
    queryKey: ['active-trip', user?.id],
    queryFn: async () => {
      const trips = await base44.entities.Trip.filter({
        employee_id: user.id,
        status: 'in_progress',
      });
      return trips[0] || null;
    },
    enabled: !!user,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (activeTrip && !isTracking) {
      start(activeTrip.id);
    } else if (!activeTrip && isTracking) {
      stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTrip?.id, isTracking]);

  // Stop tracking when the component unmounts (app closes / logout).
  useEffect(() => {
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}