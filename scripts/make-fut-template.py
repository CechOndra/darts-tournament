#!/usr/bin/env python3
"""Draws docs/fut-card-template.png: the FUT card canvas (816 x 1000, drawn at 2x) with every area the app writes on.
Use it as a bottom layer in Canva / Figma / Photoshop. Geometry mirrors src/components/fut/FutCard.tsx."""
from PIL import Image, ImageDraw, ImageFont

W, H, S = 816, 1000, 2
im = Image.new("RGBA", (W * S, H * S), (255, 255, 255, 255))
d = ImageDraw.Draw(im, "RGBA")
try:
    font = ImageFont.truetype("arial.ttf", 22 * S // 2)
except OSError:
    font = ImageFont.load_default()
pc = lambda p, of: p / 100 * of


def box(x, y, w, h, label, color):
    d.rectangle([x * S, y * S, (x + w) * S, (y + h) * S], fill=color + (60,), outline=color + (255,), width=3)
    d.text((x * S + 8, y * S + 6), label, fill=(20, 20, 20, 255), font=font)


# card canvas edge + a rough shield so you see where the frame art lives
d.rectangle([0, 0, W * S - 1, H * S - 1], outline=(0, 0, 0, 255), width=4)
d.text((20, 20), "FUT card canvas 816 x 1000 px (this file is 2x = 1632 x 2000)", fill=(0, 0, 0, 255), font=font)
box(pc(38, W), pc(19.5, H), pc(44, W), pc(33.5, H), "PHOTO window 359 x 335 (bottom 25% fades out)", (220, 60, 60))
box(pc(29, W) - 55, pc(20.5, H), 110, 95, "OVR", (60, 120, 220))
box(pc(29, W) - 40, pc(30.2, H), 80, 40, "P1/P2", (60, 120, 220))
box(pc(29, W) - pc(9.5, W) / 2, pc(36.2, H), pc(9.5, W), pc(4.8, H), "DARTS", (60, 120, 220))
box(pc(29, W) - pc(9, W) / 2, pc(43, H), pc(9, W), pc(6.5, H), "team logo 73x65", (60, 160, 90))
box(pc(18, W), pc(55.2, H), pc(64, W), 56, "PLAYER NAME (max 52 px tall, 64% wide)", (230, 150, 30))
box(pc(23, W), pc(63.5, H), pc(30, W), pc(18.5, H) - 25, "stats left (3 rows)", (150, 80, 200))
box(pc(53, W), pc(63.5, H), pc(30, W), pc(18.5, H) - 25, "stats right (3 rows)", (150, 80, 200))
box(W / 2 - 150, pc(83.5, H) + 4, 300, 52, "PLAYSTYLE badge 300 x 52", (230, 150, 30))
d.line([(pc(23, W) * S, pc(62, H) * S), (pc(77, W) * S, pc(62, H) * S)], fill=(0, 0, 0, 200), width=3)
im.save("docs/fut-card-template.png")
print("docs/fut-card-template.png")
