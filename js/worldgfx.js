// Drawing the world map. The ground is painted pixel by pixel from the tile kinds, looked up through a little
// wobble so coasts, deserts and snowfields have soft natural edges; shores get foam. Trees, hills, mountains,
// walls, bridges and places are sprites drawn on top. The map is drawn in 32x32-tile chunks, made when first
// seen and forgotten when far away.
import { canvas } from './gfx.js?v=3';
import { tileset, wsprite, WOBJ } from './assets.js?v=3';
import { WW, WH, K, PLACES, WATER } from './world.js?v=3';

export const CH = 16; // tiles per chunk side
let WD = null; // the generated world
const chunks = new Map();
export function setWorld(w) { WD = w; chunks.clear(); buildTex(); }

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
    case K.FOREST: case K.PINE: case K.PALM: return G.DGRASS; case K.STEPPE: return G.STEPPE; case K.DESERT: case K.DUNE: return G.DESERT;
    case K.SNOW: case K.SNOWMTN: return G.SNOW; case K.MARSH: return G.MARSH; case K.FARM: return G.FARM; case K.BEACH: return G.SAND;
    case K.MTN: return (x < 80 && y < 62) || y < 20 ? G.DESERT : G.ROCK;
    case K.HILL: case K.WALL: case K.ROAD: case K.PLACE: case K.GRASS: default:
      return (x < 78 && y < 60 && WD && neighbourDry(x, y)) ? G.DESERT : y < 22 && WD && neighbourDry(x, y) ? G.STEPPE : G.GRASS;
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
      const south = y > 96, n = h < 0.5 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const name = !south && h < 0.18 ? 'autumn' : h > 0.97 ? 'blossom' : 'tree' + Math.floor(hsh(x, y, 22 + i) * 3);
        wsprite(g, name, X + 8 + (n > 1 ? (i ? 4 : -4) : 0) + Math.floor(hsh(x, y, 30 + i) * 3) - 1, Y + 16 - (n > 1 && i === 0 ? 2 : 0));
      }
      break;
    }
    case K.PINE: wsprite(g, 'pine' + Math.floor(h * 3), X + 8, Y + 16); break;
    case K.PALM: wsprite(g, 'palm' + Math.floor(h * 2), X + 8, Y + 16); break;
    case K.HILL: wsprite(g, (y < 30 || (x < 80 && y < 62) ? 'dryhill' + Math.floor(h * 2) : 'hill' + Math.floor(h * 3)), X + 8, Y + 16); break;
    case K.MTN: if (bigCovered(x, y)) { if (bigAnchor(x, y)) wsprite(g, hsh(x, y, 40) < 0.5 ? 'bigmtn2' : 'bigmtn', X + 16, Y + 32); break; } wsprite(g, (y > 118 && h < 0.5 ? 'greenmtn' + Math.floor(h * 4) % 2 : 'mtn' + Math.floor(h * 4)), X + 8, Y + 16); break;
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
      const spr = PLACE_SPRITE[p[4]] || 'town';
      if (spr === 'capital' || spr === 'castle') wsprite(g, spr, X + 8, Y + 18);
      else wsprite(g, spr, X + 8, Y + 16 + (spr === 'temple' ? 2 : 0));
      if (p[4] === 'fort') { wsprite(g, 'flag_red', X + 2, Y + 8); }
      break;
    }
  }
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
  while (chunks.size > 30) chunks.delete(chunks.keys().next().value);
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
  [K.PLACE]: [220, 60, 40], [K.FERRY]: [230, 210, 120], [K.PALM]: [60, 140, 70] };
let overview = null;
export function overviewMap(scale = 2) {
  if (overview && overview.s === scale) return overview;
  const c = canvas(WW * scale, WH * scale), id = c.x.createImageData(WW * scale, WH * scale), d = id.data;
  for (let y = 0; y < WH * scale; y++) for (let x = 0; x < WW * scale; x++) {
    const k = WD.t[Math.floor(y / scale) * WW + Math.floor(x / scale)], col = MAPCOL[k] || [255, 0, 255], i = (y * WW * scale + x) * 4;
    const sh = (k === K.MTN || k === K.SNOWMTN) && ((x + y) % 3 === 0) ? 0.8 : 1;
    d[i] = col[0] * sh; d[i + 1] = col[1] * sh; d[i + 2] = col[2] * sh; d[i + 3] = 255;
  }
  c.x.putImageData(id, 0, 0);
  c.s = scale; overview = c;
  return c;
}
export { WATER };
