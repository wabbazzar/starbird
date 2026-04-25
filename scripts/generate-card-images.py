#!/usr/bin/env python3
"""
Pre-generate OG share images for every brand and firm in data.json.
Each image is a 1200x630 PNG matching the Starbird dark theme.
Output: static/cards/{id}.png

Run: python3 scripts/generate-card-images.py
Re-run whenever data.json changes (the Guardian can trigger this).
"""
import json
import pathlib
import textwrap
from PIL import Image, ImageDraw, ImageFont

REPO = pathlib.Path(__file__).resolve().parent.parent
DATA = REPO / "static" / "data.json"
OUT = REPO / "static" / "cards"
LOGO = REPO / "static" / "logo-dark.png"

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

    # Footer
    draw.text((cx, H - 56), "→ wabbazzar.github.io/starbird", fill=PRIMARY, font=FONT_URL)
    if footer_extra:
        draw.text((W - 56 - draw.textlength(footer_extra, font=FONT_URL), H - 56),
                  footer_extra, fill=INK_FAINT, font=FONT_URL)

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

    print(f"generated {count} card images in {OUT}")


if __name__ == "__main__":
    main()
