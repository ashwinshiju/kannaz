/**
 * trackingGapAnalysis — pure functions for detecting tracking gaps in GPS
 * point trails, calculating gap-aware distance, and flagging distance
 * discrepancies between tracked and odometer distance.
 *
 * Reuses GPSService's Haversine function — no new distance logic.
 */

import { calculateDistance } from '@/services/GPSService';

/** Expected interval between persisted GPS points (15 seconds). */
export const TRACKING_INTERVAL_MS = 15_000;

/** A gap is flagged when the time between consecutive points exceeds this multiplier × expected interval. */
const GAP_THRESHOLD_MULTIPLIER = 2.5;

/** Percentage difference threshold for flagging a distance mismatch. */
const MISMATCH_THRESHOLD_PCT = 10;

/**
 * Detect tracking gaps in a time-ordered series of GPS points.
 * A gap is when the time between consecutive points exceeds
 * GAP_THRESHOLD_MULTIPLIER × expectedIntervalMs.
 *
 * @param {Array} points — sorted by timestamp_ms ascending
 * @param {number} expectedIntervalMs
 * @returns {{ gaps: Array, gapSegmentStarts: Set<number> }}
 */
export function detectGaps(points, expectedIntervalMs = TRACKING_INTERVAL_MS) {
  const gaps = [];
  const gapSegmentStarts = new Set();

  if (!points || points.length < 2) return { gaps, gapSegmentStarts };

  const threshold = expectedIntervalMs * GAP_THRESHOLD_MULTIPLIER;

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
 * Calculate tracked distance with gap awareness.
 * - Continuous segments: sum Haversine distance between consecutive points.
 * - Gap segments: estimate distance using average speed of points before/after
 *   the gap (distance ≈ avg speed × gap duration). If no speed data is
 *   available, the gap segment is excluded from tracked distance and the trip
 *   is flagged as having incomplete tracking data.
 *
 * @param {Array} points — valid points sorted by timestamp_ms ascending
 * @param {Array} gaps — output from detectGaps()
 * @param {number} expectedIntervalMs
 * @returns {{ trackedDistanceKm: number, gapDetails: Array, hasIncompleteGaps: boolean }}
 */
export function calculateGapAwareDistance(points, gaps, expectedIntervalMs = TRACKING_INTERVAL_MS) {
  if (!points || points.length < 2) {
    return { trackedDistanceKm: 0, gapDetails: [], hasIncompleteGaps: false };
  }

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
        // No speed data — exclude from tracked distance
        hasIncompleteGaps = true;
        gapDetails.push({
          startTime: gap.startTime,
          endTime: gap.endTime,
          durationMs: gap.durationMs,
          durationMin: gap.durationMin,
          estimated: false,
          method: 'excluded',
        });
      }
    } else {
      // Continuous segment — Haversine
      totalMeters += calculateDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      );
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
 * Returns mismatch=true if the absolute difference exceeds the threshold.
 *
 * @param {number|null} trackedKm
 * @param {number|null} odometerKm
 * @param {number} thresholdPct
 * @returns {{ mismatch: boolean, pctDiff: number|null }}
 */
export function calculateDistanceMismatch(trackedKm, odometerKm, thresholdPct = MISMATCH_THRESHOLD_PCT) {
  if (trackedKm == null || odometerKm == null || odometerKm === 0) {
    return { mismatch: false, pctDiff: null };
  }
  const pctDiff = Math.round(
    (Math.abs(trackedKm - odometerKm) / odometerKm) * 100
  );
  return { mismatch: pctDiff > thresholdPct, pctDiff };
}