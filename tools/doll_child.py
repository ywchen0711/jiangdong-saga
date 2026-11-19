# Child paper-doll layers (Josh, 10, and Jasper, 8). Universal LPC's child body comes with its own head, hair,
# eyebrows, shirt and trousers, but only the walk is drawn for all of them, so only the walk is packed here
# (as "child" entries beside the male/female ones in doll.json). The game makes a child's other poses from the
# walk (doll.js), and lends them the grown-up walking sheets of weapons, shields and quivers, moved to a
# child's hands.
#   ULPC_REPO=path/to/Universal-LPC-repo python -P doll_child.py ../assets/doll
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import doll_build as D

# id: (definition, variant, recolourable materials). Ids that already exist get a 'child' entry added.
CHILD = {
    'body': ('body/body.json', None, ['body']),
    'head_c': ('head/heads/human/heads_human_child.json', None, ['body', 'eye']),
    'brow_thick': ('head/eyebrows/eyebrows_thick.json', None, ['hair']),
    'brow_thin': ('head/eyebrows/eyebrows_thin.json', None, ['hair']),
    'h_topknot': ('hair/braids/hair_topknot_long.json', None, ['hair']),
    'h_topknot_s': ('hair/braids/hair_topknot_short.json', None, ['hair']),
    'h_topknot_s2': ('hair/braids/hair_topknot_short2.json', None, ['hair']),
    'h_cbangs': ('hair/short/hair_parted_side_bangs.json', None, ['hair']),
    'h_cbangs2': ('hair/short/hair_parted_side_bangs2.json', None, ['hair']),
    'h_cswoop': ('hair/short/hair_swoop_side.json', None, ['hair']),
    'h_crelm': ('hair/bob/hair_relm_short.json', None, ['hair']),
    'hb_thick': ('headwear/coverings/headbands/hat_headband_thick.json', None, ['cloth']),
    'hb_hairtie': ('headwear/coverings/headbands/hat_headband_hairtie.json', None, ['cloth']),
    'h_ctwin': ('hair/braids/hair_topknot_short.json', None, ['hair']),  # made into two buns below
    't_cshirt': ('torso/shirts/torso_clothes_child_shirt.json', 'white', ['cloth']),
    'l_cpants': ('legs/pants/legs_childpants.json', 'white', ['cloth']),
}

# the child shirt and trousers come in fixed colours; their white versions are moved onto the white cloth ramp
# (shade by shade, darkest first) so the game can dye them like any other cloth
RAMP = {
    't_cshirt': ['#b0b1b3', '#c6c7c9', '#d5d7da', '#e4e4e5', '#ececed', '#fafafa'], # -> ramp 1,2,3,4,5,5
    'l_cpants': ['#474747', '#b5b5b5', '#d0d0d0', '#e3e3e3', '#f0f0f0'],            # -> ramp 1..5
}
def to_ramp(lid, by_z):
    if lid not in RAMP: return False
    ramp = D.PAL['cloth']['ulpc:white']
    src = RAMP[lid]
    idx = [1, 2, 3, 4, 5, 5] if len(src) == 6 else [1, 2, 3, 4, 5]
    m = {tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)): tuple(int(ramp[k][i:i + 2], 16) for i in (1, 3, 5)) for c, k in zip(src, idx)}
    for ims in by_z.values():
        for im in ims.values():
            px = im.load()
            for y in range(im.height):
                for x in range(im.width):
                    r, g, b, a = px[x, y]
                    if a and (r, g, b) in m: px[x, y] = m[(r, g, b)] + (a,)
    return True

# Jasper's two buns: the short topknot's bun, drawn twice, apart (rows: up, left, down, right)
TWIN = [[(-5, 2), (5, 2)], [(-2, 1), (2, 1)], [(-5, 2), (5, 2)], [(2, 1), (-2, 1)]]
def twin(by_z):
    from PIL import Image
    z = max(by_z); im = by_z[z]['walk']; out = Image.new('RGBA', im.size)
    for r in range(4):
        row = im.crop((0, r * 64, im.width, r * 64 + 64))
        for dx, dy in TWIN[r]:
            for k in range(im.width // 64):
                fr = row.crop((k * 64, 0, k * 64 + 64, 64)); layer = Image.new('RGBA', im.size); layer.paste(fr, (k * 64 + dx, r * 64 + dy), fr); out.alpha_composite(layer)
    by_z[z]['walk'] = out

def build(outdir):
    D.ANIMS = {'walk': D.ANIMS['walk']}  # the walk is all a child has
    meta = json.load(open(os.path.join(outdir, 'doll.json')))
    for lid, (defp, var, mats) in CHILD.items():
        by_z = D.layer(defp, var, 'child')
        if lid == 'h_ctwin': twin(by_z)
        dyed = to_ramp(lid, by_z)
        pk = D.save_pack(outdir, lid + '_child', by_z)
        if not pk: print('EMPTY', lid); continue
        found = {'cloth': 'ulpc:white'} if dyed else D.detect(pk['ims'], mats)
        open(os.path.join(outdir, pk['file']), 'wb').write(pk['data'])
        meta['layers'].setdefault(lid, {})['child'] = {'file': pk['file'], 'parts': pk['parts'], 'mats': found}
        print(lid, [p['z'] for p in pk['parts']], found, len(pk['data']))
    json.dump(meta, open(os.path.join(outdir, 'doll.json'), 'w'), separators=(',', ':'))
    for f, cr in D.CREDITS.items(): print(('CREDIT ' + f + ' | ' + ', '.join(cr.get('authors', [])) + ' | ' + ', '.join(cr.get('licenses', []))).encode('ascii', 'replace').decode())

if __name__ == '__main__':
    build(sys.argv[1])
