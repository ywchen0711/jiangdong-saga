# Paper doll layers for Saga of Jiangdong.
# Every Universal LPC layer we use becomes one "pack" png per body type it differs for, holding only the
# animations the game needs (walk 4 dirs; slash, thrust, shoot, spellcast, idle facing left; hurt), and
# doll.json describes them: depth (zPos), which recolourable materials the layer has and which palette ramp
# its pixels are in now, so the game can recolour hair, skin, cloth and metal at run time.
#   python -P doll_build.py OUTDIR
import json, os, sys, subprocess, io, hashlib
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.join(HERE, '..', '..', 'dl_ulpc', 'repo')
FILES = set(subprocess.run(['git', 'ls-tree', '-r', '--name-only', 'HEAD', 'spritesheets'], cwd=REPO, capture_output=True, text=True).stdout.split('\n'))
def jl(p): return json.load(open(os.path.join(REPO, p), encoding='utf-8'))
PAL = {}
for mat in ['body', 'hair', 'cloth', 'metal', 'wood', 'eye']:
    d = os.path.join(REPO, 'palette_definitions', mat)
    for f in sorted(os.listdir(d)):
        if f.startswith('meta_'): continue
        tag = 'ulpc' if 'ulpc' in f else 'lpcr'
        for k, v in jl(f'palette_definitions/{mat}/{f}').items():
            if isinstance(v, list): PAL.setdefault(mat, {})[tag + ':' + k] = [c.lower() for c in v]

_blobs = {}
def blob(path):
    if path not in _blobs:
        data = subprocess.run(['git', 'cat-file', 'blob', 'HEAD:' + path], cwd=REPO, capture_output=True).stdout
        _blobs[path] = Image.open(io.BytesIO(data)).convert('RGBA')
    return _blobs[path].copy()

# what we keep of each animation: (source folder name, frames, rows wanted (0=N 1=W 2=S 3=E), cell size in the pack)
ANIMS = {
    'walk': ('walk', 9, [0, 1, 2, 3], 64),
    'slash': ('slash', 6, [1], 128),
    'thrust': ('thrust', 8, [1], 128),
    'shoot': ('shoot', 13, [1], 64),
    'cast': ('spellcast', 7, [1], 64),
    'hurt': ('hurt', 6, [0], 64),
    'idle': ('combat_idle', 2, [1], 64),
}
CUSTOM = {'slash_128': 'slash', 'slash_oversize': 'slash', 'thrust_oversize': 'thrust', 'walk_128': 'walk', 'shoot_oversize': 'shoot'}
def first_png(d):
    c = sorted(f for f in FILES if f.startswith(d) and f.endswith('.png') and '/' not in f[len(d):])
    return c[0] if c else None
def resolve(defp, variant, body, anim):
    d = jl('sheet_definitions/' + defp); plain, custom = [], []
    src = ANIMS[anim][0]
    for k, L in d.items():
        if not k.startswith('layer_') or body not in L: continue
        base = 'spritesheets/' + L[body]
        ca = L.get('custom_animation')
        if ca:
            if CUSTOM.get(ca) != anim: continue
            tries = [base + (variant or '') + '.png', base.rstrip('/') + '.png']
            f = next((t for t in tries if t in FILES), None) or first_png(base)
            if f: custom.append((L['zPos'], f, True))
        else:
            tries = [base + src + '/' + (variant or '') + '.png', base + src + '.png']
            f = next((t for t in tries if t in FILES), None) or first_png(base + src + '/')
            if f: plain.append((L['zPos'], f, False))
    return (plain or custom), d

def cut(anim, im, is_custom):
    """take the wanted rows of an animation sheet and put each frame centred in the pack's cell size"""
    _, n, rows, cell = ANIMS[anim]
    nrows = 1 if anim == 'hurt' else 4
    fs = im.height // nrows
    if fs < 32: return None
    n = min(n, im.width // fs)
    out = Image.new('RGBA', (cell * n, cell * len(rows)))
    for ri, r in enumerate(rows):
        if r >= nrows: continue
        for k in range(n):
            fr = im.crop((k * fs, r * fs, k * fs + fs, r * fs + fs))
            if fs > cell:
                o = (fs - cell) // 2; fr = fr.crop((o, o, o + cell, o + cell)); out.alpha_composite(fr, (k * cell, ri * cell))
            else:
                o = (cell - fs) // 2; out.alpha_composite(fr, (k * cell + o, ri * cell + o))
    return out if out.getbbox() else None

def detect(ims, mats):
    """which ramp of each material the pictures are drawn in"""
    cols = {}
    for im in ims:
        for n, rgba in im.getcolors(1 << 22) or []:
            if rgba[3]: k = '#%02x%02x%02x' % rgba[:3]; cols[k] = cols.get(k, 0) + n
    found = {}
    for mat in mats:
        best, bn = None, 0
        for k, v in PAL.get(mat, {}).items():
            n = sum(cols.get(c, 0) for c in v)
            if n > bn: best, bn = k, n
        if best and bn > 30: found[mat] = best
    return found

CREDITS = {}
def layer(defp, variant, body):
    """{z: {anim: Image}} for one definition"""
    by_z = {}
    for a in ANIMS:
        fl, d = resolve(defp, variant, body, a)
        for z, f, cu in fl:
            im = cut(a, blob(f), cu)
            if im is None: continue
            if a in by_z.setdefault(z, {}): by_z[z][a].alpha_composite(im)
            else: by_z[z][a] = im
        for cr in d.get('credits', []): CREDITS[cr['file']] = cr
    # a layer without its own fighting stance stands as it walks (facing left, first frame)
    for z, ims in by_z.items():
        if 'idle' not in ims and 'walk' in ims:
            w = ims['walk']; fr = w.crop((0, 64, 64, 128)); idle = Image.new('RGBA', (128, 64)); idle.alpha_composite(fr, (0, 0)); idle.alpha_composite(fr, (64, 0)); ims['idle'] = idle
    return by_z

def save_pack(outdir, name, by_z):
    blocks, y, W = [], 0, 0
    parts = []
    for z in sorted(by_z):
        a2 = {}
        for a in ANIMS:
            im = by_z[z].get(a)
            if im is None: continue
            bb = im.getbbox()
            if not bb: continue
            blocks.append((im, y)); a2[a] = [y, im.width // ANIMS[a][3]]; y += im.height; W = max(W, im.width)
        if a2: parts.append({'z': z, 'a': a2})
    if not parts: return None
    out = Image.new('RGBA', (max(1, W), max(1, y)))
    for im, yy in blocks: out.alpha_composite(im, (0, yy))
    buf = io.BytesIO(); out.save(buf, 'PNG', optimize=True); data = buf.getvalue()
    h = hashlib.md5(data).hexdigest()[:10]
    return {'file': name + '.png', 'parts': parts, 'data': data, 'hash': h, 'ims': [b[0] for b in blocks]}

S = 'sheet_definitions/'
# id: (definition, variant, recolourable materials)
LAYERS = {
    'body': ('body/body.json', None, ['body']),
    'head_m': ('head/heads/human/heads_human_male.json', None, ['body']),
    'head_f': ('head/heads/human/heads_human_female.json', None, ['body']),
    'head_old': ('head/heads/human/heads_human_male_elderly.json', None, ['body']),
    'head_plump': ('head/heads/human/heads_human_male_plump.json', None, ['body']),
    'head_gaunt': ('head/heads/human/heads_human_male_gaunt.json', None, ['body']),
    'head_fold': ('head/heads/human/heads_human_female_elderly.json', None, ['body']),
    'wrinkles': ('head/head_wrinkles.json', None, ['body']),
    'brow_thick': ('head/eyebrows/eyebrows_thick.json', None, ['hair']),
    'brow_thin': ('head/eyebrows/eyebrows_thin.json', None, ['hair']),
    # hair
    'h_plain': ('hair/short/hair_plain.json', None, ['hair']),
    'h_parted': ('hair/short/hair_parted.json', None, ['hair']),
    'h_topknot': ('hair/braids/hair_topknot_long.json', None, ['hair']),
    'h_topknot_s': ('hair/braids/hair_topknot_short.json', None, ['hair']),
    'h_topknot_s2': ('hair/braids/hair_topknot_short2.json', None, ['hair']),
    'h_long': ('hair/long/hair_long.json', None, ['hair']),
    'h_long_tied': ('hair/braids/hair_long_tied.json', None, ['hair']),
    'h_ponytail': ('hair/braids/hair_ponytail.json', None, ['hair']),
    'h_high_pony': ('hair/braids/hair_high_ponytail.json', None, ['hair']),
    'h_bangs_bun': ('hair/braids/hair_bangs_bun.json', None, ['hair']),
    'h_messy': ('hair/short/hair_messy1.json', None, ['hair']),
    'h_bedhead': ('hair/short/hair_bedhead.json', None, ['hair']),
    'h_buzz': ('hair/bald/hair_buzzcut.json', None, ['hair']),
    'h_balding': ('hair/bald/hair_balding.json', None, ['hair']),
    'h_xlong': ('hair/xlong/hair_xlong.json', None, ['hair']),
    'h_braid': ('hair/braids/hair_braid.json', None, ['hair']),
    'h_bob': ('hair/bob/hair_bob.json', None, ['hair']),
    'h_pixie': ('hair/short/hair_pixie.json', None, ['hair']),
    'h_curly': ('hair/curly/hair_curly_short.json', None, ['hair']),
    'h_spiked': ('hair/spiky/hair_spiked.json', None, ['hair']),
    'h_loose': ('hair/long/hair_loose.json', None, ['hair']),
    'h_princess': ('hair/xlong/hair_princess.json', None, ['hair']),
    'h_unkempt': ('hair/short/hair_unkempt.json', None, ['hair']),
    'h_long_messy': ('hair/long/hair_long_messy.json', None, ['hair']),
    'h_cowlick': ('hair/short/hair_cowlick.json', None, ['hair']),
    'h_halfup': ('hair/braids/hair_half_up.json', None, ['hair']),
    'h_wavy': ('hair/long/hair_wavy.json', None, ['hair']),
    # beards
    'b_beard': ('hair/beards/beards_beard.json', None, ['hair']),
    'b_medium': ('hair/beards/beards_medium.json', None, ['hair']),
    'b_trimmed': ('hair/beards/beards_trimmed.json', None, ['hair']),
    'b_winter': ('hair/beards/beards_winter.json', None, ['hair']),
    'b_stubble': ('hair/beards/beards_5oclock_shadow.json', None, ['hair']),
    'm_mustache': ('hair/mustaches/beards_mustache.json', None, ['hair']),
    'm_walrus': ('hair/mustaches/beards_walrus.json', None, ['hair']),
    'm_horseshoe': ('hair/mustaches/beards_horseshoe.json', None, ['hair']),
    'm_chevron': ('hair/mustaches/beards_chevron.json', None, ['hair']),
    'm_handlebar': ('hair/mustaches/beards_handlebar.json', None, ['hair']),
    'm_big': ('hair/mustaches/beards_bigstache.json', None, ['hair']),
    'm_french': ('hair/mustaches/beards_french.json', None, ['hair']),
    # clothes
    't_robe': ('torso/shirts/torso_clothes_robe.json', None, ['cloth']),
    't_tunic': ('torso/shirts/torso_clothes_tunic.json', None, ['cloth']),
    't_long': ('torso/shirts/longsleeve/torso_clothes_longsleeve.json', None, ['cloth']),
    't_long2': ('torso/shirts/longsleeve/torso_clothes_longsleeve2.json', None, ['cloth']),
    't_laced': ('torso/shirts/longsleeve/torso_clothes_longsleeve_laced.json', None, ['cloth']),
    't_sleeveless': ('torso/shirts/sleeveless/torso_clothes_sleeveless.json', None, ['cloth']),
    't_short': ('torso/shirts/shortsleeve/torso_clothes_shortsleeve.json', None, ['cloth']),
    't_kimono': ('torso/dresses/kimono/dress_kimono.json', 'white', ['cloth']),
    't_kimono_split': ('torso/dresses/kimono/dress_kimono_split.json', 'white', ['cloth']),
    't_kimono_sleeves': ('torso/dresses/kimono/dress_kimono_longsleeve.json', 'white', ['cloth']),
    't_vest': ('torso/vest/torso_clothes_vest.json', None, ['cloth']),
    't_frock': ('torso/jacket/torso_jacket_frock.json', None, ['cloth']),
    't_trench': ('torso/jacket/torso_jacket_trench.json', None, ['cloth']),
    't_tabard': ('torso/jacket/torso_jacket_tabard.json', None, ['cloth']),
    't_collared': ('torso/jacket/torso_jacket_collared.json', None, ['cloth']),
    't_blouse': ('torso/shirts/torso_clothes_blouse_longsleeve.json', None, ['cloth']),
    't_vneck': ('torso/shirts/longsleeve/torso_clothes_longsleeve2_vneck.json', None, ['cloth']),
    't_cardigan': ('torso/shirts/longsleeve/torso_clothes_longsleeve2_cardigan.json', None, ['cloth']),
    'l_slit': ('legs/skirts/legs_skirts_slit.json', None, ['cloth']),
    'l_formal': ('legs/pants/legs_formal.json', None, ['cloth']),
    'a_leather': ('torso/armour/torso_armour_leather.json', None, ['cloth', 'metal']),
    'a_legion': ('torso/armour/torso_armour_legion.json', None, ['metal']),
    'a_plate': ('torso/armour/torso_armour_plate.json', None, ['metal']),
    'a_chain': ('torso/torso_chainmail.json', None, ['metal']),
    'sh_legion': ('arms/shoulders/shoulders_legion.json', None, ['metal']),
    'sh_pauldrons': ('arms/shoulders/shoulders_pauldrons.json', None, ['metal']),
    'sh_mantal': ('arms/shoulders/shoulders_mantal.json', None, ['metal', 'cloth']),
    'arm_armour': ('arms/arms_armour.json', None, ['metal']),
    'bracers': ('arms/wrists/arms_bracers.json', None, ['cloth', 'metal']),
    'gloves': ('arms/arms_gloves.json', None, ['cloth', 'metal']),
    'belt_sash': ('torso/waist/belt_sash.json', None, ['cloth']),
    'belt_obi': ('torso/waist/obi/belt_obi.json', None, ['cloth']),
    'belt_leather': ('torso/waist/belt_leather.json', None, ['cloth', 'metal']),
    'l_pants': ('legs/pants/legs_pants.json', None, ['cloth']),
    'l_wide': ('legs/pants/legs_widepants.json', None, ['cloth']),
    'l_pantaloons': ('legs/pants/legs_pantaloons.json', None, ['cloth']),
    'l_legion': ('legs/skirts/legs_skirts_legion.json', None, ['cloth', 'metal']),
    'l_armour': ('legs/legs_armour.json', None, ['metal']),
    'l_skirt': ('legs/skirts/legs_skirts_plain.json', None, ['cloth']),
    'f_boots': ('feet/boots/feet_boots_basic.json', None, ['cloth']),
    'f_boots_fold': ('feet/boots/feet_boots_fold.json', None, ['cloth']),
    'f_shoes': ('feet/shoes/feet_shoes_basic.json', None, ['cloth']),
    'f_sandals': ('feet/feet_sandals.json', None, ['cloth']),
    'f_armour': ('feet/feet_armour.json', None, ['metal']),
    'c_solid': ('torso/cape/cape_solid.json', None, ['cloth']),
    'c_trim': ('torso/cape/cape_trim.json', None, ['cloth']),
    'c_tattered': ('torso/cape/cape_tattered.json', None, ['cloth']),
    # helmets and hats
    'hm_legion': ('headwear/helmets/helmets/hat_helmet_legion.json', None, ['metal']),
    'hm_spangen': ('headwear/helmets/helmets/hat_helmet_spangenhelm.json', None, ['metal']),
    'hm_kettle': ('headwear/helmets/helmets/hat_helmet_kettle.json', None, ['metal']),
    'hm_nasal': ('headwear/helmets/helmets/hat_helmet_nasal.json', None, ['metal']),
    'hm_pointed': ('headwear/helmets/helmets/hat_helmet_pointed.json', None, ['metal']),
    'hm_barbarian': ('headwear/helmets/helmets/hat_helmet_barbarian.json', None, ['metal']),
    'hm_morion': ('headwear/helmets/helmets/hat_helmet_morion.json', None, ['metal']),
    'hm_sugarloaf': ('headwear/helmets/helmets/hat_helmet_sugarloaf_simple.json', None, ['metal']),
    'hm_mail': ('headwear/helmets/helmets/hat_helmet_mail.json', None, ['metal']),
    'hm_norman': ('headwear/helmets/helmets/hat_helmet_norman.json', None, ['metal']),
    'hm_maximus': ('headwear/helmets/helmets/hat_helmet_maximus.json', None, ['metal']),
    'hm_horned': ('headwear/helmets/helmets/hat_helmet_horned.json', None, ['metal']),
    'hx_plume': ('headwear/helmets/accessories/hat_accessory_plumage.json', None, ['cloth', 'hair']),
    'hx_plume_legion': ('headwear/helmets/accessories/hat_accessory_plumage_legion.json', None, ['cloth', 'hair']),
    'hx_crest': ('headwear/helmets/accessories/hat_accessory_crest.json', None, ['cloth', 'hair']),
    'hx_wings': ('headwear/helmets/accessories/hat_accessory_wings.json', None, ['metal', 'cloth']),
    'hb_tied': ('headwear/coverings/headbands/hat_headband_tied.json', None, ['cloth']),
    'hb_thick': ('headwear/coverings/headbands/hat_headband_thick.json', None, ['cloth']),
    'hb_bandana': ('headwear/coverings/bandana/hat_bandana.json', None, ['cloth']),
    'hb_hood': ('headwear/coverings/hoods/hat_hood_cloth.json', None, ['cloth']),
    'hb_crown': ('headwear/hats/formal/hat_formal_crown.json', None, ['metal']),
    'hb_tiara': ('headwear/hats/formal/hat_formal_tiara.json', None, ['metal']),
    'hb_tricorne': ('headwear/hats/tricorne/hat_tricorne.json', None, ['cloth']),
    'hb_cap': ('headwear/hats/caps/hat_cap_leather.json', None, ['cloth']),
    'n_scarf': ('headwear/neck/neck_scarf.json', None, ['cloth']),
    'n_necklace': ('headwear/neck/neck_necklace_simple.json', None, ['metal']),
    'g_round': ('headwear/accessories/glasses/facial_glasses_round.json', None, ['metal']),
    'g_patch': ('headwear/accessories/eyepatch/facial_eyepatch_left.json', None, ['cloth']),
    'quiver': ('torso/backpack/quiver.json', None, ['cloth', 'wood']),
    'backpack': ('torso/backpack/backpack.json', None, ['cloth']),
    # weapons
    'w_sword': ('weapons/sword/weapon_sword_arming.json', 'steel', ['metal']),
    'w_longsword': ('weapons/sword/weapon_sword_longsword.json', None, ['metal']),
    'w_saber': ('weapons/sword/weapon_sword_saber.json', None, ['metal']),
    'w_scimitar': ('weapons/sword/weapon_sword_scimitar.json', None, ['metal']),
    'w_glowsword': ('weapons/sword/weapon_sword_glowsword.json', 'red', []),
    'w_glowsword_b': ('weapons/sword/weapon_sword_glowsword.json', 'blue', []),
    'w_spear': ('weapons/polearm/weapon_polearm_spear.json', 'steel', ['metal', 'wood']),
    'w_longspear': ('weapons/polearm/weapon_polearm_longspear.json', None, ['metal', 'wood']),
    'w_dragonspear': ('weapons/polearm/weapon_polearm_dragonspear.json', None, ['metal']),
    'w_trident': ('weapons/polearm/weapon_polearm_trident.json', None, ['metal']),
    'w_halberd': ('weapons/polearm/weapon_polearm_halberd.json', None, ['metal', 'wood']),
    'w_scythe': ('weapons/polearm/weapon_polearm_scythe.json', None, ['metal', 'wood']),
    'w_waraxe': ('weapons/blunt/weapon_blunt_waraxe.json', None, ['metal', 'wood']),
    'w_mace': ('weapons/blunt/weapon_blunt_mace.json', None, ['metal']),
    'w_bow': ('weapons/ranged/bow/weapon_ranged_bow_normal.json', 'medium', ['wood']),
    'w_recurve': ('weapons/ranged/bow/weapon_ranged_bow_recurve.json', 'medium', ['wood']),
    'w_greatbow': ('weapons/ranged/bow/weapon_ranged_bow_great.json', 'medium', ['wood']),
    'w_arrow': ('weapons/ranged/bow/weapon_ranged_bow_arrow.json', None, []),
    'w_crossbow': ('weapons/ranged/weapon_ranged_crossbow.json', None, ['metal', 'wood']),
    'w_staff': ('weapons/magic/weapon_magic_simple.json', None, ['wood']),
    'w_wand': ('weapons/magic/weapon_magic_wand.json', None, []),
    'w_loop': ('weapons/magic/weapon_magic_loop.json', 'medium', []),
    'w_crystal': ('weapons/magic/weapon_magic_crystal.json', 'blue', []),
    's_round': ('weapons/shields/shield_round.json', None, ['metal', 'wood', 'cloth']),
    's_kite': ('weapons/shields/shield_kite.json', None, ['metal', 'wood', 'cloth']),
    's_heater': ('weapons/shields/heater/shield_heater_revised_wood.json', None, ['wood', 'metal']),
    's_scutum': ('weapons/shields/scutum/shield_scutum.json', None, ['metal', 'wood', 'cloth']),
}
BODIES = ['male', 'female']

def build(outdir, only=None):
    os.makedirs(outdir, exist_ok=True)
    meta = {'layers': {}, 'pal': {}, 'anims': {a: [v[1], len(v[2]), v[3]] for a, v in ANIMS.items()}}
    if only:
        meta = json.load(open(os.path.join(outdir, 'doll.json')))
    seen = {}
    total = 0
    for lid, (defp, var, mats) in LAYERS.items():
        if only and lid not in only: continue
        if not os.path.exists(os.path.join(REPO, S + defp)): print('MISSING', lid, defp); continue
        meta['layers'][lid] = {}
        for body in BODIES:
            by_z = layer(defp, var, body)
            pk = save_pack(outdir, lid + '_' + body, by_z)
            if not pk: continue
            if pk['hash'] in seen:
                meta['layers'][lid][body] = seen[pk['hash']]
                continue
            found = detect(pk['ims'], mats)
            open(os.path.join(outdir, pk['file']), 'wb').write(pk['data']); total += len(pk['data'])
            ent = {'file': pk['file'], 'parts': pk['parts'], 'mats': found}
            seen[pk['hash']] = ent
            meta['layers'][lid][body] = ent
        print(lid, {b: (e['file'], [p['z'] for p in e['parts']], e['mats'], sorted(set(k for p in e['parts'] for k in p['a']))) for b, e in meta['layers'][lid].items()})
        if not meta['layers'][lid]: print('  EMPTY', lid)
    for mat, ramps in PAL.items():
        meta['pal'][mat] = ramps
    json.dump(meta, open(os.path.join(outdir, 'doll.json'), 'w'), separators=(',', ':'))
    cp = os.path.join(HERE, 'doll_credits.json')
    old = json.load(open(cp, encoding='utf-8')) if (only and os.path.exists(cp)) else {}
    old.update(CREDITS)
    json.dump(old, open(cp, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print('bytes', total)

if __name__ == '__main__':
    build(sys.argv[1], sys.argv[2:] or None)
