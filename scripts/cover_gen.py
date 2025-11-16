"""
Cover generator for playlist images.

Provides:
    async generate_playlist_cover_bytes(session, image_id_or_url, artist_name, logo_path=None)
Returns:
    JPEG bytes (<=256KB) ready to upload to Spotify (caller handles base64 if needed).

Style:
    - Cream paper background
    - Bold uppercase title + small subtitle (top-left)
    - Portrait with circular reveal
    - Big circular reveal biased to the right/bottom
    - Optional small logo near bottom-left

Dependencies: Pillow (PIL) and aiohttp
"""

from __future__ import annotations

import io
import os
import random
from typing import Optional, Tuple, Any

import aiohttp

try:
    from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps
except Exception:  # Pillow might be missing in some environments
    Image = ImageDraw = ImageFilter = ImageFont = ImageOps = None  # type: ignore

# ---------------------------------------------------------------------------
# Constants & configuration
# ---------------------------------------------------------------------------

MAX_SIZE_BYTES = 256 * 1024
TARGET_DIM = 640

CREAM_BG = (245, 242, 236)  # off-white paper
INK = (18, 18, 18)          # near-black text

OBJECT_FIT_FOCUS = (0.35, 0.32)  # mimic CSS object-position for the portrait

FONT_CANDIDATES = (
    "Inter-Black.ttf",
    "Inter-Bold.ttf",
    "DejaVuSans-Bold.ttf",
)

# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def _load_font(size: int) -> "ImageFont.ImageFont":
    """Load a bold font from preferred candidates or fall back to default."""
    for name in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            continue
    try:
        return ImageFont.truetype("DejaVuSans-Bold.ttf", size)
    except Exception:
        return ImageFont.load_default()


async def _fetch_image_bytes(session: aiohttp.ClientSession, image_id_or_url: str, timeout: int = 20) -> Optional[bytes]:
    """
    Fetch raw bytes for an image.

    Supports:
      - Local file paths
      - HTTP(S) URLs
      - Spotify image IDs (resolved via https://i.scdn.co/image/{id})
    """
    if not image_id_or_url:
        return None

    # Local path support (useful in tests and scripts)
    if os.path.exists(image_id_or_url):
        try:
            with open(image_id_or_url, "rb") as f:
                return f.read()
        except Exception:
            return None

    if image_id_or_url.startswith(("http://", "https://")):
        url = image_id_or_url
    else:
        url = f"https://i.scdn.co/image/{image_id_or_url}"

    try:
        async with session.get(url, timeout=timeout) as resp:
            resp.raise_for_status()
            return await resp.read()
    except Exception:
        return None


def _center_crop_square(
    img: "Image.Image",
    size: int = TARGET_DIM,
    focus: Tuple[float, float] = (0.5, 0.5),
) -> "Image.Image":
    """
    Crop + resize while emulating CSS object-fit/object-position semantics.
    `focus` behaves like object-position percentages expressed as 0..1 floats.
    """
    focus_x = min(max(focus[0], 0.0), 1.0)
    focus_y = min(max(focus[1], 0.0), 1.0)

    if ImageOps is not None:
        method = getattr(Image, "LANCZOS", Image.BICUBIC)
        try:
            return ImageOps.fit(
                img,
                (size, size),
                method=method,
                centering=(focus_x, focus_y),
            )
        except Exception:
            pass

    # Manual fallback: crop the long side using the requested focus position.
    w, h = img.size
    if w == h:
        square = img
    elif w > h:
        crop_w = h
        left = int(round((w - crop_w) * focus_x))
        left = max(0, min(left, w - crop_w))
        square = img.crop((left, 0, left + crop_w, h))
    else:
        crop_h = w
        top = int(round((h - crop_h) * focus_y))
        top = max(0, min(top, h - crop_h))
        square = img.crop((0, top, w, top + crop_h))

    try:
        return square.resize((size, size), Image.LANCZOS)
    except Exception:  # Pillow<10
        return square.resize((size, size))


def _circle_reveal(
    img: "Image.Image",
    bias_x: float = 0.65,
    bias_y: float = 0.62,
    inset_ratio: float = 0.04,
) -> "Image.Image":
    """
    Reveal the image inside a large circle whose visual focus mimics object-fit:
    the circle stays fully inside the canvas while the subject can be biased by (bias_x, bias_y).
    """
    w, h = img.size
    r = min(w, h) // 2
    cx, cy = int(w * bias_x), int(h * bias_y)
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(img.convert("RGBA"), (0, 0), mask)
    return out




def _draw_text_editorial(canvas: "Image.Image", title: str, subtitle: str, logo_img: Optional["Image.Image"]) -> "Image.Image":
    """
    Place text in the top-left: big bold title + smaller subtitle.
    Optional tiny circular-plated logo anchored near bottom-left.
    """
    w, h = canvas.size
    draw = ImageDraw.Draw(canvas)

    title = (title or "Playlist")
    subtitle = subtitle or "World's Top Artists"

    title_font = _load_font(int(w * 0.035))
    sub_font = _load_font(int(w * 0.03))

    margin = int(w * 0.056)
    tx, ty = margin, margin

    draw.text((tx, ty), title, font=title_font, fill=INK)

    try:
        title_h = title_font.getbbox(title)[3]
    except Exception:
        title_h = title_font.getsize(title)[1]

    sy = ty + title_h + int(w * 0.012)
    draw.text((tx, sy), subtitle, font=sub_font, fill=(0, 0, 0, 200))

    if logo_img is not None:
        try:
            lg = logo_img.convert("RGBA")
            try:
                lg.thumbnail((50, 50), Image.LANCZOS)
            except Exception:
                lg.thumbnail((50, 50))
            lx, ly = margin - 4, h - margin - lg.height
            plate = Image.new("RGBA", (lg.width + 12, lg.height + 12), (0, 0, 0, 0))
            ImageDraw.Draw(plate).ellipse((0, 0, plate.width, plate.height), fill=(0, 0, 0, 0))
            can_rgba = canvas.convert("RGBA")
            can_rgba.alpha_composite(plate, (lx - 6, ly - 6))
            can_rgba.alpha_composite(lg, (lx, ly))
            return can_rgba.convert("RGB")
        except Exception:
            pass

    return canvas

def _random_dark_color() -> tuple[Any, int]:
    """
    Returnează un ton aleatoriu dintr-o paletă estetică,
    cu nuanțe mai închise și ușor colorate (minimal dark aesthetic).
    """
    palettes = [
        # midnight / charcoal / navy range
        [(18, 22, 28), (26, 31, 39), (34, 39, 46), (46, 52, 64), (58, 64, 74)],

        # muted deep blues / teals
        [(20, 32, 38), (22, 33, 39), (25, 45, 54), (28, 56, 62), (32, 66, 70), (38, 78, 82)],

        # plum / desaturated purples
        [(36, 24, 44), (40, 28, 46), (48, 32, 56), (54, 36, 64), (64, 42, 74), (72, 48, 82)],

        # forest green tones
        [(24, 32, 26), (28, 36, 30), (32, 45, 38), (42, 60, 48), (48, 72, 54), (56, 86, 64)],

        # graphite / dark neutral greys
        [(20, 20, 20), (25, 25, 25), (30, 30, 30), (38, 38, 38), (46, 46, 46), (54, 54, 54)],

        # coffee / brownish / copper darks
        [(38, 28, 24), (44, 32, 28), (50, 36, 30), (58, 44, 34), (64, 48, 40), (72, 56, 46)],

        # dark cyan / slate
        [(18, 32, 34), (22, 38, 40), (26, 46, 48), (32, 54, 56), (38, 64, 64), (44, 72, 70)],

        # dark magenta / wine / maroon
        [(42, 20, 28), (48, 22, 34), (56, 26, 40), (64, 32, 46), (72, 38, 54), (80, 44, 60)],

        # desaturated dark blues / midnight indigo
        [(18, 22, 38), (22, 28, 46), (28, 34, 54), (32, 38, 60), (38, 46, 68), (44, 52, 74)],

        # smoky olive / moss tones
        [(28, 30, 24), (32, 36, 28), (38, 42, 32), (44, 50, 36), (52, 58, 42), (60, 66, 48)],

        # dark turquoise / petrol
        [(14, 28, 32), (18, 36, 40), (22, 46, 48), (28, 56, 56), (34, 66, 64), (40, 78, 72)],

        # dark mauve / soft violet greys
        [(34, 28, 38), (42, 34, 46), (50, 40, 56), (58, 46, 66), (66, 54, 74), (72, 60, 80)],

        # steel blue / concrete
        [(26, 32, 38), (32, 38, 44), (38, 44, 50), (44, 52, 56), (52, 60, 64), (60, 68, 72)],
    ]

    base = random.choice(palettes)
    color = random.choice(base)
    # alpha channel 0 for blending layer (vignette)
    return *color, 0

def draw_text_card(img: "Image.Image", text: str, logo_img: Optional["Image.Image"] = None) -> "Image.Image":
    """
    Compose the cream canvas + circular portrait + editorial text.
    Kept as a separate function for easier swapping/testing.
    """
    # Base cream canvas
    canvas = Image.new("RGB", img.size, CREAM_BG)

    # Reveal portrait inside a large biased circle to the right/bottom
    circ = _circle_reveal(img)
    can_rgba = canvas.convert("RGBA")
    can_rgba.alpha_composite(circ, (0, 0))

    # Subtle vignette softening for the circular edge
    vign = Image.new("L", img.size, 0)
    d = ImageDraw.Draw(vign)
    d.ellipse((-60, -30, img.size[0] + 60, img.size[1] + 80), fill=255)
    vign = vign.filter(ImageFilter.GaussianBlur(radius=85))
    randomColor = _random_dark_color()
    can_rgba = Image.composite(can_rgba, Image.new("RGBA", img.size, randomColor), vign)

    # Text & optional logo
    final = _draw_text_editorial(can_rgba.convert("RGB"), text, "World's Top Artists", logo_img)
    return final


_draw_text = draw_text_card  # alias for backwards-compat if you were importing this name elsewhere

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def generate_playlist_cover_bytes(
        session: aiohttp.ClientSession,
        image_id_or_url: Optional[str],
        artist_name: str,
        logo_path: Optional[str] = None,
) -> Optional[bytes]:
    """Return JPEG bytes ready to upload (<=256KB). Returns None if Pillow unavailable."""
    if Image is None:
        return None

    raw = await _fetch_image_bytes(session, image_id_or_url) if image_id_or_url else None
    src = None
    if raw:
        try:
            src = Image.open(io.BytesIO(raw)).convert("RGB")
        except Exception:
            src = None

    if src is None:
        # Plain placeholder if input fails
        src = Image.new("RGB", (TARGET_DIM, TARGET_DIM), (200, 200, 200))

    portrait = _center_crop_square(src, focus=OBJECT_FIT_FOCUS)

    # Optional logo
    logo_img = None
    if logo_path:
        try:
            logo_img = Image.open(logo_path)
        except Exception:
            logo_img = None

    # Compose final cover
    final = _draw_text(portrait, artist_name, logo_img)

    # Size-constrained JPEG export (binary search on quality)
    lo, hi = 25, 95
    best = None
    while lo <= hi:
        mid = (lo + hi) // 2
        buf = io.BytesIO()
        try:
            final.save(buf, format="JPEG", quality=mid, optimize=True)
        except OSError:
            # Some Pillow builds raise on optimize=True for certain images
            buf = io.BytesIO()
            final.save(buf, format="JPEG", quality=mid)
        size = buf.tell()
        if size <= MAX_SIZE_BYTES:
            best = buf.getvalue()
            lo = mid + 1
        else:
            hi = mid - 1

    if best is None:
        # Fallback: slight downscale + modest quality
        try:
            small = final.resize((int(TARGET_DIM * 0.92), int(TARGET_DIM * 0.92)), Image.LANCZOS)
        except Exception:
            small = final.resize((int(TARGET_DIM * 0.92), int(TARGET_DIM * 0.92)))
        buf = io.BytesIO()
        small.save(buf, format="JPEG", quality=35, optimize=True)
        best = buf.getvalue()

    return best


__all__ = ["generate_playlist_cover_bytes", "draw_text_card"]
