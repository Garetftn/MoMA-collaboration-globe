"""GeoJSON helpers and even point scattering inside country polygons."""

from __future__ import annotations

import json
import math
import urllib.request
from collections import defaultdict

from shapely.geometry import MultiPolygon, Point, shape
from shapely.ops import unary_union

GEOJSON_URL = "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json"


def load_country_polygons() -> dict[str, object]:
    with urllib.request.urlopen(GEOJSON_URL, timeout=60) as resp:
        geo = json.load(resp)

    polygons: dict[str, object] = {}
    for feature in geo["features"]:
        iso = feature.get("id")
        if not iso:
            continue
        geom = shape(feature["geometry"])
        if geom.is_empty:
            continue
        polygons[iso] = geom
    return polygons


def _grid_points(polygon, count: int) -> list[tuple[float, float]]:
    """Return evenly spaced (lat, lng) points inside polygon."""
    if count <= 0:
        return []

    minx, miny, maxx, maxy = polygon.bounds
    if minx == maxx or miny == maxy:
        centroid = polygon.centroid
        return [(centroid.y, centroid.x)]

    side = max(2, math.ceil(math.sqrt(count * 3)))
    xs = [minx + (maxx - minx) * (i + 0.5) / side for i in range(side)]
    ys = [miny + (maxy - miny) * (j + 0.5) / side for j in range(side)]

    candidates: list[tuple[float, float]] = []
    for x in xs:
        for y in ys:
            if polygon.contains(Point(x, y)):
                candidates.append((y, x))

    if not candidates:
        centroid = polygon.centroid
        return _jitter_around(centroid.y, centroid.x, count)

    if len(candidates) >= count:
        step = len(candidates) / count
        return [candidates[int(i * step)] for i in range(count)]

    base = candidates[:]
    while len(base) < count:
        base.extend(candidates)
    return base[:count]


def _jitter_around(lat: float, lng: float, count: int) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for i in range(count):
        angle = (2 * math.pi * i) / max(count, 1)
        r = 0.35 * math.sqrt(i + 1)
        points.append((lat + r * math.sin(angle), lng + r * math.cos(angle)))
    return points


def assign_country_positions(
    author_ids_by_country: dict[str, list[str]],
    polygons: dict[str, object],
) -> dict[str, tuple[float, float]]:
    positions: dict[str, tuple[float, float]] = {}

    for iso, author_ids in author_ids_by_country.items():
        polygon = polygons.get(iso)
        if polygon is None:
            continue

        if isinstance(polygon, MultiPolygon):
            polygon = max(polygon.geoms, key=lambda g: g.area)

        coords = _grid_points(polygon, len(author_ids))
        for author_id, (lat, lng) in zip(sorted(author_ids), coords, strict=False):
            positions[author_id] = (lat, lng)

    return positions


def export_country_polygon_features(
    countries_map: dict[str, dict],
) -> dict:
    """Export filtered country GeoJSON for the frontend globe (avoids runtime fetch)."""
    import urllib.request

    with urllib.request.urlopen(GEOJSON_URL, timeout=60) as resp:
        geo = json.load(resp)

    features = []
    for feature in geo.get("features", []):
        iso = feature.get("id")
        if not iso or iso not in countries_map:
            continue
        record = countries_map[iso]
        features.append(
            {
                "type": "Feature",
                "id": iso,
                "properties": {
                    "iso_a3": iso,
                    "artistCount": record["artistCount"],
                    "artworkCount": record["artworkCount"],
                    "totalCollaborations": record["totalCollaborations"],
                    "displayName": record["name"],
                },
                "geometry": feature["geometry"],
            }
        )

    return {"type": "FeatureCollection", "features": features}
