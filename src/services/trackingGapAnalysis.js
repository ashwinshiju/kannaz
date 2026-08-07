/**
 * trackingGapAnalysis — pure functions for detecting tracking gaps in GPS
 * point trails, calculating gap-aware distance, and flagging distance
 * discrepancies between tracked and odometer distance.
 *
 * All tunable thresholds are read from a config object (sourced at runtime
 * from the `gps_tracking_config` Setting record via configLoader.js). Each
 * function accepts an optional `config` and falls back to
 * GPS_TRACKING_DEFAULTS when a field is absent — so callers that don't pass
 * config behave exactly as before, and the hardcoded values live in ONE
 * place (configLoader.js).
 *
 * Reuses GPSService's Haversine function — no new distance logic.
 */

import { calculateDistance } from '@/services/GPSService';
import { GPS_TRACKING_DEFAULTS } from '@/lib/configLoader';

/** Expected interval between persisted GPS points (re-exported for the
 *  adaptive-interval fallback in the tracking hook). */
export const TRACKING_INTERVAL_MS = GPS_TRACKING_DEFAULTS.tracking_interval_ms;

/** EMA smoothing factor (re-exported for backwards compatibility). */
export const EMA_ALPHA = GPS_TRACKING_DEFAULTS.ema_alpha;

/**
 * Detect tracking gaps in a time-ordered series of GPS points.
 * A gap is when the time between consecutive points exceeds
 * gap_threshold_multiplier × tracking_interval_ms.
 *
 * @param {Array} points — sorted by timestamp_ms ascending
 * @param {object} config — { tracking_interval_ms, gap_threshold_multiplier }
 * @returns {{ gaps: Array, gapSegmentStarts: Set<number> }}
 */
export function detectGaps(points, config = {}) {
  const gaps = [];
  const gapSegmentStarts = new Set();

  if (!points || points.length < 2) return { gaps, gapSegmentStarts };

  const expectedIntervalMs = config.tracking_interval_ms ?? GPS_TRACKING_DEFAULTS.tracking_interval_ms;
  const multiplier = config.gap_threshold_multiplier ?? GPS_TRACKING_DEFAULTS.gap_threshold_multiplier;
  const threshold = expectedIntervalMs * multiplier;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const prevTs = prev.timestamp_ms ?? prev.timestamp ?? 0;
    const currTs = curr.timestamp_ms ?? curr.timestamp ?? 0;
    const gapMs = currTs - prevTs;

    if (gapMs > threshold) {
      gaps.push({
        startIndex: i - 1,
        endIndex: i,
        startTime: prevTs,
        endTime: currTs,
        durationMs: gapMs,
        durationMin: Math.round((gapMs / 60_000) * 100) / 100,
      });
      gapSegmentStarts.add(i - 1);
    }
  }

  return { gaps, gapSegmentStarts };
}

/**
 * Extract speed (km/h) from a TripTrackingLog point.
 * Checks the dedicated speed_kmh field first, then falls back to
 * parsing gps_metadata JSON.
 */
function getSpeedKmh(point) {
  if (point.speed_kmh != null) return point.speed_kmh;
  if (point.gps_metadata) {
    try {
      const meta = typeof point.gps_metadata === 'string'
        ? JSON.parse(point.gps_metadata)
        : point.gps_metadata;
      if (meta.impliedSpeedKmh != null) return meta.impliedSpeedKmh;
    } catch { /* ignore parse errors */ }
  }
  return null;
}

/**
 * Apply exponential moving average (EMA) smoothing to a series of GPS points.
 * Dampens the coordinate oscillation ("shimmer") that occurs when the vehicle
 * is stationary or moving at low speeds. Display/map-rendering only — NOT for
 * distance calculation (distance uses raw coordinates to preserve turns).
 *
 * @param {Array} points
 * @param {object} config — { ema_alpha }
 */
export function smoothPoints(points, config = {}) {
  const alpha = config.ema_alpha ?? GPS_TRACKING_DEFAULTS.ema_alpha;
  if (points.length < 2) return points;
  const smoothed = [{ ...points[0] }];
  for (let i = 1; i < points.length; i++) {
    const prev = smoothed[i - 1];
    const curr = points[i];
    smoothed.push({
      ...curr,
      latitude: prev.latitude * (1 - alpha) + curr.latitude * alpha,
      longitude: prev.longitude * (1 - alpha) + curr.longitude * alpha,
    });
  }
  return smoothed;
}

/**
 * Calculate tracked distance with gap awareness.
 * - Continuous segments: sum Haversine distance between consecutive points
 *   (segments shorter than stationary_threshold_m are skipped).
 * - Gap segments: estimate distance using average speed of points before/after
 *   the gap (distance ≈ avg speed × gap duration). If no speed data is
 *   available, straight-line Haversine is used; gaps longer than
 *   gap_incomplete_threshold_ms are flagged incomplete.
 *
 * @param {Array} points — valid points sorted by timestamp_ms ascending
 * @param {Array} gaps — output from detectGaps()
 * @param {object} config — { stationary_threshold_m, gap_incomplete_threshold_ms }
 * @returns {{ trackedDistanceKm: number, gapDetails: Array, hasIncompleteGaps: boolean }}
 */
export function calculateGapAwareDistance(points, gaps, config = {}) {
  if (!points || points.length < 2) {
    return { trackedDistanceKm: 0, gapDetails: [], hasIncompleteGaps: false };
  }

  const stationaryThresholdM = config.stationary_threshold_m ?? GPS_TRACKING_DEFAULTS.stationary_threshold_m;
  const gapIncompleteThresholdMs = config.gap_incomplete_threshold_ms ?? GPS_TRACKING_DEFAULTS.gap_incomplete_threshold_ms;

  // Use raw coordinates for distance calculation — EMA smoothing was pulling
  // points toward a straight line, under-counting distance on turns/curves.
  let totalMeters = 0;
  const gapDetails = [];
  let hasIncompleteGaps = false;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const gap = gaps.find((g) => g.startIndex === i - 1);

    if (gap) {
      // Gap segment — try speed interpolation
      const speedBefore = getSpeedKmh(prev);
      const speedAfter = getSpeedKmh(curr);
      const speeds = [speedBefore, speedAfter].filter((s) => s != null && s > 0);

      if (speeds.length > 0) {
        const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
        const gapDurationHours = gap.durationMs / 3_600_000;
        const estimatedKm = Math.round(avgSpeed * gapDurationHours * 100) / 100;
        totalMeters += estimatedKm * 1000;
        gapDetails.push({
          startTime: gap.startTime,
          endTime: gap.endTime,
          durationMs: gap.durationMs,
          durationMin: gap.durationMin,
          estimated: true,
          estimatedDistanceKm: estimatedKm,
          method: 'speed_interpolation',
        });
      } else {
        // No speed data — use straight-line Haversine between gap endpoints.
        const haversineM = calculateDistance(
          prev.latitude, prev.longitude,
          curr.latitude, curr.longitude
        );
        const estimatedKm = Math.round((haversineM / 1000) * 100) / 100;
        totalMeters += haversineM;

        if (gap.durationMs > gapIncompleteThresholdMs) {
          hasIncompleteGaps = true;
        }

        gapDetails.push({
          startTime: gap.startTime,
          endTime: gap.endTime,
          durationMs: gap.durationMs,
          durationMin: gap.durationMin,
          estimated: true,
          estimatedDistanceKm: estimatedKm,
          method: gap.durationMs > gapIncompleteThresholdMs ? 'excluded_large_gap' : 'straight_line',
        });
      }
    } else {
      // Continuous segment — Haversine with stationary dedup
      const segmentM = calculateDistance(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude
      );
      if (segmentM < stationaryThresholdM) continue;
      totalMeters += segmentM;
    }
  }

  return {
    trackedDistanceKm: Math.round((totalMeters / 1000) * 100) / 100,
    gapDetails,
    hasIncompleteGaps,
  };
}

/**
 * Calculate the percentage difference between tracked and odometer distance.
 * Returns mismatch=true if the absolute difference exceeds mismatch_threshold_pct.
 *
 * @param {number|null} trackedKm
 * @param {number|null} odometerKm
 * @param {object} config — { mismatch_threshold_pct }
 * @returns {{ mismatch: boolean, pctDiff: number|null }}
 */
export function calculateDistanceMismatch(trackedKm, odometerKm, config = {}) {
  const thresholdPct = config.mismatch_threshold_pct ?? GPS_TRACKING_DEFAULTS.mismatch_threshold_pct;
  if (trackedKm == null || odometerKm == null || odometerKm === 0) {
    return { mismatch: false, pctDiff: null };
  }
  const pctDiff = Math.round(
    (Math.abs(trackedKm - odometerKm) / odometerKm) * 100
  );
  return { mismatch: pctDiff > thresholdPct, pctDiff };
}