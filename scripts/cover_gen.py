"""
Cover generator for playlist images.
Provides an async function `generate_playlist_cover_bytes(session, image_id_or_url, artist_name, logo_path=None)`
that returns bytes of a JPEG (<=256KB) ready to be uploaded to Spotify (base64 encoding done by caller).

Uses Pillow and aiohttp. Keeps dependencies minimal and falls back to DejaVuSans if available.
"""
from __future__ import annotations

import io
from typing import Any, Optional

import aiohttp

try:
    from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps
except Exception:  # Pillow might be missing in some environments
    Image = ImageDraw = ImageFilter = ImageFont = ImageOps = None  # type: ignore

MAX_SIZE_BYTES = 256 * 1024
TARGET_DIM = 640


async def _fetch_image_bytes(session: aiohttp.ClientSession, image_id_or_url: str, timeout: int = 20) -> Optional[bytes]:
    if not image_id_or_url:
        return None
    if image_id_or_url.startswith("http://") or image_id_or_url.startswith("https://"):
        url = image_id_or_url
    else:
        # treat as spotify image id
        url = f"https://i.scdn.co/image/{image_id_or_url}"

    try:
        async with session.get(url, timeout=timeout) as resp:
            resp.raise_for_status()
            return await resp.read()
    except Exception:
        return None


def _compute_palette(img: Any, colors: int = 4) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    # use PIL quantize to get a small palette
    thumb = img.copy().convert("RGB")
    thumb.thumbnail((200, 200))
    pal = thumb.convert("P", palette=Image.ADAPTIVE, colors=colors).convert("RGB")
    # collect colors
    colors_list = pal.getcolors(maxcolors=10000) or []
    colors_list = sorted(colors_list, key=lambda x: -x[0])
    if not colors_list:
        return (34, 197, 94), (139, 92, 246)  # emerald/purple fallback
    primary = colors_list[0][1]
    secondary = colors_list[1][1] if len(colors_list) > 1 else primary
    return primary, secondary


def _make_gradient(size: tuple[int, int], c1: tuple[int, int, int], c2: tuple[int, int, int]) -> Any:
    w, h = size
    base = Image.new("RGB", size, c1)
    top = Image.new("RGB", size, c2)
    # Create a diagonal linear mask
    lin = Image.linear_gradient("L").resize((w, h))
    lin = lin.rotate(25, resample=Image.BICUBIC, expand=False)
    lin = lin.filter(ImageFilter.GaussianBlur(radius=min(w, h) * 0.04))
    return Image.composite(top, base, lin)



def _add_vignette(img: Any, radius: float = 1.9) -> Any:
    w, h = img.size
    mask = Image.new("L", (w, h), 255)
    d = ImageDraw.Draw(mask)
    # Larger, softer ellipse for subtle falloff
    pad = int(min(w, h) * 0.12)
    d.ellipse((-pad, -pad, w + pad, h + pad), fill=0)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=w * 0.18))
    # Darken only a touch
    dark = Image.new("RGB", (w, h), (0, 0, 0))
    return Image.composite(img, Image.blend(img, dark, 0.12), mask)

def _add_grain(img: Any, amount: float = 0.015) -> Any:
    # Very light monochrome grain for a premium finish
    w, h = img.size
    noise = Image.effect_noise((w, h), 60).convert("L")
    noise = noise.point(lambda p: p * 0.5)
    noise = Image.merge("RGB", (noise, noise, noise))
    return Image.blend(img, noise, amount)

def _rel_luminance(rgb: tuple[int, int, int]) -> float:
    def ch(c: int) -> float:
        x = c / 255.0
        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(rgb[0]), ch(rgb[1]), ch(rgb[2]))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def _best_text_color(bg: tuple[int, int, int]) -> tuple[int, int, int]:
    # Choose near-white or near-black for max contrast
    white = (245, 246, 248)
    black = (18, 18, 18)
    lw = _rel_luminance(white) + 0.05
    lb = _rel_luminance(black) + 0.05
    lbg = _rel_luminance(bg) + 0.05
    # Contrast ratios
    cw = max(lw, lbg) / min(lw, lbg)
    cb = max(lb, lbg) / min(lb, lbg)
    return white if cw >= cb else black

def _pick_ui_colors(primary: tuple[int, int, int], secondary: tuple[int, int, int]) -> tuple[tuple[int,int,int], tuple[int,int,int], tuple[int,int,int]]:
    # Blend palette toward a muted midpoint for modern minimal look
    mid = tuple(int(primary[i] * 0.5 + secondary[i] * 0.5) for i in range(3))
    bg1 = tuple(int(primary[i] * 0.75 + mid[i] * 0.25) for i in range(3))
    bg2 = tuple(int(secondary[i] * 0.75 + mid[i] * 0.25) for i in range(3))
    # Use center color to choose text color
    center = tuple(int(bg1[i] * 0.5 + bg2[i] * 0.5) for i in range(3))
    txt = _best_text_color(center)
    return bg1, bg2, txt

from typing import Optional, Tuple
from PIL import Image, ImageDraw, ImageFilter, ImageFont

TEXT_COLOR = (26, 26, 26, 255)
TAG_COLOR_ALPHA = 0.78
BG_COLOR = (255, 255, 255, 255)
SHADOW_FILL = (0, 0, 0, 80)

FONT_CANDIDATES = (
    "Inter-Bold.ttf",
)

FRAME_MARGIN_RATIO = 0.095

TITLE_FONT_RATIO = 0.22
TITLE_FONT_MIN = 5

SHADOW_RADIUS_RATIO = 0.9
SHADOW_RADIUS_MIN = 5

TAG_FONT_RATIO = 0.15

LOGO_MAX_SIZE = 40
RIGHT_MARGIN_MIN = 8
TOP_BIAS_RATIO = 0.2

def _load_font(size: int) -> ImageFont.ImageFont:
    for fname in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(fname, size)
        except Exception:
            continue
    try:
        return ImageFont.truetype("DejaVuSans-Bold.ttf", size)
    except Exception:
        return ImageFont.load_default()

def _text_length(draw: ImageDraw.ImageDraw, ft: ImageFont.ImageFont, text: str) -> int:
    if hasattr(draw, "textlength"):
        try:
            return int(draw.textlength(text, font=ft))
        except Exception:
            pass
    try:
        return int(ft.getlength(text))
    except Exception:
        try:
            bbox = ft.getbbox(text)
            return int(bbox[2] - bbox[0])
        except Exception:
            return len(text) * getattr(ft, "size", 16) * 0.6

def _text_height(ft: ImageFont.ImageFont, text: str) -> int:
    try:
        bbox = ft.getbbox(text)
        return bbox[3] - bbox[1]
    except Exception:
        try:
            return ft.getsize(text)[1]
        except Exception:
            return getattr(ft, "size", 16)

def draw_text_card(img: Image.Image, text: str, logo_img: Optional[Image.Image] = None) -> Image.Image:
    w, h = img.size
    frame_margin = max(int(w * FRAME_MARGIN_RATIO), 40)

    inner_size = max(1, min(w - 2 * frame_margin, h - 2 * frame_margin))
    photo_x = frame_margin + (w - 2 * frame_margin - inner_size) // 2
    photo_y = frame_margin + (h - 2 * frame_margin - inner_size) // 2

    base = Image.new("RGBA", (w, h), BG_COLOR)

    shadow_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(shadow_layer).rectangle(
        [photo_x, photo_y, photo_x + inner_size, photo_y + inner_size], fill=SHADOW_FILL
    )
    shadow_radius = max(int(inner_size * SHADOW_RADIUS_RATIO), SHADOW_RADIUS_MIN)
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=shadow_radius))
    base = Image.alpha_composite(base, shadow_layer)

    try:
        photo = img.resize((inner_size, inner_size), Image.LANCZOS)
    except Exception:
        photo = img.resize((inner_size, inner_size))
    if photo.mode != "RGBA":
        photo = photo.convert("RGBA")
    base.paste(photo, (photo_x, photo_y), photo)

    draw = ImageDraw.Draw(base)

    # Title font
    title_text = (text or "").strip() or "Playlist"
    font = _load_font(int(frame_margin * TAG_FONT_RATIO) + 4)

    title_height = _text_height(font, title_text)
    bottom_band_top = h - frame_margin
    ty = 605

    # Calculate positions like justify-between
    left_x = frame_margin
    right_x = w - frame_margin

    # Draw logo (left)
    logo_w = logo_h = 0
    if logo_img is not None:
        try:
            logo = logo_img.copy().convert("RGBA")
            logo.thumbnail((LOGO_MAX_SIZE, LOGO_MAX_SIZE), Image.LANCZOS)
            logo_w, logo_h = logo.size
            ly = ty + (title_height - logo_h) // 2
            base.paste(logo, (left_x, ly), logo)
        except Exception:
            pass

    # Draw playlist title (center-left after logo)
    tx = left_x + logo_w + int(frame_margin * 0.4)
    draw.text((tx, ty), title_text, font=font, fill=TEXT_COLOR)

    # Draw tagline (right aligned)
    tagline = "World's Top Artists"
    tag_font = _load_font(int(frame_margin * TAG_FONT_RATIO + 4))
    tag_width = _text_length(draw, tag_font, tagline)
    tag_height = _text_height(tag_font, tagline)
    tag_y = ty + (title_height - tag_height) // 2
    tag_x = right_x - tag_width

    tag_color = (TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2], int(TEXT_COLOR[3] * TAG_COLOR_ALPHA))
    draw.text((tag_x, tag_y), tagline, font=tag_font, fill=tag_color)

    return base.convert("RGB")

_draw_text = draw_text_card



async def generate_playlist_cover_bytes(session: aiohttp.ClientSession, image_id_or_url: Optional[str], artist_name: str, logo_path: Optional[str] = None) -> Optional[bytes]:
    """Return JPEG bytes ready to upload (not base64 encoded)."""
    if Image is None:
        # Pillow not available; return None so caller can continue without cover
        return None

    raw = await _fetch_image_bytes(session, image_id_or_url) if image_id_or_url else None
    src = None
    if raw:
        try:
            src = Image.open(io.BytesIO(raw)).convert("RGB")
            # center-crop
            w, h = src.size
            short = min(w, h)
            left = (w - short) // 2
            top = (h - short) // 2
            src = src.crop((left, top, left + short, top + short))
            src = src.resize((TARGET_DIM, TARGET_DIM), Image.LANCZOS)
        except Exception:
            src = None
    if src is None:
        src = Image.new("RGB", (TARGET_DIM, TARGET_DIM), (30, 64, 60))

    # compute palette
    try:
        primary, secondary = _compute_palette(src)
    except Exception:
        primary, secondary = (34, 197, 94), (139, 92, 246)

    bg1, bg2, _ = _pick_ui_colors(primary, secondary)
    grad = _make_gradient((TARGET_DIM, TARGET_DIM), bg1, bg2)
    blended = Image.blend(src, grad, 0.25)
    blended = _add_vignette(blended, radius=1.9)
    blended = _add_grain(blended, amount=0.015)

    # load logo if provided
    logo_img = None
    if logo_path:
        try:
            logo_img = Image.open(logo_path)
        except Exception:
            logo_img = None

    # draw text and logo
    final = _draw_text(blended, artist_name, logo_img)

    # binary search quality to be under MAX_SIZE_BYTES
    lo, hi = 25, 95
    best = None
    while lo <= hi:
        mid = (lo + hi) // 2
        buf = io.BytesIO()
        final.save(buf, format="JPEG", quality=mid, optimize=True)
        size = buf.tell()
        if size <= MAX_SIZE_BYTES:
            best = buf.getvalue()
            lo = mid + 1
        else:
            hi = mid - 1
    if best is None:
        # fallback: reduce size with resize
        small = final.resize((int(TARGET_DIM * 0.9), int(TARGET_DIM * 0.9)), Image.LANCZOS)
        buf = io.BytesIO()
        small.save(buf, format="JPEG", quality=30, optimize=True)
        best = buf.getvalue()
    return best


__all__ = ["generate_playlist_cover_bytes"]
