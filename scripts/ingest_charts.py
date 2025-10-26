import asyncio
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import aiohttp
from aiohttp import ClientError, ClientResponseError, ClientTimeout

from utils import Utils
from token_service import TokenManager

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ARTISTS_DIR = PROJECT_ROOT / "public" / "data" / "artists"

CHART_ENDPOINTS: Tuple[Tuple[str, str], ...] = (
    ("https://charts-spotify-com-service.spotify.com/auth/v0/charts/artist-global-daily/latest", "DAILY"),
    ("https://charts-spotify-com-service.spotify.com/auth/v0/charts/artist-global-weekly/latest", "WEEKLY"),
)

REQUEST_TIMEOUT = ClientTimeout(total=20)
MAX_ATTEMPTS = 4
MAX_SNAPSHOTS_PER_RECURRENCE = 400
SNAPSHOT_KEYS: Tuple[str, ...] = (
    "date",
    "recurrence",
    "chartType",
    "artistName",
    "currentRank",
    "previousRank",
    "peakRank",
    "peakDate",
    "appearancesOnChart",
    "consecutiveAppearancesOnChart",
    "entryStatus",
    "entryRank",
    "entryDate",
)


def ensure_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


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


def artist_path(artist_id: str) -> Path:
    return ARTISTS_DIR / artist_id[:2].lower() / f"{artist_id}.json"


def extract_artist_id(uri: Optional[str]) -> Optional[str]:
    if not uri or not isinstance(uri, str):
        return None
    if not uri.startswith("spotify:artist:"):
        return None
    artist_id = uri.split(":")[-1].strip()
    if not artist_id:
        return None
    return artist_id


def coerce_int(value: Any) -> Optional[int]:
    if value is None:
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


@dataclass
class ChartContext:
    date: Optional[str]
    recurrence: Optional[str]
    chart_type: Optional[str]


class ArtistChartStore:
    def __init__(self, root: Path, *, max_entries: int = MAX_SNAPSHOTS_PER_RECURRENCE):
        self.root = root
        self.max_entries = max_entries
        self._cache: Dict[str, Optional[Dict[str, Any]]] = {}
        self._dirty: Dict[str, bool] = {}

    def load(self, artist_id: str) -> Optional[Dict[str, Any]]:
        if artist_id not in self._cache:
            path = artist_path(artist_id)
            self._cache[artist_id] = load_json(path)
        return self._cache[artist_id]

    def upsert(self, artist_id: str, snapshot: Dict[str, Any]) -> bool:
        detail = self.load(artist_id)
        if not detail:
            return False

        recurrence = snapshot.get("recurrence")
        date = snapshot.get("date")
        if not recurrence or not date:
            return False

        snapshots = detail.get("chartSnapshots")
        if not isinstance(snapshots, dict):
            snapshots = {}

        bucket = snapshots.get(recurrence)
        if not isinstance(bucket, dict):
            bucket = {}

        rows = bucket.get("rows")
        if not isinstance(rows, list):
            rows = []

        filtered_rows: List[Dict[str, Any]] = [row for row in rows if isinstance(row, dict)]
        existing_index: Optional[int] = None
        for index, row in enumerate(filtered_rows):
            if row.get("date") == date:
                existing_index = index
                break

        if existing_index is not None:
            existing_row = filtered_rows[existing_index]
            if all(existing_row.get(key) == snapshot.get(key) for key in SNAPSHOT_KEYS):
                return False
            filtered_rows.pop(existing_index)

        filtered_rows.append(snapshot)
        filtered_rows.sort(key=lambda entry: entry.get("date") or "", reverse=True)
        if self.max_entries and len(filtered_rows) > self.max_entries:
            filtered_rows = filtered_rows[: self.max_entries]

        bucket["rows"] = filtered_rows
        bucket["chartType"] = snapshot.get("chartType") or bucket.get("chartType")
        snapshots[recurrence] = bucket
        detail["chartSnapshots"] = snapshots
        self._cache[artist_id] = detail
        self._dirty[artist_id] = True
        return True

    def flush(self) -> None:
        for artist_id in list(self._dirty.keys()):
            payload = self._cache.get(artist_id)
            if not payload:
                continue
            path = artist_path(artist_id)
            dump_json(path, payload)
        self._dirty.clear()


async def fetch_chart_payload(
    session: aiohttp.ClientSession,
    token_manager: TokenManager,
    url: str,
) -> Optional[Dict[str, Any]]:
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            token = await token_manager.get_token(session)
            headers = {
                "authorization": f"Bearer {token}",
                "accept": "application/json",
                "app-platform": "Browser",
                "user-agent": Utils.get_random_user_agent()
            }
            async with session.get(url, headers=headers) as response:
                try:
                    response.raise_for_status()
                except ClientResponseError as exc:
                    if exc.status in (401, 403):
                        logging.warning("Chart endpoint rejected token (%s); refreshing.", exc.status)
                        token_manager.token = None
                        token_manager.expiration_timestamp = 0
                        await asyncio.sleep(1)
                        continue
                    logging.error("Chart endpoint error %s for %s: %s", exc.status, url, exc)
                    return None

                try:
                    return await response.json()
                except (json.JSONDecodeError, ClientError) as exc:
                    logging.error("Failed to decode chart payload for %s: %s", url, exc)
                    return None
        except (asyncio.TimeoutError, ClientError) as exc:
            logging.error("Transport error for %s: %s", url, exc)
        await asyncio.sleep(2 ** attempt)
    logging.error("Exceeded retries for %s", url)
    return None


def parse_chart_context(payload: Dict[str, Any]) -> ChartContext:
    display_chart = payload.get("displayChart") or {}
    chart_metadata = display_chart.get("chartMetadata") or {}
    dimensions = chart_metadata.get("dimensions") or {}
    recurrence = dimensions.get("recurrence")
    if isinstance(recurrence, str):
        recurrence = recurrence.upper()
    chart_type = dimensions.get("chartType")
    date = display_chart.get("date")
    return ChartContext(date=date if isinstance(date, str) else None, recurrence=recurrence, chart_type=chart_type)


def snapshot_from_entry(context: ChartContext, entry: Dict[str, Any]) -> Optional[Tuple[str, Dict[str, Any]]]:
    artist_meta = entry.get("artistMetadata") or {}
    chart_data = entry.get("chartEntryData") or {}
    artist_uri = artist_meta.get("artistUri")
    artist_id = extract_artist_id(artist_uri)
    if not artist_id:
        return None

    snapshot = {
        "date": context.date,
        "recurrence": context.recurrence,
        "chartType": context.chart_type,
        "artistName": artist_meta.get("artistName"),
        "currentRank": coerce_int(chart_data.get("currentRank")),
        "previousRank": coerce_int(chart_data.get("previousRank")),
        "peakRank": coerce_int(chart_data.get("peakRank")),
        "peakDate": chart_data.get("peakDate"),
        "appearancesOnChart": coerce_int(chart_data.get("appearancesOnChart")),
        "consecutiveAppearancesOnChart": coerce_int(chart_data.get("consecutiveAppearancesOnChart")),
        "entryStatus": chart_data.get("entryStatus"),
        "entryRank": coerce_int(chart_data.get("entryRank")),
        "entryDate": chart_data.get("entryDate"),
    }

    if not snapshot["date"] or not snapshot["recurrence"]:
        return None
    return artist_id, snapshot


async def ingest_chart(
    session: aiohttp.ClientSession,
    token_manager: TokenManager,
    url: str,
    expected_recurrence: str,
    store: ArtistChartStore,
) -> Tuple[int, int]:
    payload = await fetch_chart_payload(session, token_manager, url)
    if not payload:
        return 0, 0

    context = parse_chart_context(payload)
    if context.recurrence != expected_recurrence:
        logging.warning(
            "Unexpected recurrence %s for %s (expected %s). Skipping.",
            context.recurrence,
            url,
            expected_recurrence,
        )
        return 0, 0
    if context.chart_type:
        normalized_type = context.chart_type.upper()
        allowed_types = {"ARTIST", "TOP_ARTIST"}
        if normalized_type not in allowed_types:
            logging.warning("Unexpected chart type %s for %s", context.chart_type, url)
            return 0, 0

    entries = payload.get("entries")
    if not isinstance(entries, list):
        logging.warning("No entries found in chart payload for %s", url)
        return 0, 0

    processed = 0
    upserts = 0
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        parsed = snapshot_from_entry(context, entry)
        if not parsed:
            continue
        artist_id, snapshot = parsed
        processed += 1
        if store.upsert(artist_id, snapshot):
            upserts += 1
    return processed, upserts


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    store = ArtistChartStore(ARTISTS_DIR)
    token_manager = TokenManager()

    async with aiohttp.ClientSession(timeout=REQUEST_TIMEOUT) as session:
        for url, recurrence in CHART_ENDPOINTS:
            try:
                processed, upserts = await ingest_chart(session, token_manager, url, recurrence, store)
            except Exception as exc:  # pragma: no cover
                logging.exception("Unhandled error ingesting %s: %s", url, exc)
                continue
            logging.info("Processed %s entries for %s (%s upserts).", processed, recurrence, upserts)

    store.flush()


if __name__ == "__main__":
    asyncio.run(main())
