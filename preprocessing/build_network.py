#!/usr/bin/env python3
"""Build author-centric collaboration datasets for the MoMA globe."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from itertools import combinations
from pathlib import Path

import pandas as pd

from artist_registry import load_artist_registry
from country_map import NATIONALITY_TO_ISO, extract_birthplace, get_centroid, normalize_label
from geo_utils import assign_country_positions, export_country_polygon_features, load_country_polygons

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "Artworks.csv"
OUT_DIR = ROOT / "data" / "processed"
FRONTEND_DATA = ROOT / "frontend" / "public" / "data"

MAX_WORKS_PER_AUTHOR = 40


def labels_to_iso(labels: list[str]) -> tuple[list[str], list[str]]:
    iso_codes: list[str] = []
    unmapped: list[str] = []
    for label in labels:
        mapped = normalize_label(label)
        if mapped:
            for iso, _name in mapped:
                if iso not in iso_codes:
                    iso_codes.append(iso)
        else:
            unmapped.append(label)
    return iso_codes, unmapped


def labels_from_block(block: str) -> list[str]:
    labels: list[str] = []
    part = re.split(r",|\sborn\s", block)[0].strip()
    for sub in re.split(r"\s+and\s+", part):
        sub = sub.strip()
        if sub and not sub[0].isdigit():
            labels.append(sub)
    for _iso, name in extract_birthplace(block):
        labels.append(name)
    return labels


def nationality_blocks(artist_bio: str | float) -> list[str]:
    if pd.isna(artist_bio):
        return []
    blocks = re.findall(r"\(([^)]+)\)", str(artist_bio))
    result: list[str] = []
    for block in blocks:
        if re.match(r"^\d", block) or block.strip().lower() in ("male", "female"):
            continue
        if "," not in block and "born" not in block.lower():
            continue
        result.append(block)
    return result


def parse_year(date_val: str | float) -> int | None:
    if pd.isna(date_val):
        return None
    match = re.search(r"(\d{4})", str(date_val))
    return int(match.group(1)) if match else None


def iso_display_name(iso: str) -> str:
    for code, name in NATIONALITY_TO_ISO.values():
        if code == iso:
            return name
    return iso


def split_field(value: str | float) -> list[str]:
    if pd.isna(value):
        return []
    return [part.strip() for part in str(value).split(",") if part.strip()]


def parse_artist_fallback_from_row(row: pd.Series, index: int, cid: str) -> dict:
    """Fallback when ConstituentID is missing from Artists.csv (rare)."""
    names = split_field(row["Artist"])
    blocks = nationality_blocks(row["ArtistBio"])
    name = names[index] if index < len(names) else cid
    block = blocks[index] if index < len(blocks) else ""
    bio = f"({block})" if block else ""
    iso_codes, _ = labels_to_iso(labels_from_block(block)) if block else ([], [])
    return {
        "id": cid,
        "name": name,
        "bio": bio,
        "country": iso_codes[0] if iso_codes else None,
    }


def parse_artists_from_row(row: pd.Series, registry: dict[str, dict]) -> list[dict]:
    cids = split_field(row["ConstituentID"])
    if not cids:
        return []

    artists: list[dict] = []
    for index, cid in enumerate(cids):
        if cid in registry:
            artists.append(dict(registry[cid]))
        else:
            artists.append(parse_artist_fallback_from_row(row, index, cid))
    return artists


def build_network() -> None:
    print(f"Loading artist registry from Artists.csv...")
    registry = load_artist_registry()
    print(f"Loaded {len(registry):,} artists")

    print(f"Loading {CSV_PATH}...")
    raw = pd.read_csv(CSV_PATH, low_memory=False)

    unmapped_counter: Counter[str] = Counter()
    authors: dict[str, dict] = {}
    author_by_country: dict[str, set[str]] = defaultdict(set)
    author_pair_counts: Counter[tuple[str, str]] = Counter()
    country_pair_counts: Counter[tuple[str, str]] = Counter()
    cross_country_work_count = 0

    for _, row in raw.iterrows():
        row_artists = parse_artists_from_row(row, registry)
        for artist in row_artists:
            if artist["country"]:
                continue
            bio_inner = artist["bio"].strip("()")
            for label in labels_from_block(bio_inner):
                _, unmapped = labels_to_iso([label])
                unmapped_counter.update(unmapped)

        countries_in_work = {a["country"] for a in row_artists if a["country"]}
        is_cross_country = len(countries_in_work) >= 2 and len(row_artists) >= 2

        object_id = int(row["ObjectID"])
        work_meta = {
            "workId": object_id,
            "title": str(row["Title"]) if pd.notna(row["Title"]) else "",
            "year": parse_year(row["Date"]),
            "date": str(row["Date"]) if pd.notna(row["Date"]) else "",
            "thumbnail": (
                str(row["ImageURL"])
                if pd.notna(row["ImageURL"]) and str(row["ImageURL"]).strip()
                else ""
            ),
            "url": str(row["URL"]) if pd.notna(row["URL"]) else "",
        }

        seen_work_for_author: set[str] = set()
        for artist in row_artists:
            aid = artist["id"]
            if aid not in authors:
                authors[aid] = {
                    "id": aid,
                    "name": artist["name"],
                    "bio": artist["bio"],
                    "country": artist["country"],
                    "countryName": iso_display_name(artist["country"]) if artist["country"] else "",
                    "works": [],
                    "workIds": set(),
                    "collaborators": Counter(),
                }
            elif not authors[aid]["country"] and artist["country"]:
                authors[aid]["country"] = artist["country"]
                authors[aid]["countryName"] = iso_display_name(artist["country"])

            if artist["country"]:
                author_by_country[artist["country"]].add(aid)

            if aid not in seen_work_for_author and aid not in authors[aid]["workIds"]:
                authors[aid]["workIds"].add(object_id)
                if len(authors[aid]["works"]) < MAX_WORKS_PER_AUTHOR:
                    authors[aid]["works"].append(work_meta)
            seen_work_for_author.add(aid)

        if is_cross_country:
            cross_country_work_count += 1
            country_list = sorted(countries_in_work)
            for a, b in combinations(country_list, 2):
                country_pair_counts[(a, b)] += 1

            for a, b in combinations(row_artists, 2):
                if not a["country"] or not b["country"]:
                    continue
                if a["country"] == b["country"]:
                    continue
                pair = tuple(sorted([a["id"], b["id"]]))
                author_pair_counts[pair] += 1
                authors[a["id"]]["collaborators"][b["id"]] += 1
                authors[b["id"]]["collaborators"][a["id"]] += 1

    collab_author_ids = {
        aid
        for aid, data in authors.items()
        if data["collaborators"] and data["country"]
    }
    print(f"Cross-country multi-artist works: {cross_country_work_count}")
    print(f"Collaboration authors: {len(collab_author_ids)}")

    print("Loading country polygons for author placement...")
    polygons = load_country_polygons()
    author_ids_by_country: dict[str, list[str]] = defaultdict(list)
    for aid in collab_author_ids:
        iso = authors[aid]["country"]
        author_ids_by_country[iso].append(aid)

    positions = assign_country_positions(author_ids_by_country, polygons)

    author_points = []
    author_records = []
    author_map: dict[str, dict] = {}

    for aid in sorted(collab_author_ids):
        data = authors[aid]
        registry_artist = registry.get(aid)
        if registry_artist:
            data["name"] = registry_artist["name"]
            data["bio"] = registry_artist["bio"]
            if registry_artist["country"]:
                data["country"] = registry_artist["country"]
                data["countryName"] = iso_display_name(registry_artist["country"])

        iso = data["country"]
        lat, lng = positions.get(aid, get_centroid(iso))

        top_collabs = []
        for partner_id, count in data["collaborators"].most_common(3):
            partner = authors.get(partner_id)
            if not partner or not partner["country"]:
                continue
            partner_info = registry.get(partner_id, partner)
            plat, plng = positions.get(partner_id, get_centroid(partner["country"]))
            top_collabs.append(
                {
                    "authorId": partner_id,
                    "authorName": partner_info["name"],
                    "country": partner["country"],
                    "countryName": iso_display_name(partner["country"]),
                    "count": count,
                    "lat": plat,
                    "lng": plng,
                }
            )

        all_collabs = []
        for partner_id, count in data["collaborators"].items():
            partner = authors.get(partner_id)
            if not partner or not partner["country"]:
                continue
            partner_info = registry.get(partner_id, partner)
            plat, plng = positions.get(partner_id, get_centroid(partner["country"]))
            all_collabs.append(
                {
                    "authorId": partner_id,
                    "authorName": partner_info["name"],
                    "country": partner["country"],
                    "countryName": iso_display_name(partner["country"]),
                    "count": count,
                    "lat": plat,
                    "lng": plng,
                }
            )

        collab_total = sum(c["count"] for c in all_collabs)
        record = {
            "id": aid,
            "name": data["name"],
            "bio": data["bio"],
            "country": iso,
            "countryName": data["countryName"],
            "lat": lat,
            "lng": lng,
            "works": data["works"],
            "workCount": len(data["workIds"]),
            "topCollaborations": top_collabs,
            "collaborations": sorted(all_collabs, key=lambda c: -c["count"]),
        }
        author_records.append(record)
        author_map[aid] = record

        author_points.append(
            {
                "id": aid,
                "name": data["name"],
                "country": iso,
                "lat": lat,
                "lng": lng,
                "collaborationCount": collab_total,
            }
        )

    collaborator_counts: dict[str, Counter[str]] = defaultdict(Counter)
    for (a, b), w in country_pair_counts.items():
        collaborator_counts[a][b] += w
        collaborator_counts[b][a] += w

    artworks_by_country: dict[str, set[int]] = defaultdict(set)
    for record in author_records:
        for work in record["works"]:
            artworks_by_country[record["country"]].add(work["workId"])

    all_countries: set[str] = set(author_by_country.keys())
    for (a, b), _ in country_pair_counts.items():
        all_countries.add(a)
        all_countries.add(b)

    nodes = []
    countries_map: dict[str, dict] = {}
    for iso in sorted(all_countries):
        lat, lng = get_centroid(iso)
        display = iso_display_name(iso)
        top_collab = [
            {"iso": partner, "name": iso_display_name(partner), "count": count}
            for partner, count in collaborator_counts[iso].most_common(3)
        ]
        total_collab = sum(collaborator_counts[iso].values())
        artist_count = len([a for a in collab_author_ids if authors[a]["country"] == iso])
        artwork_count = len(artworks_by_country.get(iso, set()))

        node = {
            "id": iso,
            "country": display,
            "artistCount": artist_count,
            "artworkCount": artwork_count,
            "lat": lat,
            "lng": lng,
            "topCollaborators": top_collab,
            "totalCollaborations": total_collab,
        }
        nodes.append(node)
        countries_map[iso] = {
            "iso": iso,
            "name": display,
            "artistCount": artist_count,
            "artworkCount": artwork_count,
            "totalCollaborations": total_collab,
        }

    edges = []
    for (source, target), weight in sorted(country_pair_counts.items(), key=lambda x: -x[1]):
        s_lat, s_lng = get_centroid(source)
        t_lat, t_lng = get_centroid(target)
        edges.append(
            {
                "source": source,
                "target": target,
                "sourceName": countries_map[source]["name"],
                "targetName": countries_map[target]["name"],
                "weight": weight,
                "startLat": s_lat,
                "startLng": s_lng,
                "endLat": t_lat,
                "endLng": t_lng,
            }
        )

    author_summaries = [
        {key: value for key, value in record.items() if key != "works"}
        for record in author_records
    ]

    country_polygon_features = export_country_polygon_features(countries_map)

    search_index = [
        {
            "authorId": record["id"],
            "authorName": record["name"],
            "bio": record["bio"],
            "country": record["country"],
            "countryName": record["countryName"],
        }
        for record in author_records
    ]

    artwork_counts = [n["artworkCount"] for n in nodes if n["artworkCount"] > 0]
    artist_counts = [n["artistCount"] for n in nodes if n["artistCount"] > 0]

    meta = {
        "builtAt": datetime.now(timezone.utc).isoformat(),
        "crossCountryWorks": cross_country_work_count,
        "authorCount": len(author_records),
        "nodeCount": len(nodes),
        "edgeCount": len(edges),
        "artistCountMin": min(artist_counts) if artist_counts else 0,
        "artistCountMax": max(artist_counts) if artist_counts else 0,
        "artworkCountMin": min(artwork_counts) if artwork_counts else 0,
        "artworkCountMax": max(artwork_counts) if artwork_counts else 0,
        "defaultMinWeight": 2,
    }

    unmapped_report = [
        {"label": label, "count": count}
        for label, count in unmapped_counter.most_common()
    ]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    FRONTEND_DATA.mkdir(parents=True, exist_ok=True)

    outputs = {
        "nodes.json": nodes,
        "edges.json": edges,
        "countries.json": countries_map,
        "authors.json": author_records,
        "author_summaries.json": author_summaries,
        "author_points.json": author_points,
        "country_polygons.json": country_polygon_features,
        "meta.json": meta,
        "search_index.json": search_index,
        "unmapped_countries.json": unmapped_report,
    }

    for filename, data in outputs.items():
        for target_dir in (OUT_DIR, FRONTEND_DATA):
            path = target_dir / filename
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"Wrote {path}")

    print(
        f"Countries: {len(nodes)}, Country edges: {len(edges)}, "
        f"Authors: {len(author_records)}"
    )


if __name__ == "__main__":
    build_network()
