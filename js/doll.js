// The paper doll (紙娃娃). Every general's picture is stacked at run time from Universal LPC layers: body and
// skin, head, hair and beard, clothes, armour, helmet, cape, weapon, shield. Hair, skin, cloth and metal are
// recoloured from the LPC palettes, so 500 generals get 500 looks from a hundred layer sheets, and whatever a
// general equips shows on them. Pictures come in three sizes: the battle sheet (64px figures, with the swing
// of their weapon), the half-size walking sheet for maps, and a head-and-shoulders portrait.
import { canvas } from './gfx.js?v=3';
import { ITEMS, SWING } from './data.js?v=3';

let META = null;
try { META = await (await fetch('assets/doll/doll.json?v=1')).json(); } catch (e) { META = null; }
export const dollReady = () => !!META;
const ANIM = META ? META.anims : {}; // anim -> [frames, rows, cell]

// ---------- the layers of a look ----------
// a general's base look plus what they have equipped -> [[layer id, {material: ramp}]]
const METAL = (m) => 'ulpc:' + (m || 'steel');
export function layersOf(look, equip = {}, opts = {}) {
  const b = look.b === 'muscular' ? 'male' : look.b, out = [];
  const add = (id, mats) => { if (id && META && META.layers[id] && META.layers[id][b]) out.push([id, mats || {}]); };
  const pre = (v, d) => { v = v || d; return v.includes(':') ? v : 'ulpc:' + v; };
  const skin = { body: pre(look.s, 'light') }, hair = { hair: pre(look.hc, 'black') };
  const cloth = (c) => ({ cloth: pre(c, 'gray') });
  const it = (slot) => (equip[slot] && ITEMS[equip[slot]]) || null;
  const w = it('weapon'), a = it('armour'), h = it('helm'), tr = it('treasure');
  const wl = (w && w.look) || {}, al = (a && a.look) || {}, hl = (h && h.look) || {}, tl = (tr && tr.look) || {};
  add('body', skin);
  add(look.hd || 'head_m', skin);
  if (look.hd === 'head_old' || look.hd === 'head_fold') add('wrinkles', skin);
  if (look.brow) add(look.brow, hair);
  // clothes. LPC has robes and kimono only for the female body; men get a crossed-collar shirt over a long
  // skirt of the same cloth, belted with a sash, which reads as a robe. A scholar's robe replaces the shirt.
  let torso = al.robe ? 't_robe' : look.t, tc = al.robe ? (look.tc === 'red' ? 'maroon' : look.tc) : look.tc, skirt = null, legs = look.l, belt = look.belt;
  if (b === 'male') {
    if (torso === 't_robe' || torso === 't_kimono') { torso = 't_vneck'; skirt = 'l_skirt'; belt = belt || 'belt_sash'; }
    else if (torso === 't_kimono_split') { torso = 't_vneck'; skirt = 'l_slit'; belt = belt || 'belt_sash'; }
    else if (torso === 't_tunic' || torso === 't_blouse') torso = 't_long';
    if (legs === 'l_wide' || legs === 'l_skirt') legs = 'l_pantaloons';
  }
  add(legs, cloth(look.lc));
  if (skirt) add(skirt, cloth(tc));
  add(look.f, cloth(look.fc));
  add(torso, cloth(tc));
  if (torso === 't_kimono' && b === 'female') add('t_kimono_sleeves', cloth(tc));
  if (belt) add(belt, { cloth: pre(look.bc, tc === 'black' ? 'red' : 'black'), metal: 'ulpc:brass' });
  // armour
  if (al.armour) add(al.armour, { metal: METAL(al.ametal), cloth: pre(al.acloth || (tc === 'white' ? 'walnut' : tc), 'walnut') });
  if (al.legs2) add(al.legs2, { metal: METAL(al.ametal), cloth: 'ulpc:leather' });
  if (al.shoulders) add(al.shoulders, { metal: METAL(al.ametal), cloth: 'ulpc:' + (look.tc || 'red') });
  if (al.arms) add(al.arms, { metal: METAL(al.ametal) });
  if (tl.bracers) add('bracers', { cloth: 'ulpc:leather', metal: 'ulpc:bronze' });
  if (tl.scarf || look.n === 'n_scarf') add('n_scarf', cloth(tl.scarf ? 'red' : look.tc === 'green' ? 'yellow' : 'red'));
  if (look.g) add(look.g, { metal: 'ulpc:brass', cloth: 'ulpc:black' });
  // a cape from the look, or a treasure that is a cape
  if (tl.cape) add(tl.cape, cloth(tl.capeCol || look.cc || look.tc));
  else if (look.c) add(look.c, cloth(look.cc));
  // head: hair and beard, then whatever is on it
  const helmet = hl.helm || null;
  const hairId = helmet && helmet.startsWith('hm_') && look.h && /long|xlong|princess|braid|pony|loose|wavy/.test(look.h) ? look.h : helmet && helmet.startsWith('hm_') ? 'h_buzz' : look.h;
  add(hairId, hair);
  if (look.bd) add(look.bd, hair);
  if (helmet) add(helmet, { metal: METAL(hl.hmetal), cloth: pre(hl.hcloth || look.tc, 'red') });
  else if (look.hat) add(look.hat, { cloth: 'ulpc:' + (look.hatc || 'red'), metal: 'ulpc:gold', hair: 'ulpc:' + (look.hatc === 'white' ? 'white' : 'red') });
  if (hl.plume) add(hl.plume, { cloth: 'ulpc:red', hair: 'ulpc:red', metal: METAL(hl.hmetal) });
  // weapon, and Josh's shield, the archers' quiver
  if (opts.quiver || (w && (w.cat === 'bow'))) add('quiver', { cloth: 'ulpc:leather', wood: 'ulpc:oak' });
  if (wl.weapon) { add(wl.weapon, { metal: METAL(wl.wmetal), wood: 'ulpc:' + (wl.wwood || 'walnut') }); if (w.cat === 'bow') add('w_arrow', {}); }
  if (opts.shield) add(opts.shield, { metal: 'ulpc:iron', wood: 'ulpc:oak', cloth: 'ulpc:' + (look.tc || 'red') });
  return out;
}
export function swingOf(equip) { const w = equip && ITEMS[equip.weapon]; return w ? SWING[w.cat] : 'slash'; }

// ---------- loading and recolouring layer sheets ----------
const imgs = new Map();
function sheet(file) {
  let p = imgs.get(file);
  if (!p) { p = new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'assets/doll/' + file + '?v=1'; }); imgs.set(file, p); }
  return p;
}
const hex2int = (h) => { const n = parseInt(h.slice(1), 16); return ((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255); }; // as little-endian ABGR without alpha
// recoloured copies of layer sheets, by file and colours
const tinted = new Map();
async function layerCanvas(ent, mats) {
  const want = Object.entries(ent.mats || {}).filter(([m]) => mats[m] && mats[m] !== ent.mats[m]);
  const key = ent.file + '|' + want.map(([m]) => m + ':' + mats[m]).join(',');
  let p = tinted.get(key);
  if (p) { tinted.delete(key); tinted.set(key, p); return p; }
  p = sheet(ent.file).then((im) => {
    if (!im) return null;
    if (!want.length) return im;
    const c = canvas(im.width, im.height); c.x.drawImage(im, 0, 0);
    const id = c.x.getImageData(0, 0, im.width, im.height), u = new Uint32Array(id.data.buffer);
    const map = new Map();
    for (const [m] of want) {
      const src = META.pal[m][ent.mats[m]], tgt = META.pal[m][mats[m]] || META.pal[m][mats[m].replace('ulpc:', 'lpcr:')];
      if (!src || !tgt) continue;
      for (let i = 0; i < src.length; i++) { const t = tgt[Math.round((i * (tgt.length - 1)) / Math.max(1, src.length - 1))]; map.set(hex2int(src[i]), hex2int(t)); }
    }
    for (let i = 0; i < u.length; i++) {
      const v = u[i];
      if (!(v >>> 24)) continue;
      const t = map.get(v & 0xffffff);
      if (t !== undefined) u[i] = (v & 0xff000000) | t;
    }
    c.x.putImageData(id, 0, 0);
    return c;
  });
  tinted.set(key, p);
  while (tinted.size > 160) tinted.delete(tinted.keys().next().value);
  return p;
}

// ---------- stacking ----------
// sets: 'walk' (four directions), and battle anims facing left
const BLOCK_ORDER = ['walk', 'idle', 'hurt', 'cast', 'slash', 'thrust', 'shoot'];
async function stack(layers, body, anims) {
  if (body === 'muscular') body = 'male';
  // which parts of which layers, deepest first
  const parts = [];
  const cans = await Promise.all(layers.map(([id, mats]) => layerCanvas(META.layers[id][body], mats)));
  layers.forEach(([id], li) => { const ent = META.layers[id][body]; if (!cans[li]) return; for (const pt of ent.parts) parts.push({ z: pt.z, a: pt.a, img: cans[li], li }); });
  parts.sort((p, q) => p.z - q.z || p.li - q.li);
  const meta = {}; let y = 0, w = 0;
  for (const a of BLOCK_ORDER) {
    if (!anims.includes(a)) continue;
    const [n, rows, cell] = ANIM[a];
    meta[a] = { y, n, rows, cell }; y += rows * cell; w = Math.max(w, n * cell);
  }
  const c = canvas(w, y), g = c.x;
  for (const a of BLOCK_ORDER) {
    const m = meta[a]; if (!m) continue;
    for (const pt of parts) {
      const s = pt.a[a]; if (!s) continue;
      const [sy, n] = s;
      g.drawImage(pt.img, 0, sy, n * m.cell, m.rows * m.cell, 0, m.y, n * m.cell, m.rows * m.cell);
    }
  }
  return { img: c, meta };
}
const lookKey = (look, equip, opts) => JSON.stringify([look, equip ? [equip.weapon, equip.armour, equip.helm, equip.treasure] : 0, opts && opts.shield, opts && opts.quiver]);

// battle sheets: walk (left row only used), idle, hurt, cast and the weapon's swing
const battleCache = new Map();
export function battleSheet(look, equip, opts = {}) {
  if (!META) return Promise.resolve(null);
  const key = 'b' + lookKey(look, equip, opts);
  let p = battleCache.get(key);
  if (p) { battleCache.delete(key); battleCache.set(key, p); return p; }
  const sw = swingOf(equip);
  p = stack(layersOf(look, equip, opts), look.b, ['walk', 'idle', 'hurt', 'cast', sw]).then((r) => { if (r) r.swing = sw; return r; });
  battleCache.set(key, p);
  while (battleCache.size > 24) battleCache.delete(battleCache.keys().next().value);
  return p;
}

// half-size walking sheets for maps: every 2x2 block of the 64px picture becomes one pixel. Dark outline
// pixels win where they are, so the little figures keep their edges; otherwise the colour most like the
// block's average is kept, so no new colours appear.
function halve(src, sx, sy, w, h) {
  const s = src.getContext ? src : null;
  const c0 = canvas(w, h); c0.x.drawImage(src, sx, sy, w, h, 0, 0, w, h);
  const d = c0.x.getImageData(0, 0, w, h).data, W2 = w >> 1, H2 = h >> 1, out = canvas(W2, H2), od = out.x.createImageData(W2, H2), o = od.data;
  void s;
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
    const px = [];
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const k = ((y * 2 + j) * w + x * 2 + i) * 4; if (d[k + 3] > 100) px.push(k); }
    if (!px.length) continue;
    const dark = px.filter((k) => d[k] + d[k + 1] + d[k + 2] < 150);
    if (px.length === 1 && !dark.length) {
      // a lone pixel survives only if the block beside it in the row is empty too (thin details such as spear shafts)
      const k = px[0], ox = (y * W2 + x) * 4; o[ox] = d[k]; o[ox + 1] = d[k + 1]; o[ox + 2] = d[k + 2]; o[ox + 3] = 255; continue;
    }
    let pick = px[0];
    if (dark.length >= 2 || (dark.length && px.length < 4)) { pick = dark.reduce((a, k) => (d[k] + d[k + 1] + d[k + 2] < d[a] + d[a + 1] + d[a + 2] ? k : a), dark[0]); }
    else {
      let r = 0, g = 0, b = 0; for (const k of px) { r += d[k]; g += d[k + 1]; b += d[k + 2]; } r /= px.length; g /= px.length; b /= px.length;
      let best = 1e9; for (const k of px) { const e = (d[k] - r) ** 2 + (d[k + 1] - g) ** 2 + (d[k + 2] - b) ** 2; if (e < best) { best = e; pick = k; } }
    }
    const ox = (y * W2 + x) * 4; o[ox] = d[pick]; o[ox + 1] = d[pick + 1]; o[ox + 2] = d[pick + 2]; o[ox + 3] = 255;
  }
  out.x.putImageData(od, 0, 0);
  return out;
}
const fieldCache = new Map(), fieldReady = new Map();
// the half-size walking sheet: 9 frames x 4 rows of 32px (rows: up, left, down, right); null until ready
export function fieldSheet(look, equip, opts = {}) {
  if (!META) return null;
  const key = 'f' + lookKey(look, equip, opts);
  const got = fieldReady.get(key);
  if (got) { fieldReady.delete(key); fieldReady.set(key, got); return got; }
  if (!fieldCache.has(key)) {
    fieldCache.set(key, stack(layersOf(look, equip, opts), look.b, ['walk']).then((r) => {
      const half = halve(r.img, 0, 0, 576, 256);
      fieldReady.set(key, half);
      while (fieldReady.size > 120) { const k = fieldReady.keys().next().value; fieldReady.delete(k); fieldCache.delete(k); }
      return half;
    }));
  }
  return null;
}
export function fieldSheetAsync(look, equip, opts = {}) { fieldSheet(look, equip, opts); return fieldCache.get('f' + lookKey(look, equip, opts)); }
// a portrait: the head and shoulders, facing the viewer, cut from the walking sheet's first frame (32x32 from the 64px picture)
const porCache = new Map(), porReady = new Map();
export function portrait(look, equip, opts = {}) {
  if (!META) return null;
  const key = 'p' + lookKey(look, equip, opts);
  const got = porReady.get(key);
  if (got) return got;
  if (!porCache.has(key)) {
    porCache.set(key, stack(layersOf(look, equip, opts), look.b, ['walk']).then((r) => {
      const c = canvas(36, 36); c.x.drawImage(r.img, 14, 128 + 7, 36, 36, 0, 0, 36, 36);
      porReady.set(key, c);
      if (porReady.size > 200) { const k = porReady.keys().next().value; porReady.delete(k); porCache.delete(k); }
      return c;
    }));
  }
  return null;
}
export function portraitAsync(look, equip, opts = {}) { portrait(look, equip, opts); return porCache.get('p' + lookKey(look, equip, opts)); }
export { ANIM, META };
