// Towns, castles, villages, ports, forts, temples, caves and the rooms inside them. Every place on the world
// map gets its own layout, made from a template for its kind and a seed from its name, so the same place always
// looks the same. Ground is laid out as letters; houses, trees and furniture are objects placed on top.
import { hash, canvas } from './gfx.js?v=4';
import { tileset } from './assets.js?v=4';
import { TILES } from './tiles.js?v=4';
import { PLACES } from './world.js?v=4';
import { L } from './i18n.js?v=4';

// ---------- extra tiles ----------
// a 16-piece floor autotile (3x3 patch, a column, a row and a single), as in tiles.js
const PATCH = (img, bx, by) => (g, X, Y, n) => {
  const k = n(0, 0), s = (dx, dy) => n(dx, dy) === k;
  const N = s(0, -1), S = s(0, 1), Wt = s(-1, 0), E = s(1, 0);
  const col = Wt && E ? 1 : E ? 0 : Wt ? 2 : 3, row = N && S ? 1 : S ? 0 : N ? 2 : 3;
  g.drawImage(tileset(img), (bx + col) * 16, (by + row) * 16, 16, 16, 0, 0, 16, 16);
};
TILES.tanfloor = { draw: PATCH('interiorfloor', 12, 0) };
TILES.ornfloor = { draw: PATCH('interiorfloor', 16, 0) };
TILES.brickfloor = { draw: PATCH('interiorfloor', 0, 12) };
TILES.darkfloor = { draw: PATCH('interiorfloor', 12, 12) };
TILES.jadefloor = { draw: PATCH('interiorfloor', 16, 6) };
// the city wall: pale stone with battlements, drawn to join its neighbours
TILES.rampart = { solid: true, draw(g, X, Y, n) {
  const same = (dx, dy) => n(dx, dy) === 'rampart' || n(dx, dy) === 'rgate';
  g.fillStyle = '#2a2026'; g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#c8a878'; g.fillRect(1, 1, 14, 14);
  g.fillStyle = '#e6c898'; g.fillRect(1, 1, 14, 2);
  g.fillStyle = '#a88858'; for (let y = 5; y < 15; y += 4) for (let x = (y % 8 ? 2 : 6); x < 15; x += 8) g.fillRect(x, y, 5, 1);
  g.fillStyle = '#8a6a48'; g.fillRect(1, 14, 14, 1);
  if (same(-1, 0)) { g.fillStyle = '#c8a878'; g.fillRect(0, 1, 2, 14); g.fillStyle = '#e6c898'; g.fillRect(0, 1, 2, 2); }
  if (same(1, 0)) { g.fillStyle = '#c8a878'; g.fillRect(14, 1, 2, 14); g.fillStyle = '#e6c898'; g.fillRect(14, 1, 2, 2); }
  if (same(0, -1)) { g.fillStyle = '#c8a878'; g.fillRect(1, 0, 14, 2); }
  if (same(0, 1)) { g.fillStyle = '#c8a878'; g.fillRect(1, 14, 14, 2); }
  // battlements along the top when the wall runs across
  if (!same(0, -1)) { g.fillStyle = '#2a2026'; for (let x = 2; x < 14; x += 5) g.fillRect(x, 0, 3, 1); }
} };
TILES.rgate = { draw(g) { g.fillStyle = '#5a4030'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#7a5a40'; for (let y = 0; y < 16; y += 4) g.fillRect(0, y, 16, 2); } };
TILES.carpet = { draw(g, X, Y, n) {
  g.fillStyle = '#9a2418'; g.fillRect(0, 0, 16, 16);
  const edge = (dx, dy) => n(dx, dy) !== 'carpet';
  g.fillStyle = '#e0b858';
  if (edge(-1, 0)) g.fillRect(1, 0, 1, 16); if (edge(1, 0)) g.fillRect(14, 0, 1, 16); if (edge(0, -1)) g.fillRect(0, 1, 16, 1); if (edge(0, 1)) g.fillRect(0, 14, 16, 1);
  g.fillStyle = '#b83a28'; if ((X + Y) % 2) g.fillRect(6, 6, 4, 4);
} };
TILES.cavefloor = { draw(g, X, Y) { g.drawImage(tileset('interiorfloor'), 12 * 16, 13 * 16, 16, 16, 0, 0, 16, 16); g.fillStyle = 'rgba(30,20,10,0.35)'; g.fillRect(0, 0, 16, 16); if (hash(X, Y, 3) < 0.15) { g.fillStyle = '#5a4a40'; g.fillRect(4 + (X % 5), 6, 3, 2); } } };
TILES.cavewall = { solid: true, draw(g, X, Y, n) {
  const open = (dx, dy) => { const k = n(dx, dy); return k && k !== 'cavewall'; };
  g.fillStyle = '#14100e'; g.fillRect(0, 0, 16, 16);
  if (open(0, 1)) { g.fillStyle = '#4a3a30'; g.fillRect(0, 4, 16, 12); g.fillStyle = '#6a5444'; g.fillRect(0, 4, 16, 2); g.fillStyle = '#3a2c24'; for (let x = (X * 5) % 6; x < 16; x += 6) g.fillRect(x, 7, 1, 8); }
  else if (open(0, -1) || open(1, 0) || open(-1, 0)) { g.fillStyle = '#2a201a'; g.fillRect(0, 0, 16, 16); }
} };
TILES.deck = { draw(g, X, Y) { g.fillStyle = '#7e5230'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#5a3820'; g.fillRect(0, 7, 16, 1); g.fillRect(0, 15, 16, 1); g.fillRect((X * 7) % 16, 0, 1, 7); g.fillRect((X * 7 + 8) % 16, 8, 1, 7); } };
TILES.blackstone = { draw(g, X, Y) { g.fillStyle = '#2a2230'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#3a3044'; g.fillRect(1, 1, 14, 14); g.fillStyle = '#4a3c56'; g.fillRect(1, 1, 14, 1); if ((X + Y) % 3 === 0) { g.fillStyle = '#6a2a6a'; g.fillRect(7, 7, 2, 2); } } };
TILES.lotuswall = { solid: true, draw(g, X, Y, n) { const open = n(0, 1) && n(0, 1) !== 'lotuswall'; g.fillStyle = '#100a14'; g.fillRect(0, 0, 16, 16); if (open) { g.fillStyle = '#3a2440'; g.fillRect(0, 3, 16, 13); g.fillStyle = '#5a3a64'; g.fillRect(0, 3, 16, 2); g.fillStyle = '#8a3a8a'; if (X % 3 === 0) { g.fillRect(6, 8, 4, 4); g.fillStyle = '#d0a0e0'; g.fillRect(7, 9, 2, 2); } } } };

// ---------- building blocks ----------
export function canvasMap(w, h, fill) {
  const g = Array.from({ length: h }, () => Array(w).fill(fill));
  const b = {
    g, w, h,
    set(x, y, c) { if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; },
    get(x, y) { return x >= 0 && y >= 0 && x < w && y < h ? g[y][x] : null; },
    rect(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) b.set(x + i, y + j, c); },
    road(pts, c = 'path') { for (let i = 0; i + 1 < pts.length; i++) { let [x, y] = pts[i]; const [tx, ty] = pts[i + 1]; for (;;) { b.set(x, y, c); if (x === tx && y === ty) break; if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y); } } },
    room(x, y, rw, rh, wall, floor) { b.rect(x, y, rw, rh, wall); b.rect(x + 1, y + 1, rw - 2, rh - 2, floor); },
  };
  return b;
}
function finish(b, meta) {
  return { w: b.w, h: b.h, kinds: b.g, kindAt: (x, y) => b.g[y][x], ents: meta.ents || [], ...meta };
}
// [tileset, x, y, w, h, { door: column you walk in by, foot: rows from the bottom that are solid }]
export const OBJ = {
  house: ['house', 0, 0, 4, 3, { door: 1 }], cottage: ['house', 4, 0, 4, 3, { door: 1 }], farmhouse: ['house', 8, 0, 4, 3, { door: 1 }], redhall: ['house', 12, 0, 4, 3, { door: 1 }],
  shop: ['house', 16, 0, 3, 3, { door: 1 }], inn: ['house', 19, 0, 4, 3, { door: 2 }], hut: ['house', 23, 0, 3, 3, { door: 1 }], lodge: ['house', 26, 0, 3, 3, { door: 1 }],
  torii: ['house', 0, 5, 3, 2, { posts: true }], cavemouth: ['house', 0, 7, 3, 3, { door: 1 }], straw: ['house', 3, 7, 3, 3, { door: 1 }],
  keep: ['house', 25, 7, 4, 7, { door: 1 }], greathall: ['house', 25, 14, 4, 5, { door: 1 }], tower: ['house', 30, 4, 3, 4, { door: 1 }],
  tree: ['nature', 16, 0, 2, 2], tree2: ['nature', 18, 0, 2, 2], blossom: ['nature', 14, 0, 2, 2], pine: ['nature', 2, 0, 2, 2], oak: ['nature', 6, 0, 2, 2],
  grove: ['nature', 4, 2, 4, 3], pinegrove: ['nature', 0, 2, 4, 3], bigtree: ['nature', 3, 18, 3, 3], deadtree: ['nature', 4, 0, 2, 2], bamboo: ['nature', 11, 8, 1, 3],
  boulder: ['nature', 13, 8, 2, 2, { foot: 2 }], greyrock: ['nature', 16, 8, 2, 2, { foot: 2 }], stump: ['nature', 0, 8, 2, 2, { foot: 2 }],
  stall: ['desert', 2, 10, 2, 2, { foot: 1 }], stall2: ['desert', 4, 10, 2, 2, { foot: 1 }], stall3: ['desert', 6, 7, 2, 2, { foot: 1 }], well: ['desert', 0, 3, 2, 2, { foot: 1 }],
  lantern: ['element', 6, 3, 1, 2], barrel: ['element', 1, 0, 1, 1], crate: ['element', 0, 0, 1, 1], cart: ['element', 0, 3, 2, 2, { foot: 1 }],
  statue: ['house', 1, 15, 2, 3, { foot: 2 }], lion: ['house', 2, 16, 2, 2, { foot: 1 }],
  // furniture
  counter: ['house', 16, 16, 2, 1, { foot: 1 }], counter2: ['house', 18, 16, 2, 1, { foot: 1 }], shelf: ['house', 16, 18, 1, 2, { foot: 1 }], bench: ['house', 18, 18, 2, 1, { foot: 1 }],
  screen: ['house', 22, 16, 2, 2, { foot: 1 }], jars: ['house', 16, 20, 1, 1, { foot: 1 }], pots: ['house', 18, 20, 1, 1, { foot: 1 }], baskets: ['house', 16, 12, 2, 1, { foot: 1 }],
  barrels: ['house', 16, 14, 2, 1, { foot: 1 }], goods: ['house', 18, 14, 2, 1, { foot: 1 }], potions: ['house', 20, 14, 1, 2, { foot: 1 }], desk: ['house', 30, 8, 2, 1, { foot: 1 }],
  tent: ['camp', 4, 0, 3, 3, { foot: 2 }], tent2: ['camp', 7, 0, 3, 3, { foot: 2 }], campfire: ['camp', 8, 3, 2, 2, { foot: 1 }], firepit: ['camp', 10, 3, 2, 2, { foot: 2 }],
  table: ['house', 22, 6, 2, 2, { foot: 2 }], bed: ['house', 16, 6, 2, 2, { foot: 2 }], rack: ['house', 14, 10, 2, 2, { foot: 1 }],
  banner_r: ['house', 22, 20, 1, 2, { foot: 1 }], banner_red: ['house', 23, 20, 1, 2, { foot: 1 }], banner_g: ['house', 25, 20, 1, 2, { foot: 1 }], banner_p: ['house', 27, 20, 1, 2, { foot: 1 }], banner_y: ['house', 28, 20, 1, 2, { foot: 1 }],
};
export function obj(m, name, x, y, extra = {}) {
  const [img, sx, sy, w, h, o = {}] = OBJ[name], by = y + h - 1, foot = o.foot || 1;
  const draw = (g, X, Y) => g.drawImage(tileset(img), sx * 16, sy * 16, w * 16, h * 16, X, Y - (h - 1) * 16, w * 16, h * 16);
  m.ents.push({ type: 'sprite', x, y: by, solid: true, draw, cond: extra.cond, obj: name });
  for (let j = 0; j < (o.door !== undefined ? h : foot); j++) for (let i = 0; i < w; i++) {
    const tx = x + i, ty = by - j;
    if (tx === x && ty === by) continue;
    if (o.door !== undefined && j === 0 && i === o.door) continue;
    if (o.posts && j === 0 && i === 1) continue;
    m.ents.push({ type: 'solid', x: tx, y: ty, cond: extra.cond });
  }
  return o.door !== undefined ? [x + o.door, by] : null;
}
// a procedurally drawn thing on one tile (throne, brazier, chest...) with optional talk
function thing(m, x, y, draw, o = {}) { m.ents.push({ type: 'sprite', x, y, solid: o.solid !== false, draw, talk: o.talk }); }
const throne = (g, X, Y) => { g.fillStyle = '#2a1408'; g.fillRect(X + 1, Y - 10, 14, 26); g.fillStyle = '#b8862e'; g.fillRect(X + 2, Y - 9, 12, 24); g.fillStyle = '#e0b858'; g.fillRect(X + 2, Y - 9, 12, 2); g.fillStyle = '#9a2418'; g.fillRect(X + 4, Y - 5, 8, 10); g.fillRect(X + 3, Y + 6, 10, 6); };
const brazier = (g, X, Y, f) => { g.fillStyle = '#3a2a20'; g.fillRect(X + 4, Y + 8, 8, 8); g.fillStyle = '#6a4a30'; g.fillRect(X + 3, Y + 6, 10, 3); g.fillStyle = (f >> 3) % 2 ? '#f8a030' : '#f8d050'; g.fillRect(X + 5, Y + 1, 6, 5); g.fillStyle = '#ffe890'; g.fillRect(X + 7, Y + 2, 2, 3); };
const pillar = (g, X, Y) => { g.fillStyle = '#4a0c08'; g.fillRect(X + 4, Y - 18, 8, 34); g.fillStyle = '#a8281c'; g.fillRect(X + 5, Y - 18, 6, 34); g.fillStyle = '#d84a30'; g.fillRect(X + 5, Y - 18, 2, 34); g.fillStyle = '#e0b858'; g.fillRect(X + 3, Y - 20, 10, 3); g.fillRect(X + 3, Y + 13, 10, 3); };
const sign = (label) => (g, X, Y) => { g.fillStyle = '#3a2410'; g.fillRect(X + 1, Y + 1, 14, 9); g.fillStyle = '#c89048'; g.fillRect(X + 2, Y + 2, 12, 7); g.fillStyle = '#3a2410'; g.fillRect(X + 7, Y + 10, 2, 6); void label; };

export const warp = (to, tx, ty, dir = 'd', extra = {}) => ({ type: 'warp', to, tx, ty, dir, ...extra });
export const npc = (id, look, talk, extra = {}) => ({ type: 'npc', id, look, talk, ...extra });

// ---------- people ----------
// townsfolk are dressed from a seed: plain clothes, no armour
const FOLK_COL = ['gray', 'slate', 'navy', 'forest', 'maroon', 'walnut', 'teal', 'charcoal', 'white', 'rose', 'sky', 'bluegray'];
export function folkLook(seed, kind = 'folk') {
  const r = (k) => hash(seed, k, 77);
  const p = (a, k) => a[Math.floor(r(k) * a.length)];
  const fem = kind === 'woman' || (kind === 'folk' && r(1) < 0.4), old = kind === 'elder' || r(2) < 0.15, child = kind === 'child';
  const hc = old ? p(['gray', 'white'], 3) : p(['black', 'black', 'raven', 'dark_brown', 'chestnut'], 3);
  let s = `b=${fem ? 'f' : 'm'} s=${p(['light', 'light', 'amber', 'olive', 'taupe'], 4)} hd=${fem ? (old ? 'fold' : 'f') : old ? 'old' : p(['m', 'm', 'plump', 'gaunt'], 5)} hc=${hc}`;
  s += ` h=${fem ? p(['bangs_bun', 'braid', 'halfup', 'long', 'ponytail'], 6) : p(['topknot', 'topknot_s', 'topknot_s2', 'messy', 'buzz', old ? 'balding' : 'plain'], 6)}`;
  if (!fem && (old || r(7) < 0.4)) s += ` bd=${p(['b_beard', 'b_medium', 'm_mustache', 'b_winter', 'm_walrus'], 8)}`;
  s += ` t=${kind === 'guard' ? 'tunic' : fem ? p(['kimono', 'blouse', 'kimono'], 9) : p(['tunic', 'kimono', 'long', 'kimono_split', 'robe'], 9)} tc=${kind === 'guard' ? 'red' : p(FOLK_COL, 10)}`;
  s += ` l=${fem && r(11) < 0.6 ? 'skirt' : p(['pants', 'wide', 'wide'], 11)} lc=${p(['brown', 'charcoal', 'black', 'tan', 'navy'], 12)} f=${p(['shoes', 'sandals', 'boots'], 13)} fc=${p(['brown', 'black'], 14)}`;
  if (kind === 'monk') s = `b=m s=light hd=old h=buzz hc=gray t=robe tc=orange l=wide lc=orange f=sandals fc=brown`;
  if (kind === 'merchant') s += ' belt=sash bc=gold';
  if (kind === 'sailor') s += ' hat=hb_bandana hatc=navy';
  void child;
  return s;
}

// ---------- the places ----------
const SIZES = { capital: [46, 34], castle: [40, 30], town: [32, 24], village: [30, 20], port: [32, 22], fort: [30, 22], temple: [30, 20], gate: [30, 17], cave: [30, 24], camp: [26, 20] };
// which shops each kind of place has
const SHOPS = { capital: ['inn', 'weapon', 'armour', 'item', 'book', 'tavern', 'horse', 'hall'], castle: ['inn', 'weapon', 'armour', 'item', 'tavern', 'hall', 'horse'], town: ['inn', 'weapon', 'item', 'tavern'], village: ['inn', 'item'], port: ['inn', 'item', 'tavern', 'dock'], fort: ['hall'], temple: ['shrine'], gate: ['inn'] };
export const ROLE_NAME = { inn: ['客棧', 'Inn'], weapon: ['武器店', 'Weapons'], armour: ['防具店', 'Armour'], item: ['道具店', 'Supplies'], book: ['書肆', 'Books'], tavern: ['酒館', 'Tavern'], horse: ['馬市', 'Horses'], hall: ['太守府', 'Governor\'s Hall'], shrine: ['廟堂', 'Shrine'], dock: ['碼頭', 'Docks'] };
const BUILDING = { inn: 'inn', weapon: 'shop', armour: 'shop', item: 'shop', book: 'redhall', tavern: 'lodge', horse: null, shrine: 'redhall', dock: null };
export const placeName = (id) => (PLACES[id] ? L(PLACES[id][0], PLACES[id][1]) : id);

// the outside of a place
function buildOutside(id, extraEnts) {
  const P = PLACES[id], kind = P[4];
  if (kind === 'cave') return buildCave(id, 1);
  const [W, H] = SIZES[kind] || SIZES.town;
  const seed = [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const R = (k) => hash(seed % 9973, k, 5);
  const ground = kind === 'temple' ? 'grass' : 'grass';
  const b = canvasMap(W, H, ground);
  const m = { ents: [] };
  const walled = kind === 'capital' || kind === 'castle' || kind === 'fort' || kind === 'gate';
  const cx = Math.floor(W / 2);
  // dark grass patches and flowers
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (hash(x, y, seed + 1) < 0.045) b.set(x, y, ['flower', 'flower2', 'clover', 'weed', 'weed'][Math.floor(hash(x, y, 9) * 5)]); }
  // walls with a gate in the south (and the north for gates)
  if (walled) {
    for (let x = 1; x < W - 1; x++) { b.set(x, 2, 'rampart'); b.set(x, H - 3, 'rampart'); }
    for (let y = 2; y < H - 2; y++) { b.set(1, y, 'rampart'); b.set(W - 2, y, 'rampart'); }
    for (let x = 1; x < W - 1; x++) for (let y = 0; y < 2; y++) b.set(x, y, 'dgrass');
    b.set(cx, H - 3, 'rgate'); b.set(cx - 1, H - 3, 'rgate');
    if (kind === 'gate') { b.set(cx, 2, 'rgate'); b.set(cx - 1, 2, 'rgate'); }
  }
  // streets: south gate to the north, and across
  const top = walled ? 4 : 2;
  b.road([[cx, H - 1], [cx, top + 2]]); b.road([[cx - 1, H - 1], [cx - 1, top + 2]]);
  const midY = Math.floor(H * 0.55);
  b.road([[walled ? 3 : 1, midY], [W - (walled ? 4 : 2), midY]]);
  if (kind === 'gate') { b.road([[cx, 0], [cx, H - 1]]); b.road([[cx - 1, 0], [cx - 1, H - 1]]); }
  // buildings on lots along the streets
  const roles = (SHOPS[kind] || []).slice();
  if (id === 'mashi' || id === 'wuwei' || id === 'tianshui') roles.push('horse');
  const lots = [];
  const x0 = walled ? 3 : 2, x1 = W - (walled ? 4 : 2);
  // north row, under the hall
  for (let x = x0; x + 4 <= x1; x += 5) lots.push([x, midY - 4]);
  for (let x = x0; x + 4 <= x1; x += 5) lots.push([x, midY + 2]);
  if (H > 26) for (let x = x0; x + 4 <= x1; x += 5) lots.push([x, H - 9]);
  const free = lots.filter(([x]) => x + 3 < cx - 1 || x > cx + 1);
  const doors = {};
  // the hall at the top of the main street
  if (roles.includes('hall')) {
    const hb = kind === 'fort' ? 'greathall' : 'keep';
    const d = obj(m, hb, cx - 2, top, {});
    doors.hall = d;
    for (const dx of [-4, 3]) thing(m, cx + dx, top + 5, brazier);
    if (kind !== 'fort') { obj(m, 'lion', cx - 5, top + 4); obj(m, 'lion', cx + 3, top + 4); }
    for (let y = top + 6; y < midY; y++) { b.set(cx, y, 'path'); b.set(cx - 1, y, 'path'); }
  }
  let li = 0;
  for (const role of roles) {
    if (role === 'hall') continue;
    if (role === 'dock') continue;
    if (role === 'horse') {
      // a paddock: fence posts round a patch of dirt, with horses
      const lot = free[li++]; if (!lot) break;
      b.rect(lot[0], lot[1], 4, 3, 'dpath');
      m.ents.push({ type: 'horsepen', x: lot[0] + 1, y: lot[1] + 1 });
      m.ents.push(npc('horse_' + id, folkLook(seed + 5, 'merchant'), 'shop_horse', { x: lot[0] + 3, y: lot[1] + 3, dir: 'd', role: 'horse' }));
      continue;
    }
    const lot = free[li++]; if (!lot) break;
    const bname = BUILDING[role] || 'house';
    const [ox, oy] = [lot[0], lot[1]];
    const d = obj(m, bname, ox, oy);
    if (d) { doors[role] = d; for (let y = d[1] + 1; y <= midY && y < d[1] + 4; y++) b.set(d[0], y, 'path'); for (let y = d[1] + 1; y >= midY && y > d[1] - 4; y--) b.set(d[0], y, 'path'); b.set(d[0], d[1] + 1, 'path'); }
    thing(m, ox + (bname === 'inn' ? 3 : 2), oy + 3, sign(role), { solid: true, talk: 'sign_' + role });
  }
  // homes in the remaining lots
  let hi = 0;
  for (; li < free.length; li++) {
    const [ox, oy] = free[li];
    if (kind === 'temple') { obj(m, R(42 + li) < 0.5 ? 'pine' : 'bamboo', ox + 1, oy + 1); if (R(43 + li) < 0.6) obj(m, 'bamboo', ox + 3, oy + 1); continue; }
    if (kind === 'fort' || kind === 'gate') { obj(m, R(44 + li) < 0.5 ? 'tent' : 'tent2', ox, oy); if (R(45 + li) < 0.5) obj(m, 'campfire', ox + 3, oy + 2); continue; }
    if (R(40 + li) < 0.15) { obj(m, R(41 + li) < 0.5 ? 'tree' : 'oak', ox + 1, oy + 1); continue; }
    const bname = kind === 'village' || kind === 'port' ? ['straw', 'hut', 'house'][Math.floor(R(50 + li) * 3)] : kind === 'capital' || kind === 'castle' ? ['house', 'farmhouse', 'redhall'][Math.floor(R(50 + li) * 3)] : ['house', 'cottage', 'farmhouse'][Math.floor(R(50 + li) * 3)];
    const d = obj(m, bname, ox, oy);
    if (d) { doors['house' + hi] = d; b.set(d[0], d[1] + 1, 'path'); hi++; }
  }
  // trees round the edge (outside the walls), a well, stalls in the market
  if (!walled) {
    for (let x = 0; x < W; x += 2) { if (Math.abs(x - cx) > 2 && R(x) < 0.7) obj(m, R(x + 100) < 0.5 ? 'tree' : 'tree2', x, 0); }
    for (let y = 3; y < H - 3; y += 3) { obj(m, 'tree', 0, y); obj(m, 'tree2', W - 2, y); }
  } else {
    for (let x = 2; x < W - 2; x += 3) if (Math.abs(x - cx) > 3) obj(m, 'tree2', x, 0);
  }
  if (kind !== 'temple' && kind !== 'gate') { obj(m, 'well', cx + 2, midY + 1); }
  // lanterns along the main street, barrels and crates by the shops, trees inside the walls
  const freeTile = (x, y) => b.get(x, y) && !['rampart', 'rgate', 'sea', 'plank', 'path'].includes(b.get(x, y)) && !m.ents.some((e) => (e.type === 'solid' || e.type === 'sprite') && e.x === x && Math.abs(e.y - y) <= 1);
  for (let y = midY + 2; y < H - 4; y += 4) for (const x of [cx - 2, cx + 1]) if (freeTile(x, y) && freeTile(x, y - 1)) obj(m, 'lantern', x, y - 1);
  for (const [role, d] of Object.entries(doors)) if (d && role !== 'hall' && !role.startsWith('house')) { const x = d[0] + 2, y = d[1]; if (freeTile(x, y)) obj(m, R(x * 3 + y) < 0.5 ? 'barrel' : 'crate', x, y); }
  if (walled) for (let x = 3; x < W - 4; x += 4) { if (Math.abs(x - cx) < 4) continue; if (freeTile(x, 3) && freeTile(x + 1, 3) && freeTile(x, 4) && freeTile(x + 1, 4) && R(300 + x) < 0.7) obj(m, R(301 + x) < 0.5 ? 'pine' : 'tree2', x, 3); }
  if (kind === 'capital' || kind === 'castle' || kind === 'port') { obj(m, 'stall', cx - 5, midY + 1); obj(m, 'stall2', cx + 4, midY - 2); }
  if (kind === 'port') {
    // docks along the bottom edge: water and a pier
    b.rect(0, H - 4, W, 4, 'sea'); b.rect(cx + 3, H - 6, 2, 5, 'plank'); b.rect(cx + 3, H - 6, 8, 1, 'plank');
    m.ents.push(npc('boatman_' + id, folkLook(seed + 9, 'sailor'), 'boatman', { x: cx + 5, y: H - 7, dir: 'd', role: 'dock' }));
    b.road([[cx, midY], [cx, H - 5]]);
  }
  if (kind === 'temple') {
    obj(m, 'torii', cx - 2, H - 7);
    const d = obj(m, 'redhall', cx - 2, 3); doors.shrine = d;
    for (const dx of [-5, 4]) obj(m, 'pine', cx + dx, 6);
    thing(m, cx - 4, 7, brazier); thing(m, cx + 3, 7, brazier);
  }
  // banners and guards at walled gates
  const exits = [];
  for (let x = cx - 1; x <= cx; x++) exits.push([x, H - 1]);
  if (kind === 'gate') for (let x = cx - 1; x <= cx; x++) exits.push([x, 0]);
  if (!walled) for (let y = 0; y < H; y++) { exits.push([0, y]); exits.push([W - 1, y]); }
  for (const [x, y] of exits) m.ents.push({ type: 'exit', x, y });
  if (walled) {
    obj(m, 'banner_red', cx - 3, H - 5); obj(m, 'banner_red', cx + 2, H - 5);
    m.ents.push(npc('guardL_' + id, folkLook(seed + 1, 'guard'), 'guard', { x: cx - 2, y: H - 4, dir: 'd', guard: true }), npc('guardR_' + id, folkLook(seed + 2, 'guard'), 'guard', { x: cx + 1, y: H - 4, dir: 'd', guard: true }));
  }
  // doors lead inside
  for (const [role, d] of Object.entries(doors)) if (d) m.ents.push({ ...warp(id + '/' + role, 0, 0, 'u', { inside: true }), x: d[0], y: d[1] });
  // townsfolk
  const nFolk = { capital: 9, castle: 8, town: 6, village: 5, port: 6, fort: 4, temple: 3, gate: 3, camp: 3 }[kind] || 4;
  for (let i = 0; i < nFolk; i++) {
    let x, y, t = 0;
    do { x = 2 + Math.floor(R(200 + i * 3 + t) * (W - 4)); y = top + 2 + Math.floor(R(201 + i * 3 + t) * (H - top - 5)); t++; } while ((b.get(x, y) === 'rampart' || b.get(x, y) === 'sea' || m.ents.some((e) => e.x === x && e.y === y)) && t < 40);
    const kindF = kind === 'fort' ? 'guard' : kind === 'temple' ? (i === 0 ? 'monk' : 'folk') : i % 5 === 4 ? 'elder' : 'folk';
    m.ents.push(npc(`folk${i}_${id}`, folkLook(seed + 20 + i, kindF), `folk:${id}:${i}`, { x, y, dir: 'd', wander: kindF !== 'guard' }));
  }
  if (extraEnts) extraEnts(m, b, { cx, H, W, midY, top, doors });
  return finish(b, { id, name: placeName(id), music: { capital: 'castle', castle: 'castle', fort: 'tension', temple: 'temple', cave: 'cave', village: 'village', port: 'harbor' }[kind] || 'town', safe: true, ents: m.ents, entry: [cx, H - 2, 'u'], kind, place: id });
}

// rooms
function buildRoom(id, role) {
  const P = PLACES[id], kind = P[4];
  const seed = [...(id + role)].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const sizes = { hall: [17, 13], inn: [12, 9], tavern: [13, 10], shrine: [13, 10], weapon: [10, 8], armour: [10, 8], item: [10, 8], book: [10, 8] };
  const [W, H] = sizes[role] || [9, 7];
  const b = canvasMap(W, H, 'iwall');
  const floor = role === 'hall' ? 'darkfloor' : role === 'shrine' ? 'jadefloor' : role === 'inn' || role === 'tavern' ? 'tanfloor' : role.startsWith('house') ? 'ornfloor' : 'brickfloor';
  b.room(0, 0, W, H, role === 'hall' ? 'owall' : 'iwall', floor);
  const cx = Math.floor(W / 2);
  b.set(cx, H - 1, floor);
  const m = { ents: [] };
  m.ents.push({ ...warp(id, 0, 0, 'd', { out: true }), x: cx, y: H - 1 });
  const keeper = (r, x, y, extra = {}) => m.ents.push(npc(`${r}_${id}`, folkLook(seed + 3, 'merchant'), 'shop_' + r, { x, y, dir: 'd', role: r, ...extra }));
  if (role === 'hall') {
    for (let y = 3; y < H - 1; y++) b.set(cx, y, 'carpet');
    for (const x of [cx - 1, cx + 1]) for (let y = 3; y < H - 1; y++) b.set(x, y, 'carpet');
    thing(m, cx, 2, throne);
    for (const y of [4, 8]) { thing(m, cx - 4, y, pillar); thing(m, cx + 4, y, pillar); }
    thing(m, 2, 2, brazier); thing(m, W - 3, 2, brazier);
    obj(m, 'banner_red', cx - 2, 1); obj(m, 'banner_red', cx + 2, 1);
    m.ents.push({ type: 'lordseat', x: cx, y: 3 });
  } else if (role === 'inn') {
    obj(m, 'counter', 2, 2); obj(m, 'bed', W - 4, 2); obj(m, 'bed', W - 4, 5); obj(m, 'jars', 1, 1);
    keeper('inn', 2, 1);
  } else if (role === 'tavern') {
    obj(m, 'table', 2, 4); obj(m, 'table', 8, 4); obj(m, 'barrels', 1, 1); obj(m, 'counter2', 5, 2); obj(m, 'jars', W - 2, 1);
    keeper('tavern', 6, 1);
    m.ents.push({ type: 'recruits', x: 0, y: 0 });
  } else if (role === 'shrine') {
    thing(m, cx, 2, (g, X, Y) => { g.fillStyle = '#3a2410'; g.fillRect(X - 6, Y + 4, 28, 10); g.fillStyle = '#b8862e'; g.fillRect(X - 5, Y + 5, 26, 8); g.fillStyle = '#e0b858'; g.fillRect(X + 4, Y - 6, 8, 12); });
    thing(m, cx - 3, 2, brazier); thing(m, cx + 3, 2, brazier);
    m.ents.push(npc(`monk_${id}`, folkLook(seed, 'monk'), 'shrine', { x: cx, y: 4, dir: 'd', role: 'shrine' }));
  } else if (!role.startsWith('house')) {
    obj(m, 'counter', cx - 1, 2);
    if (role === 'weapon') { obj(m, 'rack', 1, 1); obj(m, 'rack', W - 3, 1); }
    else if (role === 'armour') { obj(m, 'shelf', 1, 1); obj(m, 'shelf', W - 2, 1); obj(m, 'goods', 1, 4); }
    else if (role === 'book') { obj(m, 'shelf', 1, 1); obj(m, 'shelf', 2, 1); obj(m, 'shelf', W - 2, 1); obj(m, 'screen', W - 4, 4); }
    else { obj(m, 'potions', 1, 1); obj(m, 'baskets', W - 3, 1); obj(m, 'barrels', 1, 5); }
    keeper(role, cx, 1);
  }
  if (role.startsWith('house')) {
    obj(m, 'bed', 1, 1); obj(m, 'table', W - 3, 3); obj(m, 'jars', W - 2, 1);
    m.ents.push(npc(`home_${id}_${role}`, folkLook(seed + 11, hash(seed, 1, 2) < 0.5 ? 'woman' : 'elder'), `home:${id}:${role}`, { x: cx, y: 3, dir: 'd' }));
    if (hash(seed, 3, 4) < 0.45) m.ents.push({ type: 'chest', x: 1, y: H - 2, id: `${id}_${role}`, item: null });
  }
  return finish(b, { id: id + '/' + role, name: L(`${P[0]}・${ROLE_NAME[role] ? ROLE_NAME[role][0] : '民宅'}`, `${P[1]} - ${ROLE_NAME[role] ? ROLE_NAME[role][1] : 'House'}`), music: role === 'hall' ? 'castle' : role === 'shrine' ? 'temple' : null, safe: true, ents: m.ents, entry: [cx, H - 2, 'u'], kind: 'room', place: id, role, dark: false });
}

// caves: a few floors of winding tunnels with chests; armies lurk inside
function buildCave(id, floor) {
  const seed = ([...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0) + floor * 101;
  const W = 34, H = 26, b = canvasMap(W, H, 'cavewall');
  // carve rooms joined by tunnels
  const rooms = [];
  for (let i = 0; i < 8; i++) {
    const rw = 4 + Math.floor(hash(seed, i, 1) * 5), rh = 3 + Math.floor(hash(seed, i, 2) * 4);
    const x = 2 + Math.floor(hash(seed, i, 3) * (W - rw - 4)), y = 2 + Math.floor(hash(seed, i, 4) * (H - rh - 4));
    rooms.push([x, y, rw, rh]);
    b.rect(x, y, rw, rh, 'cavefloor');
  }
  rooms.sort((p, q) => p[0] - q[0]);
  for (let i = 0; i + 1 < rooms.length; i++) {
    const [ax, ay, aw, ah] = rooms[i], [bx, by, bw, bh] = rooms[i + 1];
    b.road([[ax + (aw >> 1), ay + (ah >> 1)], [bx + (bw >> 1), by + (bh >> 1)]], 'cavefloor');
  }
  const m = { ents: [] };
  const first = rooms[0], last = rooms[rooms.length - 1];
  const ex = [first[0] + 1, first[1] + first[2] - 1];
  // the way out (or up), and the way down
  const upX = first[0] + 1, upY = first[1] + 1;
  m.ents.push({ type: floor === 1 ? 'exit' : 'stairs', x: upX, y: upY, to: floor === 1 ? null : `${id}/f${floor - 1}`, up: true });
  const deep = (CAVE_FLOORS[id] || 2);
  if (id === 'wuxia') {
    // the Black Lotus Palace: every floor has its altar; the way down opens when the floor's envoy falls
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b.set(x, y, b.get(x, y) === 'cavewall' ? 'lotuswall' : 'blackstone');
    m.ents.push({ type: 'cavegoal', x: last[0] + (last[2] >> 1), y: last[1] + (last[3] >> 1), place: id });
    const need = { 1: 'won_lotus1', 2: 'won_lotus2' }[floor];
    if (floor < deep) m.ents.push({ type: 'stairs', x: last[0] + last[2] - 1, y: last[1] + last[3] - 1, to: `${id}/f${floor + 1}`, cond: need ? (f) => !!f[need] : undefined });
  } else if (floor < deep) m.ents.push({ type: 'stairs', x: last[0] + last[2] - 2, y: last[1] + last[3] - 2, to: `${id}/f${floor + 1}` });
  else m.ents.push({ type: 'cavegoal', x: last[0] + (last[2] >> 1), y: last[1] + (last[3] >> 1), place: id });
  // chests
  for (let i = 1; i < rooms.length - 1; i += 2) { const r = rooms[i]; m.ents.push({ type: 'chest', x: r[0] + r[2] - 1, y: r[1], id: `${id}_f${floor}_${i}`, item: null }); }
  void ex;
  return finish(b, { id: floor === 1 ? id : `${id}/f${floor}`, name: L(`${PLACES[id][0]}・第${floor}層`, `${PLACES[id][1]} - Floor ${floor}`), music: id === 'wuxia' ? 'sect' : 'cave', safe: false, enc: true, ents: m.ents, entry: [upX, upY + 1, 'd'], kind: 'cave', place: id, dark: true, floor });
}
export const CAVE_FLOORS = { shanyue: 2, tianzhu: 2, jiuyi: 3, wuxia: 4 };

// story hooks may add people or things to a place: (id) -> fn(m, b, info)
export const EXTRA = {};
export function buildMap(mapId) {
  const [id, sub] = mapId.split('/');
  if (!PLACES[id]) return null;
  if (!sub) return buildOutside(id, EXTRA[id]);
  if (sub.startsWith('f')) return buildCave(id, +sub.slice(1));
  const r = buildRoom(id, sub);
  if (EXTRA[mapId]) EXTRA[mapId](r, null, {});
  return r;
}
export { canvas };
