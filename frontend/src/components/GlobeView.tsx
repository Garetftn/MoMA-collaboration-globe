import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeData, GlobeNode, RenderAuthorPoint } from "../types";
import type { RenderArc } from "../utils";
import {
  ARC_LAYER,
  AUTHOR_FOCUS_ALTITUDE,
  GLOBE_RADIUS,
  MAX_CAMERA_ALTITUDE,
  MIN_CAMERA_ALTITUDE,
  shouldShowArcs,
} from "../globe/cameraConfig";
import {
  buildAuthorMap,
  buildColorScale,
  buildNodeMap,
  buildPolygonFeatures,
  debounce,
  findNearestAuthorPoint,
  loadCountryGeoJson,
  pickRadiusKm,
  prepareBaseAuthorPoints,
  prepareSelectedAuthorPoints,
  buildAuthorCollabRangeFromPoints,
  throttle,
  toAuthorCollaborationArcs,
  toRenderArcs,
  withAlpha,
} from "../utils";

interface GlobeViewProps {
  data: GlobeData;
  minWeight: number;
  selectedAuthorId: string | null;
  onCountryHover: (node: GlobeNode | null) => void;
  onCountrySelect: (iso: string | null) => void;
  onAuthorSelect: (authorId: string | null) => void;
}

type PolygonFeature = GeoJSON.Feature & {
  properties: {
    iso_a3?: string;
    artworkCount?: number;
    totalCollaborations?: number;
    capColor?: string;
  };
};

type GlobeHandle = {
  controls: () => {
    minDistance: number;
    maxDistance: number;
    enableDamping: boolean;
    dampingFactor: number;
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
  };
  renderer: () => { setPixelRatio: (n: number) => void };
  pointOfView: (
    pov?: { lat?: number; lng?: number; altitude?: number },
    ms?: number,
  ) => { altitude?: number };
  pointerRaycasterThrottleMs?: (ms?: number) => number;
};

const POLYGON_SIDE_COLOR = "rgba(12, 18, 30, 0.35)";

function readCameraAltitude(globe: GlobeHandle | null): number {
  if (!globe) return 2.5;
  try {
    const altitude = globe.pointOfView()?.altitude;
    return typeof altitude === "number" && Number.isFinite(altitude) ? altitude : 2.5;
  } catch {
    return 2.5;
  }
}

function GlobeViewInner({
  data,
  minWeight,
  selectedAuthorId,
  onCountryHover,
  onCountrySelect,
  onAuthorSelect,
}: GlobeViewProps) {
  const globeRef = useRef<GlobeHandle | null>(null);
  const displayAuthorPointsRef = useRef<RenderAuthorPoint[]>([]);
  const [showArcs, setShowArcs] = useState(true);

  const nodeMap = useMemo(() => buildNodeMap(data.nodes), [data.nodes]);
  const authorMap = useMemo(() => buildAuthorMap(data.authors), [data.authors]);
  const colorScale = useMemo(() => buildColorScale(data), [data]);

  const selectedAuthor = selectedAuthorId ? authorMap.get(selectedAuthorId) ?? null : null;

  const polygons = useMemo(
    () => buildPolygonFeatures(data.countryPolygons, data.countries, colorScale) as PolygonFeature[],
    [data.countryPolygons, data.countries, colorScale],
  );

  const [fallbackPolygons, setFallbackPolygons] = useState<PolygonFeature[]>([]);

  useEffect(() => {
    if (polygons.length > 0) {
      setFallbackPolygons([]);
      return;
    }
    let cancelled = false;
    loadCountryGeoJson(data.countries)
      .then((geo) => {
        if (cancelled) return;
        const features = geo.features.map((feature) => {
          const props = feature.properties as PolygonFeature["properties"];
          const count = props?.artworkCount ?? 0;
          return {
            ...feature,
            properties: {
              ...props,
              capColor: withAlpha(colorScale(count), 0.5),
            },
          } as PolygonFeature;
        });
        setFallbackPolygons(features);
      })
      .catch((err) => {
        console.error("Failed to load fallback country GeoJSON:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [polygons.length, data.countries, colorScale]);

  const activePolygons = polygons.length > 0 ? polygons : fallbackPolygons;

  const authorCollabRange = useMemo(
    () => buildAuthorCollabRangeFromPoints(data.authorPoints),
    [data.authorPoints],
  );

  const baseAuthorPoints = useMemo(
    () => prepareBaseAuthorPoints(data.authorPoints, authorCollabRange),
    [data.authorPoints, authorCollabRange],
  );

  const displayAuthorPoints = useMemo((): RenderAuthorPoint[] => {
    if (selectedAuthor) {
      return prepareSelectedAuthorPoints(baseAuthorPoints, selectedAuthor);
    }
    return baseAuthorPoints;
  }, [selectedAuthor, baseAuthorPoints]);

  displayAuthorPointsRef.current = displayAuthorPoints;

  const filteredEdges = useMemo(
    () => data.edges.filter((e) => e.weight >= minWeight),
    [data.edges, minWeight],
  );

  const maxEdgeWeight = useMemo(
    () => Math.max(...filteredEdges.map((e) => e.weight), 1),
    [filteredEdges],
  );

  const maxAuthorCollabCount = useMemo(
    () => Math.max(...data.authorPoints.map((p) => p.collaborationCount), 1),
    [data.authorPoints],
  );

  const countryArcs = useMemo(
    () => toRenderArcs(filteredEdges, maxEdgeWeight),
    [filteredEdges, maxEdgeWeight],
  );

  const authorArcs = useMemo(
    () => (selectedAuthor ? toAuthorCollaborationArcs(selectedAuthor, maxAuthorCollabCount) : []),
    [selectedAuthor, maxAuthorCollabCount],
  );

  const renderArcs = selectedAuthor
    ? authorArcs
    : showArcs
      ? countryArcs
      : [];

  const collaboratorCountries = useMemo(() => {
    if (!selectedAuthor) return new Set<string>();
    return new Set(selectedAuthor.collaborations.map((c) => c.country));
  }, [selectedAuthor]);

  const syncArcVisibility = useCallback(() => {
    setShowArcs(shouldShowArcs(readCameraAltitude(globeRef.current)));
  }, []);

  const debouncedCountryHover = useMemo(
    () =>
      debounce((iso: string | null) => {
        if (!selectedAuthorId) {
          onCountryHover(iso ? nodeMap.get(iso) ?? null : null);
        }
      }, 120),
    [nodeMap, onCountryHover, selectedAuthorId],
  );

  useEffect(() => {
    if (!selectedAuthor) return;
    const globe = globeRef.current;
    if (!globe) return;
    globe.pointOfView(
      { lat: selectedAuthor.lat, lng: selectedAuthor.lng, altitude: AUTHOR_FOCUS_ALTITUDE },
      800,
    );
  }, [selectedAuthor?.id, selectedAuthor]);

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const controls = globe.controls();
    controls.minDistance = GLOBE_RADIUS * MIN_CAMERA_ALTITUDE;
    controls.maxDistance = GLOBE_RADIUS * MAX_CAMERA_ALTITUDE;
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;

    globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 1.1));
    globe.pointerRaycasterThrottleMs?.(180);
    syncArcVisibility();
  }, [syncArcVisibility]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const onCameraChange = throttle(syncArcVisibility, 150);
    const controls = globe.controls();
    controls.addEventListener("change", onCameraChange);
    return () => controls.removeEventListener("change", onCameraChange);
  }, [activePolygons.length, syncArcVisibility]);

  const pickAuthorAtClick = useCallback(
    (lat: number, lng: number): RenderAuthorPoint | null => {
      const points = displayAuthorPointsRef.current;
      if (!points.length) return null;
      const altitude = readCameraAltitude(globeRef.current);
      return findNearestAuthorPoint(lat, lng, points, pickRadiusKm(altitude));
    },
    [],
  );

  const selectAuthor = useCallback(
    (point: RenderAuthorPoint) => {
      onAuthorSelect(selectedAuthorId === point.id ? null : point.id);
    },
    [onAuthorSelect, selectedAuthorId],
  );

  const handleGlobeClick = useCallback(
    (coords: { lat: number; lng: number }) => {
      const picked = pickAuthorAtClick(coords.lat, coords.lng);
      if (picked) {
        selectAuthor(picked);
      }
    },
    [pickAuthorAtClick, selectAuthor],
  );

  const handlePolygonHover = useCallback(
    (feature: PolygonFeature | null) => {
      debouncedCountryHover(feature?.properties?.iso_a3 ?? null);
    },
    [debouncedCountryHover],
  );

  const handlePolygonClick = useCallback(
    (
      feature: PolygonFeature | null,
      _event: MouseEvent,
      coords: { lat: number; lng: number },
    ) => {
      const picked = pickAuthorAtClick(coords.lat, coords.lng);
      if (picked) {
        selectAuthor(picked);
        return;
      }

      const iso = feature?.properties?.iso_a3 ?? null;
      if (!iso || (feature?.properties?.totalCollaborations ?? 0) === 0) return;
      onCountrySelect(iso);
    },
    [pickAuthorAtClick, selectAuthor, onCountrySelect],
  );

  const polygonCapColor = useCallback(
    (feature: PolygonFeature) => feature.properties?.capColor ?? "rgba(0,0,0,0)",
    [],
  );

  const polygonStrokeColor = useCallback(
    (feature: PolygonFeature) => {
      const iso = feature.properties?.iso_a3 ?? "";
      if (selectedAuthor?.country === iso) {
        return "rgba(255, 220, 80, 0.95)";
      }
      if (collaboratorCountries.has(iso)) {
        return "rgba(180, 220, 255, 0.85)";
      }
      return "rgba(180, 195, 220, 0.28)";
    },
    [selectedAuthor, collaboratorCountries],
  );

  const polygonAltitude = useCallback(() => 0.002, []);

  const arcColor = useCallback((arc: RenderArc) => arc.color, []);

  const arcStroke = useCallback((arc: RenderArc) => arc.stroke, []);

  const arcAltitude = useCallback(() => ARC_LAYER.altitude, []);

  const arcDashLength = useCallback(() => ARC_LAYER.dashLength, []);

  return (
    <Globe
      ref={globeRef}
      onGlobeReady={handleGlobeReady}
      rendererConfig={{
        antialias: false,
        alpha: true,
        powerPreference: "high-performance",
      }}
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-day.jpg"
      backgroundColor="rgba(2, 4, 10, 1)"
      showAtmosphere={false}
      globeCurvatureResolution={2}
      polygonsTransitionDuration={0}
      arcsTransitionDuration={ARC_LAYER.transitionDuration}
      pointsTransitionDuration={0}
      polygonsData={activePolygons}
      polygonGeoJsonGeometry={(d: PolygonFeature) => d.geometry}
      polygonCapColor={polygonCapColor}
      polygonSideColor={() => POLYGON_SIDE_COLOR}
      polygonStrokeColor={polygonStrokeColor}
      polygonAltitude={polygonAltitude}
      polygonCapCurvatureResolution={1}
      onPolygonHover={handlePolygonHover}
      onPolygonClick={handlePolygonClick}
      onGlobeClick={handleGlobeClick}
      pointsData={displayAuthorPoints}
      pointLat="lat"
      pointLng="lng"
      pointColor="color"
      pointRadius="radius"
      pointAltitude={0.018}
      pointResolution={4}
      pointsMerge
      arcsData={renderArcs}
      arcStartLat="startLat"
      arcStartLng="startLng"
      arcEndLat="endLat"
      arcEndLng="endLng"
      arcColor={arcColor}
      arcStroke={arcStroke}
      arcAltitude={arcAltitude}
      arcCurveResolution={ARC_LAYER.curveResolution}
      arcCircularResolution={ARC_LAYER.circularResolution}
      arcDashLength={arcDashLength}
      arcDashGap={ARC_LAYER.dashGap}
      arcDashAnimateTime={ARC_LAYER.dashAnimateTime}
    />
  );
}

export const GlobeView = memo(GlobeViewInner);
