/**
 * GeofenceMonitor — point-in-circle geofencing with hysteresis / debounce
 * to prevent flapping at boundary edges and during GPS glitches.
 *
 * A fence: { id, lat, lng, radiusM }
 * "Enter" fires immediately when a point is inside.
 * "Exit" only fires after the point has remained outside for `exitDebounceMs`.
 */

import { calculateDistance } from './GPSService';

export class GeofenceMonitor {
  constructor(fences = [], config = {}) {
    this.fences = fences;
    this.exitDebounceMs = config.exitDebounceMs ?? 30_000;
    // Track state per fence: { inside: bool, lastInsideTs: number|null }
    this._state = new Map();
    fences.forEach((f) => this._state.set(f.id, { inside: false, lastInsideTs: null }));
  }

  reset() {
    this._state.clear();
    this.fences.forEach((f) => this._state.set(f.id, { inside: false, lastInsideTs: null }));
  }

  /**
   * Process a point; returns an array of events.
   * @returns {{ fenceId: string, type: 'enter'|'exit', fence: object }[]}
   */
  process(point) {
    const events = [];
    const now = point.timestamp ?? Date.now();

    for (const fence of this.fences) {
      const st = this._state.get(fence.id) ?? { inside: false, lastInsideTs: null };
      const dist = calculateDistance(point.lat, point.lng, fence.lat, fence.lng);
      const isInside = dist <= fence.radiusM;

      if (isInside) {
        st.lastInsideTs = now;
        if (!st.inside) {
          st.inside = true;
          events.push({ fenceId: fence.id, type: 'enter', fence });
        }
      } else {
        // Hysteresis: only emit exit after debounce window has passed
        const elapsed = now - (st.lastInsideTs ?? now);
        if (st.inside && elapsed >= this.exitDebounceMs) {
          st.inside = false;
          events.push({ fenceId: fence.id, type: 'exit', fence });
        }
        // If still within debounce window, we HOLD the previous inside state
        // (no exit event — this is the anti-flapping buffer).
      }

      this._state.set(fence.id, st);
    }

    return events;
  }

  /** Check if a point is inside any fence (for quick queries). */
  isInsideAny(point) {
    return this.fences.some(
      (f) => calculateDistance(point.lat, point.lng, f.lat, f.lng) <= f.radiusM
    );
  }
}