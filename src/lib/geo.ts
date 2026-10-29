import { MAP_SCALE, MAP_TX, MAP_TY } from "./geo-data";
import { ORIGINS, PORTS } from "./api/reference";
import type { OriginRegion, PortCode } from "./api/types";

export { MAP_W, MAP_H, LAND_PATH, GRATICULE_PATH } from "./geo-data";

const RAD = Math.PI / 180;

/** Mercator projection matching the generated land path. */
export function project(lon: number, lat: number): [number, number] {
  const x = MAP_SCALE * lon * RAD + MAP_TX;
  const y = MAP_TY - MAP_SCALE * Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
  return [x, y];
}

/** Schematic sea-lane waypoints (lon, lat). Indicative only, not navigational. */
export const LANE_WAYPOINTS: Record<OriginRegion, [number, number][]> = {
  AUS_QLD: [
    [149.3, -21.28],
    [151.2, -17.5],
    [146.5, -12.2],
    [142.3, -10.4],
    [136, -9.6],
    [127, -10.9],
    [117, -11.6],
    [106, -9.6],
    [96, -3.5],
    [89.5, 6.5],
    [87.4, 17.5],
  ],
  AUS_NSW: [
    [151.78, -32.92],
    [151.2, -36.5],
    [146.5, -40.2],
    [140, -38.6],
    [130, -36.2],
    [118, -36.2],
    [113.5, -32],
    [106, -21],
    [96, -6],
    [88.6, 7.5],
    [85.4, 16.2],
  ],
  AUS_WA: [
    [118.58, -20.31],
    [114.5, -17],
    [104.5, -9.4],
    [94, -0.5],
    [89.5, 9],
    [87.6, 18.6],
  ],
  IDN_KAL: [
    [117.4, -0.9],
    [117.9, -2.7],
    [114, -5.2],
    [108.5, -5.6],
    [105.6, -6.4],
    [102, -5],
    [96.5, 1.5],
    [90.5, 9.5],
    [87.2, 17.2],
  ],
};

/** Final approach from the shared Bay of Bengal fairway into each port. */
export function laneTo(origin: OriginRegion, port: PortCode): [number, number][] {
  const p = PORTS.find((x) => x.code === port)!;
  return [...LANE_WAYPOINTS[origin], [p.lon, p.lat]];
}

/** Catmull-Rom → cubic bezier smooth path through projected points. */
export function smoothPath(points: [number, number][]): string {
  const pts = points.map(([lon, lat]) => project(lon, lat));
  const at = (i: number) => pts[Math.min(pts.length - 1, Math.max(0, i))]!;
  if (pts.length < 2) return "";
  let d = `M${at(0)[0].toFixed(1)},${at(0)[1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export const originPoint = (id: OriginRegion) => {
  const o = ORIGINS.find((x) => x.id === id)!;
  return project(o.lon, o.lat);
};
export const portPoint = (code: PortCode) => {
  const p = PORTS.find((x) => x.code === code)!;
  return project(p.lon, p.lat);
};
