// Walking: the big world map (on foot, on horseback or by ship) and the towns, rooms and caves. The leader
// walks tile by tile; in towns the front-line generals follow in a line. Random battles come from the region
// you are in, at its own fixed strength.
import { ctx, W, H, canvas, text, textW, windowBox } from './gfx.js?v=6';
import { input, lastDevice } from './input.js?v=6';
import { sfx } from './audio.js?v=6';
import { UI } from './ui.js?v=6';
import { L } from './i18n.js?v=6';
import { IMG, tileset, WOBJ } from './assets.js?v=6';
import { generate, WW, WH, K, PLACES, REGIONS, walkable, sailable, DANGER, WATER } from './world.js?v=6';
import { setWorld, drawWorld, warmWorld, overviewMap, kind as wkind } from './worldgfx.js?v=6';
import { renderMap, solidKind, TILES } from './tiles.js?v=6';
import { buildMap, placeName } from './maps.js?v=6';
import { GENERALS, parseLook } from './generals.js?v=6';
import { fieldSheet } from './doll.js?v=6';
import { horseImg } from './horses.js?v=6';
import { ITEMS, gearFx } from './data.js?v=6';
import { S, member, hasSkill, troopsMax } from './state.js?v=6';

export const F = { mode: 'world', map: null, px: 0, py: 0, dir: 'd', moving: 0, frame: 0, enc: 0, encAt: 20, trail: [], banner: null, bannerT: 0, lockMsgT: 0, ents: [] };
export const FH = { talk: null, enterPlace: null, encounter: null, trigger: null, chest: null, blocked: null, onStep: null, exitPlace: null, stairs: null };
export let WD = null;
export function initWorld() { WD = generate(); setWorld(WD); return WD; }
const DIRV = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
const DROW = { u: 0, l: 1, d: 2, r: 3 };
const T = 16;
export const tileX = () => Math.round(F.px / T), tileY = () => Math.round(F.py / T);
export const regionAt = (x, y) => WD.rkeys[WD.region[y * WW + x]];

// ---------- entering and leaving ----------
export function toWorld(x, y, dir = 'd') {
  F.mode = 'world'; F.map = null; F.ents = [];
  F.px = x * T; F.py = y * T; F.dir = dir; F.moving = 0;
  S.pos = { map: 'world', x, y, dir };
  F.trail = [];
}
export function toMap(mapId, x, y, dir = 'd') {
  const m = buildMap(mapId);
  if (!m) return false;
  F.mode = 'local'; F.map = m; F.mapId = mapId;
  F.ents = m.ents.filter((e) => !e.cond || e.cond(S.flags));
  const before = F.ents.length;
  if (FH.populate) FH.populate(mapId, F.ents);
  // people placed by the story stand on the nearest free tile
  for (let i = before; i < F.ents.length; i++) { const e = F.ents[i]; const [fx, fy] = freeSpot(e.x, e.y, e); e.x = fx; e.y = fy; }
  for (const e of F.ents) if (e.type === 'npc') { e.hx = e.x; e.hy = e.y; e.px = e.x * T; e.py = e.y * T; e.dir = e.dir || 'd'; e.wt = Math.floor(Math.random() * 120); }
  if (x == null) [x, y, dir] = m.entry;
  F.px = x * T; F.py = y * T; F.dir = dir; F.moving = 0;
  F.render = renderLocal(m);
  S.pos = { map: mapId, x, y, dir };
  F.trail = [];
  return true;
}
// the ground of a local map, drawn once
function renderLocal(m) {
  const c = canvas(m.w * T, m.h * T), t = canvas(T, T);
  const at = (x, y) => m.kinds[Math.max(0, Math.min(m.h - 1, y))][Math.max(0, Math.min(m.w - 1, x))];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const k = m.kinds[y][x], def = TILES[k];
    if (!def) continue;
    t.x.clearRect(0, 0, T, T);
    def.draw(t.x, x, y, (dx, dy) => at(x + dx, y + dy), 0);
    c.x.drawImage(t, x * T, y * T);
  }
  return { frames: [c] };
}
// ---------- what is solid ----------
function solidLocal(x, y, self) {
  const m = F.map;
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return !exitAt(x, y);
  const k = m.kinds[y][x];
  if (TILES[k] && TILES[k].solid) return true;
  for (const e of F.ents) {
    if (e === self) continue;
    if ((e.type === 'solid' || e.type === 'sprite') && e.solid !== false && e.x === x && e.y === y) return true;
    if (e.type === 'npc' && Math.round(e.px / T) === x && Math.round(e.py / T) === y) return true;
    if (e.type === 'chest' && e.x === x && e.y === y) return true;
    if (e.type === 'horsepen' && x >= e.x - 1 && x <= e.x + 2 && y >= e.y - 1 && y <= e.y + 1) return true;
  }
  return false;
}
export function freeSpot(x, y, self) {
  const m = F.map;
  const ok = (X, Y) => X > 0 && Y > 0 && X < m.w - 1 && Y < m.h - 1 && !solidLocal(X, Y, self) && !F.ents.some((o) => o !== self && (o.type === 'warp' || o.type === 'exit' || o.type === 'stairs') && o.x === X && o.y === Y);
  if (ok(x, y)) return [x, y];
  for (let r = 1; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && ok(x + dx, y + dy)) return [x + dx, y + dy];
  return [x, y];
}
function exitAt(x, y) { return F.mode === 'local' && (x < 0 || y < 0 || x >= F.map.w || y >= F.map.h || F.ents.some((e) => e.type === 'exit' && e.x === x && e.y === y)); }
function regionOpen(x, y) { const r = REGIONS[regionAt(x, y)]; return !r || r[4] <= S.chapter || S.flags['open_' + regionAt(x, y)]; }
function worldBlocked(x, y) {
  if (x < 0 || y < 0 || x >= WW || y >= WH) return true;
  const k = WD.t[y * WW + x];
  if (S.vehicle === 'ship') return !(sailable(k) || walkable(k));
  return !walkable(k);
}

// ---------- update ----------
export function fieldUpdate() {
  F.frame++;
  if (F.bannerT > 0) F.bannerT--;
  if (F.lockMsgT > 0) F.lockMsgT--;
  if (F.mode === 'local') updateNpcs();
  // keep walking without a pause between tiles: when a step ends and nothing happened, read the pad at once
  if (F.moving) { stepOn(); if (F.moving || F.busy || UI.active) return; }
  if (UI.active || F.busy) return;
  const d = input.dir();
  if (input.pressed('a')) { interact(); return; }
  if (input.pressed('menu') && FH.menu) { FH.menu(); return; }
  if (input.pressed('map') && F.mode === 'world' && FH.fullmap) { FH.fullmap(); return; }
  if (!d) return;
  const dk = { up: 'u', down: 'd', left: 'l', right: 'r' }[d];
  F.dir = dk;
  const [dx, dy] = DIRV[dk], tx = tileX() + dx, ty = tileY() + dy;
  if (F.mode === 'world') {
    if (tx < 0 || ty < 0 || tx >= WW || ty >= WH) return;
    const k = WD.t[ty * WW + tx];
    if (!regionOpen(tx, ty)) { if (!F.lockMsgT) { F.lockMsgT = 90; if (FH.blocked) FH.blocked(regionAt(tx, ty)); } return; }
    if (S.vehicle === 'ship') {
      if (!sailable(k) || k === K.PLACE) {
        // landing: step onto the shore, the ship waits
        if (walkable(k)) { S.ship = { x: tileX(), y: tileY() }; S.vehicle = S.horse ? 'horse' : 'foot'; F.trail = []; sfx('step'); begin(dk); return; }
        sfx('bump'); return;
      }
      begin(dk); return;
    }
    // boarding the ship from the shore
    if (S.ship && S.ship.x === tx && S.ship.y === ty) { S.vehicle = 'ship'; S.ship = null; F.trail = []; sfx('door'); begin(dk); return; }
    if (worldBlocked(tx, ty)) { return; }
    begin(dk); return;
  }
  // local maps
  if (exitAt(tx, ty)) { if (FH.exitPlace) FH.exitPlace(); return; }
  if (solidLocal(tx, ty)) return;
  begin(dk);
}
function begin(dk) { F.moving = 1; F.mdir = dk; F.from = [F.px, F.py]; F.trail.unshift([tileX(), tileY(), dk]); if (F.trail.length > 8) F.trail.pop(); }
// whole pixels a tick that divide a tile, so every step is even
// run: Shift, or on a touch screen hold B (there is no Shift there)
const running = () => input.held('run') || (lastDevice === 'touch' && input.held('b'));
function speed() { if (F.mode === 'local') return running() ? 4 : 2; if (S.vehicle === 'ship') return 4; if (S.vehicle === 'horse' || S.horse) return 4; return running() ? 4 : 2; }
function stepOn() {
  const [dx, dy] = DIRV[F.mdir], sp = speed();
  F.px += dx * sp; F.py += dy * sp;
  const tx0 = F.from[0] + dx * T, ty0 = F.from[1] + dy * T;
  if ((dx && (dx > 0 ? F.px >= tx0 : F.px <= tx0)) || (dy && (dy > 0 ? F.py >= ty0 : F.py <= ty0))) {
    F.px = tx0; F.py = ty0; F.moving = 0;
    arrived();
  }
}
function arrived() {
  const x = tileX(), y = tileY();
  S.steps++;
  if (F.mode === 'world') {
    S.pos = { map: 'world', x, y, dir: F.dir };
    if (S.vehicle !== 'ship') {
      // walking slowly heals generals who farm as they go
      if (S.steps % 8 === 0) for (const id of S.front) { const m = member(id); if (m && m.troops > 0 && hasSkill(m, 'tuntian')) m.troops = Math.min(troopsMax(m), m.troops + Math.ceil(troopsMax(m) * 0.02)); }
    }
    const k = WD.t[y * WW + x];
    if (k === K.PLACE) { const id = WD.placeAt[y * WW + x]; if (id && FH.enterPlace) { FH.enterPlace(id); return; } }
    if (FH.onStep && FH.onStep(x, y)) return;
    encounterTick(k, x, y);
    return;
  }
  S.pos = { map: F.mapId, x, y, dir: F.dir };
  for (const e of F.ents) {
    if (e.x !== x || e.y !== y) continue;
    if (e.type === 'warp' && FH.warp) { FH.warp(e); return; }
    if (e.type === 'stairs' && FH.stairs) { FH.stairs(e); return; }
    if (e.type === 'exit' && FH.exitPlace) { FH.exitPlace(); return; }
    if (e.type === 'trigger' && FH.trigger && (!e.once || !S.flags[e.once])) { FH.trigger(e); return; }
  }
  if (F.map.enc) encounterTick(K.GRASS, x, y, true);
}
function encounterTick(k, x, y, inside = false) {
  if (S.flags.noEnc) return;
  let d = DANGER[k] ?? 1;
  if (S.vehicle === 'horse' || S.horse) d *= 0.8;
  if (S.repel > 0) { S.repel--; d *= 0.2; if (S.repel === 0 && FH.note) FH.note(L('隱蹤香的效力消失了。', 'The hiding incense wears off.')); }
  if (S.front.some((id) => member(id) && hasSkill(member(id), 'chihou'))) d *= 0.75;
  if (S.front.some((id) => member(id) && gearFx(member(id).equip).scout)) d *= 0.85;
  F.enc += d;
  if (F.enc >= F.encAt) {
    F.enc = 0; F.encAt = 16 + Math.floor(Math.random() * 22);
    if (FH.encounter) FH.encounter(inside ? { place: F.map.place, cave: true } : { region: regionAt(x, y), tile: k, naval: S.vehicle === 'ship' });
  }
}
function facing() { const [dx, dy] = DIRV[F.dir]; return [tileX() + dx, tileY() + dy]; }
function interact() {
  if (F.mode !== 'local') return;
  let [fx, fy] = facing();
  // across a counter
  const at = (x, y) => F.ents.find((e) => (e.type === 'npc' && Math.round(e.px / T) === x && Math.round(e.py / T) === y) || ((e.type === 'chest' || e.type === 'sprite' || e.type === 'solid' || e.type === 'cavegoal' || e.type === 'lordseat') && e.x === x && e.y === y && (e.type !== 'sprite' || e.talk) && (e.type !== 'solid' || e.talk)));
  let e = at(fx, fy);
  if (!e || (e.type === 'sprite' && !e.talk)) { const [dx, dy] = DIRV[F.dir]; const e2 = at(fx + dx, fy + dy); if (e2 && e2.type === 'npc') e = e2; }
  if (!e) return;
  if (e.type === 'npc') { const back = { u: 'd', d: 'u', l: 'r', r: 'l' }[F.dir]; e.dir = back; if (FH.talk) FH.talk(e); return; }
  if (e.type === 'chest' && FH.chest) { FH.chest(e); return; }
  if ((e.type === 'cavegoal' || e.type === 'lordseat') && FH.trigger) { FH.trigger(e); return; }
  if (e.talk && FH.talk) FH.talk(e);
}
function updateNpcs() {
  for (const e of F.ents) {
    if (e.type !== 'npc') continue;
    if (e.mv) {
      const [dx, dy] = DIRV[e.mv]; e.px += dx; e.py += dy; e.at = (e.at || 0) + 1;
      if (e.px % T === 0 && e.py % T === 0) e.mv = null;
      continue;
    }
    if (!e.wander || UI.active) continue;
    if (--e.wt > 0) continue;
    e.wt = 60 + Math.floor(Math.random() * 140);
    const d = 'udlr'[Math.floor(Math.random() * 4)], [dx, dy] = DIRV[d];
    const nx = Math.round(e.px / T) + dx, ny = Math.round(e.py / T) + dy;
    e.dir = d;
    if (Math.abs(nx - e.hx) > 2 || Math.abs(ny - e.hy) > 2) continue;
    if (nx === tileX() && ny === tileY()) continue;
    if (solidLocal(nx, ny, e) || exitAt(nx, ny) || F.ents.some((o) => (o.type === 'warp' || o.type === 'exit') && o.x === nx && o.y === ny)) continue;
    e.mv = d;
  }
}

// ---------- drawing ----------
let camX = 0, camY = 0;
// the line behind the leader: trail[0] is the tile the leader is leaving, and during a step each follower walks
// from the tile it stood on (one further back in the trail) to the next one, at the leader's pace
function followers() {
  const out = [];
  S.front.slice(1, 4).forEach((id, i) => {
    const t = F.trail[i]; if (!t) return;
    const g = GENERALS[id], m = member(id); if (!g || !m) return;
    const k = F.moving ? Math.min(1, Math.abs((F.mdir === 'l' || F.mdir === 'r' ? F.px - F.from[0] : F.py - F.from[1]) / T)) : 1;
    const s = (F.moving && F.trail[i + 1]) || t;
    const fx = s[0] + (t[0] - s[0]) * k, fy = s[1] + (t[1] - s[1]) * k;
    out.push({ i, id, g, m, x: fx * T, y: fy * T, dir: (F.trail[i + 1] || t)[2], walking: !!F.moving && (s[0] !== t[0] || s[1] !== t[1]) });
  });
  return out;
}
function leaderLook() { const id = S.front[0] || 'sunquan'; const g = GENERALS[id], m = member(id); return { look: g.look, equip: m ? m.equip : {}, opts: { shield: g.shield, quiver: g.quiver } }; }
function drawFigure(look, equip, opts, x, y, dir, moving, at) {
  const sh = fieldSheet(look, equip, opts);
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x + 8, y + 14, 6, 2, 0, 0, 7); ctx.fill();
  if (!sh) return;
  const fr = moving ? 1 + (Math.floor(at / 4) % 8) : 0;
  ctx.drawImage(sh, fr * 32, DROW[dir] * 32, 32, 32, Math.round(x) - 8, Math.round(y) - 15, 32, 32);
}
export function fieldDraw() {
  if (F.mode === 'world') return drawWorldMode();
  const m = F.map, mw = m.w * T, mh = m.h * T;
  camX = Math.max(0, Math.min(mw - W, F.px + 8 - W / 2)); camY = Math.max(0, Math.min(mh - H, F.py + 8 - H / 2));
  if (mw < W) camX = -(W - mw) / 2; if (mh < H) camY = -(H - mh) / 2;
  ctx.fillStyle = '#0c0a10'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(F.render.frames[0], Math.round(-camX), Math.round(-camY));
  // everything standing, sorted by the row it stands on
  const list = [];
  for (const e of F.ents) {
    if (e.type === 'sprite') list.push({ y: e.y * T + 15, d: () => e.draw(ctx, Math.round(e.x * T - camX), Math.round(e.y * T - camY), F.frame) });
    else if (e.type === 'npc') list.push({ y: e.py + 14, d: () => drawNpc(e) });
    else if (e.type === 'chest') list.push({ y: e.y * T + 10, d: () => drawChest(e) });
    else if (e.type === 'stairs') list.push({ y: e.y * T, d: () => drawStairs(e) });
    else if (e.type === 'cavegoal') list.push({ y: e.y * T + 8, d: () => drawGoal(e) });
    else if (e.type === 'horsepen') list.push({ y: e.y * T + 8, d: () => drawPen(e) });
  }
  // the leader and the line behind
  const L0 = leaderLook();
  if (!F.hideLeader) list.push({ y: F.py + 15, d: () => drawFigure(L0.look, L0.equip, L0.opts, F.px - camX, F.py - camY, F.dir, !!F.moving || (input.dir() && !UI.active), F.frame) });
  if (!F.hideLeader) for (const f of followers()) list.push({ y: f.y + 14, d: () => drawFigure(f.g.look, f.m.equip, { shield: f.g.shield, quiver: f.g.quiver }, f.x - camX, f.y - camY, f.dir, f.walking, F.frame + f.i * 3) });
  list.sort((a, b) => a.y - b.y);
  for (const o of list) o.d();
  if (m.dark) { const g = ctx.createRadialGradient(F.px - camX + 8, F.py - camY + 8, 30, F.px - camX + 8, F.py - camY + 8, 200); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.7)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (F.bannerT > 0 && F.banner) { const w = textW(F.banner) + 24; windowBox((W - w) / 2, 8, w, 22); text(F.banner, W / 2, 13, '#f8e070', { align: 'center' }); }
}
function drawNpc(e) {
  const look = typeof e.look === 'string' ? (e._look || (e._look = parseLook(e.look))) : e.look;
  drawFigure(look, e.equip || {}, e.opts || {}, e.px - camX, e.py - camY, e.dir, !!e.mv || !!e.walking, e.at || 0);
  if (e.mark) { ctx.fillStyle = '#ffe070'; text('!', e.px - camX + 6, e.py - camY - 22, '#ffe070'); }
}
function drawChest(e) {
  const X = Math.round(e.x * T - camX), Y = Math.round(e.y * T - camY), open = S.chests[e.id];
  if (e.tr) {
    // a treasure chest: lacquered red with gold bands, and a glint while it is still closed
    ctx.fillStyle = '#1a0606'; ctx.fillRect(X, Y + 2, 16, 13);
    ctx.fillStyle = open ? '#5a1810' : '#a82418'; ctx.fillRect(X + 1, Y + 3, 14, open ? 4 : 11);
    ctx.fillStyle = '#f0c040'; ctx.fillRect(X + 1, Y + 3, 14, 1); ctx.fillRect(X + 1, Y + 7, 14, 1); ctx.fillRect(X + 4, Y + 3, 1, open ? 4 : 11); ctx.fillRect(X + 11, Y + 3, 1, open ? 4 : 11);
    if (!open) { ctx.fillStyle = '#ffe890'; ctx.fillRect(X + 7, Y + 6, 2, 3); const f = (F.frame + e.x * 13) % 80; if (f < 14) { ctx.fillStyle = '#ffffff'; ctx.fillRect(X + 12, Y, 1, 5); ctx.fillRect(X + 10, Y + 2, 5, 1); } }
    else { ctx.fillStyle = '#3a0c08'; ctx.fillRect(X + 1, Y + 8, 14, 6); }
    return;
  }
  ctx.fillStyle = '#200c08'; ctx.fillRect(X + 1, Y + 3, 14, 12);
  ctx.fillStyle = open ? '#583018' : '#b06830'; ctx.fillRect(X + 2, Y + 4, 12, open ? 3 : 10);
  if (!open) { ctx.fillStyle = '#f0c040'; ctx.fillRect(X + 2, Y + 7, 12, 1); ctx.fillRect(X + 7, Y + 6, 2, 3); }
  else { ctx.fillStyle = '#784018'; ctx.fillRect(X + 2, Y + 8, 12, 6); }
}
function drawStairs(e) { const X = Math.round(e.x * T - camX), Y = Math.round(e.y * T - camY); ctx.fillStyle = '#100808'; ctx.fillRect(X + 1, Y + 1, 14, 14); ctx.fillStyle = e.up ? '#8a7a68' : '#5a4a40'; for (let i = 0; i < 4; i++) ctx.fillRect(X + 2, Y + 2 + i * 3, 12 - i * (e.up ? 0 : 2), 2); }
function drawGoal(e) { const X = Math.round(e.x * T - camX), Y = Math.round(e.y * T - camY), f = (F.frame >> 3) % 2; ctx.fillStyle = f ? '#a040c0' : '#d070f0'; ctx.beginPath(); ctx.arc(X + 8, Y + 8, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#fff0ff'; ctx.fillRect(X + 7, Y + 5, 2, 6); }
function drawPen(e) {
  const X = Math.round((e.x - 1) * T - camX), Y = Math.round((e.y - 1) * T - camY);
  ctx.fillStyle = '#6a4424'; for (let i = 0; i <= 4; i++) ctx.fillRect(X + i * 16, Y - 4, 2, 52);
  ctx.fillRect(X, Y, 66, 2); ctx.fillRect(X, Y + 46, 66, 2);
  const hi = IMG['h:brown'], h2 = IMG['h:gray'];
  if (hi) { ctx.drawImage(hi, 0, 5 * 128, 128, 128, X - 8, Y - 24, 64, 64); }
  if (h2) { ctx.drawImage(h2, 128, 7 * 128, 128, 128, X + 16, Y - 14, 64, 64); }
}
function drawWorldMode() {
  const pw = WW * T, ph = WH * T;
  camX = Math.max(0, Math.min(pw - W, F.px + 8 - W / 2)); camY = Math.max(0, Math.min(ph - H, F.py + 8 - H / 2));
  drawWorld(ctx, Math.round(camX), Math.round(camY), W, H);
  warmWorld(camX, camY, W, H);
  // Jasper's eye for hidden things: a glint where something is buried
  if (S.front.includes('jasper') && FH.secrets) for (const sc of FH.secrets()) {
    const sx = sc[0] * T - camX, sy = sc[1] * T - camY;
    if (sx < -16 || sy < -16 || sx > W || sy > H) continue;
    const f = (F.frame + sc[0] * 7) % 90;
    if (f < 24) { ctx.fillStyle = f % 8 < 4 ? '#ffffff' : '#ffe880'; ctx.fillRect(sx + 7, sy + 4, 2, 8); ctx.fillRect(sx + 4, sy + 7, 8, 2); }
  }
  // the ship waiting at the shore
  if (S.ship) drawShip(S.ship.x * T - camX, S.ship.y * T - camY, 'l');
  const x = F.px - camX, y = F.py - camY;
  if (S.vehicle === 'ship') drawShip(x, y, F.dir === 'r' ? 'r' : 'l');
  else {
    const L0 = leaderLook(), id0 = S.front[0] || 'sunquan';
    const list = [{ y: F.py, d: () => (S.horse ? drawRider(x, y, id0, F.dir, !!F.moving, F.frame) : drawFigure(L0.look, L0.equip, L0.opts, x, y, F.dir, !!F.moving, F.frame)) }];
    for (const f of followers()) list.push({ y: f.y, d: () => (S.horse ? drawRider(f.x - camX, f.y - camY, f.id, f.dir, f.walking, F.frame + f.i * 3) : drawFigure(f.g.look, f.m.equip, { shield: f.g.shield, quiver: f.g.quiver }, f.x - camX, f.y - camY, f.dir, f.walking, F.frame + f.i * 3)) });
    list.sort((a, b) => a.y - b.y);
    for (const o of list) o.d();
  }
  drawMinimap();
  const k = WD.t[tileY() * WW + tileX()];
  if (k === K.PLACE) { const id = WD.placeAt[tileY() * WW + tileX()]; if (id) { const s = placeName(id), w = textW(s) + 20; windowBox((W - w) / 2, 8, w, 22); text(s, W / 2, 13, '#f8e070', { align: 'center' }); } }
  if (F.bannerT > 0 && F.banner) { const w = textW(F.banner) + 24; windowBox((W - w) / 2, 34, w, 22); text(F.banner, W / 2, 39, '#f8f8f8', { align: 'center' }); }
}
function drawShip(x, y, face) {
  const im = tileset('wobj'), sp = WOBJ['junk_' + face];
  if (sp && im) { const bob = Math.round(Math.sin(F.frame / 12)); ctx.drawImage(im, sp[0], sp[1], sp[2], sp[3], Math.round(x + 8 - sp[2] / 2), Math.round(y + 14 - sp[3] + bob), sp[2], sp[3]); }
}
// on horseback: the horse (half size) and the leader's top half on it
function drawRider(x, y, id, dir, moving, at) {
  const g = GENERALS[id], m = member(id);
  const hname = (m && m.equip.horse && ITEMS[m.equip.horse] && ITEMS[m.equip.horse].horse) || 'brown';
  const hi = horseImg(hname);
  // half-size horse: [row, feet y, saddle x, saddle y] in the 128px frame
  const A = { u: [4, 108, 64, 62], l: [5, 94, 62, 52], d: [6, 96, 64, 58], r: [7, 94, 66, 52] }[dir];
  const fr = moving ? Math.floor(at / 4) % 4 : 0;
  const sh = g && fieldSheet(g.look, m ? m.equip : {}, { shield: g.shield, quiver: g.quiver });
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + 8, y + 14, dir === 'l' || dir === 'r' ? 13 : 6, 3, 0, 0, 7); ctx.fill();
  const hx = Math.round(x + 8 - 32), hy = Math.round(y + 15 - A[1] / 2);
  const man = () => { if (sh) { const top = hy + A[3] / 2 - 22, left = hx + A[2] / 2 - 16; ctx.drawImage(sh, 0, DROW[dir] * 32, 32, 25, left, top + (moving ? fr % 2 : 0), 32, 25); } };
  if (hi) ctx.drawImage(hi, fr * 128, A[0] * 128, 128, 128, hx, hy, 64, 64);
  man();
}
// the little map in the corner
function drawMinimap() {
  const ov = overviewMap(1);
  const mw = 72, mh = 54, x0 = W - mw - 6, y0 = H - mh - 6;
  const sx = Math.max(0, Math.min(WW - mw, tileX() - mw / 2)), sy = Math.max(0, Math.min(WH - mh, tileY() - mh / 2));
  ctx.fillStyle = '#100808'; ctx.fillRect(x0 - 2, y0 - 2, mw + 4, mh + 4);
  ctx.fillStyle = '#e0b858'; ctx.fillRect(x0 - 1, y0 - 1, mw + 2, 1); ctx.fillRect(x0 - 1, y0 + mh, mw + 2, 1); ctx.fillRect(x0 - 1, y0 - 1, 1, mh + 2); ctx.fillRect(x0 + mw, y0 - 1, 1, mh + 2);
  ctx.drawImage(ov, sx, sy, mw, mh, x0, y0, mw, mh);
  if ((F.frame >> 4) % 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 + tileX() - sx - 1, y0 + tileY() - sy - 1, 3, 3); }
}
export function setBanner(s, t = 150) { F.banner = s; F.bannerT = t; }
export { camX, camY, solidLocal };
