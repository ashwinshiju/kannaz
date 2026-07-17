import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { calculateDistance } from '@/services/GPSService';
import {
  findSkylinePreset,
  buildLastLocationsByVehicle,
  computeEffectiveStatus,
} from '@/utils/vehicleProximity';

/**
 * useVehicleProximityStatus
 *
 * Computes an "effective" display status for each vehicle based on whether
 * its last known location (the end coordinates of its most recent trip) falls
 * within the Skyline office LocationPreset radius.
 *
 * Rule: a vehicle whose stored status is "available" is only shown as
 * "available" if its last known location is within the Skyline radius.
 * If the location is outside the radius, the display status is overridden
 * to "inactive". Vehicles with no trip history or non-"available" stored
 * status keep their original status.
 *
 * @param {Array} trips — all Trip records (used to derive last known location)
 * @returns {{ getEffectiveStatus: (v: object) => string, statusMap: Record<string, {distanceToSkyline:number,isNearSkyline:boolean,hasLocation:boolean}>, skylinePreset: object|null }}
 */
export function useVehicleProximityStatus(trips = []) {
  const { data: presets = [] } = useQuery({
    queryKey: ['location-presets'],
    queryFn: () => base44.entities.LocationPreset.list().catch(() => []),
  });

  const skylinePreset = useMemo(() => findSkylinePreset(presets), [presets]);

  const lastLocationByVehicle = useMemo(
    () => buildLastLocationsByVehicle(trips),
    [trips]
  );

  const statusMap = useMemo(() => {
    if (!skylinePreset) return {};
    const map = {};
    for (const [key, loc] of Object.entries(lastLocationByVehicle)) {
      const dist = calculateDistance(
        loc.lat,
        loc.lng,
        skylinePreset.latitude,
        skylinePreset.longitude
      );
      map[key] = {
        distanceToSkyline: dist,
        isNearSkyline: dist <= (skylinePreset.radius ?? 100),
        hasLocation: true,
      };
    }
    return map;
  }, [lastLocationByVehicle, skylinePreset]);

  const getEffectiveStatus = useCallback(
    (vehicle) => computeEffectiveStatus(vehicle, trips, presets),
    [trips, presets]
  );

  return { getEffectiveStatus, statusMap, skylinePreset };
}