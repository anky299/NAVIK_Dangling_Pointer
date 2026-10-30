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

/**
 * Schematic sea-lane waypoints (lon, lat).
 * Independent, scattered maritime shipping corridors connecting separate load ports to destination terminals.
 */
export const LANE_WAYPOINTS: Record<OriginRegion, [number, number][]> = {
  AUS_QLD: [
    [149.3, -21.28], // Hay Point, Queensland
    [151.2, -17.5],  // Coral Sea fairway
    [146.5, -12.2],  // Great Barrier passage
    [142.3, -10.4],  // Torres Strait
    [136.0, -9.6],   // Arafura Sea
    [127.0, -10.9],  // Timor Sea
    [117.0, -11.6],  // South of Lombok
    [106.0, -9.6],   // South of Java
    [96.0, -3.5],    // Equatorial Indian Ocean
    [89.5, 6.5],     // Bay of Bengal southern entry
    [87.4, 17.5],    // Approach to East Coast India
  ],
  AUS_NSW: [
    [151.78, -32.92], // Newcastle, NSW
    [151.2, -36.5],   // Southern NSW offshore
    [146.5, -39.8],   // Bass Strait passage
    [140.0, -38.5],   // Great Australian Bight entry
    [130.0, -36.2],   // Central Bight
    [118.0, -36.0],   // Western Bight
    [113.5, -32.5],   // Off Cape Leeuwin
    [106.0, -21.0],   // Southeast Indian Ocean trade corridor
    [96.0, -6.0],     // Central Indian Ocean
    [88.6, 7.5],      // South of Sri Lanka / Bay of Bengal entry
    [85.4, 16.2],     // Approach to Andhra coast (Gangavaram / Vizag)
  ],
  AUS_WA: [
    [118.58, -20.31], // Port Hedland, WA
    [114.5, -17.0],   // Northwest Shelf offshore
    [104.5, -9.4],    // South of Sunda
    [94.0, -0.5],     // Equatorial Indian Ocean
    [89.5, 9.0],      // Bay of Bengal open fairway
    [87.6, 18.6],     // Approach to Odisha (Dhamra)
  ],
  IDN_KAL: [
    [117.4, -0.9],    // Balikpapan / East Kalimantan
    [117.9, -2.7],    // Makassar Strait south
    [114.0, -5.2],    // Java Sea fairway
    [108.5, -5.6],    // Bangka-Belitung passage
    [105.6, -6.4],    // Sunda Strait
    [102.0, -5.0],    // Southwest Sumatra offshore
    [96.5, 1.5],      // Northern Sumatra passage
    [90.5, 9.5],      // Bay of Bengal entry
    [87.8, 19.5],     // Sandheads approach (Haldia)
  ],
};

/** Final approach into each port along the independent route. */
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
