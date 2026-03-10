import type { Fountain } from "../types/fountain";

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export type ClusterItem =
  | { type: "single"; fountain: Fountain }
  | { type: "cluster"; latitude: number; longitude: number; count: number; fountains: Fountain[]; isVerified: boolean };

/**
 * Filter fountains to those inside the visible map bounds (with small padding).
 */
function fountainsInRegion(fountains: Fountain[], region: MapRegion): Fountain[] {
  const halfLat = region.latitudeDelta / 2;
  const halfLon = region.longitudeDelta / 2;
  const south = region.latitude - halfLat;
  const north = region.latitude + halfLat;
  const west = region.longitude - halfLon;
  const east = region.longitude + halfLon;
  return fountains.filter(
    (f) =>
      f.latitude >= south &&
      f.latitude <= north &&
      f.longitude >= west &&
      f.longitude <= east,
  );
}

/** Max markers to render so the native map doesn't crash when zooming. */
const MAX_MARKERS = 60;

/**
 * Group fountains into single markers or cluster markers by zoom level.
 * Zoomed out -> coarse grid (e.g. "250" for Iceland). Zoomed in -> individual pins.
 * Never returns more than MAX_MARKERS items to avoid native crashes.
 */
export function clusterFountains(
  fountains: Fountain[],
  region: MapRegion,
): ClusterItem[] {
  const inView = fountainsInRegion(fountains, region);
  if (inView.length === 0) return [];

  const latDelta = region.latitudeDelta;
  const lonDelta = region.longitudeDelta;

  // Only bunch when very much zoomed out (~3x later than before)
  const zoomedInThreshold = 1.14;
  if (
    latDelta < zoomedInThreshold &&
    lonDelta < zoomedInThreshold &&
    inView.length <= MAX_MARKERS
  ) {
    return inView.map((fountain) => ({ type: "single" as const, fountain }));
  }

  // Grid: cap cells so we never exceed MAX_MARKERS
  const rawCellsPerAxis = Math.max(4, Math.min(30, 0.4 / Math.max(latDelta, lonDelta)));
  const cellsPerAxis = Math.min(Math.floor(rawCellsPerAxis), Math.floor(Math.sqrt(MAX_MARKERS)));
  const cellLat = latDelta / cellsPerAxis;
  const cellLon = lonDelta / cellsPerAxis;

  const south = region.latitude - latDelta / 2;
  const west = region.longitude - lonDelta / 2;

  const buckets = new Map<string, Fountain[]>();
  for (const f of inView) {
    const gi = Math.min(Math.floor((f.latitude - south) / cellLat), cellsPerAxis - 1);
    const gj = Math.min(Math.floor((f.longitude - west) / cellLon), cellsPerAxis - 1);
    const key = `${gi},${gj}`;
    const list = buckets.get(key) ?? [];
    list.push(f);
    buckets.set(key, list);
  }

  const result: ClusterItem[] = [];
  buckets.forEach((list) => {
    if (list.length === 1) {
      result.push({ type: "single", fountain: list[0] });
    } else {
      const lat = list.reduce((s, f) => s + f.latitude, 0) / list.length;
      const lon = list.reduce((s, f) => s + f.longitude, 0) / list.length;
      const verifiedCount = list.reduce((n, f) => n + (f.useAdminPin ? 1 : 0), 0);
      result.push({ type: "cluster", latitude: lat, longitude: lon, count: list.length, fountains: list, isVerified: verifiedCount >= list.length / 2 });
    }
  });

  if (result.length <= MAX_MARKERS) return result;

  // Too many items: merge into fewer clusters by using a coarser grid
  const mergeCells = Math.max(2, Math.floor(Math.sqrt(MAX_MARKERS)));
  const mergeCellLat = latDelta / mergeCells;
  const mergeCellLon = lonDelta / mergeCells;
  const mergeBuckets = new Map<string, Fountain[]>();
  for (const f of inView) {
    const gi = Math.min(Math.floor((f.latitude - south) / mergeCellLat), mergeCells - 1);
    const gj = Math.min(Math.floor((f.longitude - west) / mergeCellLon), mergeCells - 1);
    const key = `${gi},${gj}`;
    const list = mergeBuckets.get(key) ?? [];
    list.push(f);
    mergeBuckets.set(key, list);
  }
  const merged: ClusterItem[] = [];
  mergeBuckets.forEach((list) => {
    if (list.length === 1) {
      merged.push({ type: "single", fountain: list[0] });
    } else {
      const lat = list.reduce((s, f) => s + f.latitude, 0) / list.length;
      const lon = list.reduce((s, f) => s + f.longitude, 0) / list.length;
      const verifiedCount = list.reduce((n, f) => n + (f.useAdminPin ? 1 : 0), 0);
      merged.push({ type: "cluster", latitude: lat, longitude: lon, count: list.length, fountains: list, isVerified: verifiedCount >= list.length / 2 });
    }
  });
  return merged;
}
