# import json
# import os
# from datetime import datetime, timezone
# import logging
# import pycountry
#
# # Logging setup
# logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
#
# BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# SPOTIFY_ARTISTS_DATA_FILE = os.path.join(BASE_DIR, '..', 'public', 'spotify_artists_data.json')
# CITIES_DATA_FILE = os.path.join(BASE_DIR, '..', 'public', 'cities.json')
# PROCESSED_MAP_DATA_FILE = os.path.join(BASE_DIR, '..', 'public', 'processed_map_data.json')
#
# def process_map_data():
#     logging.info("Starting to process map data for artists and cities.")
#     try:
#         with open(SPOTIFY_ARTISTS_DATA_FILE, 'r', encoding='utf-8') as f:
#             spotify_artists_data = json.load(f)
#         with open(CITIES_DATA_FILE, 'r', encoding='utf-8') as f:
#             cities_data = json.load(f)
#     except FileNotFoundError as e:
#         logging.error(f"Error: Required data file not found: {e.filename}")
#         return
#     except json.JSONDecodeError as e:
#         logging.error(f"Error: Could not decode JSON from a data file: {e}")
#         return
#
#     # Create a lookup map for cities
#     city_lookup = {}
#     for city in cities_data:
#         city_name = city.get('n', '').lower()
#         country_code = city.get('c', '').lower()
#         key = f"{city_name}|{country_code}"
#         city_lookup[key] = {
#             'lat': city.get('l'),
#             'lng': city.get('L')
#         }
#
#     # Initialize data structures
#     city_markers = {}  # Using dict for deduplication
#     artists_by_country = {}
#
#     # Process artists data
#     if spotify_artists_data and 'a' in spotify_artists_data and isinstance(spotify_artists_data['a'], list):
#         for artist in spotify_artists_data['a']:
#             if not isinstance(artist.get('t'), list):
#                 continue
#
#             artist_name = artist.get('n')
#             artist_image = artist.get('p')
#
#             for top_city_data in artist['t']:
#                 city_name = top_city_data.get('x', '').lower()
#                 country_code = top_city_data.get('c', '').lower()
#                 listeners = top_city_data.get('l', 0)
#
#                 # Look up city coordinates
#                 city_key = f"{city_name}|{country_code}"
#                 city_coords = city_lookup.get(city_key)
#                 if not city_coords:
#                     continue
#
#                 # Process city marker
#                 if city_key not in city_markers:
#                     city_markers[city_key] = {
#                         'city': top_city_data.get('x'),  # Original case
#                         'country': country_code.upper(),  # ISO country code
#                         'lat': city_coords['lat'],
#                         'lng': city_coords['lng'],
#                         'artists': []
#                     }
#
#                 # Add artist to city
#                 city_markers[city_key]['artists'].append({
#                     'artist': artist_name,
#                     'listeners': listeners,
#                     'image': artist_image
#                 })
#
#                 # Process country data
#                 try:
#                     country_obj = pycountry.countries.get(alpha_2=country_code.upper())
#                     if country_obj:
#                         country_name = country_obj.name.lower()
#                         if country_name not in artists_by_country:
#                             artists_by_country[country_name] = {}
#
#                         if artist_name not in artists_by_country[country_name]:
#                             artists_by_country[country_name][artist_name] = {
#                                 'artist': artist_name,
#                                 'listeners': listeners,
#                                 'image': artist_image
#                             }
#                         else:
#                             artists_by_country[country_name][artist_name]['listeners'] += listeners
#                 except AttributeError:
#                     continue
#
#     # Convert city markers to list and sort artists
#     final_city_markers = []
#     for marker in city_markers.values():
#         marker['artists'].sort(key=lambda x: x['listeners'], reverse=True)
#         final_city_markers.append(marker)
#
#     # Convert country artists to lists and sort
#     final_artists_by_country = {}
#     for country, artists in artists_by_country.items():
#         final_artists_by_country[country] = sorted(
#             artists.values(),
#             key=lambda x: x['listeners'],
#             reverse=True
#         )
#
#     # Prepare final data structure
#     final_data = {
#         "t": datetime.now(timezone.utc).isoformat(),
#         "cityMarkers": final_city_markers,
#         "artistsByCountry": final_artists_by_country
#     }
#
#     try:
#         with open(PROCESSED_MAP_DATA_FILE, 'w', encoding='utf-8') as f:
#             json.dump(final_data, f, separators=(',', ':'), ensure_ascii=False)
#         logging.info(f"Successfully processed and saved data to {PROCESSED_MAP_DATA_FILE}.")
#     except IOError as e:
#         logging.error(f"Error writing to {PROCESSED_MAP_DATA_FILE}: {e}")
#
# if __name__ == "__main__":
#     process_map_data()