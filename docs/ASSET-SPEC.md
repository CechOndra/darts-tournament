# Image specs: FUT cards, player photos, team logos

How to make your own FUT card frames and how to prepare photos and logos so they fit the app exactly.
Everything below mirrors the code (`src/components/fut/FutCard.tsx`, `src/services/media/photoCompressor.ts`).

**Quick answer:** four kinds of image.

| Image | Where it is used | Make it | Format |
|-------|------------------|---------|--------|
| FUT card frame (4 rarities) | behind the FUT card | 1632 x 2000 px (ratio 0.816 : 1) | transparent PNG |
| FUT card photo | inside the card | about 1070 x 1000 px (ratio 1.07 : 1), head and shoulders | transparent PNG (cut-out) is best, JPG works |
| Profile picture | round avatar on stage, scoreboard, admin, phones | 1024 x 1024 px (1 : 1), head and shoulders | PNG or JPG |
| Team logo | stage, scoreboards, FUT card, admin | 512 x 512 px (1 : 1) with padding | transparent PNG |

The app never uses a full-body photo. If you only have a full-body (or waist-up) photo, cut the two
head-and-shoulders crops out of it (section 4).

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

## 2. FUT card photo

- **Frame to shoot or cut:** ratio **1.07 : 1** (wide, almost square), the same shape as the photo window (359 x 335).
  Recommended **1070 x 1000 px**; anything from 720 px wide up is fine. The app keeps at most 720 px on the long side.
- **What is in it:** head and shoulders. Eyes at about 35 % from the top, face centered horizontally, head about
  55 to 60 % of the picture height, shoulders touching the left, right and bottom edge. Leave a little air above the hair.
- **Bottom 25 % fades out** into the card, so nothing important (logos, hands) belongs there.
- **Fit rule:** the photo is scaled to cover the window and aligned to the bottom center; a different ratio just crops
  the top and the sides.
- **Background:** a **transparent PNG cut-out** looks best (the player stands on the card). A normal photo with a
  background shows as a rectangle. The app keeps transparency (stored as WebP).
- Upload it per player in Admin > Teams > the card icon next to the player. Without it the profile picture is used.

## 3. Profile picture (round avatar)

- **Square 1 : 1**, recommended **1024 x 1024 px**, minimum 512. The app stores 256 x 256 px, cropped to the center
  square, and shows it in a circle (corners are cut off).
- Head and shoulders, face centered, head about 60 to 65 % of the picture height, a bit of the shoulders visible.
- Opaque background or transparent, both work (transparent shows the dark app background behind the person).
- Upload with the camera icon in Admin > Teams. Players without photo get a grey silhouette.

## 4. Getting both crops from one full-body photo

Yes, if all photos come from the same kind of shoot (same framing, face in the same place), both crops can be cut
automatically with fixed fractions. This is what `scripts/build-mock-dataset.py` does for the studio photos
(waist-up portraits, ratio 2 : 3, head in the upper third):

- Profile picture: a square of **62 % of the photo width**, centered on the face at **49 % from the left and 27 % from the top**.
- FUT photo: a **70 % wide** crop starting 14 % from the left and 0.20 x width from the top, height = width / 1.07.

For arbitrary photos (face anywhere) the app has no face detection, so it cannot guess. Options, from simplest:

1. Shoot every player the same way (one master photo, ratio 2 : 3, head in the upper third, face centered), and use the
   fractions above. Best for a tournament where you take the photos yourself.
2. Cut the square and the wide crop yourself (any image tool) and upload both.
3. Later: add face detection (for example OpenCV in the prep script) or a drag-to-crop tool in the admin.

If you upload a tall photo straight as the profile picture, the app takes the center square, which for a 2 : 3 portrait
is the chest, not the face. Crop it first.

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
- [ ] FUT photos about 1070 x 1000, transparent PNG if possible, name = the player's name
- [ ] Profile pictures 1024 x 1024
- [ ] Team logos 512 x 512 transparent with padding
- [ ] No private photos you do not want on a public website (anything in `public/` is public)
