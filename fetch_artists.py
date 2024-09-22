import asyncio
import aiohttp
import json
from urllib.parse import quote
from datetime import datetime, timezone

async def fetch_access_token(session):
    url = 'https://open.spotify.com/get_access_token'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    }
    async with session.get(url, headers=headers) as response:
        response.raise_for_status()
        data = await response.json()
        return data['accessToken']


async def fetch_artist_data_with_retry(session, artist_id, access_token, max_retries=10, delay=2):
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
            async with session.get(url, headers=headers) as response:
                response.raise_for_status()
                data = await response.json()

                artist_data = data.get('data', {}).get('artistUnion', {})
                if not artist_data:
                    raise ValueError(f"Unexpected or missing 'artistUnion' key in API response for artist {artist_id}")

                if not data or 'data' not in data or not data['data']:
                    raise ValueError("Unexpected or missing 'data' key in API response")

                return {
                    'id': artist_id,
                    'name': artist_data.get('profile', {}).get('name', None),
                    'img': artist_data.get('visuals', {}).get('avatarImage', {}).get('sources', [{}])[0].get('url', '').split('/')[-1] if artist_data.get('visuals', {}).get('avatarImage', {}).get('sources', [{}])[0].get('url') else None,
                    'listeners': artist_data.get('stats', {}).get('monthlyListeners', None),
                    'followers': artist_data.get('stats', {}).get('followers', None),
                    'rank': artist_data.get('stats', {}).get('worldRank', None),
                    'top': artist_data.get('stats', {}).get('topCities', None).get('items', None)
                }

        except (aiohttp.ClientError, aiohttp.ClientResponseError, ValueError, KeyError) as e:
            if attempt == max_retries - 1:
                print(f"Failed to fetch data for artist {artist_id} after {max_retries} attempts")
                return None
            await asyncio.sleep(delay)
            delay += 1



async def process_artist(session, artist_id, access_token):
    try:
        return await fetch_artist_data_with_retry(session, artist_id, access_token)
    except Exception as e:
        print(f"Unexpected error for artist {artist_id}: {str(e)}")
        return None


async def main():
    async with aiohttp.ClientSession() as session:
        access_token = await fetch_access_token(session)

        with open('artist_ids.txt', 'r') as f:
            artist_ids = [line.strip() for line in f]

        tasks = [process_artist(session, artist_id, access_token) for artist_id in artist_ids]
        results = await asyncio.gather(*tasks)

    artist_data = [result for result in results if result]

    artist_data_sorted = sorted(
        [artist for artist in artist_data if artist['rank'] != 0],
        key=lambda x: (x['rank'] if x['rank'] is not None else float('inf'), x['name'].lower() if x['name'] else '')
    )

    final_data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "artists": artist_data_sorted
    }

    with open('public/spotify_artists_data.json', 'w', encoding='utf-8') as f:
        json.dump(final_data, f, separators=(',', ':'), ensure_ascii=False)


asyncio.run(main())
