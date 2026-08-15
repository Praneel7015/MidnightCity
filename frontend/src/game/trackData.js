/** Closed-loop circuit data. Pure JS so dry-run can import it without Three.js. */
export const ROAD_HALF_WIDTH = 10;
export const COLLIDER_RADIUS = 1.05;
export const RAIL_HEIGHT = 0.7;
export const TRACK_SEGMENTS = 240;

/** t range along the closed spline where a wide tunnel is drawn (visual only). */
export const TUNNEL_T = [0.63, 0.73];

function generateWaypoints() {
  const pts = [];
  const N = 56;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rx = 640 + 90 * Math.sin(3 * a) + 40 * Math.sin(5 * a);
    const rz = 480 + 70 * Math.cos(2 * a) + 30 * Math.sin(4 * a);
    const x = Math.cos(a) * rx;
    const z = Math.sin(a) * rz;
    // Keep the whole circuit above the city floor so downhill never punches
    // through the ground plane (that read as a black box behind the camera).
    const y = 6.4 + 3.5 * Math.sin(2 * a) + 1.45 * Math.sin(5 * a);
    pts.push([x, y, z]);
  }
  return pts;
}

export const WAYPOINTS = generateWaypoints();

export function isTrackClosed(waypoints = WAYPOINTS) {
  if (!Array.isArray(waypoints) || waypoints.length < 40) return false;
  for (const p of waypoints) {
    if (!Array.isArray(p) || p.length < 3) return false;
    if (!p.every((n) => Number.isFinite(n))) return false;
  }
  return true;
}

export function checkpointCount() {
  return 8;
}
