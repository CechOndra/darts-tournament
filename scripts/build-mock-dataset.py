#!/usr/bin/env python3
"""Builds local-data/mock-dataset.json (git-ignored) for Admin > Live > Test Tournament > "Load mock dataset".

    python scripts/build-mock-dataset.py                 # reads local-data/mock-roster.json
    python scripts/build-mock-dataset.py --preview out.png   # contact sheet of the crops, to check them by eye

Needs only Pillow (pip install pillow). Nothing real is ever committed: names, photos and the roster file live in
local-data/ (git-ignored). Roster file format:

{
  "sourceDir": "path/with/the/photos/and/logos",
  "teams": [
    { "name": "Team name", "logo": "logos/x.png",
      "players": [ { "name": "Anna Novak", "nickname": "Ace", "photo": "players/anna.jpg", "framing": "studio" } ] }
  ]
}

framing (how to cut the profile picture and the FUT card photo out of the original):
  studio    waist-up studio portrait, 2:3, head in the upper third, centered (all photos from the same shoot)
  top       head near the top and centered: take the top part
  none      leave it to the app (no photo, or an already square profile picture)
"""
import argparse
import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps

FUT_RATIO = 359 / 335  # the portrait window of the FUT card (see docs/FUT-CARD-SPEC.md)

# (face centre x, face centre y, profile square side) as fractions of the width / height / width
FRAMING = {
    "studio": dict(fx=0.49, fy=0.27, side=0.62, fut_x=0.14, fut_w=0.70, fut_top=0.20),
    "top": dict(fx=0.50, fy=0.17, side=0.55, fut_x=0.0, fut_w=1.0, fut_top=0.0),
}


def crops(im: Image.Image, kind: str):
    w, h = im.size
    f = FRAMING[kind]
    side = f["side"] * w
    cx, cy = f["fx"] * w, f["fy"] * h
    x0 = min(max(cx - side / 2, 0), w - side)
    y0 = min(max(cy - side / 2, 0), h - side)
    avatar = im.crop((round(x0), round(y0), round(x0 + side), round(y0 + side)))
    fw = f["fut_w"] * w
    fh = fw / FUT_RATIO
    fy0 = min(f["fut_top"] * w, max(0, h - fh))  # fut_top is a fraction of the width, like the card geometry
    fut = im.crop((round(f["fut_x"] * w), round(fy0), round(f["fut_x"] * w + fw), round(min(h, fy0 + fh))))
    return avatar, fut


def data_url(im: Image.Image, max_side: int) -> str:
    im = im.copy()
    im.thumbnail((max_side, max_side), Image.LANCZOS)
    buf = io.BytesIO()
    if im.mode == "RGBA":
        im.save(buf, "PNG", optimize=True)
        mime = "image/png"
    else:
        im.convert("RGB").save(buf, "JPEG", quality=88)
        mime = "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(buf.getvalue()).decode()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--roster", default="local-data/mock-roster.json")
    ap.add_argument("--out", default="local-data/mock-dataset.json")
    ap.add_argument("--preview", help="write a contact sheet PNG instead of the dataset")
    args = ap.parse_args()
    cfg = json.loads(Path(args.roster).read_text(encoding="utf-8"))
    src = Path(cfg["sourceDir"])
    teams, sheet = [], []
    for t in cfg["teams"]:
        team = {"name": t["name"], "players": []}
        if t.get("logo"):
            logo = ImageOps.exif_transpose(Image.open(src / t["logo"]))
            team["logo"] = data_url(logo.convert("RGBA"), 512)
        for p in t["players"]:
            entry = {k: p[k] for k in ("name", "nickname") if p.get(k)}
            if p.get("photo"):
                im = ImageOps.exif_transpose(Image.open(src / p["photo"]))
                kind = p.get("framing", "none")
                if kind != "none":
                    avatar, fut = crops(im.convert("RGBA") if im.mode == "RGBA" else im, kind)
                    entry["photo"], entry["futPhoto"] = data_url(avatar, 512), data_url(fut, 1100)
                    sheet.append((p.get("name", "?"), avatar, fut))
                else:
                    entry["photo"] = data_url(im, 512)
            team["players"].append(entry)
        teams.append(team)
    if args.preview:
        cell = 260
        out = Image.new("RGB", (cell * 2 + 20, (cell + 10) * len(sheet)), "#334155")
        for i, (_, a, f) in enumerate(sheet):
            a2, f2 = a.copy(), f.copy()
            a2.thumbnail((cell, cell))
            f2.thumbnail((cell, cell))
            out.paste(a2.convert("RGB"), (0, i * (cell + 10)))
            out.paste(f2.convert("RGB"), (cell + 20, i * (cell + 10)))
        out.save(args.preview)
        print(f"preview: {args.preview} ({len(sheet)} players)")
        return
    Path(args.out).write_text(json.dumps({"teams": teams}), encoding="utf-8")
    n = sum(len(t["players"]) for t in teams)
    print(f"{args.out}: {len(teams)} teams, {n} players, {Path(args.out).stat().st_size // 1024} KB")


if __name__ == "__main__":
    sys.exit(main())
