// Drawing the world map. The ground is painted pixel by pixel from the tile kinds, looked up through a little
// wobble so coasts, deserts and snowfields have soft natural edges; shores get foam. Trees, hills, mountains,
// walls, bridges and places are sprites drawn on top. The map is drawn in 32x32-tile chunks, made when first
// seen and forgotten when far away.
import { canvas } from './gfx.js?v=9';
import { tileset, wsprite, WOBJ } from './assets.js?v=9';
import { WW, WH, K, PLACES, WATER, sceneOf } from './world.js?v=9';

export const CH = 16; // tiles per chunk side
let WD = null; // the generated world
const chunks = new Map();
export function setWorld(w) { WD = w; chunks.clear(); for (const k of Object.keys(overviews)) delete overviews[k]; buildTex(); }

// ---------- ground textures, cut from the Ninja Adventure floor sheet ----------
const G = { SEA: 0, SHOAL: 1, RIVER: 2, GRASS: 3, DGRASS: 4, STEPPE: 5, SAND: 6, DESERT: 7, DUNE: 8, SNOW: 9, MARSH: 10, FARM: 11, ROCK: 12 };
const TEX = {}; // class -> [Uint8ClampedArray of 16x16 RGBA] variants
function cutTex(img, x, y) { const c = canvas(16, 16); c.x.drawImage(img, x * 16, y * 16, 16, 16, 0, 0, 16, 16); return c.x.getImageData(0, 0, 16, 16).data; }
function tinted(d, f) { const o = new Uint8ClampedArray(d); for (let i = 0; i < o.length; i += 4) { const [r, g, b] = f(o[i], o[i + 1], o[i + 2]); o[i] = r; o[i + 1] = g; o[i + 2] = b; o[i + 3] = 255; } return o; }
function flat(col, specks = [], seed = 1) {
  const o = new Uint8ClampedArray(16 * 16 * 4);
  for (let i = 0; i < 256; i++) { o[i * 4] = col[0]; o[i * 4 + 1] = col[1]; o[i * 4 + 2] = col[2]; o[i * 4 + 3] = 255; }
  let s = seed * 7919;
  for (const [c, n] of specks) for (let k = 0; k < n; k++) { s = (s * 1103515245 + 12345) & 0x7fffffff; const i = s % 256; o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; }
  return o;
}
function buildTex() {
  if (TEX.ready) return;
  const fl = tileset('floor');
  const grass = [cutTex(fl, 0, 12), cutTex(fl, 1, 12), cutTex(fl, 2, 12), cutTex(fl, 0, 12), cutTex(fl, 0, 12), cutTex(fl, 3, 12)];
  TEX[G.GRASS] = grass;
  TEX[G.DGRASS] = [cutTex(fl, 11, 12), cutTex(fl, 12, 12), cutTex(fl, 11, 12)];
  TEX[G.STEPPE] = grass.map((d) => tinted(d, (r, g, b) => [r * 0.9 + 40, g * 0.85 + 22, b * 0.6 + 10]));
  TEX[G.SAND] = [cutTex(fl, 1, 1)].map((d) => tinted(d, (r, g, b) => [Math.min(255, r * 0.95 + 14), Math.min(255, g * 0.98 + 18), Math.min(255, b + 30)]));
  TEX[G.DESERT] = [cutTex(fl, 1, 1)];
  TEX[G.DUNE] = TEX[G.DESERT].map((d) => tinted(d, (r, g, b) => [r * 0.92, g * 0.85, b * 0.75]));
  TEX[G.SNOW] = [cutTex(fl, 6, 18), cutTex(fl, 1, 18), cutTex(fl, 6, 18)];
  TEX[G.ROCK] = TEX[G.DESERT].map((d) => tinted(d, (r, g, b) => [r * 0.62 + 20, g * 0.6 + 18, b * 0.6 + 24]));
  TEX[G.MARSH] = TEX[G.DGRASS].map((d, k) => { const o = tinted(d, (r, g, b) => [r * 0.8, g * 0.85, b * 0.9 + 20]); for (let i = 0; i < 6; i++) { const p = ((k * 37 + i * 53) % 14 + 1) + ((k * 11 + i * 29) % 14 + 1) * 16; for (const q of [p, p + 1]) { o[q * 4] = 70; o[q * 4 + 1] = 140; o[q * 4 + 2] = 170; } } return o; });
  // farmland: rows of crops
  TEX[G.FARM] = [0, 1].map((v) => { const o = new Uint8ClampedArray(1024); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const i = (y * 16 + x) * 4, row = (v ? x : y) % 4; const c = row === 0 ? [150, 110, 60] : row === 1 ? [110, 160, 60] : row === 2 ? [140, 190, 70] : [120, 172, 64]; o[i] = c[0]; o[i + 1] = c[1]; o[i + 2] = c[2]; o[i + 3] = 255; } return o; });
  TEX[G.SEA] = [0, 1, 2].map((k) => flat([40, 104, 184], [[[52, 120, 200], 10], [[70, 140, 214], 3]], k + 1));
  TEX[G.SHOAL] = [0, 1, 2].map((k) => flat([58, 146, 210], [[[78, 166, 226], 10], [[150, 210, 240], 2]], k + 7));
  TEX[G.RIVER] = [0, 1].map((k) => flat([64, 156, 218], [[[90, 180, 232], 9], [[170, 220, 245], 2]], k + 13));
  TEX.ready = true;
}
// which ground each tile kind sits on
function groundOf(k, x, y) {
  switch (k) {
    case K.SEA: return G.SEA; case K.SHOAL: return G.SHOAL; case K.RIVER: case K.LAKE: case K.BRIDGE: case K.FERRY: return G.RIVER;
    case K.FOREST: case K.PINE: case K.PALM: case K.BAMBOO: return G.DGRASS; case K.STEPPE: return G.STEPPE; case K.DESERT: case K.DUNE: return G.DESERT;
    case K.SNOW: case K.SNOWMTN: return G.SNOW; case K.MARSH: return G.MARSH; case K.FARM: return G.FARM; case K.BEACH: return G.SAND;
    case K.MTN: return (x < 160 && y < 124) || y < 40 ? G.DESERT : G.ROCK;
    case K.HILL: case K.WALL: case K.ROAD: case K.PLACE: case K.GRASS: default:
      return (x < 156 && y < 120 && WD && neighbourDry(x, y)) ? G.DESERT : y < 44 && WD && neighbourDry(x, y) ? G.STEPPE : G.GRASS;
  }
}
function neighbourDry(x, y) {
  let n = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = kind(x + dx, y + dy); if (k === K.DESERT || k === K.DUNE || k === K.STEPPE) n++; }
  return n >= 2;
}
export function kind(x, y) { x = Math.max(0, Math.min(WW - 1, x)); y = Math.max(0, Math.min(WH - 1, y)); return WD.t[y * WW + x]; }
const isWaterG = (g) => g <= G.RIVER;

// a smooth wobble table for the edges
const WOB = (() => { const n = 64, a = new Float32Array(n * n * 2); let s = 12345; for (let i = 0; i < a.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; a[i] = (s / 0x7fffffff - 0.5); } return { n, a }; })();
function wob(px, py, c) {
  const n = WOB.n, fx = px / 11, fy = py / 11, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const at = (x, y) => WOB.a[(((y & (n - 1)) * n + (x & (n - 1))) * 2) + c];
  const a = at(x0, y0), b = at(x0 + 1, y0), d = at(x0, y0 + 1), e = at(x0 + 1, y0 + 1);
  return (a + (b - a) * tx) * (1 - ty) + (d + (e - d) * tx) * ty;
}

const hsh = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

function paintGround(c, cx, cy) {
  const S = CH * 16, id = c.x.createImageData(S, S), d = id.data;
  // ground classes of the chunk's tiles and a margin round them
  const M = 3, GW = CH + M * 2, gc = new Int8Array(GW * GW);
  for (let j = 0; j < GW; j++) for (let i = 0; i < GW; i++) { const tx = cx * CH + i - M, ty = cy * CH + j - M; gc[j * GW + i] = groundOf(kind(tx, ty), tx, ty); }
  const gAt = (tx, ty) => gc[(ty - cy * CH + M) * GW + (tx - cx * CH + M)];
  const ox = cx * S, oy = cy * S;
  // ground class of a pixel: the four tile centres round it vote, weighted by nearness; the weights are
  // nudged by smooth noise, so edges between kinds of ground run in soft natural curves
  const w4 = [0, 0, 0, 0], g4 = [0, 0, 0, 0];
  const cls = (gx, gy) => {
    const fx = gx / 16 - 0.5, fy = gy / 16 - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy);
    let tx = fx - x0 + wob(gx, gy, 0) * 0.7, ty = fy - y0 + wob(gx, gy, 1) * 0.7;
    tx = tx < 0 ? 0 : tx > 1 ? 1 : tx; ty = ty < 0 ? 0 : ty > 1 ? 1 : ty;
    g4[0] = gAt(x0, y0); g4[1] = gAt(x0 + 1, y0); g4[2] = gAt(x0, y0 + 1); g4[3] = gAt(x0 + 1, y0 + 1);
    if (g4[0] === g4[1] && g4[0] === g4[2] && g4[0] === g4[3]) return g4[0];
    w4[0] = (1 - tx) * (1 - ty); w4[1] = tx * (1 - ty); w4[2] = (1 - tx) * ty; w4[3] = tx * ty;
    let best = g4[0], bw = -1;
    for (let a = 0; a < 4; a++) { let s = 0; for (let b = 0; b < 4; b++) if (g4[b] === g4[a]) s += w4[b]; if (s > bw) { bw = s; best = g4[a]; } }
    return best;
  };
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const gx = ox + px, gy = oy + py;
    const g = cls(gx, gy);
    const tx = gx >> 4, ty = gy >> 4;
    const vars = TEX[g], v = vars[Math.floor(hsh(tx, ty, g) * vars.length)];
    const si = ((gy & 15) * 16 + (gx & 15)) * 4, di = (py * S + px) * 4;
    let r = v[si], gg = v[si + 1], b = v[si + 2];
    if (isWaterG(g)) {
      // foam at the shore, lighter water near it
      let shore = 0;
      if (!isWaterG(cls(gx + 2, gy)) || !isWaterG(cls(gx - 2, gy)) || !isWaterG(cls(gx, gy + 2)) || !isWaterG(cls(gx, gy - 2))) shore = 2;
      else if (!isWaterG(cls(gx + 5, gy)) || !isWaterG(cls(gx - 5, gy)) || !isWaterG(cls(gx, gy + 5)) || !isWaterG(cls(gx, gy - 5))) shore = 1;
      if (shore === 2) { r = 236; gg = 246; b = 252; } else if (shore === 1) { r = Math.min(255, r + 34); gg = Math.min(255, gg + 36); b = Math.min(255, b + 22); }
    } else if (isWaterG(cls(gx + 1, gy)) || isWaterG(cls(gx - 1, gy)) || isWaterG(cls(gx, gy + 1)) || isWaterG(cls(gx, gy - 1))) { r *= 0.72; gg *= 0.72; b *= 0.72; }
    d[di] = r; d[di + 1] = gg; d[di + 2] = b; d[di + 3] = 255;
  }
  c.x.putImageData(id, 0, 0);
}

// ---------- things on top ----------
const roadish = (k) => k === K.ROAD || k === K.BRIDGE || k === K.FERRY || k === K.PLACE;
function drawRoad(g, X, Y, x, y, k) {
  const arms = [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([dx, dy]) => roadish(kind(x + dx, y + dy)));
  const dirt = '#c8a068', edge = '#9a7448';
  const W = 6, o = (16 - W) / 2;
  for (const pass of [edge, dirt]) {
    const e = pass === edge ? 1 : 0;
    g.fillStyle = pass;
    if (k !== K.PLACE) g.fillRect(X + o - e, Y + o - e, W + e * 2, W + e * 2);
    for (const [dx, dy] of arms) {
      if (dx) g.fillRect(dx > 0 ? X + 8 : X - 1, Y + o - e, 9, W + e * 2);
      else g.fillRect(X + o - e, dy > 0 ? Y + 8 : Y - 1, W + e * 2, 9);
    }
  }
  if (k === K.ROAD && hsh(x, y, 5) < 0.3) { g.fillStyle = '#a88050'; g.fillRect(X + o + 1 + Math.floor(hsh(x, y, 6) * 3), Y + o + 2, 1, 1); }
}
function drawBridge(g, X, Y, x, y) {
  const across = roadish(kind(x - 1, y)) || roadish(kind(x + 1, y)) ? 'h' : 'v';
  g.fillStyle = '#5a3a1e';
  if (across === 'h') { g.fillRect(X, Y + 4, 16, 9); g.fillStyle = '#a87a48'; for (let i = 0; i < 16; i += 3) g.fillRect(X + i, Y + 5, 2, 7); g.fillStyle = '#6a4424'; g.fillRect(X, Y + 4, 16, 1); g.fillRect(X, Y + 12, 16, 1); }
  else { g.fillRect(X + 4, Y, 9, 16); g.fillStyle = '#a87a48'; for (let i = 0; i < 16; i += 3) g.fillRect(X + 5, Y + i, 7, 2); g.fillStyle = '#6a4424'; g.fillRect(X + 4, Y, 1, 16); g.fillRect(X + 12, Y, 1, 16); }
}
function drawFerry(g, X, Y, x, y) {
  // a rope across the water and a little raft on it
  const h = roadish(kind(x - 1, y)) || roadish(kind(x + 1, y));
  g.fillStyle = '#e8dcc0';
  if (h) g.fillRect(X, Y + 7, 16, 1); else g.fillRect(X + 7, Y, 1, 16);
  if (hsh(x, y, 9) < 0.35) { g.fillStyle = '#6a4424'; g.fillRect(X + 3, Y + 5, 10, 6); g.fillStyle = '#a87a48'; g.fillRect(X + 4, Y + 6, 8, 3); }
}
function drawWall(g, X, Y, x, y) {
  const wall = (dx, dy) => kind(x + dx, y + dy) === K.WALL;
  g.fillStyle = '#3a3438';
  const seg = (rx, ry, rw, rh) => { g.fillStyle = '#3a3438'; g.fillRect(X + rx - 1, Y + ry - 1, rw + 2, rh + 2); g.fillStyle = '#a89c8a'; g.fillRect(X + rx, Y + ry, rw, rh); g.fillStyle = '#d0c6b0'; g.fillRect(X + rx, Y + ry, rw, 1); };
  seg(5, 4, 6, 7);
  if (wall(-1, 0)) seg(0, 5, 8, 5); if (wall(1, 0)) seg(8, 5, 8, 5); if (wall(0, -1)) seg(6, 0, 4, 8); if (wall(0, 1)) seg(6, 8, 4, 8);
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (wall(dx, dy) && !wall(dx, 0) && !wall(0, dy)) seg(dx < 0 ? 0 : 8, dy < 0 ? 0 : 8, 8, 8);
  g.fillStyle = '#d0c6b0'; for (let i = 1; i < 15; i += 3) if (hsh(x, y, i) < 0.8) g.fillRect(X + i, Y + 3, 1, 1);
}
const PLACE_SPRITE = { capital: 'capital', castle: 'castle', town: 'town', village: 'village', port: 'port', fort: 'town', gate: 'gate', cave: 'cave', temple: 'temple', camp: 'camp' };
function drawThing(g, X, Y, x, y, k) {
  const h = hsh(x, y, 21);
  switch (k) {
    case K.FOREST: {
      const south = y > 192, n = h < 0.5 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const name = !south && h < 0.18 ? 'autumn' : h > 0.97 ? 'blossom' : 'tree' + Math.floor(hsh(x, y, 22 + i) * 3);
        wsprite(g, name, X + 8 + (n > 1 ? (i ? 4 : -4) : 0) + Math.floor(hsh(x, y, 30 + i) * 3) - 1, Y + 16 - (n > 1 && i === 0 ? 2 : 0));
      }
      break;
    }
    case K.PINE: wsprite(g, 'pine' + Math.floor(h * 3), X + 8, Y + 16); break;
    case K.PALM: wsprite(g, 'palm' + Math.floor(h * 2), X + 8, Y + 16); break;
    case K.HILL: wsprite(g, (y < 60 || (x < 160 && y < 124) ? 'dryhill' + Math.floor(h * 2) : 'hill' + Math.floor(h * 3)), X + 8, Y + 16); break;
    case K.BAMBOO: drawBamboo(g, X, Y, x, y); break;
    case K.MTN: if (bigCovered(x, y)) { if (bigAnchor(x, y)) wsprite(g, hsh(x, y, 40) < 0.5 ? 'bigmtn2' : 'bigmtn', X + 16, Y + 32); break; } wsprite(g, (y > 236 && h < 0.5 ? 'greenmtn' + Math.floor(h * 4) % 2 : 'mtn' + Math.floor(h * 4)), X + 8, Y + 16); break;
    case K.SNOWMTN: wsprite(g, 'snowmtn' + Math.floor(h * 3), X + 8, Y + 16); break;
    case K.WALL: drawWall(g, X, Y, x, y); break;
    case K.BRIDGE: drawBridge(g, X, Y, x, y); break;
    case K.FERRY: drawFerry(g, X, Y, x, y); break;
    case K.DUNE: { g.fillStyle = '#d89a58'; const o = Math.floor(h * 6); g.fillRect(X + 2 + o, Y + 5, 7, 1); g.fillRect(X + 1, Y + 10 + (o % 3), 9, 1); g.fillStyle = '#fbe0a8'; g.fillRect(X + 3 + o, Y + 4, 5, 1); g.fillRect(X + 2, Y + 9 + (o % 3), 7, 1); break; }
    case K.DESERT: if (h < 0.06) { g.fillStyle = '#9a7a54'; g.fillRect(X + 5, Y + 9, 4, 3); g.fillStyle = '#c8a878'; g.fillRect(X + 5, Y + 9, 3, 1); } break;
    case K.MARSH: if (h < 0.6) { g.fillStyle = '#3e6a3a'; for (let i = 0; i < 3; i++) g.fillRect(X + 3 + i * 4, Y + 6 + (i % 2) * 3, 1, 4); } break;
    case K.PLACE: {
      const id = WD.placeAt[y * WW + x], p = PLACES[id];
      if (!p) break;
      const spr = PLACE_SPRITE[p[4]] || 'town', sc = sceneOf(id);
      if (p[4] === 'cave' || id === 'wuxia') { const c = caveMouth(id === 'wuxia' ? 'sect' : (sc && sc.theme) || 'rock'); g.drawImage(c, X + 8 - (c.width >> 1), Y + 17 - c.height); break; }
      if (SCENE_ART[p[4]]) { const c = sceneArt(p[4] === 'wild' ? 'wild_' + sc.theme : p[4]); g.drawImage(c, X + 8 - (c.width >> 1), Y + 17 - c.height); break; }
      if (sc && sc.t === 'isle') { wsprite(g, 'village', X + 8, Y + 16); drawBoat(g, X + 10, Y + 12); break; }
      if (sc && sc.theme === 'ferry') { wsprite(g, 'village', X + 6, Y + 16); drawBoat(g, X + 12, Y + 13); break; }
      if (spr === 'capital' || spr === 'castle') wsprite(g, spr, X + 8, Y + 18);
      else wsprite(g, spr, X + 8, Y + 16 + (spr === 'temple' ? 2 : 0));
      if (p[4] === 'fort') { wsprite(g, 'flag_red', X + 2, Y + 8); }
      if (p[4] === 'camp') { wsprite(g, 'flag_black', X + 13, Y + 8); }
      break;
    }
  }
}

// a cave's mouth on the world map: a rocky outcrop with a black arched opening under a pale stone lintel and a
// torch on either side, big enough to pick out among forests and mountains at a glance. The sect's palace in the
// Wu Gorge is the same in black rock, with a violet glow round the gate and a lotus above it.
const mouthCache = {};
// rock colours for each kind of cave: ordinary rock, the sect's black stone, pale limestone, wet sea rock,
// a miner's brown hillside, blue-white ice and black basalt
const CAVE_PAL = { rock: ['#1a1210', '#54473c', '#76685a', '#9a8a72', '#bcae92'], sect: ['#0e0812', '#2a2032', '#3e3248', '#584a64', '#76668a'], lime: ['#2a2620', '#8a8270', '#aaa290', '#c8c0aa', '#e4dcc4'],
  sea: ['#0c1418', '#2c4048', '#3e5660', '#587480', '#7a98a2'], mine: ['#1a100a', '#5a4028', '#785636', '#9a7248', '#b88c5a'], ice: ['#1a2a3a', '#7aa0c0', '#a0c4e0', '#c8e2f4', '#f0faff'], basalt: ['#08080a', '#26262c', '#36363e', '#4a4a54', '#62626e'] };
export function caveMouth(theme) {
  if (theme === true) theme = 'sect'; if (!theme) theme = 'rock';
  if (mouthCache[theme]) return mouthCache[theme];
  const sect = theme === 'sect';
  const Wd = 34, Ht = 28, c = canvas(Wd, Ht), g = c.x;
  const pal = CAVE_PAL[theme] || CAVE_PAL.rock;
  const blobs = [[17, 18, 16, 10], [9, 19, 9, 8], [25, 18, 9, 9], [15, 10, 9, 8], [22, 12, 6, 6]];
  const inRock = (x, y) => x >= 0 && y >= 0 && x < Wd && y < Ht && blobs.some(([bx, by, rx, ry]) => ((x + 0.5 - bx) / rx) ** 2 + ((y + 0.5 - by) / ry) ** 2 <= 1);
  const mouth = (x, y) => { const dx = x + 0.5 - 17; return y >= 20 ? Math.abs(dx) <= 6.5 : dx * dx / 42 + (y + 0.5 - 20) ** 2 / 36 <= 1; };
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  for (let y = 0; y < Ht; y++) for (let x = 0; x < Wd; x++) {
    if (!inRock(x, y)) { if (inRock(x + 1, y) || inRock(x - 1, y) || inRock(x, y + 1) || inRock(x, y - 1)) px(x, y, pal[0]); continue; }
    // light from the top left; cracks and speckles from a hash
    let k = 2;
    if (!inRock(x, y - 1) || !inRock(x, y - 2)) k = 4; else if (!inRock(x - 1, y) || !inRock(x - 2, y - 1)) k = 3;
    if (!inRock(x + 1, y) || !inRock(x + 2, y + 1) || y > Ht - 3) k = 1;
    const h = hsh(x, y, sect ? 77 : 71);
    if (h < 0.08) k = Math.max(1, k - 1); else if (h > 0.95) k = Math.min(4, k + 1);
    px(x, y, pal[k]);
  }
  // a few crevices between the boulders
  for (const [x0, y0, n] of [[8, 13, 4], [25, 10, 5], [13, 6, 3], [29, 17, 4]]) for (let i = 0; i < n; i++) if (inRock(x0 + (i >> 1), y0 + i)) px(x0 + (i >> 1), y0 + i, pal[1]);
  // basalt stands in columns
  if (theme === 'basalt') for (let x = 2; x < Wd - 2; x += 4) for (let y = 4; y < Ht - 2; y++) if (inRock(x, y)) px(x, y, pal[0]);
  // the mouth: a lintel of dressed stone round a black opening that fades in from the edge
  const rim = sect ? '#b070e0' : theme === 'ice' ? '#ffffff' : theme === 'sea' ? '#a8c8d0' : '#d8c8a4', rim2 = sect ? '#6a3a90' : theme === 'ice' ? '#a0c8e8' : theme === 'sea' ? '#587480' : '#9a8a6a';
  for (let y = 10; y < Ht; y++) for (let x = 8; x < 27; x++) {
    if (mouth(x, y)) { const edge = !mouth(x - 1, y) || !mouth(x + 1, y) || !mouth(x, y - 1); px(x, y, edge ? (sect ? '#2a0a3a' : '#2a1c16') : '#050304'); }
    else if (mouth(x - 1, y) || mouth(x + 1, y) || mouth(x, y + 1) || mouth(x - 1, y + 1) || mouth(x + 1, y + 1)) px(x, y, y < 18 ? rim : rim2);
  }
  // keystone
  g.fillStyle = rim; g.fillRect(16, 11, 3, 2); g.fillStyle = pal[0]; g.fillRect(16, 13, 3, 1);
  if (sect) {
    // a lotus over the gate, and the violet glow inside it
    g.fillStyle = '#e080f0'; g.fillRect(16, 5, 3, 4); g.fillRect(13, 7, 3, 2); g.fillRect(19, 7, 3, 2); g.fillStyle = '#ffd0ff'; g.fillRect(17, 6, 1, 2);
    g.fillStyle = 'rgba(176,80,230,0.45)'; g.fillRect(14, 22, 7, 6);
  }
  if (theme === 'mine') {
    // a miner's adit: a timber frame instead of dressed stone, and a cart of ore at the door
    g.fillStyle = '#3a2410'; g.fillRect(9, 12, 3, 16); g.fillRect(23, 12, 3, 16); g.fillRect(8, 11, 19, 3);
    g.fillStyle = '#8a5a30'; g.fillRect(10, 13, 1, 15); g.fillRect(24, 13, 1, 15); g.fillRect(9, 12, 17, 1);
    g.fillStyle = '#2a2a30'; g.fillRect(27, 22, 7, 4); g.fillStyle = '#c87830'; g.fillRect(28, 20, 5, 2); g.fillStyle = '#101010'; g.fillRect(28, 26, 2, 2); g.fillRect(31, 26, 2, 2);
  }
  if (theme === 'ice') { g.fillStyle = '#e8f8ff'; for (const ix of [10, 13, 18, 21, 24]) g.fillRect(ix, 13, 1, 2 + (ix % 3)); }
  if (theme === 'sea') { g.fillStyle = '#e8f4f8'; for (let x = 4; x < 31; x += 3) g.fillRect(x, Ht - 2 + (x % 2), 2, 1); }
  // torches either side: a post with a cup and a flame
  for (const tx of [3, 29]) {
    if (theme === 'mine' && tx === 29) continue;
    g.fillStyle = '#20140c'; g.fillRect(tx - 1, 15, 4, 13); g.fillStyle = '#6a4424'; g.fillRect(tx, 16, 2, 12); g.fillStyle = '#8a5a30'; g.fillRect(tx, 16, 1, 12);
    g.fillStyle = '#3a2a1a'; g.fillRect(tx - 1, 14, 4, 2);
    g.fillStyle = sect ? '#a040e0' : '#f07818'; g.fillRect(tx - 1, 9, 4, 5); g.fillStyle = sect ? '#e8a0ff' : '#ffd040'; g.fillRect(tx, 10, 2, 4); g.fillStyle = '#fffbe0'; g.fillRect(tx, 12, 1, 2);
  }
  mouthCache[theme] = c;
  return c;
}

// bamboo: a clump of tall jointed green stalks with leaves at the top
function drawBamboo(g, X, Y, x, y) {
  const n = 3 + Math.floor(hsh(x, y, 23) * 3);
  for (let i = 0; i < n; i++) {
    const bx = X + 2 + Math.floor(hsh(x, y, 24 + i) * 12), top = Y - 6 + Math.floor(hsh(x, y, 30 + i) * 6), h = Y + 15 - top;
    g.fillStyle = '#1e4a1c'; g.fillRect(bx - 1, top, 3, h);
    g.fillStyle = i % 2 ? '#5aa040' : '#78b848'; g.fillRect(bx, top, 1, h);
    g.fillStyle = '#2e6a2a'; for (let j = top + 4; j < Y + 14; j += 5) g.fillRect(bx - 1, j, 3, 1);
    g.fillStyle = '#4a9a3a'; g.fillRect(bx - 3, top + 1, 3, 1); g.fillRect(bx + 1, top + 3, 3, 1); g.fillRect(bx - 2, top + 6, 2, 1);
  }
}
// a little boat moored by a village on the water
function drawBoat(g, X, Y) { g.fillStyle = '#3a2410'; g.fillRect(X - 1, Y + 1, 10, 3); g.fillStyle = '#8a5a30'; g.fillRect(X, Y + 1, 8, 2); g.fillStyle = '#e8dcc0'; g.fillRect(X + 3, Y - 5, 1, 6); g.fillRect(X + 4, Y - 4, 3, 4); }
// the places to explore get their own pictures on the world map, drawn here in the same style as the cave mouth:
// a peak with a pavilion on its summit, a waterfall down a cliff, a grove's wooden gate, a hot spring's steam,
// a beacon tower, a lighthouse, a hermit's hut, old ruins
const SCENE_ART = { peak: 1, falls: 1, wild: 1, ruins: 1, spring: 1, tower: 1, lighthouse: 1, hut: 1 };
const artCache = {};
export function sceneArt(kind) {
  if (artCache[kind]) return artCache[kind];
  const Wd = 34, Ht = 34, c = canvas(Wd, Ht), g = c.x;
  const R = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const OUT = '#140c08';
  if (kind === 'peak') {
    // a tall peak, light from the left, snow on top and a red pavilion at the summit, a path winding up
    for (let y = 6; y < Ht; y++) { const half = Math.floor((y - 6) * 0.62) + 1; R(OUT, 17 - half - 1, y, half * 2 + 2, 1); R('#7a6a58', 17 - half, y, half, 1); R('#5a4c40', 17, y, half, 1); }
    for (let y = 6; y < 14; y++) { const half = Math.floor((y - 6) * 0.62) + 1; R('#f4f4f8', 17 - half, y, half, 1); R('#c8ccd8', 17, y, half, 1); }
    R('#c83020', 14, 1, 7, 2); R('#3a2410', 15, 3, 1, 3); R('#3a2410', 19, 3, 1, 3); R('#e0b858', 13, 0, 9, 1);
    g.fillStyle = '#d8b880'; for (const [x, y] of [[16, 15], [18, 17], [20, 19], [18, 21], [15, 23], [13, 25], [15, 27], [19, 29], [22, 31]]) g.fillRect(x, y, 2, 1);
  } else if (kind === 'falls') {
    // a grey cliff with a white stream falling into a pool, and mist
    R(OUT, 3, 2, 28, 24); R('#6a6670', 4, 3, 26, 22); R('#8a8690', 4, 3, 26, 3); R('#4a4650', 4, 20, 26, 5);
    g.fillStyle = '#5a5660'; for (const [x, y] of [[7, 9], [24, 12], [9, 16], [26, 7]]) g.fillRect(x, y, 3, 1);
    R('#2a5a3a', 4, 2, 7, 3); R('#2a5a3a', 23, 2, 8, 3);
    R('#3a80c8', 13, 3, 8, 24); R('#a8d8f8', 14, 3, 6, 24); R('#ffffff', 15, 3, 2, 24); R('#ffffff', 18, 6, 1, 18);
    R(OUT, 5, 26, 24, 7); R('#3a88d0', 6, 27, 22, 5); R('#78b8ec', 8, 27, 18, 1);
    g.fillStyle = 'rgba(255,255,255,0.75)'; for (const [x, y, w] of [[9, 25, 6], [19, 25, 6], [12, 28, 10]]) g.fillRect(x, y, w, 1);
  } else if (kind.startsWith('wild_')) {
    const th = kind.slice(5);
    if (th === 'bamboo') { for (const [bx, top] of [[4, 4], [8, 1], [12, 6], [23, 3], [27, 0], [30, 5]]) { R('#1e4a1c', bx - 1, top, 3, Ht - top); R('#78b848', bx, top, 1, Ht - top); R('#4a9a3a', bx - 3, top + 2, 3, 1); R('#4a9a3a', bx + 1, top + 4, 3, 1); } }
    if (th === 'marsh') { R('#2a4a3a', 0, 22, Ht, 12); R('#3a7a90', 2, 24, 30, 8); g.fillStyle = '#4a7a3a'; for (let x = 1; x < 33; x += 3) g.fillRect(x, 14 + (x * 7) % 8, 1, 12); g.fillStyle = '#c8b070'; for (let x = 2; x < 33; x += 6) g.fillRect(x, 13 + (x * 5) % 7, 2, 2); R('#8a5a30', 6, 28, 22, 2); }
    if (th === 'canyon') { for (let y = 0; y < Ht; y++) { const w = 9 + Math.round(Math.sin(y * 0.4) * 2); R(OUT, 0, y, w + 1, 1); R('#a86a40', 0, y, w, 1); R(OUT, Wd - w - 1, y, w + 1, 1); R('#8a5432', Wd - w, y, w, 1); } R('#c88a58', 2, 2, 4, Ht - 4); R('#d8c090', 13, 6, 8, Ht - 6); }
    // a wooden gate (a pailou) over the way in, so the entrance reads
    R(OUT, 10, 8, 3, 26); R(OUT, 21, 8, 3, 26); R('#8a3020', 11, 9, 1, 25); R('#8a3020', 22, 9, 1, 25);
    R(OUT, 7, 6, 20, 4); R('#b84030', 8, 7, 18, 2); R('#e0b858', 14, 7, 6, 2);
  } else if (kind === 'ruins') {
    // broken walls and a fallen pillar
    R(OUT, 2, 14, 12, 20); R('#9a9080', 3, 15, 10, 19); R('#b8ae9a', 3, 15, 10, 2); R(OUT, 3, 10, 4, 5); R('#9a9080', 4, 11, 2, 4);
    R(OUT, 18, 18, 14, 16); R('#8a8070', 19, 19, 12, 15); R('#b8ae9a', 19, 19, 12, 2); R(OUT, 26, 12, 5, 7); R('#8a8070', 27, 13, 3, 6);
    R(OUT, 8, 28, 16, 5); R('#c8bca4', 9, 29, 14, 3); g.fillStyle = '#4a7a3a'; for (const [x, y] of [[4, 22], [22, 25], [29, 30], [12, 30]]) g.fillRect(x, y, 2, 2);
  } else if (kind === 'spring') {
    // a steaming pool in a ring of stones, with a little roofed bench
    R(OUT, 4, 22, 26, 11); R('#9a9080', 5, 23, 24, 9); R('#3ab0c0', 7, 24, 20, 7); R('#a8e8f0', 9, 25, 16, 1);
    g.fillStyle = 'rgba(255,255,255,0.8)'; for (const [x, y] of [[10, 18], [12, 14], [17, 16], [19, 11], [23, 17], [22, 13]]) { g.fillRect(x, y, 3, 1); g.fillRect(x + 1, y - 1, 2, 1); }
    R(OUT, 24, 4, 10, 4); R('#a83a28', 25, 5, 8, 2); R('#3a2410', 26, 8, 1, 10); R('#3a2410', 31, 8, 1, 10);
  } else if (kind === 'tower') {
    // a beacon tower of stone with a fire and its smoke
    R(OUT, 10, 10, 14, 24); R('#a89c8a', 11, 11, 12, 23); R('#d0c6b0', 11, 11, 12, 2); g.fillStyle = '#7a7060'; for (let y = 15; y < 33; y += 4) g.fillRect(11, y, 12, 1);
    R(OUT, 9, 8, 16, 3); for (let x = 9; x < 25; x += 4) R('#a89c8a', x, 7, 2, 2);
    R('#f07818', 14, 3, 6, 5); R('#ffd040', 15, 4, 4, 4); R('#fffbe0', 16, 6, 2, 2);
    R('rgba(90,90,90,0.55)', 16, 0, 5, 3);
  } else if (kind === 'lighthouse') {
    // a white tower with red bands, a lamp room and its glow
    for (let y = 8; y < 34; y++) { const w = 6 + Math.floor((y - 8) / 6); R(OUT, Math.round(17 - w / 2) - 1, y, w + 2, 1); R((Math.floor((y - 8) / 6) % 2) ? '#c83020' : '#f0ece0', Math.round(17 - w / 2), y, w, 1); }
    R(OUT, 12, 3, 10, 6); R('#ffe890', 13, 4, 8, 4); R('#3a2a20', 11, 1, 12, 2);
    g.fillStyle = 'rgba(255,240,150,0.45)'; g.beginPath(); g.moveTo(17, 6); g.lineTo(0, 0); g.lineTo(0, 12); g.closePath(); g.fill(); g.beginPath(); g.moveTo(17, 6); g.lineTo(34, 0); g.lineTo(34, 12); g.closePath(); g.fill();
  } else if (kind === 'hut') {
    // a hermit's thatched hut under a pine, with smoke from the roof
    R('#1e3a24', 22, 2, 10, 20); R('#2e5a34', 23, 3, 8, 18); R('#4a2c18', 26, 20, 2, 12);
    R(OUT, 4, 16, 22, 4); R('#c8a058', 5, 15, 20, 5); R('#a8803e', 5, 19, 20, 1);
    R(OUT, 7, 20, 16, 13); R('#8a6a48', 8, 20, 14, 13); R('#2a1810', 13, 24, 5, 9); R('#ffe080', 18, 23, 3, 3);
    g.fillStyle = 'rgba(200,200,200,0.7)'; for (const [x, y] of [[9, 12], [8, 8], [10, 4]]) g.fillRect(x, y, 3, 2);
  }
  artCache[kind] = c;
  return c;
}
// marks for the minimap and the full map, by kind: a black mouth for caves, a diamond for temples, a bar for
// passes, a triangle for peaks, a blue drop for waterfalls, and so on. (g, place id, x, y, colour)
export function placeMark(g, id, x, y, col) {
  const p = PLACES[id]; if (!p) return;
  const k = p[4], sc = sceneOf(id), R = (c, a, b, w, h) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
  if (k === 'cave' || id === 'wuxia') { R(col, -2, -2, 5, 5); R(id === 'wuxia' ? '#40104a' : sc && sc.theme === 'ice' ? '#a0d0f0' : '#100808', -1, -1, 3, 3); }
  else if (k === 'temple') { R(col, 0, -2, 1, 5); R(col, -2, 0, 5, 1); R(col, -1, -1, 3, 3); }
  else if (k === 'gate') { R(col, -2, -1, 5, 3); R('#100808', 0, 0, 1, 2); }
  else if (k === 'peak') { R(col, 0, -2, 1, 1); R(col, -1, -1, 3, 1); R(col, -2, 0, 5, 2); R('#ffffff', 0, -2, 1, 1); }
  else if (k === 'falls') { R('#a8d8f8', 0, -2, 1, 3); R(col, -1, 1, 3, 2); }
  else if (k === 'wild') { R('#40a050', -2, -2, 5, 5); R(col, -1, -1, 3, 3); }
  else if (k === 'ruins') { R('#a89c8a', -2, -1, 2, 3); R('#a89c8a', 1, -2, 2, 4); R(col, -1, 1, 3, 1); }
  else if (k === 'tower' || k === 'lighthouse') { R(col, 0, -3, 1, 6); R(k === 'tower' ? '#ff8030' : '#fff0a0', -1, -3, 3, 1); }
  else if (k === 'camp') { R('#100808', -2, -2, 5, 5); R(col, -1, -1, 3, 3); }
  else if (k === 'spring') { R('#60d8e8', -2, -1, 5, 3); R('#ffffff', -1, -2, 1, 1); R('#ffffff', 1, -3, 1, 1); }
  else if (k === 'hut') { R(col, -2, 0, 5, 2); R('#c8a058', -1, -1, 3, 1); }
  else if (sc && sc.t === 'isle') { R('#80c0f0', -2, -2, 5, 5); R(col, -1, -1, 3, 3); }
  else R(col, -1, -1, 3, 3);
}
// pairs of pairs of mountain tiles sometimes make one big mountain
const isM = (x, y) => kind(x, y) === K.MTN;
function bigAnchor(x, y) { return !(x & 1) && !(y & 1) && isM(x, y) && isM(x + 1, y) && isM(x, y + 1) && isM(x + 1, y + 1) && hsh(x, y, 41) < 0.45; }
function bigCovered(x, y) { return bigAnchor(x & ~1, y & ~1); }
function makeChunk(cx, cy) {
  const S = CH * 16, c = canvas(S, S);
  paintGround(c, cx, cy);
  const g = c.x;
  // roads first (flat), then everything standing, row by row; things standing just below the chunk reach up into it
  for (let ty = cy * CH - 1; ty < cy * CH + CH + 1; ty++) for (let tx = cx * CH - 1; tx < cx * CH + CH + 1; tx++) {
    if (tx < 0 || ty < 0 || tx >= WW || ty >= WH) continue;
    const k = kind(tx, ty);
    if (k === K.ROAD || k === K.PLACE || k === K.BRIDGE || k === K.FERRY) drawRoad(g, (tx - cx * CH) * 16, (ty - cy * CH) * 16, tx, ty, k);
  }
  for (let ty = cy * CH - 1; ty < cy * CH + CH + 3; ty++) for (let tx = cx * CH - 2; tx < cx * CH + CH + 2; tx++) {
    if (tx < 0 || ty < 0 || tx >= WW || ty >= WH) continue;
    drawThing(g, (tx - cx * CH) * 16, (ty - cy * CH) * 16, tx, ty, kind(tx, ty));
  }
  return c;
}
// draw the part of the world seen from camera (camX, camY) in pixels
export function drawWorld(g, camX, camY, w, h) {
  const S = CH * 16;
  const c0 = Math.floor(camX / S), c1 = Math.floor((camX + w - 1) / S), r0 = Math.floor(camY / S), r1 = Math.floor((camY + h - 1) / S);
  let made = 0;
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    if (cx < 0 || cy < 0 || cx * CH >= WW || cy * CH >= WH) continue;
    const key = cy * 100 + cx;
    let ch = chunks.get(key);
    if (!ch) { ch = makeChunk(cx, cy); chunks.set(key, ch); made++; }
    else { chunks.delete(key); chunks.set(key, ch); }
    g.drawImage(ch, Math.round(cx * S - camX), Math.round(cy * S - camY));
  }
  // old chunks give their pixels back at once (iPhone and iPad cap the memory all canvases may use)
  while (chunks.size > 30) { const k = chunks.keys().next().value, old = chunks.get(k); chunks.delete(k); old.width = old.height = 0; }
  return made;
}
// keep the chunks round the camera ready ahead of time (one per call)
export function warmWorld(camX, camY, w, h) {
  const S = CH * 16;
  const cx0 = Math.floor((camX + w / 2) / S), cy0 = Math.floor((camY + h / 2) / S);
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const cx = cx0 + dx, cy = cy0 + dy;
    if (cx < 0 || cy < 0 || cx * CH >= WW || cy * CH >= WH) continue;
    const key = cy * 100 + cx;
    if (!chunks.has(key)) { chunks.set(key, makeChunk(cx, cy)); return true; }
  }
  return false;
}

// ---------- the whole map at a glance ----------
const MAPCOL = { [K.SEA]: [36, 84, 160], [K.SHOAL]: [54, 120, 190], [K.RIVER]: [70, 150, 220], [K.LAKE]: [70, 150, 220], [K.GRASS]: [104, 168, 72], [K.STEPPE]: [170, 176, 104],
  [K.FOREST]: [52, 120, 56], [K.PINE]: [40, 96, 64], [K.HILL]: [128, 150, 76], [K.MTN]: [128, 100, 82], [K.SNOWMTN]: [214, 222, 236], [K.DESERT]: [222, 192, 126], [K.DUNE]: [200, 164, 104],
  [K.SNOW]: [236, 240, 248], [K.MARSH]: [84, 128, 104], [K.ROAD]: [200, 160, 104], [K.BRIDGE]: [150, 100, 54], [K.FARM]: [150, 186, 84], [K.BEACH]: [234, 216, 160], [K.WALL]: [70, 64, 66],
  [K.PLACE]: [220, 60, 40], [K.FERRY]: [230, 210, 120], [K.PALM]: [60, 140, 70], [K.BAMBOO]: [84, 156, 60] };
const overviews = {};
// the whole map as a picture: scale 1 is a pixel a tile, 0.5 averages each 2 x 2 block (the realm at a glance)
export function overviewMap(scale = 1) {
  if (overviews[scale]) return overviews[scale];
  const w = Math.round(WW * scale), h = Math.round(WH * scale), c = canvas(w, h), id = c.x.createImageData(w, h), d = id.data;
  const colAt = (tx, ty) => { const k = WD.t[ty * WW + tx], col = MAPCOL[k] || [255, 0, 255], sh = (k === K.MTN || k === K.SNOWMTN) && ((tx + ty) % 3 === 0) ? 0.8 : 1; return [col[0] * sh, col[1] * sh, col[2] * sh, k]; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (scale >= 1) { const [r, g2, b] = colAt(Math.floor(x / scale), Math.floor(y / scale)); d[i] = r; d[i + 1] = g2; d[i + 2] = b; }
    else {
      // roads and walls win their block so they stay visible; otherwise the colours are averaged
      const n = Math.round(1 / scale); let r = 0, g2 = 0, b = 0, road = null;
      for (let j = 0; j < n; j++) for (let k2 = 0; k2 < n; k2++) { const c4 = colAt(x * n + k2, y * n + j); r += c4[0]; g2 += c4[1]; b += c4[2]; if (c4[3] === K.ROAD || c4[3] === K.WALL || c4[3] === K.BRIDGE) road = c4; }
      if (road) { d[i] = road[0]; d[i + 1] = road[1]; d[i + 2] = road[2]; } else { d[i] = r / (n * n); d[i + 1] = g2 / (n * n); d[i + 2] = b / (n * n); }
    }
    d[i + 3] = 255;
  }
  c.x.putImageData(id, 0, 0);
  c.s = scale; overviews[scale] = c;
  return c;
}
export { WATER };
