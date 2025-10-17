import asyncio
import json
import logging
import math
import random
import re
import statistics
import unicodedata
from collections import deque
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Deque, Dict, List, Optional, Sequence, Set, Tuple
from urllib.parse import quote, urlparse

import aiohttp
from aiohttp import ClientError, ClientResponseError, ClientTimeout
from dotenv import load_dotenv

from token_service import TokenManager
from utils import Utils

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

load_dotenv()

# --- Constants ----------------------------------------------------------------

MAX_CONCURRENT_REQUESTS = 24
REQUEST_TIMEOUT_SECONDS = 20
MAX_RETRIES = 5
TOP_ARTIST_LIMIT = 500
SERIES_SHORT_DAYS = 30
SERIES_MAX_DAYS = SERIES_SHORT_DAYS + 1  # keep an extra day for growth computations
ML_FLOOR = 5_000
TOP_TRACK_LIMIT = 10
DATA_VERSION = 1
SCHEMA_VERSION = "1.0.0"
FRESHNESS_WEIGHTS = (0.6, 0.4)
MOMENTUM_WEIGHTS = (0.5, 0.3, 0.2)
TRACK_METADATA_FIELDS = ["i", "n", "pl", "img", "preview", "licensor", "language", "isrc", "label", "rd"]

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "public" / "data"
LATEST_DIR = DATA_DIR / "latest"
ARTISTS_DIR = DATA_DIR / "artists"
DAILY_DIR_BASE = DATA_DIR / "daily"
ARTIST_IDS_PATH = PROJECT_ROOT / "artist_ids.txt"
CITIES_JSON_PATH = PROJECT_ROOT / "public" / "cities.json"

OPERATION_NAME = "queryArtistOverview"
PERSISTED_QUERY_HASH = "7c5a08a226e4dc96387c0c0a5ef4bd1d2e2d95c88cbb33dcfa505928591de672"
SPOTIFY_BASE_URI = "spotify:artist:{artist_id}"
TRACK_METADATA_URL_TEMPLATE = "https://spclient.wg.spotify.com/metadata/4/track/{gid}?market=from_token"


# --- Dataclasses ---------------------------------------------------------------


@dataclass
class TrackInfo:
    track_id: str
    name: str
    playcount: Optional[int]
    image_url: Optional[str]


@dataclass
class TrackMetadata:
    track_id: str
    preview_file_id: Optional[str] = None
    licensor_uuid: Optional[str] = None
    language: Optional[str] = None
    isrc: Optional[str] = None
    label: Optional[str] = None
    release_date: Optional[str] = None


@dataclass
class CityStat:
    name: str
    country_code: str
    listeners: Optional[int]
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@dataclass
class ArtistOverview:
    artist_id: str
    name: str
    image_small: Optional[str]
    image_large: Optional[str]
    monthly_listeners: Optional[int]
    followers: Optional[int]
    world_rank: Optional[int]
    top_tracks: List[TrackInfo] = field(default_factory=list)
    top_cities: List[CityStat] = field(default_factory=list)
    discovered_artist_ids: Set[str] = field(default_factory=set)


@dataclass
class ArtistHistoryEntry:
    day: date
    rank: Optional[int]
    monthly_listeners: Optional[int]
    followers: Optional[int] = None


@dataclass
class ArtistState:
    history: Deque[ArtistHistoryEntry]
    first_seen: date
    first_top500: Optional[date] = None
    last_top500: Optional[date] = None
    times_entered_top500: int = 0
    days_in_top500: int = 0
    best_rank: Optional[int] = None


@dataclass
class ArtistMetrics:
    delta_rank: Optional[int] = None
    growth_1: int = 0
    growth_7: int = 0
    growth_30: int = 0
    freshness_score: float = 0.0
    momentum_score: float = 0.0
    streak_days: int = 0


# --- Utility helpers ----------------------------------------------------------


def _normalize_city_name(name: str) -> str:
    normalized = unicodedata.normalize("NFKC", name or "")
    # Collapse whitespace to improve matching tolerance.
    return " ".join(normalized.casefold().split())


def _strip_diacritics(text: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFKD", text or "") if not unicodedata.combining(ch))


def load_city_catalog(path: Path) -> Dict[Tuple[str, str], Tuple[float, float]]:
    if not path.exists():
        logging.warning("City catalog not found at %s; geo records will miss coordinates.", path)
        return {}
    try:
        with path.open("r", encoding="utf-8") as handle:
            raw_data = json.load(handle)
    except json.JSONDecodeError as exc:
        logging.error("Failed to parse city catalog %s: %s", path, exc)
        return {}

    catalog: Dict[Tuple[str, str], Tuple[float, float]] = {}
    for entry in raw_data:
        if not isinstance(entry, dict):
            continue
        name = entry.get("n")
        country = entry.get("c")
        lat_value = entry.get("l")
        lon_value = entry.get("L")
        if not (name and country and lat_value and lon_value):
            continue
        try:
            lat = float(lat_value)
            lon = float(lon_value)
        except (TypeError, ValueError):
            continue

        country_code = str(country).upper()
        primary_key = (_normalize_city_name(name), country_code)
        catalog[primary_key] = (lat, lon)

        stripped_name = _strip_diacritics(name)
        if stripped_name and stripped_name != name:
            alt_key = (_normalize_city_name(stripped_name), country_code)
            catalog.setdefault(alt_key, (lat, lon))

    logging.info("Loaded %s city coordinate entries from %s", len(catalog), path)
    return catalog


CITY_CATALOG = load_city_catalog(CITIES_JSON_PATH)


def clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return max(lower, min(value, upper))


def tanh_norm(value: float) -> float:
    return math.tanh(value)


def _coerce_float(value: Optional[Any]) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def isoformat(day: Optional[date]) -> Optional[str]:
    return day.isoformat() if day else None


def _parse_int(value: Optional[Any]) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if math.isnan(value):
            return None
        return int(value)
    if isinstance(value, str):
        digits = re.sub(r"[^\d]", "", value)
        if digits:
            try:
                return int(digits)
            except ValueError:
                return None
        try:
            return int(float(value))
        except ValueError:
            return None
    return None


def _extract_image_id(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    parsed = urlparse(str(url))
    path = parsed.path or str(url)
    identifier = PurePosixPath(path).name or path.rsplit("/", 1)[-1]
    identifier = identifier.strip()
    return identifier or None


def parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        return None


def ensure_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def history_to_series(history: Sequence[ArtistHistoryEntry], limit: int) -> Optional[Dict[str, Any]]:
    if not history:
        return None
    window = list(history)[-limit:]
    if not window:
        return None
    base_day = window[0].day
    rows: List[List[Optional[int]]] = []
    for entry in window:
        rows.append([entry.rank, entry.monthly_listeners, entry.followers])
    return {
        "b": base_day.isoformat(),
        "step": "1d",
        "fields": ["r", "ml", "f"],
        "rows": rows,
    }


def compute_streak(history: Sequence[ArtistHistoryEntry]) -> int:
    streak = 0
    for entry in reversed(history):
        if entry.rank is None or entry.rank > TOP_ARTIST_LIMIT:
            break
        streak += 1
    return streak


def load_json(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError:
        logging.warning("Failed to parse JSON from %s", path)
        return None


def dump_json(path: Path, payload: Dict[str, Any]) -> None:
    ensure_directory(path.parent)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, separators=(",", ":"), ensure_ascii=False)


# --- Geography helpers --------------------------------------------------------


class GeoStore:
    def __init__(self, latest_dir: Path, city_catalog: Optional[Dict[Tuple[str, str], Tuple[float, float]]] = None) -> None:
        self.latest_dir = latest_dir
        self.cities_path = latest_dir / "geo-cities.json"
        self._cities: Dict[Tuple[str, str], Dict[str, Any]] = {}
        self._next_city_id: int = 1000
        self._dirty_cities = False
        self._city_catalog = city_catalog or {}
        self._missing_city_keys: Set[Tuple[str, str]] = set()
        self._load_existing()

    def _load_existing(self) -> None:
        cities_data = load_json(self.cities_path)
        max_city_id = 999
        if cities_data:
            fields = cities_data.get("fields", [])
            for row in cities_data.get("rows", []):
                if not isinstance(row, list) or len(row) != len(fields):
                    continue
                record = dict(zip(fields, row))
                cid = record.get("cid")
                name = record.get("name")
                cc = record.get("cc")
                if name and cc:
                    key = (name, cc)
                    self._cities[key] = record
                if isinstance(cid, int):
                    max_city_id = max(max_city_id, cid)
        self._next_city_id = max_city_id + 1

    def _lookup_city_coords(self, name: Optional[str], country_code: Optional[str]) -> Optional[Tuple[float, float]]:
        if not name or not country_code:
            return None
        cc = country_code.upper()
        key = (_normalize_city_name(name), cc)
        coords = self._city_catalog.get(key)
        if coords:
            return coords

        stripped_name = _strip_diacritics(name)
        if stripped_name and stripped_name != name:
            alt_key = (_normalize_city_name(stripped_name), cc)
            coords = self._city_catalog.get(alt_key)
            if coords:
                return coords

        if key not in self._missing_city_keys:
            self._missing_city_keys.add(key)
            logging.debug("No catalog match for city %s (%s)", name, cc)
        return None

    def ensure_city(
        self,
        name: Optional[str],
        country_code: Optional[str],
        latitude: Optional[float],
        longitude: Optional[float],
    ) -> Optional[int]:
        if not name or not country_code:
            return None

        lookup_coords = self._lookup_city_coords(name, country_code)

        lat_value = _coerce_float(latitude)
        lon_value = _coerce_float(longitude)

        if lat_value is None and lookup_coords:
            lat_value = lookup_coords[0]
        if lon_value is None and lookup_coords:
            lon_value = lookup_coords[1]

        key = (name, country_code)
        record = self._cities.get(key)
        if record is None:
            record = {
                "cid": self._next_city_id,
                "name": name,
                "cc": country_code,
                "lat": lat_value,
                "lon": lon_value,
            }
            self._cities[key] = record
            self._next_city_id += 1
            self._dirty_cities = True
        else:
            updated = False
            if record.get("lat") is None and lat_value is not None:
                record["lat"] = lat_value
                updated = True
            if record.get("lon") is None and lon_value is not None:
                record["lon"] = lon_value
                updated = True
            if updated:
                self._dirty_cities = True
        return record["cid"]

    def flush(self) -> None:
        if self._dirty_cities:
            payload = {
                "v": DATA_VERSION,
                "fields": ["cid", "name", "cc", "lat", "lon"],
                "rows": [
                    [record.get("cid"), record.get("name"), record.get("cc"), record.get("lat"), record.get("lon")]
                    for record in sorted(self._cities.values(), key=lambda item: item.get("cid"))
                ],
            }
            dump_json(self.cities_path, payload)
            self._dirty_cities = False


# --- Track metadata storage ---------------------------------------------------


# --- Artist storage -----------------------------------------------------------


class ArtistDataStore:
    def __init__(self, today: date):
        self.today = today
        self._cache: Dict[str, ArtistState] = {}

    def get_state(self, artist_id: str) -> ArtistState:
        if artist_id not in self._cache:
            self._cache[artist_id] = self._load_state(artist_id)
        return self._cache[artist_id]

    def _load_state(self, artist_id: str) -> ArtistState:
        path = self._artist_path(artist_id)
        data = load_json(path)
        if not data:
            return ArtistState(history=deque(maxlen=SERIES_MAX_DAYS), first_seen=self.today)

        meta = data.get("meta", {})
        first_seen = parse_date(meta.get("firstSeen")) or self.today
        first_top500 = parse_date(meta.get("first500"))
        last_top500 = parse_date(meta.get("last500"))
        times_entered = int(meta.get("timesEntered500") or 0)
        days_in_top500 = int(meta.get("days500") or 0)
        best_rank = meta.get("br")

        series_data = data.get("series30")
        history = self._history_from_series(series_data)
        if not history:
            history = deque(maxlen=SERIES_MAX_DAYS)

        return ArtistState(
            history=history,
            first_seen=first_seen,
            first_top500=first_top500,
            last_top500=last_top500,
            times_entered_top500=times_entered,
            days_in_top500=days_in_top500,
            best_rank=best_rank,
        )

    def _history_from_series(self, series_data: Optional[Dict[str, Any]]) -> Deque[ArtistHistoryEntry]:
        if not series_data:
            return deque(maxlen=SERIES_MAX_DAYS)
        base = parse_date(series_data.get("b"))
        if not base:
            return deque(maxlen=SERIES_MAX_DAYS)
        fields = series_data.get("fields", [])
        rows = series_data.get("rows", [])
        history: Deque[ArtistHistoryEntry] = deque(maxlen=SERIES_MAX_DAYS)
        for idx, row in enumerate(rows):
            if not isinstance(row, list):
                continue
            values = {fields[i]: row[i] if i < len(row) else None for i in range(len(fields))}
            history.append(
                ArtistHistoryEntry(
                    day=base + timedelta(days=idx),
                    rank=values.get("r"),
                    monthly_listeners=values.get("ml"),
                    followers=values.get("f"),
                )
            )
        return history

    def update_state(self, overview: ArtistOverview) -> ArtistMetrics:
        state = self.get_state(overview.artist_id)
        history = state.history

        existing_today = history[-1] if history and history[-1].day == self.today else None
        if existing_today:
            history.pop()

        previous_entry = history[-1] if history else None
        previous_rank = previous_entry.rank if previous_entry else None
        previous_in_top500 = bool(previous_rank and previous_rank <= TOP_ARTIST_LIMIT)

        history.append(
            ArtistHistoryEntry(
                day=self.today,
                rank=overview.world_rank,
                monthly_listeners=overview.monthly_listeners,
                followers=overview.followers,
            )
        )

        in_top500_today = bool(overview.world_rank and overview.world_rank <= TOP_ARTIST_LIMIT)
        recorded_today_before = bool(
            existing_today
            and existing_today.rank is not None
            and existing_today.rank <= TOP_ARTIST_LIMIT
        )

        if in_top500_today:
            if not recorded_today_before:
                state.days_in_top500 += 1
                if not previous_in_top500:
                    state.times_entered_top500 += 1
            state.last_top500 = self.today
            if state.first_top500 is None:
                state.first_top500 = self.today
            if overview.world_rank:
                if state.best_rank is None or overview.world_rank < state.best_rank:
                    state.best_rank = overview.world_rank

        metrics = self._compute_metrics(state)
        state.first_seen = min(state.first_seen, self.today)
        return metrics

    def _compute_metrics(self, state: ArtistState) -> ArtistMetrics:
        history = list(state.history)
        metrics = ArtistMetrics()
        if not history:
            return metrics

        latest = history[-1]
        prev = history[-2] if len(history) > 1 else None

        if latest.rank is not None and prev and prev.rank is not None:
            metrics.delta_rank = prev.rank - latest.rank
        elif latest.rank is None or (prev and prev.rank is None):
            metrics.delta_rank = None

        metrics.growth_1 = self._growth(history, 1)
        metrics.growth_7 = self._growth(history, 7)
        metrics.growth_30 = self._growth(history, 30)

        metrics.freshness_score = self._freshness_score(history)
        metrics.momentum_score = self._momentum_score(history)
        metrics.streak_days = compute_streak(history)
        return metrics

    @staticmethod
    def _growth(history: Sequence[ArtistHistoryEntry], offset: int) -> int:
        if len(history) <= offset:
            return 0
        latest = history[-1].monthly_listeners
        past = history[-1 - offset].monthly_listeners
        if latest is None or past is None:
            return 0
        return int(latest) - int(past)

    @staticmethod
    def _freshness_score(history: Sequence[ArtistHistoryEntry]) -> float:
        if not history:
            return 0.0
        latest = history[-1]
        ml_today = latest.monthly_listeners or 0
        g7 = ArtistDataStore._growth(history, 7)
        ml_ratio = g7 / max(ml_today, ML_FLOOR) if ml_today else 0.0

        rank_today = latest.rank if latest.rank is not None else TOP_ARTIST_LIMIT + 100
        rank_week = history[-8].rank if len(history) > 7 else None
        rank_delta = 0.0
        if rank_week is not None:
            rank_delta = (rank_week - rank_today) / TOP_ARTIST_LIMIT

        w1, w2 = FRESHNESS_WEIGHTS
        score = w1 * tanh_norm(ml_ratio) + w2 * tanh_norm(rank_delta)
        return clamp(score)

    @staticmethod
    def _momentum_score(history: Sequence[ArtistHistoryEntry]) -> float:
        if not history:
            return 0.0
        latest = history[-1]
        ml_today = latest.monthly_listeners or 0
        g30 = ArtistDataStore._growth(history, 30)
        ml_ratio = g30 / max(ml_today, ML_FLOOR) if ml_today else 0.0

        recent_history = [entry for entry in history[-30:] if entry is not None]
        if len(recent_history) < 5:
            return clamp(tanh_norm(ml_ratio))

        ranks = [entry.rank if entry.rank is not None else TOP_ARTIST_LIMIT + 100 for entry in recent_history]
        first_avg = sum(ranks[: min(7, len(ranks))]) / min(7, len(ranks))
        last_avg = sum(ranks[-min(7, len(ranks)) :]) / min(7, len(ranks))
        rank_slope = (first_avg - last_avg) / TOP_ARTIST_LIMIT

        ml_values = [entry.monthly_listeners for entry in recent_history if entry.monthly_listeners is not None]
        variance_ratio = 0.0
        if len(ml_values) > 1 and ml_today:
            variance = statistics.pvariance(ml_values)
            std_dev = math.sqrt(variance)
            variance_ratio = std_dev / max(ml_today, ML_FLOOR)

        w3, w4, w5 = MOMENTUM_WEIGHTS
        score = (w3 * tanh_norm(ml_ratio)) + (w4 * tanh_norm(rank_slope)) - (w5 * tanh_norm(variance_ratio))
        return clamp(score)

    def save_detail(
        self,
        overview: ArtistOverview,
        state: ArtistState,
        metrics: ArtistMetrics,
        geo_store: GeoStore,
        track_metadata: Dict[str, TrackMetadata],
    ) -> None:
        history = list(state.history)
        latest = history[-1]

        existing_detail = self.load_existing_detail(overview.artist_id)

        existing_track_info: Dict[str, Dict[str, Any]] = {}
        if existing_detail:
            existing_tracks = existing_detail.get("topTracks", {})
            fields = existing_tracks.get("fields", [])
            field_index = {field: idx for idx, field in enumerate(fields)}
            for row in existing_tracks.get("rows", []):
                if not isinstance(row, list) or not row:
                    continue
                track_id = None
                if "i" in field_index and field_index["i"] < len(row):
                    candidate = row[field_index["i"]]
                    track_id = candidate if isinstance(candidate, str) else None
                if not track_id and isinstance(row[0], str):
                    track_id = row[0]
                if not track_id:
                    continue

                def get_field(name: str, default: Any = None) -> Any:
                    idx = field_index.get(name)
                    if idx is not None and idx < len(row):
                        return row[idx]
                    return default

                language_value = get_field("language") or get_field("langs")
                if isinstance(language_value, list):
                    language_value = next((lang for lang in language_value if isinstance(lang, str) and lang), None)
                elif not isinstance(language_value, str):
                    language_value = None

                existing_track_info[track_id] = {
                    "n": get_field("n"),
                    "pl": _parse_int(get_field("pl")),
                    "img": get_field("img"),
                    "preview": get_field("preview"),
                    "licensor": get_field("licensor"),
                    "language": language_value,
                    "isrc": get_field("isrc"),
                    "label": get_field("label"),
                    "rd": get_field("rd"),
                }

        top_tracks_rows: List[List[Optional[Any]]] = []
        seen_track_ids: Set[str] = set()

        for track in overview.top_tracks[:TOP_TRACK_LIMIT]:
            track_id = track.track_id
            seen_track_ids.add(track_id)
            metadata = track_metadata.get(track_id)
            fallback = existing_track_info.get(track_id, {})
            language = metadata.language if metadata and metadata.language else fallback.get("language")
            if isinstance(language, list):
                language = next((lang for lang in language if isinstance(lang, str) and lang), None)
            elif language is not None and not isinstance(language, str):
                language = None
            top_tracks_rows.append(
                [
                    track_id,
                    track.name or fallback.get("n") or track_id,
                    track.playcount if track.playcount is not None else fallback.get("pl"),
                    track.image_url or fallback.get("img"),
                    metadata.preview_file_id if metadata else fallback.get("preview"),
                    metadata.licensor_uuid if metadata else fallback.get("licensor"),
                    language,
                    metadata.isrc if metadata else fallback.get("isrc"),
                    metadata.label if metadata else fallback.get("label"),
                    metadata.release_date if metadata else fallback.get("rd"),
                ]
            )

        for track_id, info in existing_track_info.items():
            if track_id in seen_track_ids:
                continue
            metadata = track_metadata.get(track_id)
            language = metadata.language if metadata and metadata.language else info.get("language")
            if isinstance(language, list):
                language = next((lang for lang in language if isinstance(lang, str) and lang), None)
            elif language is not None and not isinstance(language, str):
                language = None
            top_tracks_rows.append(
                [
                    track_id,
                    info.get("n") or track_id,
                    info.get("pl"),
                    info.get("img"),
                    metadata.preview_file_id if metadata else info.get("preview"),
                    metadata.licensor_uuid if metadata else info.get("licensor"),
                    language,
                    metadata.isrc if metadata else info.get("isrc"),
                    metadata.label if metadata else info.get("label"),
                    metadata.release_date if metadata else info.get("rd"),
                ]
            )
            seen_track_ids.add(track_id)

        top_city_rows = []
        for city in overview.top_cities:
            if city.listeners is None:
                continue
            cid = geo_store.ensure_city(city.name, city.country_code, city.latitude, city.longitude)
            if cid is not None:
                top_city_rows.append([cid, city.listeners])

        detail_payload: Dict[str, Any] = {
            "v": DATA_VERSION,
            "i": overview.artist_id,
            "n": overview.name,
            "p": overview.image_large or overview.image_small,
            "today": {
                "d": isoformat(self.today),
                "r": latest.rank,
                "ml": latest.monthly_listeners,
                "f": overview.followers,
                "dr": metrics.delta_rank,
                "g1": metrics.growth_1,
                "g7": metrics.growth_7,
                "g30": metrics.growth_30,
                "fs": round(metrics.freshness_score, 4),
                "ms": round(metrics.momentum_score, 4),
            },
            "meta": {
                "firstSeen": isoformat(state.first_seen),
                "first500": isoformat(state.first_top500),
                "last500": isoformat(state.last_top500),
                "timesEntered500": state.times_entered_top500,
                "days500": state.days_in_top500,
                "br": state.best_rank,
            },
        }

        series30 = history_to_series(history, SERIES_SHORT_DAYS)
        if series30:
            detail_payload["series30"] = series30

        detail_payload["topTracks"] = {"fields": TRACK_METADATA_FIELDS, "rows": top_tracks_rows}
        detail_payload["topCities"] = {"fields": ["cid", "l"], "rows": top_city_rows}

        dump_json(self._artist_path(overview.artist_id), detail_payload)
    def load_existing_detail(self, artist_id: str) -> Optional[Dict[str, Any]]:
        return load_json(self._artist_path(artist_id))

    @staticmethod
    def _artist_path(artist_id: str) -> Path:
        prefix = artist_id[:2].lower()
        return ARTISTS_DIR / prefix / f"{artist_id}.json"

# --- Spotify fetching ---------------------------------------------------------


def build_track_metadata_url(track_id: str) -> str:
    gid = Utils.spotify_id_to_gid(track_id)
    return TRACK_METADATA_URL_TEMPLATE.format(gid=gid)


def parse_track_metadata(track_id: str, payload: Dict[str, Any]) -> TrackMetadata:
    album = payload.get("album") or {}

    preview_entries = payload.get("preview") or []
    preview_file_id = None
    if isinstance(preview_entries, list):
        for entry in preview_entries:
            if isinstance(entry, dict):
                preview_file_id = entry.get("file_id")
                if preview_file_id:
                    break

    licensor_uuid = None
    licensor_data = payload.get("licensor")
    if isinstance(licensor_data, dict):
        licensor_uuid = licensor_data.get("uuid")
    if not licensor_uuid:
        album_licensor = album.get("licensor")
        if isinstance(album_licensor, dict):
            licensor_uuid = album_licensor.get("uuid")

    primary_language = None
    language_entries = payload.get("language_of_performance")
    if isinstance(language_entries, list):
        filtered = [lang for lang in language_entries if isinstance(lang, str) and lang]
        if filtered:
            primary_language = filtered[0]

    isrc = None
    for external in payload.get("external_id") or []:
        if not isinstance(external, dict):
            continue
        ext_type = str(external.get("type") or "").lower()
        if ext_type == "isrc":
            isrc = external.get("id")
            if isrc:
                break

    label = album.get("label") if isinstance(album.get("label"), str) else None

    release_date = None
    date_info = album.get("date") or {}
    year = _parse_int(date_info.get("year"))
    month = _parse_int(date_info.get("month"))
    day = _parse_int(date_info.get("day"))
    if year:
        if month and day:
            release_date = f"{year:04d}-{month:02d}-{day:02d}"
        elif month:
            release_date = f"{year:04d}-{month:02d}"
        else:
            release_date = f"{year:04d}"

    return TrackMetadata(
        track_id=track_id,
        preview_file_id=preview_file_id,
        licensor_uuid=licensor_uuid,
        language=primary_language,
        isrc=isrc,
        label=label,
        release_date=release_date,
    )


async def fetch_track_metadata(
    session: aiohttp.ClientSession,
    token_manager: TokenManager,
    track_id: str,
    semaphore: asyncio.Semaphore,
) -> Optional[TrackMetadata]:
    url = build_track_metadata_url(track_id)
    for attempt in range(1, MAX_RETRIES + 1):
        async with semaphore:
            try:
                token = await token_manager.get_token(session)
                headers = {
                    "authorization": f"Bearer {token}",
                    "app-platform": "WebPlayer",
                    "accept": "application/json",
                }
                async with session.get(url, headers=headers) as response:
                    response.raise_for_status()
                    payload = await response.json()
                    if not isinstance(payload, dict):
                        raise ValueError("Invalid track metadata payload shape")
                    return parse_track_metadata(track_id, payload)
            except ClientResponseError as exc:
                if exc.status in (401, 403):
                    logging.warning("Track metadata token rejected (%s) for %s, refreshing.", exc.status, track_id)
                    token_manager.token = None
                    token_manager.expiration_timestamp = 0
                else:
                    logging.error("Track metadata client error (%s) for %s: %s", exc.status, track_id, exc)
                    return None
            except (asyncio.TimeoutError, ClientError) as exc:
                logging.error("Track metadata transport error for %s: %s", track_id, exc)
            except (KeyError, ValueError, json.JSONDecodeError) as exc:
                logging.error("Track metadata parsing error for %s: %s", track_id, exc)
                return None
        backoff = (2 ** attempt) + random.uniform(0, 1)
        await asyncio.sleep(backoff)
    logging.error("Exceeded track metadata retries for %s", track_id)
    return None


async def fetch_many_track_metadata(
    track_ids: Sequence[str],
    session: aiohttp.ClientSession,
    token_manager: TokenManager,
    semaphore: asyncio.Semaphore,
) -> Dict[str, TrackMetadata]:
    unique_ids = [track_id for track_id in dict.fromkeys(track_ids) if isinstance(track_id, str) and track_id]
    if not unique_ids:
        return {}
    tasks = [asyncio.create_task(fetch_track_metadata(session, token_manager, track_id, semaphore)) for track_id in unique_ids]
    results: Dict[str, TrackMetadata] = {}
    for track_id, task in zip(unique_ids, tasks):
        try:
            metadata = await task
        except Exception as exc:  # pragma: no cover
            logging.error("Unexpected track metadata error for %s: %s", track_id, exc)
            metadata = None
        if metadata:
            results[track_id] = metadata
    return results


def build_artist_query_url(artist_id: str) -> str:
    variables = json.dumps(
        {"uri": SPOTIFY_BASE_URI.format(artist_id=artist_id), "locale": "", "includePrerelease": True},
        separators=(",", ":"),
    )
    extensions = json.dumps({"persistedQuery": {"version": 1, "sha256Hash": PERSISTED_QUERY_HASH}}, separators=(",", ":"))
    return (
        "https://api-partner.spotify.com/pathfinder/v1/query"
        f"?operationName={OPERATION_NAME}"
        f"&variables={quote(variables)}"
        f"&extensions={quote(extensions)}"
    )


async def fetch_artist_overview(
    session: aiohttp.ClientSession,
    token_manager: TokenManager,
    artist_id: str,
    semaphore: asyncio.Semaphore,
) -> Optional[ArtistOverview]:
    url = build_artist_query_url(artist_id)
    for attempt in range(1, MAX_RETRIES + 1):
        async with semaphore:
            try:
                token = await token_manager.get_token(session)
                headers = {
                    "authorization": f"Bearer {token}",
                    "app-platform": "WebPlayer",
                    "spotify-app-version": "1.2.11",
                }
                async with session.get(url, headers=headers) as response:
                    response.raise_for_status()
                    payload = await response.json()
                    return parse_artist_payload(artist_id, payload)
            except ClientResponseError as exc:
                if exc.status in (401, 403):
                    logging.warning("Token rejected (%s) for %s, refreshing.", exc.status, artist_id)
                    token_manager.token = None
                    token_manager.expiration_timestamp = 0
                else:
                    logging.error("Client error (%s) for %s: %s", exc.status, artist_id, exc)
            except (asyncio.TimeoutError, ClientError) as exc:
                logging.error("Transport error for %s: %s", artist_id, exc)
            except (KeyError, ValueError, json.JSONDecodeError) as exc:
                logging.error("Parsing error for %s: %s", artist_id, exc)
                return None
        backoff = (2 ** attempt) + random.uniform(0, 1)
        await asyncio.sleep(backoff)
    logging.error("Exceeded retries for %s", artist_id)
    return None


def parse_artist_payload(artist_id: str, payload: Dict[str, Any]) -> ArtistOverview:
    data = payload.get("data") or {}
    artist_union = data.get("artistUnion") or {}
    if not artist_union:
        raise ValueError("Missing artistUnion section")

    profile = artist_union.get("profile") or {}
    stats = artist_union.get("stats") or {}
    visuals = artist_union.get("visuals") or {}
    related_content = artist_union.get("relatedContent") or {}
    discography = artist_union.get("discography") or {}

    name = profile.get("name") or artist_union.get("name") or artist_id
    avatar_sources = (visuals.get("avatarImage") or {}).get("sources", [])
    image_small = _pick_image_url(avatar_sources, prefer_small=True)
    image_large = _pick_image_url(avatar_sources, prefer_small=False)

    monthly_listeners = stats.get("monthlyListeners")
    followers = stats.get("followers")
    world_rank = stats.get("worldRank")
    if isinstance(world_rank, int) and world_rank <= 0:
        world_rank = None

    top_tracks = _parse_top_tracks(discography.get("topTracks", {}).get("items", []))
    top_cities = _parse_top_cities(stats.get("topCities", {}).get("items", []))

    discovered_ids: Set[str] = set()
    if world_rank and world_rank != 0:
        for related in related_content.get("relatedArtists", {}).get("items", []):
            related_id = related.get("id")
            if isinstance(related_id, str):
                discovered_ids.add(related_id)

    return ArtistOverview(
        artist_id=artist_id,
        name=name,
        image_small=image_small,
        image_large=image_large,
        monthly_listeners=monthly_listeners,
        followers=followers,
        world_rank=world_rank,
        top_tracks=top_tracks,
        top_cities=top_cities,
        discovered_artist_ids=discovered_ids,
    )


def _pick_image_url(sources: Sequence[Dict[str, Any]], *, prefer_small: bool) -> Optional[str]:
    if not sources:
        return None
    ordered = sorted(
        (source for source in sources if source.get("url")),
        key=lambda src: src.get("width") or (0 if prefer_small else 10_000),
        reverse=not prefer_small,
    )
    if not ordered:
        return None
    return _extract_image_id(ordered[0].get("url"))


def _parse_top_tracks(items: Sequence[Dict[str, Any]]) -> List[TrackInfo]:
    tracks: List[TrackInfo] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        track_node = item.get("track")
        track = track_node if isinstance(track_node, dict) else item
        if not isinstance(track, dict):
            continue
        track_id = track.get("id")
        name = track.get("name")
        if not (track_id and name):
            continue
        playcount_source = track.get("playcount") or track.get("playcountWithUnits")
        playcount: Optional[int] = None
        if isinstance(playcount_source, dict):
            for key in ("total", "count", "value"):
                parsed = _parse_int(playcount_source.get(key))
                if parsed is not None:
                    playcount = parsed
                    break
        else:
            playcount = _parse_int(playcount_source)

        album = track.get("albumOfTrack") or track.get("album") or {}
        cover_art_sources = (album.get("coverArt") or {}).get("sources", [])
        image_url = _pick_image_url(cover_art_sources, prefer_small=True)
        tracks.append(
            TrackInfo(
                track_id=track_id,
                name=name,
                playcount=playcount,
                image_url=image_url,
            )
        )
    return tracks


def _parse_top_cities(items: Sequence[Dict[str, Any]]) -> List[CityStat]:
    cities: List[CityStat] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        city_name = item.get("city") or item.get("name")
        country_code = item.get("countryCode") or item.get("country")
        listeners = item.get("numberOfListeners") or item.get("listeners")
        listeners_value = _parse_int(listeners)
        latitude = item.get("latitude")
        longitude = item.get("longitude")
        cities.append(
            CityStat(
                name=city_name or "Unknown",
                country_code=(country_code or "").upper(),
                listeners=listeners_value,
                latitude=latitude if isinstance(latitude, (int, float)) else None,
                longitude=longitude if isinstance(longitude, (int, float)) else None,
            )
        )
    return cities


# --- Output assembly ----------------------------------------------------------


def build_top500_payload(entries: List[Tuple[ArtistOverview, ArtistState, ArtistMetrics]], today: date) -> Dict[str, Any]:
    rows: List[List[Any]] = []
    for overview, state, metrics in sorted(entries, key=lambda item: item[0].world_rank or TOP_ARTIST_LIMIT + 1):
        row = [
            overview.artist_id,
            overview.name,
            overview.image_small or overview.image_large,
            overview.world_rank,
            overview.monthly_listeners,
            overview.followers,
            metrics.delta_rank,
            metrics.growth_1,
            metrics.growth_7,
            metrics.growth_30,
            round(metrics.freshness_score, 4),
            round(metrics.momentum_score, 4),
            state.best_rank,
            metrics.streak_days,
        ]
        rows.append(row)

    return {
        "v": DATA_VERSION,
        "date": today.isoformat(),
        "fields": ["i", "n", "p", "r", "ml", "f", "dr", "g1", "g7", "g30", "fs", "ms", "br", "st"],
        "rows": rows[:TOP_ARTIST_LIMIT],
    }


def build_former_payload(
    entries: List[Tuple[str, str, Optional[str], Optional[int], Optional[int], Optional[int], Optional[date], Optional[int]]],
    today: date,
) -> Dict[str, Any]:
    sorted_rows = sorted(
        entries,
        key=lambda item: (
            -(item[3] or 0),
            item[7] if item[7] is not None else math.inf,
            item[1],
        ),
    )
    rows = []
    for artist_id, name, image, ml, followers, best_rank, last_top500, days_since in sorted_rows:
        rows.append(
            [
                artist_id,
                name,
                image,
                ml,
                followers,
                best_rank,
                isoformat(last_top500),
                days_since,
            ]
        )

    return {
        "v": DATA_VERSION,
        "date": today.isoformat(),
        "fields": ["i", "n", "p", "ml", "f", "br", "lf", "ls"],
        "rows": rows,
    }

# --- Main routine -------------------------------------------------------------


async def main() -> None:
    ensure_directory(DATA_DIR)
    ensure_directory(LATEST_DIR)
    ensure_directory(ARTISTS_DIR)
    ensure_directory(DAILY_DIR_BASE)
    today = datetime.now(timezone.utc).date()
    artist_ids: List[str] = []
    if ARTIST_IDS_PATH.exists():
        with ARTIST_IDS_PATH.open("r", encoding="utf-8") as handle:
            artist_ids = [line.strip() for line in handle if line.strip()]
    if not artist_ids:
        logging.error("No artist IDs found. Populate artist_ids.txt before running.")
        return

    token_manager = TokenManager()
    timeout = ClientTimeout(total=None, sock_connect=REQUEST_TIMEOUT_SECONDS, sock_read=REQUEST_TIMEOUT_SECONDS)
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

    fetch_results: Dict[str, ArtistOverview] = {}
    discovered_ids: Set[str] = set()
    failed_ids: List[str] = []
    track_metadata_map: Dict[str, TrackMetadata] = {}
    collected_track_ids: Set[str] = set()

    async with aiohttp.ClientSession(timeout=timeout) as session:
        tasks = [asyncio.create_task(fetch_artist_overview(session, token_manager, artist_id, semaphore)) for artist_id in artist_ids]
        for artist_id, task in zip(artist_ids, tasks):
            try:
                overview = await task
            except Exception as exc:  # pragma: no cover
                logging.error("Unexpected error for %s: %s", artist_id, exc)
                overview = None
            if overview:
                fetch_results[artist_id] = overview
                discovered_ids.update(overview.discovered_artist_ids)
                for track in overview.top_tracks[:TOP_TRACK_LIMIT]:
                    collected_track_ids.add(track.track_id)
            else:
                failed_ids.append(artist_id)
        if collected_track_ids:
            fetched_metadata = await fetch_many_track_metadata(
                sorted(collected_track_ids),
                session,
                token_manager,
                semaphore,
            )
            track_metadata_map.update(fetched_metadata)

    logging.info("Fetched %s artists successfully, %s failures.", len(fetch_results), len(failed_ids))

    store = ArtistDataStore(today)
    geo_store = GeoStore(LATEST_DIR, CITY_CATALOG)

    top500_entries: List[Tuple[ArtistOverview, ArtistState, ArtistMetrics]] = []
    former_entries: List[
        Tuple[str, str, Optional[str], Optional[int], Optional[int], Optional[int], Optional[date], Optional[int]]
    ] = []

    for overview in fetch_results.values():
        metrics = store.update_state(overview)
        state = store.get_state(overview.artist_id)
        store.save_detail(overview, state, metrics, geo_store, track_metadata_map)

        if overview.world_rank and overview.world_rank <= TOP_ARTIST_LIMIT:
            top500_entries.append((overview, state, metrics))
        elif state.last_top500:
            days_since = (today - state.last_top500).days if state.last_top500 else None
            former_entries.append(
                (
                    overview.artist_id,
                    overview.name,
                    overview.image_small or overview.image_large,
                    overview.monthly_listeners,
                    overview.followers,
                    state.best_rank,
                    state.last_top500,
                    days_since,
                )
            )
    previous_former_ids = _load_previous_former_ids()
    top500_ids_today = {entry[0].artist_id for entry in top500_entries}
    recorded_former_ids = {entry[0] for entry in former_entries}

    for prev_id in previous_former_ids:
        if prev_id in top500_ids_today or prev_id in recorded_former_ids:
            continue
        state = store.get_state(prev_id)
        if not state.last_top500:
            continue
        detail = store.load_existing_detail(prev_id)
        if not detail:
            continue
        today_section = detail.get("today", {})
        last_top500 = parse_date(detail.get("meta", {}).get("last500")) or state.last_top500
        days_since = (today - last_top500).days if last_top500 else None
        former_entries.append(
            (
                prev_id,
                detail.get("n") or prev_id,
                detail.get("p"),
                today_section.get("ml"),
                today_section.get("f"),
                detail.get("meta", {}).get("br") or state.best_rank,
                last_top500,
                days_since,
            )
        )

    top500_payload = build_top500_payload(top500_entries, today)
    former_payload = build_former_payload(former_entries, today)

    daily_dir = DAILY_DIR_BASE / f"{today.year:04d}" / f"{today.month:02d}" / f"{today.day:02d}"
    ensure_directory(daily_dir)
    dump_json(daily_dir / "top500.json", top500_payload)
    dump_json(daily_dir / "former500.json", former_payload)

    dump_json(LATEST_DIR / "top500.json", top500_payload)
    dump_json(LATEST_DIR / "former500.json", former_payload)
    meta_payload = {
        "date": today.isoformat(),
        "schema": SCHEMA_VERSION,
        "pointers": {
            "top500": f"/data/latest/top500.json?v={today.isoformat()}",
            "former500": f"/data/latest/former500.json?v={today.isoformat()}",
        },
    }
    dump_json(LATEST_DIR / "meta.json", meta_payload)
    geo_store.flush()

    if discovered_ids:
        artist_ids_set = set(artist_ids)
        artist_ids_set.update(discovered_ids)
        with ARTIST_IDS_PATH.open("w", encoding="utf-8") as handle:
            for artist_id in sorted(artist_ids_set):
                handle.write(f"{artist_id}\n")
        logging.info("Updated artist_ids.txt with %s total artists.", len(artist_ids_set))

    if failed_ids:
        logging.warning("Failed to fetch %s artist(s): %s", len(failed_ids), ", ".join(failed_ids[:10]))


def _load_previous_former_ids() -> Set[str]:
    latest_former = load_json(LATEST_DIR / "former500.json")
    if not latest_former:
        return set()
    rows = latest_former.get("rows", [])
    return {row[0] for row in rows if isinstance(row, list) and row}


if __name__ == "__main__":
     asyncio.run(main())
