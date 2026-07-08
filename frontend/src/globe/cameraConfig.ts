/** Globe camera and arc visibility tuning (altitude = distance in globe-radii). */

export const GLOBE_RADIUS = 100;

/** Closest the user can zoom (matches OrbitControls minDistance / GLOBE_RADIUS). */
export const MIN_CAMERA_ALTITUDE = 0.35;

/** Farthest zoom-out. */
export const MAX_CAMERA_ALTITUDE = 4;

/**
 * Hide arcs only in the closest slice of the zoom range — roughly when inspecting
 * a small country at full-frame (e.g. Benelux). Normal country / regional zoom
 * keeps arcs visible.
 *
 * Range: min + 5% of span ≈ 0.53; small EU country close-up ≈ 0.55–0.75.
 */
export const ARC_HIDE_ALTITUDE =
  MIN_CAMERA_ALTITUDE + (MAX_CAMERA_ALTITUDE - MIN_CAMERA_ALTITUDE) * 0.05;

/** Altitude when focusing a selected author (well above arc hide threshold). */
export const AUTHOR_FOCUS_ALTITUDE = Math.max(1.05, ARC_HIDE_ALTITUDE + 0.55);

export function shouldShowArcs(cameraAltitude: number): boolean {
  if (!Number.isFinite(cameraAltitude)) return true;
  return cameraAltitude >= ARC_HIDE_ALTITUDE;
}

/** Shared arc layer settings for country-level and author-level arcs. */
export const ARC_LAYER = {
  altitude: 0.15,
  curveResolution: 8,
  circularResolution: 2,
  dashLength: 0.65,
  dashGap: 0.06,
  dashAnimateTime: 0,
  transitionDuration: 0,
} as const;
