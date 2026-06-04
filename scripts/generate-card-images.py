#!/usr/bin/env python3
"""
Pre-generate OG share images for every brand and firm in data.json.
Each image is a 1200x630 PNG matching the Starbird dark theme.
Output: static/cards/{id}.png

Run: python3 scripts/generate-card-images.py
Re-run whenever data.json changes (the Guardian can trigger this).
"""
import json
import math
import pathlib
import textwrap
from PIL import Image, ImageDraw, ImageFont

REPO = pathlib.Path(__file__).resolve().parent.parent
DATA = REPO / "static" / "data.json"
OUT = REPO / "static" / "cards"
LOGO = REPO / "static" / "logo-dark.png"
LOGO_LIGHT = REPO / "static" / "logo-light.png"
FONTS = pathlib.Path(__file__).resolve().parent / "fonts"

W, H = 1200, 630

# Colors
BG = "#0d0d0d"
SURFACE = "#1a1a1a"
INK = "#f0ebe3"
INK_MUTED = "#a09890"
INK_FAINT = "#666666"
PRIMARY = "#5fc4d0"
GOLD = "#e8a83e"
AVOID = "#e06c5f"
ALIGN = "#5fbf7a"

QUEST_TO_VALUE = {
    "workers_general": "Workers", "workers_ice_cooperation": "Workers",
    "workers_mass_layoffs": "Workers", "workers_positive": "Workers",
    "environment_general": "Environment", "environment_positive": "Environment",
    "animals_general": "Animals", "animals_positive": "Animals",
    "health_general": "Health", "health_positive": "Health",
    "extraction_general": "Extraction", "extraction_sale_leaseback": "Extraction",
    "extraction_debt_loading": "Extraction", "extraction_positive": "Extraction",
    "elite_impunity_general": "Elite impunity", "elite_impunity_epstein_network": "Elite impunity",
    "elite_impunity_positive": "Elite impunity",
}


def card_intent(harms, aligns):
    """Return (verdict_text, accent_color) for a card given its tags.
    Mirrors `intrinsicKind` in src/lib/types.ts: more harms than aligns
    reads as negative, more aligns than harms reads as positive."""
    if len(harms) > len(aligns):
        return "Conflicts with your values", AVOID
    if len(aligns) > len(harms):
        return "Aligns with your values", ALIGN
    return "In Starbird's database", INK_MUTED

# Fonts
try:
    FONT_TITLE = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 38)
    FONT_NAME = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 34)
    FONT_TEXT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 19)
    FONT_SMALL = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 15)
    FONT_CHIP = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 14)
    FONT_URL = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 14)
except Exception:
    FONT_TITLE = FONT_NAME = FONT_TEXT = FONT_SMALL = FONT_CHIP = FONT_URL = ImageFont.load_default()


def load_logo():
    if LOGO.exists():
        return Image.open(LOGO).convert("RGBA").resize((44, 44), Image.LANCZOS)
    return None


def get_values(harms):
    seen = []
    for q in harms:
        v = QUEST_TO_VALUE.get(q)
        if v and v not in seen:
            seen.append(v)
    return seen


def wrap_text(text, width_chars=85):
    return textwrap.fill(text, width=width_chars)


def render_card(
    name, subtitle, verdict, verdict_color, value_labels, why_text, footer_extra="",
):
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    # Card surface
    draw.rounded_rectangle([32, 68, W - 32, H - 36], radius=14, fill=SURFACE)

    # Left accent stripe
    draw.rectangle([32, 82, 37, H - 50], fill=verdict_color)

    # Logo
    logo = load_logo()
    if logo:
        img.paste(logo, (48, 12), logo)

    # STARBIRD header
    draw.text((100, 18), "STARBIRD", fill=INK, font=FONT_TITLE)

    cx = 56
    cy = 88

    # Name
    draw.text((cx, cy), name.upper(), fill=INK, font=FONT_NAME)
    cy += 46

    # Subtitle (ownership or harm score)
    if subtitle:
        draw.text((cx, cy), subtitle, fill=INK_MUTED, font=FONT_TEXT)
        cy += 30

    cy += 4

    # Verdict
    draw.text((cx, cy), verdict.upper(), fill=verdict_color, font=FONT_SMALL)
    cy += 28

    # Value chips (simple text pills) — colored to match the verdict accent
    if verdict_color == ALIGN:
        chip_fill = (95, 191, 122, 40)
    elif verdict_color == AVOID:
        chip_fill = (224, 108, 95, 40)
    else:
        chip_fill = (160, 152, 144, 40)
    chip_text = verdict_color
    chip_x = cx
    for label in value_labels:
        tw = draw.textlength(label, font=FONT_CHIP)
        chip_w = int(tw) + 20
        chip_h = 26
        # Chip background
        chip_bg = Image.new("RGBA", (chip_w, chip_h), (0, 0, 0, 0))
        chip_draw = ImageDraw.Draw(chip_bg)
        chip_draw.rounded_rectangle([0, 0, chip_w - 1, chip_h - 1], radius=12,
                                     fill=chip_fill, outline=verdict_color)
        img.paste(Image.alpha_composite(
            Image.new("RGBA", (chip_w, chip_h), (0, 0, 0, 0)), chip_bg
        ).convert("RGB"), (chip_x, cy), chip_bg.split()[3])
        draw.text((chip_x + 10, cy + 4), label, fill=chip_text, font=FONT_CHIP)
        chip_x += chip_w + 8
        if chip_x > W - 120:
            chip_x = cx
            cy += chip_h + 6
    cy += 36

    # Divider
    draw.line([(cx, cy - 4), (W - 56, cy - 4)], fill="#333333", width=1)

    # Why text (wrapped)
    wrapped = wrap_text(why_text[:300], width_chars=90)
    lines = wrapped.split("\n")[:5]
    for line in lines:
        draw.text((cx, cy + 2), line, fill=INK_MUTED, font=FONT_TEXT)
        cy += 24

    # Footer — category/AUM only, right-aligned. The image is intended for
    # social previews where the platform already shows the URL above the
    # card, so we don't repeat it here.
    if footer_extra:
        draw.text((W - 56 - draw.textlength(footer_extra, font=FONT_URL), H - 56),
                  footer_extra, fill=INK_FAINT, font=FONT_URL)

    return img


def _site_font(filename, size, fallback, variation_axes=None):
    """Load a vendored site font (scripts/fonts/), falling back to a
    system DejaVu face so the generator still runs on a bare box."""
    path = FONTS / filename
    try:
        if path.exists():
            f = ImageFont.truetype(str(path), size)
            if variation_axes:
                try:
                    f.set_variation_by_axes(variation_axes)
                except Exception:
                    pass
            return f
        return ImageFont.truetype(fallback, size)
    except Exception:
        return ImageFont.load_default()


def _sparkle(draw, cx, cy, r, fill):
    """Four-point sparkle (concave diamond)."""
    s = r * 0.28
    draw.polygon(
        [
            (cx, cy - r), (cx + s, cy - s), (cx + r, cy), (cx + s, cy + s),
            (cx, cy + r), (cx - s, cy + s), (cx - r, cy), (cx - s, cy - s),
        ],
        fill=fill,
    )


def _star_outline(draw, cx, cy, r, color, width=3):
    """Five-point star outline, like the 2pizza confetti stars."""
    pts = []
    for i in range(10):
        rad = r if i % 2 == 0 else r * 0.42
        ang = math.radians(-90 + i * 36)
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    draw.polygon(pts, outline=color, width=width)


def render_default(stats):
    """Default OG image used when the homepage URL is shared.
    Bold poster layout: deep-teal field with star confetti, a big
    cream badge holding the logo on the left, and the wordmark +
    tagline + live stat line on the right."""
    # Palette — deep teal field from the site's theme-color, with the
    # logo's cyan and gold doing the accent work.
    FIELD = (10, 74, 82)        # #0a4a52 — site theme-color
    FIELD_DEEP = (6, 52, 58)    # vignette / shadow tone
    CREAM = (240, 235, 227)     # #f0ebe3 — site ink
    GOLD = (232, 168, 62)       # #e8a83e
    CYAN = (95, 196, 208)       # #5fc4d0
    CONFETTI = (28, 98, 107)    # quiet star outlines
    CONFETTI_BRIGHT = (44, 122, 132)

    img = Image.new("RGB", (W, H), FIELD)
    draw = ImageDraw.Draw(img)

    # Subtle vertical gradient so the field doesn't read flat.
    for y in range(H):
        t = y / H
        r = int(FIELD[0] + (FIELD_DEEP[0] - FIELD[0]) * t * 0.55)
        g = int(FIELD[1] + (FIELD_DEEP[1] - FIELD[1]) * t * 0.55)
        b = int(FIELD[2] + (FIELD_DEEP[2] - FIELD[2]) * t * 0.55)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Star confetti — fixed positions (deterministic output), denser at
    # the edges so the text stays readable.
    outline_stars = [
        (60, 60, 16), (300, 40, 10), (700, 36, 12), (1020, 52, 15),
        (1150, 160, 11), (40, 300, 10), (1160, 330, 13), (60, 560, 13),
        (330, 590, 10), (760, 588, 11), (1080, 568, 15), (560, 50, 9),
    ]
    for cx, cy, r in outline_stars:
        _star_outline(draw, cx, cy, r, CONFETTI_BRIGHT, width=3)
    sparkles = [
        (180, 110, 7, CONFETTI_BRIGHT), (880, 80, 8, GOLD),
        (1120, 240, 6, CONFETTI_BRIGHT), (140, 480, 8, GOLD),
        (480, 600, 6, CONFETTI_BRIGHT), (940, 600, 7, GOLD),
        (420, 90, 6, CONFETTI_BRIGHT), (1170, 460, 7, CONFETTI_BRIGHT),
        (90, 180, 5, CONFETTI_BRIGHT), (640, 610, 5, CONFETTI_BRIGHT),
    ]
    for cx, cy, r, col in sparkles:
        _sparkle(draw, cx, cy, r, col)
    for cx, cy in [(250, 560), (980, 130), (30, 420), (1185, 60), (600, 95)]:
        draw.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=CONFETTI)

    # --- Left: big cream badge with the logo ------------------------------
    badge = 330
    bx, by = 88, (H - badge) // 2
    # Drop shadow, then cream card with a heavy deep-teal border.
    draw.rounded_rectangle(
        [bx + 10, by + 12, bx + badge + 10, by + badge + 12],
        radius=56, fill=FIELD_DEEP,
    )
    draw.rounded_rectangle(
        [bx, by, bx + badge, by + badge],
        radius=56, fill=CREAM, outline=FIELD_DEEP, width=8,
    )
    # Corner rivets, echoing the badge furniture on the 2pizza card.
    for dx in (34, badge - 34):
        for dy in (34, badge - 34):
            draw.ellipse(
                [bx + dx - 5, by + dy - 5, bx + dx + 5, by + dy + 5],
                fill=(208, 200, 188),
            )
    # The light-theme logo has dark-teal strokes — right for a cream badge.
    logo_src = LOGO_LIGHT if LOGO_LIGHT.exists() else LOGO
    if logo_src.exists():
        # The logo art has generous transparent padding baked in, so
        # render it larger than the badge interior would suggest.
        logo = Image.open(logo_src).convert("RGBA")
        logo = logo.resize((306, 306), Image.LANCZOS)
        img.paste(logo, (bx + (badge - 306) // 2, by + (badge - 306) // 2), logo)

    # --- Right: type stack -------------------------------------------------
    tx = 505
    mono = _site_font(
        "DMMono-Medium.ttf", 26,
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    )
    display = _site_font(
        "BebasNeue-Regular.ttf", 148,
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    )
    body = _site_font(
        "DMSans-Medium.ttf", 33,
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        variation_axes=[14, 500],
    )
    stat_mono = _site_font(
        "DMMono-Medium.ttf", 22,
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    )

    # Site URL eyebrow
    draw.text((tx, 92), "// STARBIRD42.COM", fill=GOLD, font=mono)

    # Headline — Bebas Neue, gold with a deep-teal drop shadow.
    ty = 130
    for line in ("SHOP YOUR", "VALUES."):
        draw.text((tx + 5, ty + 6), line, fill=FIELD_DEEP, font=display)
        draw.text((tx, ty), line, fill=GOLD, font=display)
        ty += 138

    # Tagline
    ty += 18
    for line in ("Every brand scored against the firms",
                 "that own it. The receipts are linked."):
        draw.text((tx, ty), line, fill=CREAM, font=body)
        ty += 44

    # Live stat line — regenerated nightly with the data.
    stat_text = (
        f"{stats['brands']} brands · {stats['firms']} firms · "
        f"{stats['aum']} AUM tracked"
    )
    draw.text((tx, ty + 22), stat_text, fill=CYAN, font=stat_mono)

    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    data = json.loads(DATA.read_text())
    count = 0

    # Brands
    firms_by_id = {f["id"]: f for f in data["firms"]}
    for b in data["brands"]:
        owners = []
        for o in b.get("ownership", []):
            firm = firms_by_id.get(o["firmId"])
            name = firm["name"] if firm else o["firmId"]
            owners.append(name)
        subtitle = f"Owned by {', '.join(owners)}" if owners else ""
        harms = b.get("harms", [])
        aligns = b.get("aligns", [])
        verdict, color = card_intent(harms, aligns)
        values = get_values(harms + aligns)

        img = render_card(
            name=b["avoid"],
            subtitle=subtitle,
            verdict=verdict,
            verdict_color=color,
            value_labels=values,
            why_text=b.get("why", ""),
            footer_extra=b.get("cat", "").upper(),
        )
        img.save(OUT / f"{b['id']}.png")
        count += 1

    # Firms
    for f in data["firms"]:
        harms = f.get("harms", [])
        aligns = f.get("aligns", [])
        verdict, color = card_intent(harms, aligns)
        values = get_values(harms + aligns)
        img = render_card(
            name=f["name"],
            subtitle=f"Harm score: {f['harmScore']}/100" if f.get("harmScore") else "",
            verdict=verdict,
            verdict_color=color,
            value_labels=values,
            why_text=f.get("summary", ""),
            footer_extra=f.get("aum", ""),
        )
        img.save(OUT / f"{f['id']}.png")
        count += 1

    # Default OG image — used by the homepage's <svelte:head> when the
    # bare URL is shared (iMessage, Slack, Twitter, etc.).
    total_aum = sum(f.get("aumVal", 0) for f in data["firms"])
    if total_aum >= 1000:
        aum_label = f"${total_aum / 1000:.1f}T"
    else:
        aum_label = f"${total_aum:.0f}B"
    default_img = render_default({
        "brands": len(data["brands"]),
        "firms": len(data["firms"]),
        "aum": aum_label,
    })
    default_img.save(OUT / "_default.png")
    count += 1

    print(f"generated {count} card images in {OUT}")


if __name__ == "__main__":
    main()
