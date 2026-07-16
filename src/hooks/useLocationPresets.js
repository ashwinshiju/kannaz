import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const QUERY_KEY = ['location-presets'];

/**
 * Fetches all LocationPreset records via React Query.
 * Returns the raw list plus a lookup map (id → preset) for quick name resolution.
 * React Query deduplicates, so multiple components calling this share one request.
 */
export function useLocationPresets() {
  const { data: presets = [], isLoading, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => base44.entities.LocationPreset.list(),
  });

  const presetMap = new Map(presets.map((p) => [p.id, p]));

  return { presets, presetMap, isLoading, refetch, queryKey: QUERY_KEY };
}