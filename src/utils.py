from typing import Final

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

__all__ = ["Utils"]
