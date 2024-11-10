import asyncio
import aiohttp
import json
from urllib.parse import quote
from datetime import datetime, timezone
import random
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Constants
MAX_CONCURRENT_REQUESTS = 1000
RATE_LIMIT = 1000  # requests per second
REQUEST_TIMEOUT = 15  # seconds
MAX_RETRIES = 5  # Maximum retries for network calls

async def fetch_access_token(session):
    url = 'https://open.spotify.com/get_access_token'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    }
    try:
        async with session.get(url, headers=headers) as response:
            response.raise_for_status()
            data = await response.json()
            return data['accessToken']
    except Exception as e:
        logging.error(f"Failed to fetch access token: {e}")
        return None

async def fetch_artist_data_with_retry(session, artist_id, access_token, artist_ids_set, max_retries=MAX_RETRIES, delay=2):
    operationName = "queryArtistOverview"
    variables = json.dumps({"uri": f"spotify:artist:{artist_id}", "locale": "", "includePrerelease": True})
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
                artist_data = data.get('data', {}) if data.get('data', {}) is not None else None
                if not artist_data:
                    raise ValueError()
                artist_union = data.get('data', {}).get('artistUnion', {}) if data.get('data', {}).get('artistUnion', {}) is not None else None
                if not artist_union:
                    raise ValueError()

                profile = artist_union.get('profile') if artist_union.get('profile') is not None else None
                stats = artist_union.get('stats') if artist_union.get('stats') is not None else None
                visuals = artist_union.get('visuals') if artist_union.get('visuals') is not None else None
                image = visuals.get('avatarImage', {}).get('sources', [{}])[0].get('url', '').split('/')[-1] if visuals.get('avatarImage') and visuals.get('avatarImage').get('sources') is not None else None

                result = {
                    'i': artist_id,
                    'n': profile.get('name') if profile.get('name') is not None else None,
                    'p': image,
                    'l': stats.get('monthlyListeners') if stats.get('monthlyListeners') is not None else None,
                    'f': stats.get('followers') if stats.get('followers') is not None else None,
                    'r': stats.get('worldRank') if stats.get('worldRank') is not None else None,
                }

                result = {key: value for key, value in result.items() if value is not None}

                top_cities = stats.get('topCities', {}).get('items', []) if stats.get('topCities') and stats.get('topCities').get('items', []) is not None else []
                if top_cities:
                    result['t'] = [
                        {
                            'x': city.get('city') if city.get('city') is not None else None,
                            'c': city.get('country') if city.get('country') is not None else None,
                            'l': city.get('numberOfListeners') if city.get('numberOfListeners') is not None else None
                        }
                        for city in top_cities if
                        city.get('city') and city.get('country') and city.get('numberOfListeners') is not None
                    ]

                if result.get('l') and result['l'] > 5000000:
                    related_artists = artist_union.get('relatedContent', {}).get('relatedArtists', {}).get('items', [])
                    for related_artist in related_artists:
                        related_artist_id = related_artist.get('id')
                        if related_artist_id:
                            artist_ids_set.add(related_artist_id)

                return result

        except (aiohttp.ClientError, aiohttp.ClientResponseError, ValueError, KeyError) as e:
            logging.error(f"{artist_id}: Fetch retry occurred - Attempt {attempt} - {type(e).__name__}: {str(e)}")
            if attempt == max_retries - 1:
                return None
            backoff = delay * 2 ** attempt + random.uniform(0, 1)
            await asyncio.sleep(backoff)

async def process_artist(session, artist_id, access_token, semaphore, artist_ids_set):
    async with semaphore:
        try:
            return await fetch_artist_data_with_retry(session, artist_id, access_token, artist_ids_set)
        except Exception as e:
            logging.error(f"{artist_id}: Error occurred - {type(e).__name__}: {str(e)}")
            return None


async def main():
    artist_ids_set = set()
    try:
        async with aiohttp.ClientSession() as session:
            access_token = await fetch_access_token(session)

            if not access_token:
                logging.error("Access token fetch failed. Exiting.")
                return

            with open('artist_ids.txt', 'r') as f:
                artist_ids = [line.strip() for line in f]
                artist_ids_set.update(artist_ids)

            logging.info(f"Read {len(artist_ids)} artists successfully.")

            random.shuffle(artist_ids)  # Distribute load

            logging.info(f"Shuffled artists successfully.")

            semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
            tasks = [process_artist(session, artist_id, access_token, semaphore, artist_ids_set) for artist_id in artist_ids]

            results = []
            for future in asyncio.as_completed(tasks):
                result = await future
                if result:
                    results.append(result)

        artist_data = results

        # Process and sort as before
        top_artist_data_sorted = sorted(
            [artist for artist in artist_data if artist.get('r') is not None and artist.get('r') != 0],
            key=lambda x: (x['r'] if x['r'] is not None else float('inf'), x['n'].lower() if x['n'] else '')
        )

        final_data = {
            "t": datetime.now(timezone.utc).isoformat(),
            'x': top_artist_data_sorted,
            "a": sorted(artist_data, key=lambda x: x['n'].lower() if x['n'] else '')
        }

        with open('public/spotify_artists_data.json', 'w', encoding='utf-8') as f:
            json.dump(final_data, f, separators=(',', ':'), ensure_ascii=False)

        logging.info(f"Processed {len(artist_data)} artists successfully. {len(artist_ids) - len(artist_data)} artists failed.")

    except Exception as e:
        logging.error(f"Error in main execution: {e}")


asyncio.run(main())
