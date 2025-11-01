import asyncio
import json
import logging
import math
import random
import re
import statistics
import unicodedata
from html import unescape
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
TOP_ARTIST_LIMIT = 850
ML_FLOOR = 5_000
TOP_TRACK_LIMIT = 100
DATA_VERSION = 1
SCHEMA_VERSION = "1.0.0"
FRESHNESS_WEIGHTS = (0.6, 0.4)
MOMENTUM_WEIGHTS = (0.5, 0.3, 0.2)
TRACK_METADATA_FIELDS = ["i", "n", "pl", "img", "preview", "licensor", "language", "isrc", "label", "rd", "canvas"]

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
SPOTIFY_TRACK_URI = "spotify:track:{track_id}"
TRACK_METADATA_URL_TEMPLATE = "https://spclient.wg.spotify.com/metadata/4/track/{gid}?market=from_token"
KWORB_LISTENER_URLS = ["https://kworb.net/spotify/listeners.html"] + [
    f"https://kworb.net/spotify/listeners{index}.html" for index in range(2, 11)
]
KWORB_ARTIST_HREF_RE = re.compile(r"artist/([A-Za-z0-9]+)_songs\.html")
CANVAS_ENDPOINT = "https://spclient.wg.spotify.com/canvaz-cache/v0/canvases"
CANVAS_BATCH_SIZE = 25
BIOGRAPHY_TAG_RE = re.compile(r"<[^>]+>")
BIOGRAPHY_URL_RE = re.compile(r"(https?://\S+|www\.\S+)", re.IGNORECASE)
BIOGRAPHY_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")

CITY_PREFIX_STRIPPERS = (
    "city of ",
    "ciudad de ",
    "cidade de ",
    "municipality of ",
    "santiago de "
)
CITY_SUFFIX_STRIPPERS = (
    " city",
    " municipality",
    " metropolitan area",
    " metro area",
)
DISTRIBUTORS = {
    "ede63b46782e46e19045255f32c0ff0f": "The Orchard",
    "a830a34f35844bd784eac9a7fb395996": "TuneCore Inc.",
    "18fbcef4fb624fc58d4a7fdd230bd523": "PK Interactive / DistroKid",
    "c71b29ea9e1e48c6931da2dd7c0bf5d5": "Believe Digital",
    "b3865addfe5240778a7a8951c12c0d1f": "Queenstreet AB",
    "fe358ea987e2424d9021c2665a0667b7": "Universal Music Group",
    "2bdd92df315b492c9f4bb0ce407ce7de": "CD Baby",
    "8337a6aeaca744a7b32050f0c66e138f": "Warner Music Group",
    "354ace263824416299af258f868b43d3": "A-P Records AB",
    "0f26cfca536a4a69a2baed1eca0a42ec": "FUGA",
    "0a768a0fc630464d8862f7a2c6b0c9e6": "Kontor New Media GmbH",
    "4b67a8da63cd4496afa99dac7684a60e": "Virgin Music Group / InGrooves",
    "7cd978677487466fb9aea2f219ba290b": "iGroove Music",
    "aa9468539d19400ca4c32fdc159926a9": "Sony Music Entertainment",
    "5f22d400477342d0b01f880edf759e37": "Recordjet",
    "3f1980e65bb740b89118d2c5806d3c7d": "ONErpm",
    "e5627993ff8d48b59dfa9b39505640b5": "Routenote",
    "698e71b125a8476aa97aa411bb9b4fb9": "Empire Distribution",
    "749cfd5c7bef4bf48c5a6aec039bbbf6": "Symphonic Distribution",
    "af064b03a15e4224ab24764efe200841": "Label Engine / Create Music Group",
    "61984653554443c3be25691851563fdc": "Label Worx",
    "915f986857f94c6d8ede74191ebf61b1": "Stem Disintermedia",
    "8678e14e8edb48429cb2d2473190f2c0": "Amuseio AB",
    "60315a5bfaa04520a1ee142e2df5b8ca": "DashGo",
    "e0b063f7069449558ac1b5e967fb01bd": "Soundrop",
    "c22dde27ac4f4728bc49760041e721e1": "AudioSalad / Calm and Collected",
    "70d9c3ab1cfa4b21bd20dfa99d64f770": "Repost Network",
    "51dc0a60e30e4d8d9d8e8c6371b999d4": "Dance All Day",
    "ffb2c5e7bae04301b176bd7a5e3be782": "Foundation Media",
    "f5d6eac4fe7a4fd397ca040234f24af8": "Iricom / Digital Aggregator",
    "f4556f1e41604048bf9f93112ca6c6c2": "Too Lost LLC",
    "aa45cf37a7f84ddda54d7a4425b98ca7": "Ditto Music",
    "ba0100ab932e4f7a9d3a7c86ae1713be": "Zebralution GmbH",
    "388baa555ac649cf936c7a732cee4821": "IDOL",
    "9c290842b7fa4396bb0dcb3ad95634f5": "Vydia",
    "519ae781e9c4458abc4bf4dd5f6d682f": "Rebeat Music International",
    "9217c22e0a9b4309a83bcf0bab7e2133": "Kakao Entertainment",
    "82426856604c43119f24d75a3763616b": "Pias Recordings GmbH",
    "e1d17e83962c49a090db9ad45b1af50c": "Translation Enterprises",
    "349f8be8423c476c83a3ec82ca013c26": "DigDis",
    "7591e93c6cb94fc5b98f0098633b12a6": "BWSCD",
    "15a1c99b7fbf4183a3b9ffbeaf853b04": "GYROstream",
    "9eaaaf821a83431598b6cc2b19458621": "Record Union",
    "2917ec33ae924fe8829237b2c35e1182": "The state51 Conspiracy",
    "9edbdff2e31347e392b73eb3010e1a49": "The Orchard Enterprises",
    "eaa35594ac5c4e4b9e10416328c7ebad": "Platoon LTD",
    "699eb2804f044851a523b2163d30ae7b": "Armada Music",
    "d122f0de40ba48b0afbe884ebf9c2ce5": "Absolute Marketing",
    "25ac51b83b0e4e2aa594bf68b9043b20": "Altafonte",
    "28b43d83c8784f3b8e96925308bd580f": "Revelator Enterprises",
    "c69ceeaff4294b5e90a5acfab76b1a0c": "Aloaded",
    "240dc43954714226814bdbdeadd58c10": "Xelon",
    "2376b3370e074eac8348ef07dadff9c6": "Firefly Entertainment",
    "f00b045c5a4c44408dd4b329387bea42": "Emubands",
    "fb79b0911c0642f2b8c9c16066bd128f": "TuneCore Inc. (JP)",
    "88b2b704bfd1459ab86092726d035ce1": "Proton",
    "173930bf531e4d6f96db652cdb0a8e37": "Redeye",
    "b8d35f1fc67b46a9a9de3257484b4e9a": "Paradise Entertainment &",
    "9bbeeeb5938f4b3db01d02b7a1184f92": "LANDR",
    "9dc7168a4b42437397709f4aeecc375f": "Pschent Music",
    "ac0671a5a2764f2199f7b0ffa22c0616": "Venice Innovation",
    "90b881b00b9f4531876fd6817a1d7ef2": "Entertainment One",
    "cc6c2e9b77ea497aa2fbb91c3d97995e": "Nettwerk",
    "7cbd8bc71a55423d9df777bc3a694bbe": "BMG Rights Management",
    "29996865c5a24307a2e0a9c683546c2a": "Catfarm Music",
    "eb5b24ae2a9c49538ed984114c7871aa": "Independent Digital",
    "d95d7a04404645bea15a2498be46cd2d": "Epidemic Sound",
    "0b751d17bbbf466ea86a8c5ea4e7b7bb": "Republic Of Music",
    "d34d54b89e49450fa7780d44a4336059": "SongCast / Horizon Music",
    "75ce59b02e8f439bb9e0fc2d493c9994": "Daredo",
    "9bcf48eecf6d4651be1d7e2aa57ff18e": "Cygnus Music",
    "c4a9a916830a4d8b86c292abe6960201": "EPM Online",
    "c19e30d713b941c38b6b1ef573951934": "DMRS Ltd",
    "05047f7c0f1f42b28f5a7795de589080": "FUGA (Paraviral)",
    "c38dd86d46d44cf3b5ff2571c8127f0b": "AudioSalad",
    "b92f4e5a25da44d38dc6c8c4092159b2": "DashGo Inc",
    "4043fdd7a93d4c1da0114f2545283cf9": "Zebralution",
    "7f767f78b7a94b358fe5f6cd915bfa83": "StageOne Distribution",
    "fc63c3d0224e465aa3f3d88bb08138bc": "SpinUp",
    "b703fa47779b43f3a245f279e77b0539": "Luik Music",
    "cb80ac0caa75452e8e676f8baef7da6f": "8Ball Music",
    "80f69ae78f7c4fd68c865c7b2b5801c9": "Red P Music",
    "91137e7d85a64509bbd44e57b38f9d5c": "LABALABA",
    "0e1c00580b7c4c90a4cc4d558b953540": "Believe Distribution",
    "a4cf731ba1be47fe8ad85c5c2060107a": "On The Corner Music",
    "54ed9b19f56446d4a6d231cd2d701727": "KDigital Media Ltd",
    "670e733f9b074e9f92743aa60a60b872": "Believe Distribution Service",
    "69ae8c82bc384eb6bd11e1351f0fc02f": "MTrax",
    "4b994aa1bdf245b18796ad208cf5d69a": "Quest Management",
    "67714a8c229042c68617dc5e3f52f616": "SoundOn",
    "d3378295da4d4180bf1ba7b745f7c7ae": "eMuzyka",
    "dca8cd5a4e4e4cd8a12609a0b30bd52d": "Danmark Music Group",
    "76963aa0372f4512a21af55e3cc558fb": "Triple Vision Record Distribution",
    "f4012470fb184391a2133012fb792feb": "T-Series (Super Cassettes Industries Private Limited)",
    "eea73a63f2de40fd8d2351804a31f689": "Trap Party",
    "20cd4a77480b4fd4bb49d62dbbeeb60e": "Lujo Network",
    "b0a4cffd5c23499184d33d6581997d4c": "Agora Digital Music",
    "c4124deab2c64d3e9bb192e22a176a36": "Music Video Distributors Inc."
}
# --- Dataclasses ---------------------------------------------------------------

@dataclass
class TrackInfo:
    track_id: str
    name: str
    playcount: Optional[int]
    image_url: Optional[str]


@dataclass
class ReleaseInfo:
    release_id: str
    name: str
    cover_image: Optional[str]
    release_date: Optional[str]
    label: Optional[str] = None
    track_count: Optional[int] = None
    uri: Optional[str] = None
    share_url: Optional[str] = None
    playable: Optional[bool] = None
    release_type: Optional[str] = None


@dataclass
class TrackMetadata:
    track_id: str
    preview_file_id: Optional[str] = None
    licensor_uuid: Optional[str] = None
    language: Optional[str] = None
    isrc: Optional[str] = None
    label: Optional[str] = None
    release_date: Optional[str] = None
    canvas_url: Optional[str] = None

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
    biography: Optional[str] = None
    top_tracks: List[TrackInfo] = field(default_factory=list)
    top_cities: List[CityStat] = field(default_factory=list)
    gallery_images: List[str] = field(default_factory=list)
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


def _normalized_city_keys(name: str) -> List[str]:
    seen: Set[str] = set()
    variants: List[str] = []

    def push(raw: Optional[str]) -> None:
        if not raw:
            return
        normalized = _normalize_city_name(raw)
        if not normalized or normalized in seen:
            return
        seen.add(normalized)
        variants.append(normalized)

    push(name)

    stripped_name = _strip_diacritics(name)
    if stripped_name and stripped_name != name:
        push(stripped_name)

    base_candidates = list(variants)
    for value in base_candidates:
        for delimiter in ("(", ",", "/"):
            if delimiter in value:
                push(value.split(delimiter, 1)[0])
        if "-" in value:
            push(value.replace("-", " "))

    index = 0
    while index < len(variants):
        value = variants[index]
        for suffix in CITY_SUFFIX_STRIPPERS:
            if value.endswith(suffix):
                push(value[: -len(suffix)])
        for prefix in CITY_PREFIX_STRIPPERS:
            if value.startswith(prefix):
                push(value[len(prefix) :])
        if "(" in value:
            push(value.split("(", 1)[0])
        if "," in value:
            push(value.split(",", 1)[0])
        if "/" in value:
            push(value.split("/", 1)[0])
        if "-" in value:
            push(value.replace("-", " "))
        index += 1

    return variants


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
        for normalized_name in _normalized_city_keys(name):
            catalog[(normalized_name, country_code)] = (lat, lon)

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


def _encode_varint(value: int) -> bytes:
    if value < 0:
        raise ValueError("Cannot encode negative integers as varint.")
    buffer = bytearray()
    while True:
        to_write = value & 0x7F
        value >>= 7
        if value:
            buffer.append(to_write | 0x80)
        else:
            buffer.append(to_write)
            break
    return bytes(buffer)


def _decode_varint(buffer: bytes, index: int) -> Tuple[int, int]:
    shift = 0
    result = 0
    while True:
        if index >= len(buffer):
            raise ValueError("Unexpected end of buffer while decoding varint.")
        byte = buffer[index]
        index += 1
        result |= (byte & 0x7F) << shift
        if not (byte & 0x80):
            break
        shift += 7
        if shift >= 64:
            raise ValueError("Varint too long.")
    return result, index


def _skip_field(buffer: bytes, index: int, wire_type: int) -> int:
    if wire_type == 0:  # varint
        while True:
            if index >= len(buffer):
                raise ValueError("Unexpected end of buffer while skipping varint.")
            byte = buffer[index]
            index += 1
            if not (byte & 0x80):
                break
        return index
    if wire_type == 1:  # 64-bit
        return index + 8
    if wire_type == 2:  # length-delimited
        length, index = _decode_varint(buffer, index)
        return index + length
    if wire_type == 5:  # 32-bit
        return index + 4
    raise ValueError(f"Unsupported wire type {wire_type}")


def _iter_chunks(sequence: Sequence[str], size: int) -> List[List[str]]:
    return [list(sequence[idx : idx + size]) for idx in range(0, len(sequence), size)]


def _track_id_from_uri(uri: Optional[str]) -> Optional[str]:
    if not uri:
        return None
    if ":" not in uri:
        return uri
    parts = uri.split(":")
    if not parts:
        return None
    return parts[-1] or None


def _extract_image_id(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    parsed = urlparse(str(url))
    path = parsed.path or str(url)
    identifier = PurePosixPath(path).name or path.rsplit("/", 1)[-1]
    identifier = identifier.strip()
    return identifier or None


def _extract_biography_text(profile: Dict[str, Any]) -> Optional[str]:
    if not isinstance(profile, dict):
        return None
    biography_section = profile.get("biography")
    if not isinstance(biography_section, dict):
        return None
    raw_text = biography_section.get("text")
    if not isinstance(raw_text, str):
        return None
    stripped = BIOGRAPHY_TAG_RE.sub(" ", raw_text)
    without_links = BIOGRAPHY_URL_RE.sub(" ", stripped)
    unescaped = unescape(without_links)
    normalized = " ".join(unescaped.split())
    if not normalized:
        return None
    sentences = BIOGRAPHY_SENTENCE_SPLIT_RE.split(normalized)
    collected: List[str] = []
    for sentence in sentences:
        trimmed = sentence.strip()
        if not trimmed:
            continue
        if collected and _should_merge_sentence(collected[-1], trimmed):
            collected[-1] = f"{collected[-1]} {trimmed}"
        else:
            collected.append(trimmed)
        if len(collected) >= 2:
            break
    if not collected:
        return None
    return " ".join(collected)


def _should_merge_sentence(previous: str, current: str) -> bool:
    if not previous or not current:
        return False
    if not previous.endswith("."):
        return False
    first_char = current[0]
    if first_char.isdigit():
        return True
    abbreviated_match = re.search(r"\b(?:No|Nos|Vol|Vols|St|Mr|Mrs|Ms|Dr|Sr|Jr)\.$", previous)
    if abbreviated_match:
        return True
    if re.search(r"\b[A-Z]\.$", previous):
        return True
    return False


def parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        return None


def ensure_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def parse_optional_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        try:
            return int(float(stripped))
        except ValueError:
            return None
    return None


def history_to_series(
    history: Sequence[ArtistHistoryEntry],
    limit: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    if not history:
        return None

    window = list(history)
    if limit is not None:
        window = window[-limit:]

    if not window:
        return None

    rows: List[List[Any]] = []
    for entry in window:
        rows.append(
            [
                entry.day.isoformat(),
                entry.monthly_listeners,
                entry.followers,
                entry.rank,
            ]
        )

    return {
        "fields": ["d", "ml", "f", "r"],
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


def load_artist_ids_from_payload(path: Path, *, limit: Optional[int] = None) -> List[str]:
    payload = load_json(path)
    if not payload:
        return []
    rows = payload.get("rows")
    if not isinstance(rows, list):
        return []
    collected: List[str] = []
    seen: Set[str] = set()
    for row in rows:
        candidate: Optional[str] = None
        if isinstance(row, list) and row:
            maybe_id = row[0]
            candidate = maybe_id if isinstance(maybe_id, str) else None
        elif isinstance(row, dict):
            candidate = row.get("i") if isinstance(row.get("i"), str) else None
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)
        collected.append(candidate)
        if limit and len(collected) >= limit:
            break
    return collected


def load_artist_ids_from_file(path: Path, *, limit: Optional[int] = None) -> List[str]:
    if not path.exists():
        return []
    collected: List[str] = []
    seen: Set[str] = set()
    try:
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                candidate = line.strip()
                if not candidate or candidate.startswith("#") or candidate in seen:
                    continue
                seen.add(candidate)
                collected.append(candidate)
                if limit and len(collected) >= limit:
                    break
    except OSError as exc:
        logging.warning("Failed to read artist IDs from %s: %s", path, exc)
        return []
    return collected


async def fetch_kworb_artist_ids(limit: int) -> List[str]:
    if limit <= 0:
        return []
    ids: List[str] = []
    seen: Set[str] = set()
    timeout = ClientTimeout(total=15)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        for url in KWORB_LISTENER_URLS:
            try:
                async with session.get(url) as response:
                    response.raise_for_status()
                    html = await response.text()
            except (ClientError, asyncio.TimeoutError) as exc:
                logging.warning("Failed to fetch kworb page %s: %s", url, exc)
                continue
            for match in KWORB_ARTIST_HREF_RE.finditer(html):
                artist_id = match.group(1)
                if not artist_id or artist_id in seen:
                    continue
                seen.add(artist_id)
                ids.append(artist_id)
                if len(ids) >= limit:
                    logging.info("Fetched %s artist ID(s) from kworb.", len(ids))
                    return ids
    if ids:
        logging.info("Fetched %s artist ID(s) from kworb.", len(ids))
    return ids


async def resolve_target_artist_ids() -> List[str]:
    top500_ids = load_artist_ids_from_payload(LATEST_DIR / "top500.json", limit=TOP_ARTIST_LIMIT)
    former_ids = load_artist_ids_from_payload(LATEST_DIR / "former500.json")

    if len(top500_ids) < TOP_ARTIST_LIMIT:
        kworb_ids = await fetch_kworb_artist_ids(TOP_ARTIST_LIMIT)
        added = 0
        for artist_id in kworb_ids:
            if artist_id not in top500_ids:
                top500_ids.append(artist_id)
                added += 1
            if len(top500_ids) >= TOP_ARTIST_LIMIT:
                break
        if added:
            logging.info("Supplemented top500 list with %s artist(s) from kworb.", added)
        else:
            logging.info("kworb fallback did not provide additional unique top500 IDs.")

    if len(top500_ids) < TOP_ARTIST_LIMIT:
        file_ids = load_artist_ids_from_file(ARTIST_IDS_PATH)
        added = 0
        for artist_id in file_ids:
            if artist_id not in top500_ids:
                top500_ids.append(artist_id)
                added += 1
            if len(top500_ids) >= TOP_ARTIST_LIMIT:
                break
        if added:
            logging.info("Supplemented top500 list with %s artist(s) from artist_ids.txt.", added)
        else:
            logging.warning(
                "Unable to fill missing top500 entries; artist_ids.txt provided no new IDs."
            )

    if not top500_ids:
        logging.error("No artist IDs available from latest data, kworb, or artist_ids.txt.")
        return []

    combined = list(dict.fromkeys(top500_ids + former_ids))
    logging.info(
        "Resolved %s top500 artist(s), %s former artist(s), %s total unique.",
        len(top500_ids),
        len(former_ids),
        len(combined),
    )
    return combined


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
        for normalized_name in _normalized_city_keys(name):
            coords = self._city_catalog.get((normalized_name, cc))
            if coords:
                return coords
        base_key = (_normalize_city_name(name), cc)
        if base_key not in self._missing_city_keys:
            self._missing_city_keys.add(base_key)
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
            return ArtistState(history=deque(), first_seen=self.today)

        meta = data.get("meta", {})
        first_seen = parse_date(meta.get("firstSeen")) or self.today
        first_top500 = parse_date(meta.get("first500"))
        last_top500 = parse_date(meta.get("last500"))
        times_entered = int(meta.get("timesEntered500") or 0)
        days_in_top500 = int(meta.get("days500") or 0)
        best_rank = meta.get("br")

        series_data = data.get("series") or data.get("series30")
        history = self._history_from_series(series_data)
        if not history:
            history = deque()

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
        history: Deque[ArtistHistoryEntry] = deque()
        if not series_data:
            return history

        fields = series_data.get("fields", [])
        rows = series_data.get("rows", [])
        if not isinstance(fields, list) or not isinstance(rows, list):
            return history

        field_index = {
            field: index
            for index, field in enumerate(fields)
            if isinstance(field, str)
        }

        # New format includes the date in each row.
        if "d" in field_index:
            for row in rows:
                if not isinstance(row, list):
                    continue
                day_raw = row[field_index["d"]] if field_index["d"] < len(row) else None
                day = parse_date(day_raw) if isinstance(day_raw, str) else None
                if not day:
                    continue
                ml_idx = field_index.get("ml")
                f_idx = field_index.get("f")
                r_idx = field_index.get("r")
                ml = (
                    parse_optional_int(row[ml_idx])
                    if ml_idx is not None and ml_idx < len(row)
                    else None
                )
                followers = (
                    parse_optional_int(row[f_idx])
                    if f_idx is not None and f_idx < len(row)
                    else None
                )
                rank = (
                    parse_optional_int(row[r_idx])
                    if r_idx is not None and r_idx < len(row)
                    else None
                )
                history.append(
                    ArtistHistoryEntry(
                        day=day,
                        rank=rank,
                        monthly_listeners=ml,
                        followers=followers,
                    )
                )
            return history

        # Fallback for legacy series30 format that relies on base date.
        base = parse_date(series_data.get("b"))
        if not base:
            return history
        for idx, row in enumerate(rows):
            if not isinstance(row, list):
                continue
            values = {fields[i]: row[i] if i < len(row) else None for i in range(len(fields))}
            history.append(
                ArtistHistoryEntry(
                    day=base + timedelta(days=idx),
                    rank=parse_optional_int(values.get("r")),
                    monthly_listeners=parse_optional_int(values.get("ml")),
                    followers=parse_optional_int(values.get("f")),
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

        rank_today = latest.rank if latest.rank is not None else 500 + 100
        rank_week = history[-8].rank if len(history) > 7 else None
        rank_delta = 0.0
        if rank_week is not None:
            rank_delta = (rank_week - rank_today) / 500

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

        ranks = [entry.rank if entry.rank is not None else 500 + 100 for entry in recent_history]
        first_avg = sum(ranks[: min(7, len(ranks))]) / min(7, len(ranks))
        last_avg = sum(ranks[-min(7, len(ranks)) :]) / min(7, len(ranks))
        rank_slope = (first_avg - last_avg) / 500

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
                    "canvas": get_field("canvas"),
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
            canvas_url = metadata.canvas_url if metadata and metadata.canvas_url else fallback.get("canvas")
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
                    canvas_url,
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
            canvas_url = metadata.canvas_url if metadata and metadata.canvas_url else info.get("canvas")
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
                    canvas_url,
                ]
            )

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

        biography_value = overview.biography
        if (not biography_value) and existing_detail:
            existing_bio = existing_detail.get("bio")
            if isinstance(existing_bio, str) and existing_bio.strip():
                biography_value = existing_bio.strip()
        if biography_value:
            detail_payload["bio"] = biography_value

        if overview.gallery_images:
            detail_payload["gallery"] = overview.gallery_images

        series_payload = history_to_series(history)
        if series_payload:
            detail_payload["series"] = series_payload

        detail_payload["topTracks"] = {"fields": TRACK_METADATA_FIELDS, "rows": top_tracks_rows}
        detail_payload["topCities"] = {"fields": ["cid", "l"], "rows": top_city_rows}
        detail_payload["relatedArtists"] = list(overview.discovered_artist_ids)
        if existing_detail:
            chart_snapshots = existing_detail.get("chartSnapshots")
            if isinstance(chart_snapshots, dict):
                detail_payload["chartSnapshots"] = chart_snapshots

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


def encode_canvas_request(track_ids: Sequence[str]) -> bytes:
    payload = bytearray()
    for track_id in track_ids:
        if not track_id:
            continue
        track_uri = SPOTIFY_TRACK_URI.format(track_id=track_id)
        uri_bytes = track_uri.encode("utf-8")
        track_message = bytearray()
        track_message.append(0x0A)  # field 1 (track_uri), wire type 2
        track_message.extend(_encode_varint(len(uri_bytes)))
        track_message.extend(uri_bytes)
        payload.append(0x0A)  # field 1 (tracks), wire type 2
        payload.extend(_encode_varint(len(track_message)))
        payload.extend(track_message)
    return bytes(payload)


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
    if licensor_uuid:
        licensor_uuid = DISTRIBUTORS.get(licensor_uuid, licensor_uuid) or None

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


def _parse_canvas_message(buffer: bytes) -> Tuple[Optional[str], Optional[str]]:
    index = 0
    track_uri: Optional[str] = None
    canvas_url: Optional[str] = None
    length = len(buffer)
    while index < length:
        tag = buffer[index]
        index += 1
        field_number = tag >> 3
        wire_type = tag & 0x07
        if wire_type == 2:
            try:
                field_length, index = _decode_varint(buffer, index)
            except ValueError:
                break
            field_data = buffer[index : index + field_length]
            index += field_length
            if field_number == 2:
                try:
                    canvas_url = field_data.decode("utf-8")
                except UnicodeDecodeError:
                    logging.debug("Failed to decode canvas URL bytes for field 2.")
            elif field_number == 5:
                try:
                    track_uri = field_data.decode("utf-8")
                except UnicodeDecodeError:
                    logging.debug("Failed to decode track URI bytes for field 5.")
        else:
            try:
                index = _skip_field(buffer, index, wire_type)
            except ValueError:
                break
    return _track_id_from_uri(track_uri), canvas_url


def parse_canvas_response(payload: bytes) -> Dict[str, str]:
    index = 0
    length = len(payload)
    canvases: Dict[str, str] = {}
    while index < length:
        tag = payload[index]
        index += 1
        field_number = tag >> 3
        wire_type = tag & 0x07
        if field_number == 1 and wire_type == 2:
            try:
                message_length, index = _decode_varint(payload, index)
            except ValueError:
                break
            message_end = index + message_length
            canvas_bytes = payload[index:message_end]
            index = message_end
            track_id, canvas_url = _parse_canvas_message(canvas_bytes)
            if track_id and canvas_url and track_id not in canvases:
                canvases[track_id] = canvas_url
        else:
            try:
                index = _skip_field(payload, index, wire_type)
            except ValueError:
                break
    return canvases


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


async def fetch_canvas_batch(
    session: aiohttp.ClientSession,
    token_manager: TokenManager,
    track_ids: Sequence[str],
    semaphore: asyncio.Semaphore,
) -> Dict[str, str]:
    if not track_ids:
        return {}
    request_body = encode_canvas_request(track_ids)
    if not request_body:
        return {}
    for attempt in range(1, MAX_RETRIES + 1):
        async with semaphore:
            try:
                token = await token_manager.get_token(session)
                headers = {
                    "authorization": f"Bearer {token}",
                    "Accept": "application/protobuf",
                    "Accept-Language": "en",
                    "User-Agent": "Spotify/9.0.34.593 iOS/18.4 (iPhone15,3)",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Content-Type": "application/x-www-form-urlencoded",
                }
                async with session.post(CANVAS_ENDPOINT, data=request_body, headers=headers) as response:
                    if response.status == 404:
                        return {}
                    response.raise_for_status()
                    payload = await response.read()
                    return parse_canvas_response(payload)
            except ClientResponseError as exc:
                if exc.status in (401, 403):
                    logging.warning(
                        "Track canvas batch token rejected (%s) for %s track(s), refreshing.",
                        exc.status,
                        len(track_ids),
                    )
                    token_manager.token = None
                    token_manager.expiration_timestamp = 0
                else:
                    logging.error(
                        "Track canvas batch client error (%s) for %s track(s): %s",
                        exc.status,
                        len(track_ids),
                        exc,
                    )
                    return {}
            except (asyncio.TimeoutError, ClientError) as exc:
                logging.error("Track canvas batch transport error for %s track(s): %s", len(track_ids), exc)
            except ValueError as exc:
                logging.error("Track canvas batch parsing error for %s track(s): %s", len(track_ids), exc)
                return {}
        backoff = (2 ** attempt) + random.uniform(0, 1)
        await asyncio.sleep(backoff)
    logging.error("Exceeded track canvas retries for %s track(s)", len(track_ids))
    return {}


async def fetch_many_track_canvas(
    track_ids: Sequence[str],
    session: aiohttp.ClientSession,
    token_manager: TokenManager,
    semaphore: asyncio.Semaphore,
) -> Dict[str, str]:
    unique_ids = [track_id for track_id in dict.fromkeys(track_ids) if isinstance(track_id, str) and track_id]
    if not unique_ids:
        return {}
    chunks = _iter_chunks(unique_ids, CANVAS_BATCH_SIZE)
    tasks = [
        asyncio.create_task(fetch_canvas_batch(session, token_manager, chunk, semaphore)) for chunk in chunks
    ]
    results: Dict[str, str] = {}
    for chunk, task in zip(chunks, tasks):
        try:
            batch_result = await task
        except Exception as exc:  # pragma: no cover
            logging.error("Unexpected track canvas batch error for %s track(s): %s", len(chunk), exc)
            batch_result = {}
        for track_id in chunk:
            canvas_url = batch_result.get(track_id)
            if canvas_url:
                results[track_id] = canvas_url
    return results


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
    if results:
        canvas_map = await fetch_many_track_canvas(unique_ids, session, token_manager, semaphore)
        if canvas_map:
            for track_id, canvas_url in canvas_map.items():
                metadata = results.get(track_id)
                if metadata:
                    metadata.canvas_url = canvas_url
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

    biography = _extract_biography_text(profile)
    top_tracks = _parse_top_tracks(discography.get("topTracks", {}).get("items", []))
    gallery_images = _parse_gallery_images(visuals)
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
        biography=biography,
        top_tracks=top_tracks,
        top_cities=top_cities,
        gallery_images=gallery_images,
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

def _format_release_date(date_info: Optional[Dict[str, Any]]) -> Optional[str]:
    if not isinstance(date_info, dict):
        return None
    year = _parse_int(date_info.get("year"))
    if not year:
        return None
    month = _parse_int(date_info.get("month"))
    day = _parse_int(date_info.get("day"))
    if month and day:
        return f"{year:04d}-{month:02d}-{day:02d}"
    if month:
        return f"{year:04d}-{month:02d}"
    return f"{year:04d}"


def _parse_gallery_images(visuals: Dict[str, Any]) -> List[str]:
    gallery_images: List[str] = []
    gallery_section = visuals.get("gallery") if isinstance(visuals, dict) else None
    items = gallery_section.get("items") if isinstance(gallery_section, dict) else None
    if not isinstance(items, list):
        return gallery_images
    for item in items:
        if not isinstance(item, dict):
            continue
        sources = item.get("sources")
        if not isinstance(sources, list):
            continue
        for source in sources:
            if not isinstance(source, dict):
                continue
            image_id = _extract_image_id(source.get("url"))
            if image_id and image_id not in gallery_images:
                gallery_images.append(image_id)
    return gallery_images

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
    artist_ids = await resolve_target_artist_ids()
    if not artist_ids:
        return


    store = ArtistDataStore(today)
    token_manager = TokenManager()
    timeout = ClientTimeout(total=None, sock_connect=REQUEST_TIMEOUT_SECONDS, sock_read=REQUEST_TIMEOUT_SECONDS)
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

    fetch_results: Dict[str, ArtistOverview] = {}
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
