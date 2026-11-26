#!/usr/bin/env python3
"""Builds local-data/mock-dataset.json (git-ignored) from a folder of teams and players.

    python scripts/build-mock-dataset.py                    # reads local-data/roster/
    python scripts/build-mock-dataset.py --preview x.png    # contact sheet of the cut-out photos, to check by eye
    python scripts/build-mock-dataset.py --dir other/folder

Load the result in Admin > Live > Test Tournament > "Load mock dataset (.json)". Needs only Pillow (pip install pillow).
The folder layout and file names are explained in local-data/roster/README.txt (copy: docs/ROSTER-FOLDER.txt).
Nothing in local-data/ is ever committed (real names, photos).
"""
import argparse
import base64
import io
import json
import re
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageOps

FUT_RATIO = 359 / 335  # the photo window of the FUT card (see docs/ASSET-SPEC.md)
IMG = {".png", ".jpg", ".jpeg", ".webp"}

# How to cut the head-and-shoulders photo out of a bigger photo (fractions of its width / height).
FRAMING = {
    # waist-up studio portrait, 2:3, head in the upper third, centered (same shoot for everybody)
    "studio": dict(x=0.14, w=0.70, top=0.20),  # top is a fraction of the WIDTH
    # snapshot with the head near the top and centered
    "top": dict(x=0.0, w=1.0, top=0.0),
}


def find(folder: Path, stem: str):
    """First image in folder called <stem>.<ext> (any case)."""
    for f in sorted(folder.iterdir()):
        if f.is_file() and f.suffix.lower() in IMG and f.stem.lower() == stem:
            return f
    return None


def bust_crop(im: Image.Image, kind: str) -> Image.Image:
    w, h = im.size
    f = FRAMING[kind]
    cw = f["w"] * w
    ch = cw / FUT_RATIO
    y0 = min(f["top"] * w, max(0, h - ch))
    return im.crop((round(f["x"] * w), round(y0), round(f["x"] * w + cw), round(min(h, y0 + ch))))


def data_url(im: Image.Image, max_side: int) -> str:
    im = im.copy()
    im.thumbnail((max_side, max_side), Image.LANCZOS)
    buf = io.BytesIO()
    if im.mode in ("RGBA", "LA", "P"):
        im.convert("RGBA").save(buf, "PNG", optimize=True)
        mime = "image/png"
    else:
        im.convert("RGB").save(buf, "JPEG", quality=88)
        mime = "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(buf.getvalue()).decode()


def load(path: Path) -> Image.Image:
    return ImageOps.exif_transpose(Image.open(path))


def clean_team(name: str) -> str:
    return re.sub(r"^\d+[\s._-]+", "", name).strip()  # "01 Falcons" -> "Falcons"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="local-data/roster")
    ap.add_argument("--out", default="local-data/mock-dataset.json")
    ap.add_argument("--preview")
    args = ap.parse_args()
    root = Path(args.dir)
    readme = Path(__file__).resolve().parent.parent / "docs" / "ROSTER-FOLDER.txt"
    if not root.exists():
        root.mkdir(parents=True)
    if readme.exists() and not (root / "README.txt").exists():
        shutil.copy(readme, root / "README.txt")
    teams, sheet = [], []
    for tdir in sorted(p for p in root.iterdir() if p.is_dir()):
        team = {"name": clean_team(tdir.name), "players": []}
        logo = find(tdir, "logo")
        if logo:
            team["logo"] = data_url(load(logo).convert("RGBA"), 512)
        for pdir in sorted(p for p in tdir.iterdir() if p.is_dir()):
            entry = {"name": pdir.name}
            nick = pdir / "nickname.txt"
            if nick.exists():
                entry["nickname"] = nick.read_text(encoding="utf-8").strip().splitlines()[0][:16]
            bust = None
            for stem, kind in (("photo", None), ("photo-studio", "studio"), ("photo-top", "top")):
                src = find(pdir, stem)
                if src:
                    im = load(src)
                    bust = bust_crop(im, kind) if kind else im
                    break
            if bust is not None:
                entry["bust"] = data_url(bust, 1100)
                sheet.append(bust)
            prof = find(pdir, "profile")
            if prof:
                entry["avatar"] = data_url(load(prof), 512)
            team["players"].append(entry)
        teams.append(team)
    if args.preview:
        cell = 300
        cols = 4
        rows = (len(sheet) + cols - 1) // cols
        out = Image.new("RGB", (cols * (cell + 10), rows * (cell + 10)), "#334155")
        for i, b in enumerate(sheet):
            t = b.copy()
            t.thumbnail((cell, cell))
            out.paste(t.convert("RGB"), ((i % cols) * (cell + 10), (i // cols) * (cell + 10)))
        out.save(args.preview)
        print(f"preview: {args.preview} ({len(sheet)} photos)")
        return
    Path(args.out).write_text(json.dumps({"teams": teams}), encoding="utf-8")
    n = sum(len(t["players"]) for t in teams)
    print(f"{args.out}: {len(teams)} teams, {n} players, {Path(args.out).stat().st_size // 1024} KB")


if __name__ == "__main__":
    sys.exit(main())
