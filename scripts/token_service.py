import asyncio
import base64
import logging
import os
import random
import secrets
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from time import time_ns
from typing import Dict, List, Optional, Set, Tuple

import aiohttp
import pyotp
from dotenv import load_dotenv

TOKEN_URL = "https://open.spotify.com/api/token"
SERVER_TIME_ORIGIN = "https://open.spotify.com/"
SECRETS_URL = "https://raw.githubusercontent.com/xyloflake/spot-secrets-go/refs/heads/main/secrets/secretDict.json"
FETCH_INTERVAL_SECONDS = 60 * 60  # 1 hour
REQUEST_TIMEOUT = 15

load_dotenv()

def get_random_user_agent() -> str:
    browser = random.choice(["chrome", "firefox", "edge", "safari"])

    if browser == "chrome":
        os_choice = random.choice(["mac", "windows"])
        if os_choice == "mac":
            return (
                f"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_{random.randrange(11, 15)}_{random.randrange(4, 9)}) "
                f"AppleWebKit/{random.randrange(530, 537)}.{random.randrange(30, 37)} (KHTML, like Gecko) "
                f"Chrome/{random.randrange(80, 105)}.0.{random.randrange(3000, 4500)}.{random.randrange(60, 125)} "
                f"Safari/{random.randrange(530, 537)}.{random.randrange(30, 36)}"
            )
        chrome_version = random.randint(80, 105)
        build = random.randint(3000, 4500)
        patch = random.randint(60, 125)
        return (
            f"Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            f"AppleWebKit/537.36 (KHTML, like Gecko) "
            f"Chrome/{chrome_version}.0.{build}.{patch} Safari/537.36"
        )

    if browser == "firefox":
        os_choice = random.choice(["windows", "mac", "linux"])
        version = random.randint(90, 110)
        if os_choice == "windows":
            return (
                f"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:{version}.0) "
                f"Gecko/20100101 Firefox/{version}.0"
            )
        if os_choice == "mac":
            return (
                f"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_{random.randrange(11, 15)}_{random.randrange(0, 10)}; rv:{version}.0) "
                f"Gecko/20100101 Firefox/{version}.0"
            )
        return (
            f"Mozilla/5.0 (X11; Linux x86_64; rv:{version}.0) "
            f"Gecko/20100101 Firefox/{version}.0"
        )

    if browser == "edge":
        os_choice = random.choice(["windows", "mac"])
        chrome_version = random.randint(80, 105)
        build = random.randint(3000, 4500)
        patch = random.randint(60, 125)
        version_str = f"{chrome_version}.0.{build}.{patch}"
        if os_choice == "windows":
            return (
                f"Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                f"AppleWebKit/537.36 (KHTML, like Gecko) "
                f"Chrome/{version_str} Safari/537.36 Edg/{version_str}"
            )
        return (
            f"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_{random.randrange(11, 15)}_{random.randrange(0, 10)}) "
            f"AppleWebKit/605.1.15 (KHTML, like Gecko) "
            f"Version/{random.randint(13, 16)}.0 Safari/605.1.15 Edg/{version_str}"
        )

    # safari fallback
    mac_major = random.randrange(11, 16)
    mac_minor = random.randrange(0, 10)
    webkit_major = random.randint(600, 610)
    webkit_minor = random.randint(1, 20)
    webkit_patch = random.randint(1, 20)
    safari_version = random.randint(13, 16)
    return (
        f"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_{mac_major}_{mac_minor}) "
        f"AppleWebKit/{webkit_major}.{webkit_minor}.{webkit_patch} (KHTML, like Gecko) "
        f"Version/{safari_version}.0 Safari/{webkit_major}.{webkit_minor}.{webkit_patch}"
    )


class TOTPSecretsManager:
    def __init__(self, version_override: Optional[int] = None):
        self._secrets_map: Dict[str, List[int]] = {}
        self._totp_cache: Dict[str, pyotp.TOTP] = {}
        self._last_fetch_time: float = 0
        self._lock = asyncio.Lock()
        self._version_override = version_override

    async def ensure_ready(self, session: aiohttp.ClientSession) -> None:
        async with self._lock:
            now = time.time()
            if self._secrets_map and (now - self._last_fetch_time) < FETCH_INTERVAL_SECONDS:
                return

            try:
                secrets_map = await self._download_secrets(session)
                versions = self._select_versions(secrets_map)
                self._secrets_map = {version: secrets_map[version] for version in versions}
                self._totp_cache.clear()
                self._last_fetch_time = now
                logging.info(f"TOTP secrets initialised. Available versions: {', '.join(versions)}")
            except Exception as exc:
                if self._secrets_map:
                    logging.warning(f"Failed to refresh TOTP secrets, using cached versions {', '.join(self._secrets_map.keys())}: {exc}")
                    return
                raise

    async def _download_secrets(self, session: aiohttp.ClientSession) -> Dict[str, List[int]]:
        async with session.get(SECRETS_URL, headers={"User-Agent": get_random_user_agent()}, timeout=REQUEST_TIMEOUT) as response:
            response.raise_for_status()
            payload = await response.json(content_type=None)

        if not isinstance(payload, dict) or not payload:
            raise ValueError("Unexpected secrets payload")

        secrets_map: Dict[str, List[int]] = {}
        for key, value in payload.items():
            if not isinstance(key, str) or not key.isdigit():
                raise ValueError(f"Invalid secret key format: {key}")
            if not isinstance(value, list) or not all(isinstance(x, int) for x in value):
                raise ValueError(f"Invalid secret payload for version {key}")
            secrets_map[key] = list(value)
        return secrets_map

    def _select_versions(self, secrets_map: Dict[str, List[int]]) -> List[str]:
        if self._version_override:
            override_key = str(self._version_override)
            if override_key not in secrets_map:
                raise ValueError(f"Requested TOTP version {override_key} not available")
            return [override_key]

        versions = sorted(secrets_map.keys(), key=int, reverse=True)
        if not versions:
            raise ValueError("No versions available in secrets payload")
        return versions

    def available_versions(self) -> List[str]:
        if not self._secrets_map:
            raise RuntimeError("TOTP secrets not initialised")
        return sorted(self._secrets_map.keys(), key=int, reverse=True)

    @staticmethod
    def _create_totp_secret(data: List[int]) -> str:
        transformed = [value ^ ((idx % 33) + 9) for idx, value in enumerate(data)]
        joined = "".join(str(num) for num in transformed)
        hex_data = joined.encode("utf-8").hex()
        base32_secret = base64.b32encode(bytes.fromhex(hex_data)).decode("utf-8").rstrip("=")
        return base32_secret

    def generate(self, version: str, timestamp_seconds: int) -> str:
        if not self._secrets_map:
            raise RuntimeError("TOTP secrets not initialised")
        if version not in self._secrets_map:
            raise ValueError(f"TOTP version {version} not available")

        totp = self._totp_cache.get(version)
        if not totp:
            secret = self._create_totp_secret(self._secrets_map[version])
            totp = pyotp.TOTP(secret, digits=6, interval=30)
            self._totp_cache[version] = totp

        return totp.at(int(timestamp_seconds))


class TokenManager:
    def __init__(self):
        self.token: Optional[str] = None
        self.expiration_timestamp: int = 0
        self._lock = asyncio.Lock()

        version_override = os.getenv("SP_TOTP_VERSION")
        self._totp_managers: List[TOTPSecretsManager] = [TOTPSecretsManager()]
        if version_override:
            try:
                override_version = int(version_override)
                self._totp_managers.insert(0, TOTPSecretsManager(override_version))
            except ValueError:
                logging.error("Invalid SP_TOTP_VERSION value provided; ignoring override.")

        self._sp_dc = os.getenv("SP_DC")
        if not self._sp_dc:
            logging.error("Missing SP_DC cookie value. Set SP_DC in your environment or .env file.")
            raise RuntimeError("SP_DC is required to fetch Spotify tokens.")

        self._user_agent = os.getenv("SP_USER_AGENT") or get_random_user_agent()

    def is_token_expired(self) -> bool:
        return int(time.time() * 1000) >= self.expiration_timestamp

    async def get_token(self, session: aiohttp.ClientSession) -> str:
        async with self._lock:
            if self.token is None or self.is_token_expired():
                logging.info("[*] Token expired or missing, fetching new token...")
                await self._fetch_token(session)
        return self.token

    async def _fetch_token(self, session: aiohttp.ClientSession) -> None:
        last_error: Optional[Exception] = None
        version_plan: List[Tuple[TOTPSecretsManager, str]] = []
        seen_versions: Set[str] = set()

        for manager_index, manager in enumerate(self._totp_managers):
            try:
                await manager.ensure_ready(session)
                for version in manager.available_versions():
                    if version in seen_versions:
                        continue
                    version_plan.append((manager, version))
                    seen_versions.add(version)
            except Exception as exc:
                logging.error(f"TOTP manager initialisation failed (index {manager_index}): {exc}")
                last_error = exc

        if not version_plan:
            raise RuntimeError(f"No TOTP versions available. Last error: {last_error}")

        for manager, version in version_plan:
            logging.info(f"Attempting token fetch with TOTP version {version}")
            for reason in ("transport", "init"):
                try:
                    server_time = await self._fetch_server_time(session)
                    payload = self._build_auth_payload(server_time, manager, version, reason=reason)
                    data = await self._perform_token_request(session, payload)
                except Exception as exc:
                    logging.error(f"Token request ({reason}, version {version}) failed: {exc}")
                    last_error = exc
                    continue

                access_token = data.get("accessToken")
                expiration = data.get("accessTokenExpirationTimestampMs")

                if not access_token or not expiration:
                    logging.error(f"Token response missing data for reason {reason} (version {version})")
                    continue

                self.token = access_token
                self.expiration_timestamp = int(expiration)
                self._log_token_expiration(version)
                return

        raise RuntimeError(f"Unable to fetch Spotify access token: {last_error}")

    async def _perform_token_request(self, session: aiohttp.ClientSession, payload: Dict[str, str]) -> Dict[str, object]:
        headers = {
            "User-Agent": self._user_agent,
            "Origin": "https://open.spotify.com/",
            "Referer": "https://open.spotify.com/",
            "Cookie": f"sp_dc={self._sp_dc}",
        }

        async with session.get(TOKEN_URL, params=payload, headers=headers, timeout=REQUEST_TIMEOUT) as response:
            response.raise_for_status()
            return await response.json()

    async def _fetch_server_time(self, session: aiohttp.ClientSession) -> int:
        headers = {
            "User-Agent": self._user_agent,
            "Accept": "*/*",
        }

        last_error: Optional[Exception] = None
        for method in ("HEAD", "GET"):
            try:
                async with session.request(method, SERVER_TIME_ORIGIN, headers=headers, timeout=REQUEST_TIMEOUT) as response:
                    response.raise_for_status()
                    date_header = response.headers.get("Date")
                    if not date_header:
                        raise RuntimeError("Missing 'Date' header in server response")
                    server_dt = parsedate_to_datetime(date_header)
                    return int(server_dt.timestamp())
            except Exception as exc:
                last_error = exc

        raise RuntimeError(f"Failed to fetch server time: {last_error}")

    def _build_auth_payload(self, server_time: int, manager: TOTPSecretsManager, version: str, *, reason: str, product_type: str = "mobile-web-player") -> Dict[str, str]:
        totp_value = manager.generate(version, server_time)

        payload: Dict[str, str] = {
            "reason": reason,
            "productType": product_type,
            "totp": totp_value,
            "totpServer": totp_value,
            "totpVer": version,
        }

        version_int = int(version)
        if version_int < 10:
            client_time = int(time_ns() / 1_000_000)
            payload.update({
                "sTime": str(server_time),
                "cTime": str(client_time),
                "buildDate": time.strftime("%Y-%m-%d", time.gmtime(server_time)),
                "buildVer": f"web-player_{time.strftime('%Y-%m-%d', time.gmtime(server_time))}_{server_time * 1000}_{secrets.token_hex(4)}",
            })

        return payload

    def _log_token_expiration(self, version: str) -> None:
        expires_in_ms = self.expiration_timestamp - int(time.time() * 1000)
        expires_in_sec = max(0, expires_in_ms // 1000)
        mins, secs = divmod(expires_in_sec, 60)
        exp_time_str = datetime.fromtimestamp(self.expiration_timestamp / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        logging.info(
            f"[+] Got new token (version {version})\n"
            f"    - Expires in: {mins} min {secs} sec\n"
            f"    - Exact time: {exp_time_str}"
        )


__all__ = ["TokenManager"]
