# Vendored fonts for generate-card-images.py

These match the site's web fonts so the pre-rendered OG share cards use
the same typography as the app:

- `BebasNeue-Regular.ttf` — display headline
- `DMSans-Medium.ttf` — body (variable font; the generator sets opsz/wght axes)
- `DMMono-Medium.ttf` — eyebrow + stat line

All three are from the [google/fonts](https://github.com/google/fonts)
repo and licensed under the SIL Open Font License 1.1. The generator
falls back to system DejaVu faces if these files are missing.
