# Makes the feather fan (羽扇) layer for strategists from the LPC simple staff layer: in every frame the staff is
# found, cut down to a short handle at the grip, and a white feather fan is drawn opening out from the grip along
# the staff's direction. Writes w_fan_<body>.png and w_cranefan_<body>.png next to doll.json and adds the layers.
#   python -P fan.py C:/JiangdongSaga/assets/doll
import sys, os, json, math
from PIL import Image
D = sys.argv[1]
meta = json.load(open(os.path.join(D, 'doll.json')))
ANIM = meta['anims']

def fan_frame(cell, crane=False):
    w, h = cell.size
    px = [(x, y) for y in range(h) for x in range(w) if cell.getpixel((x, y))[3] > 0]
    out = Image.new('RGBA', (w, h))
    if len(px) < 6: return out
    mx = sum(p[0] for p in px) / len(px); my = sum(p[1] for p in px) / len(px)
    sxx = sum((p[0] - mx) ** 2 for p in px); syy = sum((p[1] - my) ** 2 for p in px); sxy = sum((p[0] - mx) * (p[1] - my) for p in px)
    ang = 0.5 * math.atan2(2 * sxy, sxx - syy)
    ux, uy = math.cos(ang), math.sin(ang)
    proj = [(p[0] - mx) * ux + (p[1] - my) * uy for p in px]
    lo, hi = min(proj), max(proj)
    a = (mx + ux * lo, my + uy * lo); b = (mx + ux * hi, my + uy * hi)
    top, bot = (a, b) if a[1] < b[1] else (b, a)
    if abs(a[1] - b[1]) < 3: top, bot = (a, b) if a[0] < b[0] else (b, a)
    L = math.hypot(top[0] - bot[0], top[1] - bot[1])
    if L < 6: return out
    dx, dy = (top[0] - bot[0]) / L, (top[1] - bot[1]) / L
    gx, gy = top[0] - dx * L * 0.55, top[1] - dy * L * 0.55  # the grip
    put = lambda x, y, c: (0 <= int(x) < w and 0 <= int(y) < h) and out.putpixel((int(round(x)), int(round(y))), c)
    # handle: a short stick below the grip
    for k in range(0, 6):
        put(gx - dx * k, gy - dy * k, (110, 70, 40, 255))
    # the fan: a wedge of feathers opening from just above the grip
    R = 11
    base = math.atan2(dy, dx)
    feather = (246, 246, 240, 255); shade = (206, 208, 214, 255); tip = (40, 40, 48, 255) if crane else (232, 214, 170, 255); rib = (150, 120, 90, 255)
    pix = {}
    for r10 in range(10, R * 10 + 1):
        r = r10 / 10
        for t10 in range(-48, 49, 2):
            t = math.radians(t10)
            x = gx + dx * 2 + math.cos(base + t) * r; y = gy + dy * 2 + math.sin(base + t) * r
            k = (int(round(x)), int(round(y)))
            col = tip if r > R - 2.2 else (shade if (t10 // 8) % 2 else feather)
            if r < 3: col = rib
            pix[k] = col
    for (x, y), c in pix.items(): put(x, y, c)
    # outline round the fan
    keys = set(pix)
    for (x, y) in list(keys):
        for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + ox, y + oy)
            if q not in keys and 0 <= q[0] < w and 0 <= q[1] < h and out.getpixel(q)[3] == 0: out.putpixel(q, (52, 40, 44, 255))
    return out

def make(src_ent, name, crane):
    im = Image.open(os.path.join(D, src_ent['file'])).convert('RGBA')
    out = Image.new('RGBA', im.size)
    for part in src_ent['parts']:
        for anim, (y0, n) in part['a'].items():
            cellsz = ANIM[anim][2]; rows = ANIM[anim][1]
            for r in range(rows):
                for k in range(n):
                    box = (k * cellsz, y0 + r * cellsz, k * cellsz + cellsz, y0 + r * cellsz + cellsz)
                    out.alpha_composite(fan_frame(im.crop(box), crane), (box[0], box[1]))
    out.save(os.path.join(D, name), optimize=True)
    return {'file': name, 'parts': src_ent['parts'], 'mats': {}}

for lid, crane in (('w_fan', False), ('w_cranefan', True)):
    meta['layers'][lid] = {}
    done = {}
    for body, ent in meta['layers']['w_staff'].items():
        if ent['file'] in done: meta['layers'][lid][body] = done[ent['file']]; continue
        e = make(ent, f'{lid}_{body}.png', crane)
        done[ent['file']] = e; meta['layers'][lid][body] = e
json.dump(meta, open(os.path.join(D, 'doll.json'), 'w'), separators=(',', ':'))
print('ok', list(meta['layers']['w_fan']))
