"""Storyboard of a plan, as ONE image anyone can read before the video is made.
python tools/storyboard.py <job_dir> <library_dir> <studio_root>
Reads <job_dir>/storyboard_plan.json (written by server.js: title, channel, chapters, media) and writes <job_dir>/storyboard.jpg.
Every shot is a card: its number and time, the theme, a 9:16 picture (the real app screenshot, with the zoomed part when the shot
zooms, or the theme's poster for a scene shot), what the narrator says, the words on screen and what happens.
No Claude call, no rendering: it takes a second and costs nothing."""
import json, os, sys, textwrap
from PIL import Image, ImageDraw, ImageFont, ImageFilter

job, lib, root = sys.argv[1], sys.argv[2], sys.argv[3]
P = json.load(open(os.path.join(job, 'storyboard_plan.json'), encoding='utf-8'))

def font(size, bold=False):
    names = (['arialbd.ttf', 'DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf']
             if bold else ['arial.ttf', 'DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf'])
    for n in names:
        try: return ImageFont.truetype(n, size)
        except Exception: pass
    return ImageFont.load_default()

INK, MUTED, LINE, ACCENT, BG, CARD = (25, 32, 40), (95, 105, 115), (225, 229, 234), (18, 120, 110), (243, 245, 247), (255, 255, 255)
F_T, F_H, F_B, F_S, F_L = font(44, True), font(22, True), font(20), font(17), font(15, True)

def wrap(d, text, f, width, max_lines=99):
    words, lines, cur = str(text or '').split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=f) <= width: cur = t
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    if len(lines) > max_lines: lines = lines[:max_lines]; lines[-1] = lines[-1].rstrip('.,') + ' ...'
    return lines

def poster(slug):
    for p in [os.path.join(lib, 'styles', slug, 'poster.jpg'), os.path.join(root, 'studio-themes', slug, 'poster.jpg')]:
        if os.path.exists(p): return Image.open(p).convert('RGB')
    return None

media = {m['id']: m for m in P.get('media', [])}
def picture(shot, style, W, H):
    """the 9:16 picture of a shot"""
    box = Image.new('RGB', (W, H), (236, 239, 242))
    m = media.get(shot.get('img') or '')
    if m and os.path.exists(os.path.join(job, m['file'])):
        im = Image.open(os.path.join(job, m['file'])).convert('RGBA')
        reg = (m.get('regions') or {}).get(shot.get('zoom') or '')
        if reg:   # what the viewer sees when the shot zooms: the named part, big
            x, y, w, h = reg; iw, ih = im.size
            crop = im.crop((int(x * iw), int(y * ih), int((x + w) * iw), int((y + h) * ih)))
            crop.thumbnail((W - 24, H - 24))
            card = Image.new('RGBA', (W, H), (236, 239, 242, 255)); card.alpha_composite(crop, ((W - crop.width) // 2, (H - crop.height) // 2))
            d = ImageDraw.Draw(card); cx, cy = (W - crop.width) // 2, (H - crop.height) // 2
            d.rectangle([cx - 4, cy - 4, cx + crop.width + 4, cy + crop.height + 4], outline=(220, 40, 40), width=5)
            d.rounded_rectangle([10, 10, 10 + d.textlength('ZOOM: ' + shot['zoom'].replace('_', ' '), font=F_L) + 16, 36], 6, fill=(220, 40, 40))
            d.text((18, 14), 'ZOOM: ' + shot['zoom'].replace('_', ' '), fill=(255, 255, 255), font=F_L)
            return card.convert('RGB')
        if m.get('label'):   # a character frame (character video) fills its card like a photo
            r = max(W / im.width, H / im.height); im = im.resize((int(im.width * r) + 1, int(im.height * r) + 1), Image.LANCZOS)
            return im.crop(((im.width - W) // 2, (im.height - H) // 2, (im.width - W) // 2 + W, (im.height - H) // 2 + H)).convert('RGB')
        bb = im.getbbox()   # cut the empty transparent margin so the device fills the card
        if bb: im = im.crop(bb)
        r = min((W - 16) / im.width, (H - 16) / im.height); im = im.resize((max(1, int(im.width * r)), max(1, int(im.height * r))), Image.LANCZOS)
        bgc = (34, 38, 44, 255) if 'white' in str(m.get('name', '')).lower() else (236, 239, 242, 255)   # a white logo needs a dark card
        card = Image.new('RGBA', (W, H), bgc)
        card.alpha_composite(im, ((W - im.width) // 2, (H - im.height) // 2))
        return card.convert('RGB')
    # a scene shot, drawn in ONE general storyboard look (the real scene is animated for this video in its theme):
    # a gradient in the theme's colour, the words on screen big on yellow, and what happens
    c1 = THEME_COL.get(style, (60, 80, 110)); c2 = tuple(max(0, int(v * .45)) for v in c1)
    box = Image.new('RGB', (W, H)); px = box.load()
    for yy in range(H):
        k = yy / H; row = tuple(int(c1[i] * (1 - k) + c2[i] * k) for i in range(3))
        for xx in range(W): px[xx, yy] = row
    d = ImageDraw.Draw(box)
    d.text((16, 14), 'SCENE  ·  ' + style.upper(), fill=(255, 255, 255), font=F_L)
    words = shot.get('text') or ''; y0 = H * 0.3
    if words:
        fz = 44; f = font(fz, True); lines = wrap(d, words.upper(), f, W - 48, 4)
        y0 = H * 0.34 - len(lines) * (fz + 12) / 2
        for l in lines:
            tw = d.textlength(l, font=f); d.rounded_rectangle([18, y0 - 6, 18 + tw + 20, y0 + fz + 8], 6, fill=(255, 212, 0))
            d.text((28, y0), l, fill=(17, 17, 17), font=f); y0 += fz + 16
    yy = int(max(y0 + 24, H * 0.52))
    for l in wrap(d, shot.get('action', ''), F_B, W - 40, 10): d.text((20, yy), l, fill=(255, 255, 255), font=F_B); yy += 27
    return box

# one colour per theme for its band (stable, so the same theme always looks the same)
THEME_COL = {}
def _col(slug):
    h = sum(ord(c) * (i + 1) for i, c in enumerate(slug)) % 360
    import colorsys; r, g, b = colorsys.hls_to_rgb(h / 360, 0.38, 0.55); return (int(r * 255), int(g * 255), int(b * 255))
for c in P['chapters']: THEME_COL.setdefault(c.get('style', ''), _col(c.get('style', '')))

# the shots in order, with a rough time from the words (about 2.6 words a second)
shots, t = [], 0.0
for ci, ch in enumerate(P['chapters']):
    for li, ln in enumerate(ch['lines']):
        dur = max(1.6, len(str(ln.get('say', '')).split()) / 2.6) + 0.3
        n = max(1, len(ln.get('shots') or [1]))
        for si, s in enumerate(ln.get('shots') or [{}]):
            shots.append({'s': s, 'style': ch.get('style', ''), 'say': ln.get('say', '') if si == 0 else '', 't': t + dur * si / n, 'ch': ci, 'first': li == 0 and si == 0})
        t += dur

COLS, CW, PW, PH, GAP = 4, 420, 396, 704, 24
def card_height(d, sh):
    h = 12 + 34 + PH + 14
    if sh['say']: h += 24 * len(wrap(d, '"' + sh['say'] + '"', F_B, CW - 28, 5)) + 6
    else: h += 26
    if sh['s'].get('img') and sh['s'].get('text'): h += 28
    if sh['s'].get('img'): h += 21 * len(wrap(d, sh['s'].get('action', ''), F_S, CW - 28, 5))
    return h + 16

tmp = ImageDraw.Draw(Image.new('RGB', (10, 10)))
groups = []   # one block per chapter (part): a header, then its shots in rows of 4
for ci, ch in enumerate(P['chapters']):
    sh = [x for x in shots if x['ch'] == ci]
    rows = [sh[i:i + COLS] for i in range(0, len(sh), COLS)]
    groups.append((ci, ch, sh, rows, [max(card_height(tmp, s) for s in r) for r in rows]))
HEAD, CHH = 230, 54
W = COLS * CW + (COLS + 1) * GAP
H = HEAD + sum(CHH + sum(rh) + GAP * len(rh) for *_, rh in groups) + GAP + 70
img = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(img)

# header band
d.rectangle([0, 0, W, HEAD - 30], fill=(18, 92, 86))
d.text((GAP, 26), 'STORYBOARD', fill=(170, 230, 220), font=F_L)
for i, l in enumerate(wrap(d, P.get('title') or '', F_T, W - 2 * GAP, 2)): d.text((GAP, 50 + i * 52), l, fill=(255, 255, 255), font=F_T)
d.text((GAP, HEAD - 70), f"{P.get('channel', '')}   ·   {len(shots)} shots   ·   about {int(round(t))} seconds   ·   {len(P['chapters'])} parts", fill=(205, 235, 230), font=F_B)
d.text((GAP, HEAD - 22), 'Real app screens are shown as they are (red ZOOM = the part the video zooms into). Coloured cards = scenes animated for this video.', fill=MUTED, font=F_S)

y = HEAD + 12; num = 0
for ci, ch, sh, rows, rh in groups:
    col = THEME_COL.get(ch.get('style', ''), (90, 100, 115))
    d.rounded_rectangle([GAP, y, GAP + 16, y + 16 + 8], 4, fill=col)
    t0 = sh[0]['t'] if sh else 0
    d.text((GAP + 26, y), f"PART {ci + 1}   ·   {ch.get('style', '')}   ·   {int(t0 // 60)}:{int(t0 % 60):02d}", fill=INK, font=F_H)
    why = (ch.get('why') or '')[:140]
    if why: d.text((GAP + 26 + d.textlength(f"PART {ci + 1}   ·   {ch.get('style', '')}   ·   {int(t0 // 60)}:{int(t0 % 60):02d}", font=F_H) + 20, y + 4), why, fill=MUTED, font=F_S)
    y += CHH
    for r, h in zip(rows, rh):
        x = GAP
        for s in r:
            num += 1
            d.rounded_rectangle([x, y, x + CW, y + h], 14, fill=CARD, outline=LINE, width=2)
            d.rounded_rectangle([x + 12, y + 12, x + 62, y + 40], 8, fill=ACCENT); d.text((x + 22, y + 15), f'{num:02d}', fill=(255, 255, 255), font=F_H)
            d.text((x + 74, y + 17), f"{int(s['t'] // 60)}:{int(s['t'] % 60):02d}", fill=MUTED, font=F_L)
            if s['s'].get('img'):
                lab = 'ZOOM' if s['s'].get('zoom') else (media.get(s['s']['img'], {}).get('label') or 'REAL SCREEN'); lw = d.textlength(lab, font=F_L)
                d.rounded_rectangle([x + CW - 24 - lw, y + 13, x + CW - 12, y + 39], 6, fill=(229, 50, 45) if s['s'].get('zoom') else ACCENT)
                d.text((x + CW - 18 - lw, y + 17), lab, fill=(255, 255, 255), font=F_L)
            img.paste(picture(s['s'], s['style'], PW, PH), (x + 12, y + 50))
            yy = y + 50 + PH + 12
            if s['say']:
                for l in wrap(d, '"' + s['say'] + '"', F_B, CW - 28, 5): d.text((x + 14, yy), l, fill=INK, font=F_B); yy += 24
                yy += 6
            else:
                d.text((x + 14, yy), '... same line', fill=MUTED, font=F_S); yy += 26
            if s['s'].get('img') and s['s'].get('text'):
                d.text((x + 14, yy), s['s']['text'].upper(), fill=INK, font=F_H); yy += 28
            if s['s'].get('img'):
                for l in wrap(d, s['s'].get('action', ''), F_S, CW - 28, 5): d.text((x + 14, yy), l, fill=MUTED, font=F_S); yy += 21
            x += CW + GAP
        y += h + GAP
d.text((GAP, H - 48), 'Check every shot. Write your changes in AutoTube Studio (under any shot or for the whole video), or approve to make the full video.', fill=MUTED, font=F_S)
img.save(os.path.join(job, 'storyboard.jpg'), quality=88)
print(os.path.join(job, 'storyboard.jpg'))
