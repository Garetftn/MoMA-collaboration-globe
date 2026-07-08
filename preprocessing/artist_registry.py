"""Load canonical artist metadata from Artists.csv."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from country_map import normalize_label

ROOT = Path(__file__).resolve().parent.parent
ARTISTS_CSV_PATH = ROOT / "Artists.csv"


def format_artist_bio(bio_text: str) -> str:
    text = bio_text.strip()
    if not text:
        return ""
    if text.startswith("(") and text.endswith(")"):
        return text
    return f"({text})"


def country_from_artist_row(row: pd.Series) -> str | None:
    nationality = row.get("Nationality")
    if pd.notna(nationality):
        mapped = normalize_label(str(nationality).strip())
        if mapped:
            return mapped[0][0]

    bio_text = str(row["ArtistBio"]).strip() if pd.notna(row["ArtistBio"]) else ""
    if bio_text:
        part = bio_text.split(",")[0].strip()
        mapped = normalize_label(part)
        if mapped:
            return mapped[0][0]

    return None


def load_artist_registry(path: Path | None = None) -> dict[str, dict]:
    """Return artist records keyed by ConstituentID string."""
    csv_path = path or ARTISTS_CSV_PATH
    df = pd.read_csv(csv_path, low_memory=False)

    registry: dict[str, dict] = {}
    for _, row in df.iterrows():
        if pd.isna(row["ConstituentID"]):
            continue

        cid = str(int(row["ConstituentID"]))
        bio_text = str(row["ArtistBio"]).strip() if pd.notna(row["ArtistBio"]) else ""
        country = country_from_artist_row(row)

        registry[cid] = {
            "id": cid,
            "name": str(row["DisplayName"]).strip() if pd.notna(row["DisplayName"]) else cid,
            "bio": format_artist_bio(bio_text),
            "country": country,
        }

    return registry
