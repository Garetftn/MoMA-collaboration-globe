import { scaleSequential } from "d3-scale";
import { interpolateYlOrRd } from "d3-scale-chromatic";
import type {
  Author,
  AuthorPoint,
  AuthorSearchResult,
  CountryFeatureCollection,
  GlobeData,
  GlobeEdge,
  GlobeNode,
  RenderAuthorPoint,
  SearchIndexEntry,
  WorkMeta,
} from "./types";

export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: never[]) => void>(
  fn: T,
  interval: number,
): (...args: Parameters<T>) => void {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = interval - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = undefined;
        last = Date.now();
        fn(...args);
      }, remaining);
    }
  };
}

export function buildNodeMap(nodes: GlobeNode[]): Map<string, GlobeNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

export function buildAuthorMap(authors: Author[]): Map<string, Author> {
  return new Map(authors.map((a) => [a.id, a]));
}

export function buildEdgeMap(edges: GlobeEdge[]): Map<string, GlobeEdge> {
  return new Map(edges.map((e) => [edgeKey(e.source, e.target), e]));
}

export function edgeKey(source: string, target: string): string {
  return [source, target].sort().join("-");
}

export function authorArcKey(authorId: string, partnerId: string): string {
  return `${authorId}-${partnerId}`;
}

export function buildColorScale(data: GlobeData) {
  const counts = data.nodes
    .filter((n) => n.totalCollaborations > 0)
    .map((n) => n.artworkCount ?? 0)
    .filter((c) => c > 0);
  const min = counts.length ? Math.min(...counts) : (data.meta.artworkCountMin || 1);
  const max = counts.length ? Math.max(...counts) : (data.meta.artworkCountMax || 1);
  return scaleSequential(interpolateYlOrRd).domain([min, Math.max(min, max)]);
}

export function withAlpha(color: string, alpha: number): string {
  const trimmed = color.trim();
  if (trimmed.startsWith("rgba(")) return trimmed;
  if (trimmed.startsWith("rgb(")) {
    const parts = trimmed.slice(4, -1).split(",").map((v) => v.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  }
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    const normalized =
      hex.length === 3
        ? hex.split("").map((c) => c + c).join("")
        : hex.padEnd(6, "0").slice(0, 6);
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  if (trimmed.startsWith("hsl(")) {
    return trimmed.replace("hsl(", "hsla(").replace(")", `, ${alpha})`);
  }
  return trimmed;
}

export function authorCollaborationTotal(author: Author): number {
  return author.collaborations.reduce((sum, collab) => sum + collab.count, 0);
}

export function buildAuthorCollabRangeFromPoints(
  points: AuthorPoint[],
): { min: number; max: number } {
  const totals = points.map((p) => p.collaborationCount ?? 1).filter((count) => count > 0);
  if (!totals.length) return { min: 1, max: 1 };
  return { min: Math.min(...totals), max: Math.max(...totals) };
}

export function pointRadiusForCount(
  count: number,
  range: { min: number; max: number },
): number {
  const { min, max } = range;
  const t = max > min ? (count - min) / (max - min) : 0.5;
  return 0.1 + t * 0.45;
}

export function prepareBaseAuthorPoints(
  points: AuthorPoint[],
  range: { min: number; max: number },
): RenderAuthorPoint[] {
  return points.map((point) => ({
    ...point,
    radius: pointRadiusForCount(point.collaborationCount, range),
    color: "rgba(200, 220, 255, 0.85)",
  }));
}

export function prepareSelectedAuthorPoints(
  basePoints: RenderAuthorPoint[],
  selectedAuthor: Author,
): RenderAuthorPoint[] {
  const collabIds = new Set(selectedAuthor.collaborations.map((c) => c.authorId));
  return basePoints.map((point) => {
    if (point.id === selectedAuthor.id) {
      return { ...point, color: "rgba(255, 220, 80, 1)", radius: point.radius * 1.35 };
    }
    if (collabIds.has(point.id)) {
      return { ...point, color: "rgba(160, 210, 255, 0.95)", radius: point.radius * 1.1 };
    }
    if (point.country === selectedAuthor.country) {
      return { ...point, color: "rgba(140, 170, 210, 0.55)", radius: point.radius * 0.85 };
    }
    return { ...point, color: "rgba(80, 95, 120, 0.25)", radius: point.radius * 0.75 };
  });
}

export function buildPolygonFeatures(
  countryPolygons: CountryFeatureCollection | null,
  countries: Record<string, CountryRecord>,
  colorScale: ReturnType<typeof buildColorScale>,
): CountryFeatureCollection["features"] {
  if (countryPolygons) {
    return countryPolygons.features.map((feature) => {
      const count = feature.properties?.artworkCount ?? 0;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          capColor: withAlpha(colorScale(count), 0.5),
        },
      };
    });
  }

  return [];
}

export function authorPickRadiusForAltitude(altitude: number): number {
  if (!Number.isFinite(altitude)) return 6;
  return Math.max(1.2, Math.min(12, altitude * 4));
}

export function angularDistanceDegrees(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return (2 * Math.asin(Math.sqrt(a)) * 180) / Math.PI;
}

export function pickNearestAuthorPoint(
  points: RenderAuthorPoint[],
  lat: number,
  lng: number,
  maxDistanceDeg: number,
): RenderAuthorPoint | null {
  let nearest: RenderAuthorPoint | null = null;
  let nearestDist = maxDistanceDeg;
  for (const point of points) {
    const dist = angularDistanceDegrees(lat, lng, point.lat, point.lng);
    if (dist <= nearestDist) {
      nearestDist = dist;
      nearest = point;
    }
  }
  return nearest;
}

export function arcAltitudeShowsArcs(altitude: number, hideBelow: number): boolean {
  if (!Number.isFinite(altitude)) return true;
  return altitude >= hideBelow;
}

export function findNearestAuthorPoint(
  lat: number,
  lng: number,
  points: RenderAuthorPoint[],
  maxDistanceKm: number,
): RenderAuthorPoint | null {
  if (!points.length || maxDistanceKm <= 0) return null;

  let best: RenderAuthorPoint | null = null;
  let bestDistance = maxDistanceKm;

  for (const point of points) {
    const distance = haversineDistanceKm(lat, lng, point.lat, point.lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = point;
    }
  }

  return best;
}

export function pickRadiusKm(cameraAltitude: number): number {
  if (!Number.isFinite(cameraAltitude)) return 200;
  return Math.max(35, Math.min(350, cameraAltitude * 110));
}

function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function arcStrokeForWeight(weight: number, maxWeight: number): number {
  const normalizedMax = Math.max(maxWeight, 1);
  return 0.25 + (weight / normalizedMax) * 2.5;
}

export function collaboratorName(
  iso: string,
  nodeMap: Map<string, GlobeNode>,
): string {
  return nodeMap.get(iso)?.country ?? iso;
}

export interface RenderArc {
  key: string;
  source: string;
  target: string;
  weight: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  stroke: number;
}

export function toRenderArcs(edges: GlobeEdge[], maxWeight: number): RenderArc[] {
  return edges.map((edge) => ({
    key: edgeKey(edge.source, edge.target),
    source: edge.source,
    target: edge.target,
    weight: edge.weight,
    startLat: edge.startLat,
    startLng: edge.startLng,
    endLat: edge.endLat,
    endLng: edge.endLng,
    color: edgeColor(edge.source, edge.target, edge.weight, maxWeight),
    stroke: arcStrokeForWeight(edge.weight, maxWeight),
  }));
}

export function toAuthorCollaborationArcs(author: Author, maxWeight: number): RenderArc[] {
  if (!author.collaborations.length) return [];
  const normalizedMax = Math.max(maxWeight, 1);
  return author.collaborations.map((collab) => ({
    key: authorArcKey(author.id, collab.authorId),
    source: author.country,
    target: collab.country,
    weight: collab.count,
    startLat: author.lat,
    startLng: author.lng,
    endLat: collab.lat,
    endLng: collab.lng,
    color: edgeColor(author.id, collab.authorId, collab.count, normalizedMax),
    stroke: arcStrokeForWeight(collab.count, normalizedMax),
  }));
}

export function buildCountryAdjacency(edges: GlobeEdge[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, new Set());
    if (!adj.has(edge.target)) adj.set(edge.target, new Set());
    adj.get(edge.source)!.add(edge.target);
    adj.get(edge.target)!.add(edge.source);
  }
  return adj;
}

export function edgeColor(source: string, target: string, weight: number, maxWeight: number): string {
  const key = edgeKey(source, target);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  const sat = 55 + (weight / maxWeight) * 30;
  const light = 48 + (weight / maxWeight) * 18;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

export function searchAuthors(
  query: string,
  searchIndex: SearchIndexEntry[],
  authorMap: Map<string, Author>,
): AuthorSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const seen = new Set<string>();
  const results: AuthorSearchResult[] = [];

  for (const entry of searchIndex) {
    if (seen.has(entry.authorId)) continue;
    const nameMatch = entry.authorName.toLowerCase().includes(q);
    const bioMatch = entry.bio.toLowerCase().includes(q);
    const countryMatch = entry.countryName.toLowerCase().includes(q);
    if (!nameMatch && !bioMatch && !countryMatch) continue;

    const author = authorMap.get(entry.authorId);
    if (!author) continue;

    seen.add(entry.authorId);
    results.push({
      authorId: entry.authorId,
      author,
      label: `${entry.authorName} · ${entry.countryName}`,
    });
  }

  return results.sort((a, b) => a.author.name.localeCompare(b.author.name));
}

export async function loadGlobeData(): Promise<GlobeData> {
  const [
    nodes,
    edges,
    countries,
    authorSummaries,
    authorPoints,
    meta,
    searchIndex,
    countryPolygons,
  ] = await Promise.all([
    fetch("./data/nodes.json").then((r) => r.json()),
    fetch("./data/edges.json").then((r) => r.json()),
    fetch("./data/countries.json").then((r) => r.json()),
    fetch("./data/author_summaries.json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetch("./data/author_points.json").then((r) => r.json()),
    fetch("./data/meta.json").then((r) => r.json()),
    fetch("./data/search_index.json")
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
    fetch("./data/country_polygons.json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  let authors: Author[] = authorSummaries ?? [];
  authors = authors.map((author: Author) => ({ ...author, works: [] }));

  return {
    nodes,
    edges,
    countries,
    authors,
    authorPoints,
    countryPolygons,
    meta,
    searchIndex,
  };
}

let worksIndexCache: Record<string, WorkMeta> | null = null;

async function getWorksIndex(): Promise<Record<string, WorkMeta>> {
  if (!worksIndexCache) {
    worksIndexCache = await fetch("./data/works.json").then((r) => r.json());
  }
  return worksIndexCache;
}

export async function hydrateAuthorWorks(author: Author): Promise<Author> {
  if (author.works.length > 0) return author;
  const ids = author.workIds ?? [];
  if (!ids.length) return { ...author, works: [] };

  const index = await getWorksIndex();
  const works = ids
    .map((id) => index[String(id)])
    .filter((work): work is WorkMeta => Boolean(work));

  return { ...author, works };
}

export async function loadCountryGeoJson(
  countries: Record<string, { artistCount: number; artworkCount: number; totalCollaborations: number; name: string }>,
): Promise<GeoJSON.FeatureCollection> {
  const response = await fetch(
    "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json",
  );
  const geo = (await response.json()) as GeoJSON.FeatureCollection;

  const features = geo.features
    .map((feature) => {
      const props = feature.properties ?? {};
      const iso =
        (feature.id as string) ||
        (props.ISO_A3 as string) ||
        (props.iso_a3 as string) ||
        "";
      const record = countries[iso];
      return {
        ...feature,
        properties: {
          ...props,
          iso_a3: iso,
          artistCount: record?.artistCount ?? 0,
          artworkCount: record?.artworkCount ?? 0,
          totalCollaborations: record?.totalCollaborations ?? 0,
          displayName: record?.name ?? (props.ADMIN as string) ?? (props.name as string) ?? iso,
        },
      };
    })
    .filter((f) => {
      const iso = f.properties.iso_a3 as string;
      const record = countries[iso];
      return record && record.totalCollaborations > 0;
    });

  return { type: "FeatureCollection", features };
}
