# Image specs: FUT cards, player photos, team logos

How to make your own FUT card frames and how to prepare photos and logos so they fit the app exactly.
Everything below mirrors the code (`src/components/fut/FutCard.tsx`, `src/services/media/photoCompressor.ts`).

**Quick answer:** one photo per player is enough. Make ONE head-and-shoulders photo; the app uses it on the FUT card and
on the "next match" screen, and cuts the round profile picture out of it.

| Image | Where it is used | Make it | Format |
|-------|------------------|---------|--------|
| FUT card frame (4 rarities) | behind the FUT card | 1632 x 2000 px (ratio 0.816 : 1) | transparent PNG |
| **Player photo** (the one photo) | FUT card, "next match" screen on the stage; the round avatar is cut from it | about 1070 x 1000 px (ratio 1.07 : 1), head and shoulders | transparent PNG (cut-out) is best, JPG works |
| Profile picture (optional) | round avatar on scoreboard, admin, phones. Only needed if you want a different picture than the automatic cut | 1024 x 1024 px (1 : 1) | PNG or JPG |
| Team logo | stage, scoreboards, FUT card, admin | 512 x 512 px (1 : 1) with padding | transparent PNG |

The app never uses a full-body photo. If you only have a waist-up or full-body photo, cut the head-and-shoulders crop out
of it (section 4). How to arrange the files in folders: `docs/ROSTER-FOLDER.txt`.

## 1. FUT card frame

The card is drawn as one picture on a canvas of **816 x 1000 px**. Your frame is stretched to fill the whole canvas,
so draw it **816 x 1000 or exactly 2x: 1632 x 2000 px** (recommended: the downloaded card PNG is exported at 2x, so a 2x
frame stays sharp). Transparent background outside the shield, PNG.

The app writes everything else on top of your frame (rating, name, stats, photo, logo), at fixed positions. Keep these
areas calm and readable (no busy patterns), and do not bake any text or numbers into the frame:

| Area | x (px) | y (px) | Size | What |
|------|--------|--------|------|------|
| Photo window | 310 to 669 | 195 to 530 | 359 x 335 | player photo, bottom 25 % fades out |
| Overall rating (OVR) | centered at x 237 | 205 to 285 | about 110 x 95 | big number |
| Position (P1 / P2) | centered at x 237 | 302 to 335 | about 80 x 35 | text |
| "DARTS" badge | 198 to 276 | 362 to 410 | 78 x 48 | rounded box |
| Team logo | 200 to 273 | 430 to 495 | 73 x 65 | logo, fitted inside |
| Player name | 147 to 669 (centered at 408) | 552 to 608 | up to 522 wide, 52 tall | upper-case text |
| Divider line | 188 to 628 | 620 | | thin line |
| Stats, left column | 188 to 400 | 635 to 805 | 3 rows | number + label, rows every 63 px |
| Stats, right column | 433 to 645 | 635 to 805 | 3 rows | number + label |
| Playstyle badge | 258 to 558 | 839 to 891 | 300 x 52 | rounded box with text |

`docs/fut-card-template.png` has all of these drawn as coloured boxes on a 1632 x 2000 canvas. Put it as the bottom
layer in Canva / Figma / Photoshop, design your shield around it, then hide or delete the layer and export. Regenerate it
with `python scripts/make-fut-template.py` if the layout in the code ever changes.

Text colours: dark brown ink (`#3e3114`) on bronze, silver and gold; near-white (`#f8fafc`) on the Icon frame. Use
light enough art behind the dark text (bronze, silver, gold) and dark enough art for Icon.

Files, one per rarity, in `public/custom-cards/`: `fut-bronze.png`, `fut-silver.png`, `fut-gold.png`, `fut-icon.png`
(Bronze below OVR 66, Silver 66+, Gold 77+, Icon 87+). Missing files fall back to the built-in shield. Files in
`public/` are published on the website, so everyone can download them.

## 2. Player photo (FUT card + next-match screen)

- **Frame to shoot or cut:** ratio **1.07 : 1** (wide, almost square), the same shape as the FUT photo window
  (359 x 335). Recommended **1070 x 1000 px**; anything from 720 px wide up is fine. The app keeps at most 720 px on the
  long side.
- **What is in it:** head and shoulders. **Face centered horizontally, eyes at about 35 % from the top**, head about
  55 to 60 % of the picture height, shoulders touching the left, right and bottom edge. A little air above the hair.
  Keeping the face in this spot is what lets the app cut the round profile picture out automatically.
- **FUT card:** the photo is scaled to cover the window and aligned to the bottom center; the **bottom 25 % fades out**
  into the card, so nothing important (logos, hands) belongs there. A different ratio just crops the top and the sides.
- **"Next match" screen (stage):** shown 256 px tall (192 px when a team has 3 players) next to the team logo, left team
  bottom-left, right team bottom-right. Transparent cut-outs look best here too.
- **Background:** a **transparent PNG cut-out** looks best (the player stands on the card and on the stage). A normal
  photo with a background shows as a rectangle with rounded corners. The app keeps transparency (stored as WebP).
- Upload per player in Admin > Teams with the card icon next to the player. The profile picture is cut from it at the
  same moment.

## 3. Profile picture (round avatar)

- Normally **you do not need to make one**: it is cut from the player photo (a square from 2 % to 78 % of the photo
  height, centered, so head and shoulders).
- If you want a different one: **square 1 : 1**, **1024 x 1024 px** (minimum 512), head and shoulders, face centered,
  head about 60 to 65 % of the height. Stored as 256 x 256 px, shown in a circle. Upload it with the camera icon in
  Admin > Teams (this replaces the automatic one, the player photo stays).
- Players without any photo get a grey silhouette.

## 4. Getting the player photo from a bigger photo

If all photos come from the same kind of shoot (same framing, face in the same place), the crop can be cut automatically
with fixed fractions. This is what `scripts/build-mock-dataset.py` does:

- `photo-studio.jpg` (waist-up studio portrait, ratio 2 : 3, head in the upper third, face centered): a crop **70 % of the
  width wide**, starting 14 % from the left and 0.20 x width from the top, height = width / 1.07.
- `photo-top.jpg` (snapshot, head near the top): the top part, full width.

For arbitrary photos (face anywhere) the app has no face detection, so it cannot guess. Options, from simplest:

1. Shoot every player the same way (one master photo, ratio 2 : 3, head in the upper third, face centered).
2. Cut the head-and-shoulders crop yourself (any image tool) following section 2.
3. Later: face detection (for example OpenCV in the prep script) or a drag-to-crop tool in the admin.

A tall photo uploaded straight into the app is NOT cropped to the face: the card would show the chest. Crop it first.

## 5. Team logos

- **Square canvas 1 : 1, 512 x 512 px or larger, transparent PNG**, with the logo fitted inside and about 5 % padding.
- Round, shield-shaped and wide logos all work: the app fits the **whole** logo into the square (never crops it) and
  centers it. Wide logos (like the Farmers wordmark) become small in the square: if you can, export a version with a
  stacked or shortened layout, or keep it at least 3 : 1 wide so the text stays readable at 64 px.
- The app shows logos on a **white tile** (stage, scoreboards, admin), so dark and light logos both stay visible.
- On the FUT card the logo is drawn without the tile, inside the 73 x 65 box. Check that the logo is readable on your
  frame colour.
- Stored as 256 x 256 WebP.

## 6. Checklist before you hand over files

- [ ] FUT frames 1632 x 2000 px PNG with transparent outside, named `fut-bronze/silver/gold/icon.png`
- [ ] Checked against `docs/fut-card-template.png` that nothing is drawn under the text areas
- [ ] One player photo per player, about 1070 x 1000, face centered, eyes ~35 % from the top, transparent PNG if possible
- [ ] (optional) profile pictures 1024 x 1024 only where the automatic cut is not good enough
- [ ] Files in the folder layout of `docs/ROSTER-FOLDER.txt`
- [ ] Team logos 512 x 512 transparent with padding
- [ ] No private photos you do not want on a public website (anything in `public/` is public)
