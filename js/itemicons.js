// Item icons, 16x16. Weapons, books, relics and trinkets use the Ninja Adventure item pictures (CC0), recoloured
// to the metal of the piece; armour, helmets, capes, shields and neck pieces are cut from the very paper-doll
// layers they put on a general, so the icon always matches the look; horses show their head in their coat.
// Unfound treasures are drawn as a dark silhouette. A frame in the rarity's colour marks each treasure.
import { ctx, canvas } from './gfx.js?v=7';
import { ITEMS, RARITY } from './data.js?v=7';
import { layersOf, stack, META } from './doll.js?v=7';
import { horseImg } from './horses.js?v=7';
import { parseLook } from './generals.js?v=7';

let SHEET = null, MAP = {};
try {
  MAP = await (await fetch('assets/items/icons.json?v=1')).json();
  SHEET = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'assets/items/icons.png?v=1'; });
} catch (e) { SHEET = null; }
const METAL_RGB = { bronze: [200, 132, 70], iron: [150, 150, 158], steel: [182, 200, 222], silver: [228, 236, 255], gold: [255, 208, 80], copper: [214, 112, 80], brass: [220, 180, 84], ceramic: [232, 244, 244] };
const WEAPON_PIC = { w_sword: 'Sword', w_saber: 'Sword2', w_longsword: 'BigSword', w_longsword_alt: 'BigSword', w_katana: 'Katana', w_rapier: 'Rapier', w_dagger: 'Kunai', w_scimitar: 'Sword2', w_glowsword: 'Sword', w_glowsword_b: 'Sword',
  w_spear: 'Lance', w_longspear: 'Lance2', w_dragonspear: 'Lance2', w_trident: 'Fork', w_halberd: 'Lance2', w_scythe: 'Lance2', w_waraxe: 'Axe', w_mace: 'Club', w_flail: 'Hammer', w_club: 'Club',
  w_bow: 'Bow', w_recurve: 'Bow', w_greatbow: 'Bow2', w_crossbow: 'Bow2', w_staff: 'Stick', w_gnarled: 'Stick', w_crystal: 'MagicWand', w_diamond: 'MagicWand', w_wand: 'MagicWand', w_fan: 'Feather', w_cranefan: 'Feather' };
const KIND_PIC = { supply: 'LifePot', gift: 'GoldCup', book: 'Scroll', key: 'GoldKey', relic: 'Hourglass', treasure: 'GemGreen' };
const SUPPLY_PIC = { salve: 'Medipack', jinchuang: 'LifePot', wine: 'WaterPot', rations: 'Onigiri', zhaohun: 'Letter3', tpdan: 'Heart', tpbig: 'Heart', gunpowder: 'Bomb', smoke: 'Dynamite', qingxin: 'TeaLeaf', incense: 'Letter2', returnseal: 'Letter', goodwine: 'Gourd', oldbook: 'Book', silk: 'Bag', pearl: 'SilverCoin',
  bingfu: 'GoldKey', huxin: 'SilverCup', jade: 'GemGreen', wristguard: 'BarIron', scarf: 'Letter2', compass: 'Hourglass', sextant: 'Hourglass', sunzi: 'Book', qingnang: 'Book', seal: 'Stamp', letter: 'Letter', lotus: 'GemPurple', shipwright: 'ScrollEmpty', blueprint: 'ScrollFire', lotuskey: 'SilverKey', q_heirloom: 'GemGreen', q_seal: 'Stamp' };
// the picture for a Ninja icon, its grey parts tinted to a metal
function ninja(name, metal, glow) {
  const r = MAP[name]; if (!SHEET || !r) return null;
  const c = canvas(16, 16), g = c.x;
  const s = Math.min(1, 16 / Math.max(r[2], r[3]));
  g.imageSmoothingEnabled = false;
  const w = Math.round(r[2] * s), h = Math.round(r[3] * s);
  g.drawImage(SHEET, r[0], r[1], r[2], r[3], Math.floor((16 - w) / 2), Math.floor((16 - h) / 2), w, h);
  const tint = METAL_RGB[metal];
  if (tint || glow) {
    const id = g.getImageData(0, 0, 16, 16), d = id.data;
    if (tint) for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
      if (mx - mn < 40 && mx > 70) { const l = mx / 255; d[i] = tint[0] * l * 1.05; d[i + 1] = tint[1] * l * 1.05; d[i + 2] = tint[2] * l * 1.05; }
    }
    if (glow) outline(d, 16, 16, glow);
    g.putImageData(id, 0, 0);
  }
  return c;
}
function outline(d, W, H, col) {
  const n = parseInt(col.slice(1), 16), R = n >> 16, G = (n >> 8) & 255, B = n & 255;
  const a = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) a[i] = d[i * 4 + 3] > 60 ? 1 : 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (a[i]) continue; if ((x > 0 && a[i - 1]) || (x < W - 1 && a[i + 1]) || (y > 0 && a[i - W]) || (y < H - 1 && a[i + W])) { d[i * 4] = R; d[i * 4 + 1] = G; d[i * 4 + 2] = B; d[i * 4 + 3] = 200; } }
}
// cut a doll layer: which walking row and which part of the 64px figure
const CUT = { armour: [2, 14, 20, 36, 36], helm: [2, 18, 2, 28, 28], cape: [0, 12, 18, 40, 40], shield: [3, 10, 18, 40, 40], neck: [2, 22, 24, 20, 20], belt: [2, 18, 32, 28, 16] };
const BASE = parseLook('b=m s=light hd=m h=buzz hc=black t=long tc=white l=pants lc=black f=boots fc=black');
const BASE_F = parseLook('b=f s=light hd=f h=buzz hc=black t=robe tc=white l=skirt lc=black f=shoes fc=black');
function dollIcon(it, slot) {
  if (!META) return Promise.resolve(null);
  const look = it.look && it.look.robe ? BASE_F : BASE;
  const base = new Set(layersOf(look, {}).map((l) => l[0]));
  let layers = layersOf(look, { [slot]: it.id }).filter((l) => !base.has(l[0]) || (it.look.robe && /^t_|^l_skirt|^belt/.test(l[0])));
  if (slot === 'helm') layers = layers.filter((l) => !/^h_/.test(l[0]));
  if (!layers.length) return Promise.resolve(null);
  const part = slot === 'treasure' ? (it.look.belt ? 'belt' : 'neck') : it.look && it.look.robe ? 'armour' : slot;
  const [row, x0, y0, w, h] = CUT[part] || CUT.armour;
  return stack(layers, look.b, ['walk']).then((r) => {
    if (!r) return null;
    const src = canvas(w, h); src.x.drawImage(r.img, x0, row * 64 + y0, w, h, 0, 0, w, h);
    // trim to what is drawn, then fit in 16x16 by a whole-number step
    const id = src.x.getImageData(0, 0, w, h).data;
    let mx = w, my = h, Mx = -1, My = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (id[(y * w + x) * 4 + 3] > 20) { mx = Math.min(mx, x); my = Math.min(my, y); Mx = Math.max(Mx, x); My = Math.max(My, y); }
    if (Mx < 0) return null;
    const bw = Mx - mx + 1, bh = My - my + 1, k = Math.max(bw, bh) > 16 ? 16 / Math.max(bw, bh) : 1;
    const c = canvas(16, 16); c.x.imageSmoothingEnabled = k < 1;
    const dw = Math.max(1, Math.round(bw * k)), dh = Math.max(1, Math.round(bh * k));
    c.x.drawImage(src, mx, my, bw, bh, Math.floor((16 - dw) / 2), Math.floor((16 - dh) / 2), dw, dh);
    if (it.look && it.look.glow) { const d2 = c.x.getImageData(0, 0, 16, 16); outline(d2.data, 16, 16, it.look.glow); c.x.putImageData(d2, 0, 0); }
    return c;
  });
}
function horseIcon(it) {
  const hi = horseImg(it.horse); if (!hi) return null;
  const c = canvas(16, 16); c.x.imageSmoothingEnabled = true; c.x.imageSmoothingQuality = 'high';
  c.x.drawImage(hi, 18, 640 + 26, 46, 46, 0, 0, 16, 16);
  return c;
}
const cache = new Map(), pending = new Set();
// the 16x16 icon of an item, or null while it is still being made
export function itemIcon(id) {
  if (cache.has(id)) return cache.get(id);
  const it = ITEMS[id]; if (!it) return null;
  let c = null;
  const k = it.kind;
  if (k === 'weapon') c = ninja(WEAPON_PIC[it.look && it.look.weapon] || 'Sword', it.look && (it.look.wmetal || (it.look.wwood === 'gold' ? 'gold' : null)), it.look && it.look.glow);
  else if (k === 'horse') c = horseIcon(it);
  else if (['armour', 'helm', 'cape', 'shield'].includes(k) || (k === 'treasure' && it.look && (it.look.neck || it.look.belt) && !it.icon)) {
    if (!pending.has(id)) { pending.add(id); dollIcon(it, k === 'treasure' ? 'treasure' : k).then((r) => { cache.set(id, r || ninja(KIND_PIC[k] || 'Bag')); }); }
    return null;
  } else c = ninja(it.icon || SUPPLY_PIC[id] || KIND_PIC[k] || 'Bag', null, it.look && it.look.glow);
  if (c) cache.set(id, c);
  return c;
}
// a dark silhouette of an icon, for treasures not yet found
const silCache = new Map();
function silhouette(id) {
  if (silCache.has(id)) return silCache.get(id);
  const ic = itemIcon(id); if (!ic) return null;
  const c = canvas(16, 16); c.x.drawImage(ic, 0, 0);
  const d = c.x.getImageData(0, 0, 16, 16);
  for (let i = 0; i < d.data.length; i += 4) if (d.data[i + 3] > 40) { d.data[i] = 34; d.data[i + 1] = 30; d.data[i + 2] = 44; d.data[i + 3] = 255; }
  outline(d.data, 16, 16, '#5a5470');
  c.x.putImageData(d, 0, 0);
  silCache.set(id, c);
  return c;
}
// draw an item's icon at (x, y), scale s; frame: the rarity border for treasures; sil: as an unfound silhouette
export function drawItemIcon(id, x, y, s = 1, { frame = true, sil = false, g = ctx } = {}) {
  const it = ITEMS[id];
  const ic = sil ? silhouette(id) : itemIcon(id);
  if (frame && it && it.tr) {
    const col = sil ? '#4a4458' : RARITY[it.rar][2];
    g.fillStyle = '#0c0a12'; g.fillRect(x - 1, y - 1, 16 * s + 2, 16 * s + 2);
    g.fillStyle = col; g.fillRect(x - 1, y - 1, 16 * s + 2, 1); g.fillRect(x - 1, y + 16 * s, 16 * s + 2, 1); g.fillRect(x - 1, y - 1, 1, 16 * s + 2); g.fillRect(x + 16 * s, y - 1, 1, 16 * s + 2);
  }
  if (!ic) return;
  g.imageSmoothingEnabled = false;
  g.drawImage(ic, 0, 0, 16, 16, x, y, 16 * s, 16 * s);
}
// make every icon in a list ahead of time (they build in the background)
export function warmIcons(ids) { for (const id of ids) itemIcon(id); }
