# Original pixel art for the world map of Saga of Jiangdong: mountains, hills, trees, towns, castles, gates,
# caves, ports, temples, camps and the war junk. Drawn by code, 16px grid, palette close to Ninja Adventure.
#   python -P world_art.py OUT.png OUT.json
import sys, json, math, random
from PIL import Image

OUTL = (40, 28, 36, 255)
def C(h, a=255):
    h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)

class Spr:
    def __init__(s, w, h): s.w, s.h = w, h; s.px = [[None] * w for _ in range(h)]
    def put(s, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < s.w and 0 <= y < s.h: s.px[y][x] = c
    def get(s, x, y):
        return s.px[y][x] if 0 <= x < s.w and 0 <= y < s.h else None
    def rect(s, x, y, w, h, c):
        for j in range(h):
            for i in range(w): s.put(x + i, y + j, c)
    def outline(s, col=OUTL, diag=False):
        add = []
        for y in range(s.h):
            for x in range(s.w):
                if s.px[y][x] is not None: continue
                nb = [(1, 0), (-1, 0), (0, 1), (0, -1)] + ([(1, 1), (-1, -1), (1, -1), (-1, 1)] if diag else [])
                if any(s.get(x + dx, y + dy) not in (None, col) for dx, dy in nb): add.append((x, y))
        for x, y in add: s.put(x, y, col)
    def img(s):
        im = Image.new('RGBA', (s.w, s.h))
        for y in range(s.h):
            for x in range(s.w):
                if s.px[y][x]: im.putpixel((x, y), s.px[y][x])
        return im

def shade(ramp, t):
    t = max(0, min(len(ramp) - 1, t)); return ramp[int(t)]

def mountain(w=16, h=16, seed=0, snow=False, green=False, peak_h=None):
    rnd = random.Random(seed)
    s = Spr(w, h)
    rock = [C('#4a3a42'), C('#6e5652'), C('#9a7a64'), C('#c09a74'), C('#e0c090')]
    if green: rock = [C('#2a4a3a'), C('#3e6a44'), C('#5a8a4a'), C('#86ae58'), C('#b8d070')]
    snowr = [C('#9ab0c8'), C('#c8d8e8'), C('#f4f8ff')]
    cx = w / 2 + rnd.uniform(-1.2, 1.2); top = (peak_h if peak_h is not None else 1 + rnd.randint(0, 2)); base = h - 1
    for y in range(top, base + 1):
        t = (y - top) / max(1, base - top)
        half = 1 + t * (w / 2 - 0.5)
        for x in range(w):
            dx = x + 0.5 - cx
            if abs(dx) <= half + (rnd.random() * 0.8 if t > 0.2 else 0):
                # light from the upper left: left face lit, right face shadowed; a ridge line down the middle
                side = dx / max(0.5, half)
                lv = 3.2 - (side + 1) * 1.45 - t * 0.4 + rnd.uniform(-0.35, 0.35)
                if abs(dx) < 0.8 and t < 0.75: lv = 3.4
                col = shade(rock, round(lv))
                if snow and t < 0.38 + rnd.uniform(-0.06, 0.06): col = shade(snowr, 2 if side < 0.1 else 1)
                s.put(x, y, col)
    # a few cracks
    for _ in range(2):
        x = int(cx + rnd.uniform(-3, 3)); y = int(top + (base - top) * rnd.uniform(0.45, 0.8))
        for k in range(3):
            if s.get(x, y): s.put(x, y, rock[0])
            x += rnd.choice([-1, 0, 1]); y += 1
    s.outline()
    return s

def hill(seed=0, dry=False):
    rnd = random.Random(seed); s = Spr(16, 16)
    g = [C('#2e5a34'), C('#467a3c'), C('#62984a'), C('#86b858'), C('#b0d870')]
    if dry: g = [C('#6a5232'), C('#8a6c3e'), C('#ab8a4c'), C('#cbaa62'), C('#e6cc86')]
    cx = 8 + rnd.uniform(-1, 1); r = 6.5 + rnd.uniform(-0.5, 0.8); cy = 14
    for y in range(16):
        for x in range(16):
            dx, dy = (x + 0.5 - cx) / r, (y + 0.5 - cy) / (r * 0.85)
            d = dx * dx + dy * dy
            if d <= 1 and y < 15:
                lv = 3.6 - (dx + 0.6) * 1.6 - (dy + 1) * 0.6 + rnd.uniform(-0.3, 0.3)
                s.put(x, y, shade(g, round(lv)))
    s.outline((30, 50, 34, 255) if not dry else (70, 50, 30, 255))
    return s

def tree(seed=0, kind='broad'):
    rnd = random.Random(seed); s = Spr(16, 16)
    if kind == 'pine':
        g = [C('#1c3a30'), C('#2a5a40'), C('#3c7a4a'), C('#5a9a58')]
        cx = 8 + rnd.choice([-0.5, 0, 0.5])
        for tier, (y0, y1, wmax) in enumerate([(1, 6, 3.5), (4, 10, 5.2), (8, 13, 6.8)]):
            for y in range(y0, y1 + 1):
                t = (y - y0) / max(1, y1 - y0); half = 0.8 + t * wmax
                for x in range(16):
                    dx = x + 0.5 - cx
                    if abs(dx) <= half: s.put(x, y, shade(g, round(2.6 - (dx / half + 1) * 1.1 - t * 0.6)))
        s.rect(7, 13, 2, 2, C('#6a4428')); s.put(7, 13, C('#8a5a30'))
    elif kind == 'palm':
        for y in range(6, 15): s.put(7 + (1 if y < 9 else 0), y, C('#8a6034')); s.put(8 + (1 if y < 9 else 0), y, C('#6a4428'))
        lf = [C('#2a6a3a'), C('#4a9a4a'), C('#7ac05a')]
        for ang in range(0, 360, 50):
            a = math.radians(ang + rnd.uniform(-10, 10))
            for k in range(1, 7):
                x = 8.5 + math.cos(a) * k; y = 5 + math.sin(a) * k * 0.6 + (k * k) * 0.06
                s.put(x, y, lf[1 if k < 4 else 0]); s.put(x, y - 1, lf[2] if k < 3 else lf[1])
    else:
        g = [C('#1e4a2c'), C('#2e6a36'), C('#4a8c40'), C('#6cae4c'), C('#9ccc62')]
        if kind == 'autumn': g = [C('#5a2a18'), C('#8a3e1e'), C('#c0622a'), C('#e08a3a'), C('#f4b85a')]
        if kind == 'blossom': g = [C('#7a3a5a'), C('#b05a7a'), C('#e08aa8'), C('#f4b8c8'), C('#fce0e8')]
        s.rect(7, 11, 2, 4, C('#6a4428')); s.put(7, 11, C('#8a5a30')); s.put(7, 12, C('#8a5a30'))
        blobs = [(8, 7, 5.6)] + [(8 + rnd.uniform(-3, 3), 6 + rnd.uniform(-2, 2), rnd.uniform(2.5, 3.5)) for _ in range(3)]
        for y in range(16):
            for x in range(16):
                for bx, by, br in blobs:
                    dx, dy = x + 0.5 - bx, y + 0.5 - by
                    if dx * dx + dy * dy <= br * br and y < 12:
                        lv = 3.8 - (dx + dy + br) / br * 1.3 + rnd.uniform(-0.4, 0.4)
                        s.put(x, y, shade(g, round(lv))); break
    s.outline()
    return s

ROOF = [C('#5a1a14'), C('#8a2a1c'), C('#b8402a'), C('#d86a40')]
ROOF_B = [C('#1a2a40'), C('#2a4060'), C('#3a5a80'), C('#5a7aa0')]
ROOF_S = [C('#5a4420'), C('#8a6a30'), C('#b89448'), C('#dcc070')]  # straw
WALL = [C('#5a5048'), C('#7e7468'), C('#a89c8a'), C('#d0c6b0')]
PLAST = [C('#a89880'), C('#d8ccb0'), C('#f0e8d0')]
WOOD = [C('#4a2c18'), C('#6e4426'), C('#94603a')]

def roof(s, x0, x1, y, rows, ramp, flare=True):
    """a Chinese roof: ridge on top, eaves curling up at both ends"""
    for j in range(rows):
        xa, xb = x0 - j, x1 + j
        for x in range(xa, xb + 1):
            lv = 3 if j == 0 else (2 if (x + j) % 2 else 1)
            if j == rows - 1: lv = 0 if (x % 2) else 1
            s.put(x, y + j, ramp[lv])
    if flare:
        s.put(x0 - rows, y + rows - 2, ramp[2]); s.put(x1 + rows, y + rows - 2, ramp[2])
    for x in range(x0, x1 + 1): s.put(x, y - 1, ramp[0])
    s.put(x0 - 1, y - 1, ramp[2]); s.put(x1 + 1, y - 1, ramp[2])

def house(s, x, y, w, ramp=ROOF, straw=False):
    """a small house whose roof starts at row y; walls under it"""
    roof(s, x, x + w - 1, y, 2, ROOF_S if straw else ramp)
    s.rect(x - 1, y + 2, w + 2, 3, PLAST[1]); s.rect(x - 1, y + 4, w + 2, 1, PLAST[0])
    s.put(x + w // 2, y + 3, WOOD[0]); s.put(x + w // 2, y + 4, WOOD[0])

def village():
    s = Spr(16, 16)
    house(s, 3, 3, 4, straw=True); house(s, 10, 6, 3, straw=True); house(s, 4, 10, 3, straw=True)
    s.outline()
    return s

def city_wall(s, x0, y0, x1, y1):
    for x in range(x0, x1 + 1):
        for y in (y0, y1):
            s.put(x, y, WALL[2]); s.put(x, y + 1, WALL[1])
            if x % 2 == 0: s.put(x, y - 1, WALL[3])
    for y in range(y0, y1 + 2):
        for x in (x0, x1):
            s.put(x, y, WALL[2] if x == x0 else WALL[1]); s.put(x + (1 if x == x0 else -1), y, WALL[1])

def town():
    s = Spr(16, 16)
    city_wall(s, 1, 6, 14, 13)
    for y in range(8, 13):
        for x in range(3, 13): s.put(x, y, C('#c8b890') if (x + y) % 5 else C('#b0a078'))
    house(s, 5, 3, 6); house(s, 4, 9, 2, ROOF_B); house(s, 11, 9, 1, ROOF_B)
    s.rect(7, 13, 2, 2, C('#2a1a14'))  # gate
    s.outline()
    return s

def castle(capital=False):
    w = 32; s = Spr(w, 32 if not capital else 32)
    # outer wall with corner towers
    x0, y0, x1, y1 = 2, 12, 29, 27
    for y in range(y0 + 1, y1):
        for x in range(x0 + 1, x1): s.put(x, y, C('#c8b890') if (x * 3 + y) % 7 else C('#b4a47e'))
    for x in range(x0, x1 + 1):
        s.put(x, y0, WALL[3] if x % 2 == 0 else WALL[2]); s.put(x, y0 + 1, WALL[2]); s.put(x, y0 + 2, WALL[1])
        s.put(x, y1, WALL[2] if x % 2 else WALL[3]); s.put(x, y1 + 1, WALL[1]); s.put(x, y1 + 2, WALL[0])
    for y in range(y0, y1 + 3):
        s.put(x0, y, WALL[2]); s.put(x0 + 1, y, WALL[1]); s.put(x1, y, WALL[1]); s.put(x1 - 1, y, WALL[2])
    for tx, ty in [(x0, y0), (x1 - 2, y0), (x0, y1 - 1), (x1 - 2, y1 - 1)]:
        s.rect(tx - 1, ty - 2, 4, 4, WALL[2]); s.rect(tx - 1, ty - 2, 4, 1, WALL[3]); roof(s, tx, tx + 1, ty - 4, 2, ROOF)
    # the gate tower in the south wall
    s.rect(14, y1 - 2, 4, 5, WALL[2]); s.rect(15, y1 + 1, 2, 2, C('#2a1a14'))
    roof(s, 13, 18, y1 - 4, 2, ROOF)
    # the hall: a two-tier roof
    hall = ROOF if not capital else [C('#6a4a10'), C('#a07818'), C('#d0a830'), C('#f0d060')]
    s.rect(10, 13, 12, 6, PLAST[1]); s.rect(10, 18, 12, 1, PLAST[0])
    for x in range(11, 21, 2): s.rect(x, 15, 1, 3, C('#8a2a1c'))
    roof(s, 12, 19, 10, 3, hall); roof(s, 14, 17, 5, 3, hall)
    s.rect(13, 8, 6, 2, PLAST[1])
    # side houses
    house(s, 5, 19, 3, ROOF_B); house(s, 23, 19, 3, ROOF_B)
    if capital:
        for x in (6, 25): s.rect(x, 2, 1, 8, WOOD[1]); s.rect(x + 1, 2, 3, 2, C('#d83a2a'))
    s.outline()
    return s

def cave():
    s = mountain(16, 16, seed=91, peak_h=2)
    for y in range(9, 16):
        for x in range(5, 11):
            dx = (x + 0.5 - 8) / 3.2; dy = (y + 0.5 - 15) / 6
            if dx * dx + dy * dy <= 1: s.put(x, y, C('#140c10'))
    s.put(5, 15, C('#6e5652')); s.put(10, 15, C('#6e5652'))
    return s

def gate():
    s = Spr(16, 16)
    s.rect(1, 8, 14, 7, WALL[2]); s.rect(1, 8, 14, 1, WALL[3]); s.rect(1, 14, 14, 1, WALL[0])
    for x in range(1, 15, 2): s.put(x, 7, WALL[3])
    s.rect(6, 10, 4, 5, C('#2a1a14')); s.put(6, 10, WALL[1]); s.put(9, 10, WALL[1])
    s.rect(4, 4, 8, 4, PLAST[1]); s.rect(5, 5, 1, 3, C('#8a2a1c')); s.rect(10, 5, 1, 3, C('#8a2a1c'))
    roof(s, 4, 11, 2, 2, ROOF)
    s.outline()
    return s

def temple():
    s = Spr(16, 24)
    for k, (y, w) in enumerate([(3, 2), (8, 4), (13, 6)]):
        x0 = 8 - w // 2
        s.rect(x0, y + 2, w, 3, PLAST[1] if k % 2 == 0 else PLAST[2]); s.put(8, y + 3, C('#8a2a1c'))
        roof(s, x0, x0 + w - 1, y, 2, ROOF)
    s.rect(4, 18, 8, 5, PLAST[1]); s.rect(7, 20, 2, 3, WOOD[0]); roof(s, 4, 11, 16, 2, ROOF)
    s.rect(7, 0, 2, 2, C('#e0c060'))
    s.outline()
    return s

def port():
    s = Spr(16, 16)
    s.rect(1, 9, 9, 2, WOOD[2]); s.rect(1, 11, 9, 1, WOOD[0])
    for x in (2, 5, 8): s.rect(x, 12, 1, 3, WOOD[0])
    house(s, 3, 3, 3, ROOF_S, straw=True)
    # a moored boat
    s.rect(10, 10, 5, 2, WOOD[1]); s.rect(11, 12, 3, 1, WOOD[0]); s.rect(12, 4, 1, 6, WOOD[0]); s.rect(13, 5, 2, 4, C('#e8dcc0'))
    s.outline()
    return s

def camp(col='#c83a2a'):
    s = Spr(16, 16)
    for (x, y) in [(2, 6), (9, 4), (6, 10)]:
        for j in range(5):
            for i in range(-j, j + 1): s.put(x + 3 + i, y + j, C('#e8dcc0') if i <= 0 else C('#b8a888'))
        s.put(x + 3, y + 4, C('#5a4a3a'))
    s.rect(13, 1, 1, 8, WOOD[0]); s.rect(14, 1, 2, 3, C(col))
    s.outline()
    return s

def ruins():
    s = Spr(16, 16)
    for x, y, h in [(2, 7, 7), (6, 9, 5), (11, 6, 8), (13, 11, 3)]:
        s.rect(x, y, 2, h, WALL[2]); s.put(x, y, WALL[3]); s.put(x + 1, y + h - 1, WALL[1])
    s.rect(1, 14, 14, 1, WALL[1])
    s.outline()
    return s

def junk(face='l'):
    """the war junk: a hull with a stern castle and two battened sails, seen from the side"""
    s = Spr(32, 32)
    hull = [C('#3a2414'), C('#5a3820'), C('#7e5230'), C('#a06c3e')]
    for y in range(20, 27):
        t = (y - 20) / 6
        xa = int(3 + t * 4); xb = int(29 - t * 3)
        for x in range(xa, xb + 1): s.put(x, y, hull[2] if y < 22 else hull[1] if y < 25 else hull[0])
    s.rect(3, 19, 27, 1, hull[3])
    s.rect(22, 15, 7, 5, hull[2]); s.rect(22, 15, 7, 1, hull[3]); s.rect(24, 17, 3, 2, C('#f0d870'))
    for mx, top, w in [(10, 3, 9), (19, 6, 7)]:
        s.rect(mx, top, 1, 17, WOOD[0])
        for y in range(top + 1, 18):
            for x in range(mx - w // 2, mx + w // 2 + 1):
                s.put(x, y, C('#c84a2a') if (y - top) % 3 else C('#8a2a1c'))
    s.rect(5, 26, 22, 1, C('#e8f4ff', 200))
    s.outline()
    if face == 'r':
        s2 = Spr(32, 32)
        for y in range(32):
            for x in range(32): s2.px[y][31 - x] = s.px[y][x]
        return s2
    return s

def flag(col):
    s = Spr(16, 16)
    s.rect(4, 2, 1, 13, WOOD[0]); s.rect(5, 2, 7, 5, C(col)); s.rect(5, 6, 7, 1, (0, 0, 0, 90))
    s.outline()
    return s

def build(out_png, out_json):
    sprites = {}
    for i in range(4): sprites[f'mtn{i}'] = mountain(seed=10 + i)
    for i in range(3): sprites[f'snowmtn{i}'] = mountain(seed=30 + i, snow=True)
    for i in range(2): sprites[f'greenmtn{i}'] = mountain(seed=50 + i, green=True)
    sprites['bigmtn'] = mountain(32, 24, seed=7, snow=True, peak_h=0)
    sprites['bigmtn2'] = mountain(32, 24, seed=8, snow=False, peak_h=1)
    for i in range(3): sprites[f'hill{i}'] = hill(seed=70 + i)
    for i in range(2): sprites[f'dryhill{i}'] = hill(seed=80 + i, dry=True)
    for i in range(3): sprites[f'tree{i}'] = tree(seed=100 + i)
    for i in range(3): sprites[f'pine{i}'] = tree(seed=120 + i, kind='pine')
    for i in range(2): sprites[f'palm{i}'] = tree(seed=140 + i, kind='palm')
    sprites['autumn'] = tree(seed=150, kind='autumn')
    sprites['blossom'] = tree(seed=151, kind='blossom')
    sprites['village'] = village(); sprites['town'] = town()
    sprites['castle'] = castle(); sprites['capital'] = castle(True)
    sprites['cave'] = cave(); sprites['gate'] = gate(); sprites['temple'] = temple(); sprites['port'] = port()
    sprites['camp'] = camp(); sprites['sectcamp'] = camp('#3a2a4a'); sprites['ruins'] = ruins()
    sprites['junk_l'] = junk('l'); sprites['junk_r'] = junk('r')
    sprites['flag_red'] = flag('#d83a2a'); sprites['flag_black'] = flag('#2a2030')
    # pack in rows
    W = 256; x = y = rowh = 0; meta = {}; placed = []
    for k, s in sprites.items():
        if x + s.w > W: x = 0; y += rowh; rowh = 0
        placed.append((k, s, x, y)); meta[k] = [x, y, s.w, s.h]; x += s.w; rowh = max(rowh, s.h)
    im = Image.new('RGBA', (W, y + rowh))
    for k, s, px, py in placed: im.alpha_composite(s.img(), (px, py))
    im.save(out_png)
    json.dump(meta, open(out_json, 'w'))
    big = im.resize((im.width * 4, im.height * 4), Image.NEAREST); bg = Image.new('RGBA', big.size, (120, 170, 90, 255)); bg.alpha_composite(big); bg.save(out_png.replace('.png', '_x4.png'))

if __name__ == '__main__':
    build(sys.argv[1], sys.argv[2])
