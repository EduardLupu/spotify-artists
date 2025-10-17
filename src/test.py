import json

import aiohttp

from src.fetch_artists import PROJECT_ROOT

# # înlocuiește cu conținutul tău JSON complet
# DATA_DIR = PROJECT_ROOT / "public" / "data"
# LATEST_DIR = DATA_DIR / "latest"
# with open(LATEST_DIR / "top500.json", "r", encoding="utf-8") as f:
#     data = f.read()
#
# # parsează JSON-ul
# parsed = json.loads(data)
#
# # extrage toate valorile din coloana "r" (rank)
# ranks = [row[3] for row in parsed["rows"]]
#
# # check what are the missing numbers from 1-500 from ranks
# missing = [i for i in range(1, 501) if i not in ranks]
# print("Missing ranks:", missing)

from token_service import TokenManager

async def test_token_manager():
    token_manager = TokenManager()
    async with aiohttp.ClientSession() as session:
        token = await token_manager.get_token(session)
        print(token)

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_token_manager())



