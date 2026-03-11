import type { Fountain } from "../types/fountain";

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export type ClusterItem =
  | { type: "single"; fountain: Fountain; key: string }
  | {
      type: "cluster";
      key: string;
      latitude: number;
      longitude: number;
      count: number;
      isVerified: boolean;
    };

const MAX_MARKERS = 100;
const PADDING = 1.2; // include points slightly outside visible area to reduce edge flicker

/**
 * Returns fountains whose coordinates fall inside the region's bounding box.
 */
function getVisibleFountains(fountains: Fountain[], region: MapRegion): Fountain[] {
  const halfLat = (region.latitudeDelta * PADDING) / 2;
  const halfLon = (region.longitudeDelta * PADDING) / 2;
  const minLat = region.latitude - halfLat;
  const maxLat = region.latitude + halfLat;
  const minLon = region.longitude - halfLon;
  const maxLon = region.longitude + halfLon;
  const out: Fountain[] = [];
  for (let i = 0; i < fountains.length; i++) {
    const f = fountains[i];
    if (
      Number.isFinite(f.latitude) &&
      Number.isFinite(f.longitude) &&
      f.latitude >= minLat &&
      f.latitude <= maxLat &&
      f.longitude >= minLon &&
      f.longitude <= maxLon
    ) {
      out.push(f);
    }
  }
  return out;
}

/**
 * 1. Filter fountains to visible bbox only.
 * 2. If zoomed in (small deltas): return singles only.
 * 3. If zoomed out: grid the visible fountains and return clusters + singles.
 * All items have a stable `key` for React.
 */
export function getClusterItems(fountains: Fountain[], region: MapRegion): ClusterItem[] {
  if (!Array.isArray(fountains) || fountains.length === 0) return [];

  const visible = getVisibleFountains(fountains, region);
  if (visible.length === 0) return [];

  const spanLat = Math.max(region.latitudeDelta, 0.0001);
  const spanLon = Math.max(region.longitudeDelta, 0.0001);

  // Only skip clustering when very zoomed in (tiny area). Default map view uses ~0.02 deltas.
  const zoomedIn = spanLat <= 0.008 && spanLon <= 0.008;
  if (zoomedIn) {
    return visible.slice(0, MAX_MARKERS).map((fountain) => ({
      type: "single" as const,
      fountain,
      key: `single-${fountain.id}`,
    }));
  }

  // Grid clustering: coarser grid = fewer, larger cells = more clusters
  const gridSize = 8;
  const cellLat = spanLat / gridSize;
  const cellLon = spanLon / gridSize;
  const grid = new Map<string, Fountain[]>();

  for (let i = 0; i < visible.length; i++) {
    const f = visible[i];
    const ci = Math.floor((f.latitude - (region.latitude - spanLat / 2)) / cellLat);
    const cj = Math.floor((f.longitude - (region.longitude - spanLon / 2)) / cellLon);
    const cellKey = `${ci}:${cj}`;
    const bucket = grid.get(cellKey);
    if (bucket) bucket.push(f);
    else grid.set(cellKey, [f]);
  }

  const clusters: ClusterItem[] = [];
  const singles: ClusterItem[] = [];
  for (const [cellKey, bucket] of grid.entries()) {
    if (bucket.length === 1) {
      singles.push({
        type: "single",
        fountain: bucket[0],
        key: `single-${bucket[0].id}`,
      });
      continue;
    }
    let sumLat = 0;
    let sumLon = 0;
    let verified = 0;
    for (let i = 0; i < bucket.length; i++) {
      const f = bucket[i];
      sumLat += f.latitude;
      sumLon += f.longitude;
      if (f.useAdminPin) verified += 1;
    }
    clusters.push({
      type: "cluster",
      key: `cluster-${cellKey}`,
      latitude: sumLat / bucket.length,
      longitude: sumLon / bucket.length,
      count: bucket.length,
      isVerified: verified >= bucket.length / 2,
    });
  }
  const combined = [...clusters, ...singles];
  return combined.slice(0, MAX_MARKERS);
}
