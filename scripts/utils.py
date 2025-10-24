from typing import Final
import random

class Utils:
    _BASE62_CHARS: Final[str] = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

    # ---------- Public API ----------
    @staticmethod
    def spotify_id_to_gid(spotify_id: str) -> str:
        """
        Convert a Spotify base62 ID (e.g. '3n3Ppam7vgaVa1iaRUc9Lp') to a 32-char lowercase hex GID.
        """
        n = Utils._base62_to_int(spotify_id)
        gid_hex = Utils._int_to_hex(n)
        return gid_hex.rjust(32, "0")  # left-pad to 32 hex chars

    @staticmethod
    def gid_to_spotify_id(gid_hex: str) -> str:
        """
        Convert a 32-char hex GID back to a Spotify base62 ID.
        """
        # strip leading zeros added by padding
        trimmed = gid_hex.lstrip("0")
        n = Utils._hex_to_int(trimmed or "0")
        return Utils._int_to_base62(n)

    # ---------- Helpers ----------
    @staticmethod
    def _base62_to_int(s: str) -> int:
        base = 62
        val = 0
        for ch in s:
            if "0" <= ch <= "9":
                digit = ord(ch) - ord("0")
            elif "a" <= ch <= "z":
                digit = ord(ch) - ord("a") + 10
            elif "A" <= ch <= "Z":
                digit = ord(ch) - ord("A") + 36
            else:
                raise ValueError(f"Invalid base62 character: {ch!r}")
            val = val * base + digit
        return val

    @staticmethod
    def _int_to_base62(n: int) -> str:
        if n == 0:
            return "0"
        base = 62
        chars = Utils._BASE62_CHARS
        out = []
        while n > 0:
            n, rem = divmod(n, base)
            out.append(chars[rem])
        return "".join(reversed(out))

    @staticmethod
    def _int_to_hex(n: int) -> str:
        return format(n, "x")  # lowercase hex, no '0x'

    @staticmethod
    def _hex_to_int(h: str) -> int:
        if h.startswith(("0x", "0X")):
            h = h[2:]
        if any(c not in "0123456789abcdefABCDEF" for c in h):
            raise ValueError(f"Invalid hex string: {h!r}")
        return int(h or "0", 16)

    @staticmethod
    def get_random_user_agent() -> str:
        browser = random.choice(['chrome', 'firefox', 'edge', 'safari'])

        if browser == 'chrome':
            os_choice = random.choice(['mac', 'windows'])
            if os_choice == 'mac':
                return (
                    f"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_{random.randrange(11, 15)}_{random.randrange(4, 9)}) "
                    f"AppleWebKit/{random.randrange(530, 537)}.{random.randrange(30, 37)} (KHTML, like Gecko) "
                    f"Chrome/{random.randrange(80, 105)}.0.{random.randrange(3000, 4500)}.{random.randrange(60, 125)} "
                    f"Safari/{random.randrange(530, 537)}.{random.randrange(30, 36)}"
                )
            else:
                chrome_version = random.randint(80, 105)
                build = random.randint(3000, 4500)
                patch = random.randint(60, 125)
                return (
                    f"Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    f"AppleWebKit/537.36 (KHTML, like Gecko) "
                    f"Chrome/{chrome_version}.0.{build}.{patch} Safari/537.36"
                )

        elif browser == 'firefox':
            os_choice = random.choice(['windows', 'mac', 'linux'])
            version = random.randint(90, 110)
            if os_choice == 'windows':
                return (
                    f"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:{version}.0) "
                    f"Gecko/20100101 Firefox/{version}.0"
                )
            elif os_choice == 'mac':
                return (
                    f"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_{random.randrange(11, 15)}_{random.randrange(0, 10)}; rv:{version}.0) "
                    f"Gecko/20100101 Firefox/{version}.0"
                )
            else:
                return (
                    f"Mozilla/5.0 (X11; Linux x86_64; rv:{version}.0) "
                    f"Gecko/20100101 Firefox/{version}.0"
                )

        elif browser == 'edge':
            os_choice = random.choice(['windows', 'mac'])
            chrome_version = random.randint(80, 105)
            build = random.randint(3000, 4500)
            patch = random.randint(60, 125)
            version_str = f"{chrome_version}.0.{build}.{patch}"
            if os_choice == 'windows':
                return (
                    f"Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    f"AppleWebKit/537.36 (KHTML, like Gecko) "
                    f"Chrome/{version_str} Safari/537.36 Edg/{version_str}"
                )
            else:
                return (
                    f"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_{random.randrange(11, 15)}_{random.randrange(0, 10)}) "
                    f"AppleWebKit/605.1.15 (KHTML, like Gecko) "
                    f"Version/{random.randint(13, 16)}.0 Safari/605.1.15 Edg/{version_str}"
                )

        elif browser == 'safari':
            os_choice = 'mac'
            if os_choice == 'mac':
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
            else:
                return ""
        else:
            return ""

__all__ = ["Utils"]
