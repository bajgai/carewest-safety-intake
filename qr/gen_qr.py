#!/usr/bin/env python3
"""Generate the Carewest Safety Intake QR (bare + a simple labelled poster) for the Pages URL."""
import os, qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
URL = "https://bajgai.github.io/carewest-safety-intake/"
NAVY = (1, 66, 106); YELLOW = (255, 199, 44); WHITE = (255, 255, 255); INK = (28, 28, 30)

def make_qr(url, box=16, border=4):
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_H, box_size=box, border=border)
    qr.add_data(url); qr.make(fit=True)
    return qr.make_image(fill_color="black", back_color="white").convert("RGB")

def font(size):
    for p in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf",
              "/System/Library/Fonts/Helvetica.ttc",
              "/Library/Fonts/Arial.ttf"):
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except Exception: pass
    return ImageFont.load_default()

# 1) bare QR
bare = make_qr(URL)
bare.save(os.path.join(HERE, "safety-intake-qr.png"))

# 2) simple letter-ish poster
W, H = 1000, 1300
poster = Image.new("RGB", (W, H), WHITE)
d = ImageDraw.Draw(poster)
d.rectangle([0, 0, W, 14], fill=NAVY)
d.rectangle([0, 14, W, 22], fill=YELLOW)

def centered(text, y, fnt, fill=INK):
    w = d.textbbox((0, 0), text, font=fnt)[2]
    d.text(((W - w) / 2, y), text, font=fnt, fill=fill)

centered("CAREWEST SAFETY INTAKE", 70, font(54), NAVY)
centered("See something? Scan it. Report it in under a minute.", 150, font(30), INK)
qr = make_qr(URL, box=12, border=2)
qs = 620; qr = qr.resize((qs, qs), Image.Resampling.NEAREST)
poster.paste(qr, ((W - qs) // 2, 230))
centered("Scan with your phone camera", 880, font(30), NAVY)
centered("Hazard · Incident · Maintenance · Chemical · Cleaning · Feedback", 940, font(24), INK)
centered("Routed straight to your site manager. You can report anonymously.", 990, font(24), INK)
centered("Not for medical emergencies — if someone is hurt, tell your supervisor now.", 1050, font(22), (160, 0, 30))
centered(URL, 1130, font(22), (84, 86, 90))
d.rectangle([0, H - 22, W, H - 14], fill=YELLOW)
d.rectangle([0, H - 14, W, H], fill=NAVY)
poster.save(os.path.join(HERE, "safety-intake-poster.png"))
print("wrote safety-intake-qr.png + safety-intake-poster.png for", URL)
