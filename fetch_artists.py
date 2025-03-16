import asyncio
import aiohttp
import json
from urllib.parse import quote
from datetime import datetime, timezone
import time
import random
import logging
from playwright.async_api import async_playwright

# Logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Constants
MAX_CONCURRENT_REQUESTS = 1000
REQUEST_TIMEOUT = 15
MAX_RETRIES = 5


class TokenManager:
    def __init__(self):
        self.token = None
        self.expiration_timestamp = 0

    def is_token_expired(self):
        return int(time.time() * 1000) >= self.expiration_timestamp

    async def fetch_token(self):
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context()
            page = await context.new_page()

            token_data = {}

            async def handle_response(response):
                nonlocal token_data
                if "get_access_token" in response.url and response.status == 200:
                    try:
                        json_data = await response.json()
                        token_data = {
                            "accessToken": json_data.get("accessToken"),
                            "expiration": json_data.get("accessTokenExpirationTimestampMs", 0)
                        }
                    except Exception as e:
                        logging.error(f"Token parse error: {e}")

            page.on("response", handle_response)
            await page.goto("https://open.spotify.com", wait_until="networkidle")
            await asyncio.sleep(5)
            await browser.close()

            if not token_data.get("accessToken"):
                logging.error("Failed to fetch token via browser.")
                return None

            self.token = token_data["accessToken"]
            self.expiration_timestamp = token_data["expiration"]

            expires_in_ms = self.expiration_timestamp - int(time.time() * 1000)
            expires_in_sec = expires_in_ms // 1000
            mins, secs = divmod(expires_in_sec, 60)
            exp_time_str = datetime.utcfromtimestamp(self.expiration_timestamp / 1000).strftime('%Y-%m-%d %H:%M:%S UTC')

            logging.info(
                f"[+] Got new token ✔️\n"
                f"    ├─ Expires in: {mins} min {secs} sec\n"
                f"    └─ Exact time: {exp_time_str}"
            )

            return self.token

    async def get_token(self):
        if self.token is None or self.is_token_expired():
            logging.info("[*] Token expired or missing, fetching new token...")
            return await self.fetch_token()
        return self.token


async def fetch_artist_data_with_retry(session, artist_id, access_token, artist_ids_set, max_retries=MAX_RETRIES, delay=2):
    operationName = "queryArtistOverview"
    variables = json.dumps({
        "uri": f"spotify:artist:{artist_id}",
        "locale": "",
        "includePrerelease": True
    })
    extensions = '{"persistedQuery":{"version":1,"sha256Hash":"7c5a08a226e4dc96387c0c0a5ef4bd1d2e2d95c88cbb33dcfa505928591de672"}}'
    url = f"https://api-partner.spotify.com/pathfinder/v1/query?operationName={operationName}&variables={quote(variables)}&extensions={quote(extensions)}"

    headers = {
        'authorization': f"Bearer {access_token}",
        'app-platform': 'WebPlayer',
        'spotify-app-version': '896000000'
    }

    for attempt in range(max_retries):
        try:
            async with session.get(url, headers=headers, timeout=REQUEST_TIMEOUT) as response:
                response.raise_for_status()
                data = await response.json()
                if not data or 'data' not in data:
                    raise ValueError("Missing 'data' key")
                artist_data = data.get('data', {})
                if not artist_data:
                    raise ValueError()

                artist_union = artist_data.get('artistUnion', {})
                if not artist_union:
                    raise ValueError()

                profile = artist_union.get('profile')
                stats = artist_union.get('stats')
                visuals = artist_union.get('visuals')
                image = visuals.get('avatarImage', {}).get('sources', [{}])[0].get('url', '').split('/')[-1] if visuals else None

                result = {
                    'i': artist_id,
                    'n': profile.get('name') if profile else None,
                    'p': image,
                    'l': stats.get('monthlyListeners') if stats else None,
                    'f': stats.get('followers') if stats else None,
                    'r': stats.get('worldRank') if stats else None,
                }

                result = {key: value for key, value in result.items() if value is not None}

                top_cities = stats.get('topCities', {}).get('items', []) if stats else []
                if top_cities:
                    result['t'] = [
                        {
                            'x': city.get('city'),
                            'c': city.get('country'),
                            'l': city.get('numberOfListeners')
                        }
                        for city in top_cities
                        if city.get('city') and city.get('country') and city.get('numberOfListeners') is not None
                    ]

                if result.get('l') and result['l'] > 5000000:
                    related_artists = artist_union.get('relatedContent', {}).get('relatedArtists', {}).get('items', [])
                    for related_artist in related_artists:
                        related_artist_id = related_artist.get('id')
                        if related_artist_id:
                            artist_ids_set.add(related_artist_id)

                return result

        except Exception as e:
            logging.error(f"{artist_id}: Retry {attempt} - {type(e).__name__}: {str(e)}")
            if attempt == max_retries - 1:
                return None
            backoff = delay * 2 ** attempt + random.uniform(0, 1)
            await asyncio.sleep(backoff)


async def process_artist_with_token_check(session, artist_id, token_manager, semaphore, artist_ids_set):
    async with semaphore:
        try:
            token = await token_manager.get_token()
            return await fetch_artist_data_with_retry(session, artist_id, token, artist_ids_set)
        except Exception as e:
            logging.error(f"{artist_id}: Error - {type(e).__name__}: {str(e)}")
            return None


async def main():
    artist_ids_set = set()
    token_manager = TokenManager()

    try:
        async with aiohttp.ClientSession() as session:
            token = await token_manager.get_token()
            if not token:
                logging.error("Access token fetch failed. Exiting.")
                return

            with open('artist_ids.txt', 'r') as f:
                artist_ids = [line.strip() for line in f]
                artist_ids_set.update(artist_ids)

            logging.info(f"Loaded {len(artist_ids)} artist IDs.")
            random.shuffle(artist_ids)

            semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
            tasks = [
                process_artist_with_token_check(session, artist_id, token_manager, semaphore, artist_ids_set)
                for artist_id in artist_ids
            ]

            results = []
            for future in asyncio.as_completed(tasks):
                result = await future
                if result:
                    results.append(result)

        artist_data = results

        top_artist_data_sorted = sorted(
            [artist for artist in artist_data if artist.get('r') is not None and artist.get('r') != 0],
            key=lambda x: (x['r'], x['n'].lower() if x['n'] else '')
        )

        final_data = {
            "t": datetime.now(timezone.utc).isoformat(),
            "x": top_artist_data_sorted,
            "a": sorted(artist_data, key=lambda x: x['n'].lower() if x['n'] else '')
        }

        with open('public/spotify_artists_data.json', 'w', encoding='utf-8') as f:
            json.dump(final_data, f, separators=(',', ':'), ensure_ascii=False)

        logging.info(f"Saved data for {len(artist_data)} artists.")

        with open('artist_ids.txt', 'w') as f:
            for artist_id in artist_ids_set:
                f.write(f"{artist_id}\n")

        logging.info(f"Updated artist_ids.txt with {len(artist_ids_set)} total artists.")

    except Exception as e:
        logging.error(f"Main error: {e}")


if __name__ == "__main__":
    asyncio.run(main())
