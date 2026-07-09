/**
 * calculateTrackedDistance — computes the actual driven distance from
 * GPS waypoints stored during a trip.
 *
 * 1. Filters out invalid points (trust score below threshold, or
 *    anomaly/spoofed/mocked flags set).
 * 2. Orders valid points by timestamp.
 * 3. Sums Haversine distances between each consecutive pair.
 * 4. If fewer than 2 valid points exist, falls back to Haversine between
 *    the trip's start and end coordinates and flags "low_tracking_data".
 *
 * Reuses GPSService.calculateDistance (Haversine) — no new distance math.
 */

import { calculateDistance } from '@/services/GPSService';

const TRUST_SCORE_THRESHOLD = 50;

export function calculateTrackedDistance(points, trip) {
  const safePoints = Array.isArray(points) ? points : [];

  // Filter out clearly invalid points
  const validPoints = safePoints.filter(
    (p) =>
      p.is_valid !== false &&
      p.trust_score != null &&
      p.trust_score >= TRUST_SCORE_THRESHOLD &&
      p.latitude != null &&
      p.longitude != null
  );

  // Sort by timestamp (ascending)
  const sorted = [...validPoints].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Fewer than 2 valid points — fall back to straight-line start→end
  if (sorted.length < 2) {
    if (
      trip?.start_lat != null &&
      trip?.start_lng != null &&
      trip?.end_lat != null &&
      trip?.end_lng != null
    ) {
      const distM = calculateDistance(
        trip.start_lat,
        trip.start_lng,
        trip.end_lat,
        trip.end_lng
      );
      return {
        tracked_distance_km: Math.round((distM / 1000) * 100) / 100,
        low_tracking_data: true,
        point_count: sorted.length,
      };
    }
    return {
      tracked_distance_km: null,
      low_tracking_data: true,
      point_count: sorted.length,
    };
  }

  // Sum Haversine distances between consecutive valid points
  let totalMeters = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalMeters += calculateDistance(
      sorted[i - 1].latitude,
      sorted[i - 1].longitude,
      sorted[i].latitude,
      sorted[i].longitude
    );
  }

  return {
    tracked_distance_km: Math.round((totalMeters / 1000) * 100) / 100,
    low_tracking_data: false,
    point_count: sorted.length,
  };
}