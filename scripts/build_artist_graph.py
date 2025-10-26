import json
import logging
from collections import Counter
from pathlib import Path
from typing import Dict, List, Set, Tuple

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "public" / "data"
LATEST_DIR = DATA_DIR / "latest"
ARTISTS_DIR = DATA_DIR / "artists"
TOP500_PATH = LATEST_DIR / "top500.json"
OUTPUT_PATH = LATEST_DIR / "artist-graph.json"


def load_top500() -> Dict[str, Dict[str, str]]:
    if not TOP500_PATH.exists():
        raise FileNotFoundError(f"Missing dataset {TOP500_PATH}")
    with TOP500_PATH.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    fields = payload.get("fields", [])
    rows = payload.get("rows", [])
    if not isinstance(fields, list) or "i" not in fields or "n" not in fields:
        raise ValueError("Invalid top500 schema")

    field_index = {field: idx for idx, field in enumerate(fields)}
    id_idx = field_index["i"]
    name_idx = field_index["n"]
    image_idx = field_index.get("p")

    artists: Dict[str, Dict[str, str]] = {}
    for row in rows:
        if not isinstance(row, list):
            continue
        try:
            artist_id = row[id_idx]
            name = row[name_idx]
        except IndexError:
            continue
        if not isinstance(artist_id, str) or not isinstance(name, str):
            continue
        image_hash = ""
        if isinstance(image_idx, int) and image_idx < len(row):
            value = row[image_idx]
            if isinstance(value, str):
                image_hash = value
        artists[artist_id] = {"id": artist_id, "name": name, "imageHash": image_hash}
    return artists


def artist_path(artist_id: str) -> Path:
    return ARTISTS_DIR / artist_id[:2].lower() / f"{artist_id}.json"


def build_graph_nodes(top500_map: Dict[str, Dict[str, str]]) -> List[Dict[str, str]]:
    nodes = []
    for artist in top500_map.values():
        nodes.append(
            {
                "i": artist["id"],
                "n": artist["name"],
                "p": artist.get("imageHash") or "",
            }
        )
    nodes.sort(key=lambda entry: entry["n"].casefold())
    return nodes


def build_graph_links(top500_map: Dict[str, Dict[str, str]]) -> Tuple[List[Dict[str, str]], Counter]:
    edges: Set[Tuple[str, str]] = set()
    degree = Counter()

    for artist_id in top500_map:
        path = artist_path(artist_id)
        if not path.exists():
            continue
        try:
            payload = json.load(path.open("r", encoding="utf-8"))
        except json.JSONDecodeError:
            logging.warning("Skipping invalid JSON for %s", artist_id)
            continue
        related = payload.get("relatedArtists")
        if not isinstance(related, list):
            continue
        for candidate in related:
            if not isinstance(candidate, str) or candidate == artist_id:
                continue
            if candidate not in top500_map:
                continue
            source, target = sorted((artist_id, candidate))
            if (source, target) in edges:
                continue
            edges.add((source, target))
            degree[source] += 1
            degree[target] += 1

    links = [{"source": source, "target": target} for source, target in sorted(edges)]
    return links, degree


def write_output(nodes: List[Dict[str, str]], links: List[Dict[str, str]]) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as handle:
        json.dump({"nodes": nodes, "links": links}, handle, separators=(",", ":"), ensure_ascii=False)


def log_stats(nodes: List[Dict[str, str]], links: List[Dict[str, str]], degree: Counter) -> None:
    logging.info("Graph nodes: %s", len(nodes))
    logging.info("Graph links: %s", len(links))
    if degree:
        top = degree.most_common(10)
        logging.info("Top 10 by degree:")
        for artist_id, count in top:
            logging.info("  %s (%s)", artist_id, count)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    top500_map = load_top500()
    nodes = build_graph_nodes(top500_map)
    links, degree = build_graph_links(top500_map)
    write_output(nodes, links)
    log_stats(nodes, links, degree)


if __name__ == "__main__":
    main()
