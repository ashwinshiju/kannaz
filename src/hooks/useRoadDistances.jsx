import { useState, useEffect } from 'react';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

/**
 * Fetches actual road distance (km) between each trip's start and end
 * GPS coordinates using the public OSRM API.
 *
 * @param {Array} trips - filtered trip objects with start_lat/lng, end_lat/lng
 * @returns {{ distances: Record<string, number>, loading: boolean }}
 */
export function useRoadDistances(trips) {
  const [distances, setDistances] = useState({});
  const [loading, setLoading] = useState(false);

  // Stable dependency key — avoids re-fetching when array reference changes
  // but trip IDs remain the same.
  const tripKey = trips?.map((t) => t.id).join(',') || '';

  useEffect(() => {
    if (!trips || trips.length === 0) {
      setDistances({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchable = trips.filter(
      (t) =>
        t.start_lat != null &&
        t.start_lng != null &&
        t.end_lat != null &&
        t.end_lng != null
    );

    Promise.all(
      fetchable.map(async (trip) => {
        try {
          const url = `${OSRM_BASE}/${trip.start_lng},${trip.start_lat};${trip.end_lng},${trip.end_lat}?overview=false`;
          const res = await fetch(url);
          if (!res.ok) return null;
          const data = await res.json();
          if (data.code === 'Ok' && data.routes?.[0]?.distance != null) {
            const km = Math.round((data.routes[0].distance / 1000) * 100) / 100;
            return { id: trip.id, distance_km: km };
          }
          return null;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const map = {};
      results.forEach((r) => {
        if (r) map[r.id] = r.distance_km;
      });
      setDistances(map);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripKey]);

  return { distances, loading };
}