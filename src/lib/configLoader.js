/**
 * configLoader — single source of truth for GPS tracking tunables.
 *
 * GPS_TRACKING_DEFAULTS holds the fallback values used when no Setting
 * record exists yet (or the record is malformed). Every service that needs
 * these values imports from here, so the hardcoded constants live in ONE
 * place. Admins override them by editing the `gps_tracking_config` Setting
 * record from the dashboard — changes take effect on the next app refresh
 * (the values are read at runtime, not bundled at build time).
 */

import { base44 } from '@/api/base44Client';

export const GPS_TRACKING_DEFAULTS = {
  /** Expected interval between persisted GPS points (ms). */
  tracking_interval_ms: 15_000,
  /** A gap is flagged when time between points exceeds this × interval. */
  gap_threshold_multiplier: 10,
  /** Segments shorter than this (meters) are treated as stationary. */
  stationary_threshold_m: 5,
  /** Gaps longer than this (ms) with no speed data are flagged incomplete. */
  gap_incomplete_threshold_ms: 300_000,
  /** Jump detection ceiling — implied speed above this is a GPS jump (km/h). */
  max_realistic_speed_kmh: 180,
  /** Trust-score accuracy penalty tiers (meters), ascending. [low, mid, high]. */
  trust_penalty_accuracy_m: [20, 50, 100],
  /** EMA smoothing factor for display-only coordinate smoothing. */
  ema_alpha: 0.7,
  /** Percentage difference above which tracked vs odometer distance mismatches. */
  mismatch_threshold_pct: 20,
  /** Readings with accuracy worse than this (meters) are "low" confidence. */
  max_accuracy_meters: 100,
};

const SETTING_KEY = 'gps_tracking_config';

/**
 * Fetch the admin-configured GPS tracking config from the Setting entity.
 * Merges the stored JSON over the hardcoded defaults so any missing field
 * falls back safely. Never throws — returns defaults on any error so the
 * GPS pipeline stays operational even if the record is deleted or corrupt.
 *
 * @returns {Promise<typeof GPS_TRACKING_DEFAULTS>}
 */
export async function getGpsTrackingConfig() {
  try {
    const records = await base44.entities.Setting.filter({ key: SETTING_KEY }, null, 1);
    const rec = records?.[0];
    if (!rec?.value) return { ...GPS_TRACKING_DEFAULTS };
    const parsed = JSON.parse(rec.value);
    const merged = { ...GPS_TRACKING_DEFAULTS, ...parsed };
    // Normalize the trust tiers to a sorted ascending 3-element array.
    if (Array.isArray(merged.trust_penalty_accuracy_m)) {
      merged.trust_penalty_accuracy_m = merged.trust_penalty_accuracy_m
        .map((v) => Number(v))
        .filter((n) => !Number.isNaN(n))
        .sort((a, b) => a - b);
    } else {
      merged.trust_penalty_accuracy_m = [...GPS_TRACKING_DEFAULTS.trust_penalty_accuracy_m];
    }
    return merged;
  } catch {
    return { ...GPS_TRACKING_DEFAULTS };
  }
}

/**
 * Persist the GPS tracking config back to the Setting entity. Creates the
 * record if it doesn't exist, otherwise updates the existing one.
 *
 * @param {typeof GPS_TRACKING_DEFAULTS} config
 */
export async function saveGpsTrackingConfig(config) {
  const value = JSON.stringify(config);
  const existing = await base44.entities.Setting.filter({ key: SETTING_KEY }, null, 1);
  if (existing?.[0]?.id) {
    await base44.entities.Setting.update(existing[0].id, { value });
    return existing[0].id;
  }
  const created = await base44.entities.Setting.create({
    key: SETTING_KEY,
    value,
    category: 'system',
    description: 'Admin-configurable GPS tracking thresholds (gap, jump, trust-score tiers).',
  });
  return created?.id;
}