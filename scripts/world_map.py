#!/usr/bin/env python3
"""
Aggregate artist city listener data into a world map dataset.

The script scans the generated artist detail payloads under public/data/artists,
collects the top city entries, and produces a per-city ranking of artists by
listener counts. The output is written to public/data/latest/world-map.json by
default and is intended to support client-side visualisations.
"""
from __future__ import annotations

import argparse
import json
import logging
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, DefaultDict, Dict, Iterable, List, Optional, Tuple


LOGGER = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ARTISTS_DIR = PROJECT_ROOT / "public" / "data" / "artists"
DEFAULT_OUTPUT_PATH = PROJECT_ROOT / "public" / "data" / "latest" / "world-map.json"
DATA_VERSION = 1


@dataclass(frozen=True)
class ArtistCityEntry:
    """Lightweight record tying an artist to a city listener count."""

    artist_id: str
    artist_name: str
    listeners: int
    monthly_listeners: int
    image_hash: Optional[str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a world map dataset that ranks artists by listeners for each city."
    )
    parser.add_argument(
        "--artists-dir",
        type=Path,
        default=DEFAULT_ARTISTS_DIR,
        help=f"Directory containing artist JSON payloads (default: {DEFAULT_ARTISTS_DIR})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help=f"Path to write aggregated output (default: {DEFAULT_OUTPUT_PATH})",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of artists to retain per city (default: keep all).",
    )
    parser.add_argument(
        "--indent",
        type=int,
        default=None,
        help="Indent level for JSON output. Omit for compact output.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging.",
    )
    return parser.parse_args()


def load_artist_payload(path: Path) -> Optional[Dict[str, Any]]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError as exc:
        LOGGER.warning("Skipping %s due to invalid JSON (%s).", path, exc)
    except OSError as exc:
        LOGGER.warning("Skipping %s (%s).", path, exc)
    return None


def iter_artist_files(artists_dir: Path) -> Iterable[Path]:
    if not artists_dir.exists():
        LOGGER.error("Artists directory %s does not exist.", artists_dir)
        return []
    if not artists_dir.is_dir():
        LOGGER.error("Artists directory %s is not a directory.", artists_dir)
        return []
    return artists_dir.glob("*/*.json")


def _field_index(fields: Sequence[Any]) -> Dict[str, int]:
    mapping: Dict[str, int] = {}
    for idx, value in enumerate(fields):
        if isinstance(value, str):
            mapping[value] = idx
    return mapping


def extract_city_rows(payload: Dict[str, Any]) -> Iterable[Tuple[int, int]]:
    top_cities = payload.get("topCities")
    if not isinstance(top_cities, dict):
        return []

    fields = top_cities.get("fields")
    rows = top_cities.get("rows")
    if not isinstance(fields, list) or not isinstance(rows, list):
        return []

    index = _field_index(fields)
    cid_idx = index.get("cid")
    listeners_idx = index.get("l") or index.get("listeners")
    if cid_idx is None or listeners_idx is None:
        return []

    extracted: List[Tuple[int, int]] = []
    for row in rows:
        if not isinstance(row, Sequence):
            continue
        if cid_idx >= len(row) or listeners_idx >= len(row):
            continue
        city_raw = row[cid_idx]
        listeners_raw = row[listeners_idx]
        try:
            city_id = int(city_raw)
            listeners = int(listeners_raw)
        except (TypeError, ValueError):
            continue
        if listeners <= 0:
            continue
        extracted.append((city_id, listeners))
    return extracted


def aggregate_city_rankings(
    artists_dir: Path,
    limit: Optional[int] = None,
) -> Tuple[DefaultDict[int, List[ArtistCityEntry]], int]:
    city_map: DefaultDict[int, List[ArtistCityEntry]] = defaultdict(list)
    processed_artists = 0

    for path in iter_artist_files(artists_dir):
        payload = load_artist_payload(path)
        if not payload:
            continue

        artist_id = payload.get("i")
        artist_name = payload.get("n")
        if not isinstance(artist_id, str) or not isinstance(artist_name, str):
            continue

        today = payload.get("today") or {}
        monthly_listeners_raw = today.get("ml")
        try:
            monthly_listeners = int(monthly_listeners_raw)
        except (TypeError, ValueError):
            monthly_listeners = 0

        image_hash = payload.get("p") if isinstance(payload.get("p"), str) else None

        city_rows = extract_city_rows(payload)
        if not city_rows:
            continue

        processed_artists += 1
        for city_id, listeners in city_rows:
            city_map[city_id].append(
                ArtistCityEntry(
                    artist_id=artist_id,
                    artist_name=artist_name,
                    listeners=listeners,
                    monthly_listeners=monthly_listeners,
                    image_hash=image_hash,
                )
            )

    for city_id, entries in city_map.items():
        entries.sort(key=lambda entry: entry.listeners, reverse=True)
        if limit is not None and limit >= 0:
            city_map[city_id] = entries[:limit]

    return city_map, processed_artists


def build_payload(
    rankings: Dict[int, List[ArtistCityEntry]],
    processed_artists: int,
) -> Dict[str, Any]:
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    rows: List[List[Any]] = []
    for city_id in sorted(rankings.keys()):
        entries = rankings[city_id]
        artists_column = [
            [
                entry.artist_id,
                entry.artist_name,
                entry.listeners,
                entry.monthly_listeners,
                entry.image_hash,
            ]
            for entry in entries
        ]
        rows.append([city_id, artists_column])

    payload: Dict[str, Any] = {
        "v": DATA_VERSION,
        "generated": generated_at,
        "fields": ["cid", "artists"],
        "rows": rows,
        "meta": {
            "cityCount": len(rankings),
            "artistCount": processed_artists,
        },
    }
    return payload


def main() -> None:
    args = parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
    )

    LOGGER.info("Aggregating city rankings from %s", args.artists_dir)
    rankings, processed_artists = aggregate_city_rankings(args.artists_dir, args.limit)
    LOGGER.info(
        "Compiled rankings for %s cities from %s artist payload(s).",
        len(rankings),
        processed_artists,
    )

    payload = build_payload(rankings, processed_artists)
    args.output.parent.mkdir(parents=True, exist_ok=True)

    with args.output.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=args.indent, ensure_ascii=False)
        handle.write("\n")
    LOGGER.info("World map dataset written to %s", args.output)


if __name__ == "__main__":
    main()
