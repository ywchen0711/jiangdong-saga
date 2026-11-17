// 江東霸業傳 Saga of Jiangdong: start-up, the title screen, the main loop, and the glue between walking,
// battles, menus and the story. window.G exposes hooks for testing.
import { ctx, W, H, present, text, textW, windowBox, canvas } from './gfx.js?v=7';
import { input, pollInput, endInput, setupTouch, setupCanvasTap } from './input.js?v=7';
import { initAudio, playMusic, sfx, stopMusic, currentSong } from './audio.js?v=7';
import { UI, menu, say, talk, ask, notice, wait, uiTick, abortUI } from './ui.js?v=7';
import { L, LANG, setLang } from './i18n.js?v=7';
import { generate, WW, WH, K, PLACES, REGIONS, walkable } from './world.js?v=7';
import { F, FH, initWorld, toWorld, toMap, fieldUpdate, fieldDraw, setBanner, regionAt, tileX, tileY } from './field.js?v=7';
import * as FIELD from './field.js?v=7';
import { overviewMap } from './worldgfx.js?v=7';
import { B, startBattle, battleUpdate, battleDraw } from './battle.js?v=7';
import { S, newGame, recruit, member, healAll, tpMax, save, load, slotInfo, give, have, take, troopsMax, gainExp } from './state.js?v=7';
import { GENERALS, GEN_LIST, genName } from './generals.js?v=7';
import { ITEMS, TACTICS, FORMS, itemName } from './data.js?v=7';
import { openMenu, fullMap, helpPage, itemDesc } from './menu.js?v=7';
import { talkTo, openChest, onEnterPlace, onTrigger, encounterArmy, persuade, STORY, regionLockText, runIntro, bossFor } from './story.js?v=7';
import { buildMap } from './maps.js?v=7';
import { portrait, fieldSheet, battleSheet, dollReady } from './doll.js?v=7';
import { banditFor, banditBeaten } from './treasure_world.js?v=7';

export const G = window.G = { mode: 'boot', S, F, B, UI, GENERALS, GEN_LIST, ITEMS, PLACES, REGIONS };
G.uiActive = () => UI.active;
let scene = 'boot', titleT = 0, busy = false;
G.busy = false;

// ---------- hooks from walking ----------
FH.menu = () => { if (!busy) run(openMenu); };
FH.fullmap = () => { if (!busy) run(fullMap); };
FH.note = (s) => setBanner(s, 120);
FH.blocked = (rk) => { setBanner(regionLockText(rk), 150); sfx('buzz'); };
FH.enterPlace = (id) => run(async () => { await enterPlace(id); });
FH.exitPlace = () => run(async () => { await exitPlace(); });
FH.warp = (e) => run(async () => {
  sfx('door');
  if (e.inside) { F.backDoor = [e.x, e.y]; await fade(() => toMap(e.to)); }
  else if (e.out) { const back = F.backDoor || null; await fade(() => toMap(e.to, back ? back[0] : null, back ? back[1] + 1 : null, 'd')); }
  else await fade(() => toMap(e.to, e.tx, e.ty, e.dir));
  await onEnterMap();
});
FH.stairs = (e) => run(async () => { sfx('stairs'); if (!e.to) { await exitPlace(); return; } await fade(() => toMap(e.to)); await onEnterMap(); });
FH.talk = (e) => run(() => talkTo(e));
FH.chest = (e) => run(() => openChest(e));
FH.trigger = (e) => run(() => onTrigger(e));
FH.encounter = (info) => run(() => randomBattle(info));
FH.onStep = (x, y) => STORY.onStep ? STORY.onStep(x, y) : false;

async function enterPlace(id) {
  const r = await onEnterPlace(id);
  if (r === 'stay') return;
  S.visited[id] = 1;
  const P = PLACES[id];
  F.worldBack = [tileX(), tileY(), F.dir];
  if (['capital', 'castle', 'town', 'village', 'port'].includes(P[4])) S.lastTown = id;
  sfx('door');
  await fade(() => toMap(id));
  await onEnterMap();
}
async function exitPlace() {
  const P = PLACES[F.map.place];
  sfx('door');
  // step out on the world map just south of the place, or the nearest open ground
  let [x, y] = [P[2], P[3]];
  const cands = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [0, 2], [2, 0], [-2, 0]];
  let best = [x, y + 1];
  for (const [dx, dy] of cands) { const k = FIELD.WD.t[(y + dy) * WW + x + dx]; if (walkable(k) && k !== K.PLACE) { best = [x + dx, y + dy]; break; } }
  await fade(() => toWorld(best[0], best[1], 'd'));
  playMusic(worldSong());
}
async function onEnterMap() {
  if (F.mode === 'local') playMusic(F.map.music || worldSong());
  if (STORY.onMap) await STORY.onMap(F.mapId);
}
export function worldSong() {
  if (S.vehicle === 'ship') return 'boat';
  const rk = F.mode === 'world' ? regionAt(tileX(), tileY()) : null;
  if (rk && ['badong', 'hanzhong'].includes(rk)) return 'tension';
  return S.chapter >= 8 ? 'world3' : S.chapter >= 4 ? 'world2' : 'world';
}
G.worldSong = worldSong;
// ---------- fades ----------
let fadeA = 0, fadeTo = 0;
export async function fade(fn, frames = 14) {
  fadeTo = 1; while (fadeA < 1) { fadeA = Math.min(1, fadeA + 1 / frames); await wait(1); }
  if (fn) fn();
  fadeTo = 0; while (fadeA > 0) { fadeA = Math.max(0, fadeA - 1 / frames); await wait(1); }
}
G.fade = fade;
// a script or action that holds the controls until it ends
export async function run(fn) {
  if (busy) return;
  busy = true; G.busy = true; F.busy = true;
  const depth = UI.depth();
  try { await fn(); } catch (e) { console.error(e); UI.trim(depth); }
  busy = false; G.busy = false; F.busy = false;
}
G.run = run;

// ---------- battles ----------
const TERRAIN = { [K.FOREST]: 'forest', [K.PINE]: 'forest', [K.PALM]: 'forest', [K.HILL]: 'hill', [K.DESERT]: 'desert', [K.DUNE]: 'desert', [K.SNOW]: 'snow', [K.STEPPE]: 'steppe', [K.MARSH]: 'grass', [K.BEACH]: 'grass' };
async function randomBattle(info) {
  const bandit = info.region && !info.naval ? banditFor(info.region) : null;
  const army = bandit ? { foes: bandit.foes, form: 'yulin' } : encounterArmy(info);
  if (!army) return;
  sfx('encounter');
  await flash();
  if (bandit) { const r = await battle({ foes: army.foes, terrain: TERRAIN[info.tile] || 'grass', canRun: true, foeForm: army.form, intro: bandit.intro, capture: false }); if (r === 'win') { banditBeaten(bandit.q); await say(null, L('山賊頭目伏誅了！回去告訴委託人吧。', 'The bandit chief is dead! Go back and tell the one who asked.')); } return; }
  const r = await battle({ foes: army.foes, terrain: info.cave ? 'cave' : info.naval ? 'river' : TERRAIN[info.tile] || 'grass', naval: !!info.naval, canRun: true, foeForm: army.form, region: info.region || (info.place && PLACES[info.place] ? PLACES[info.place][5] : null) });
  void r;
}
async function flash() { for (let i = 0; i < 6; i++) { flashA = i % 2 ? 0 : 0.8; await wait(3); } flashA = 0; }
let flashA = 0;
// fight a battle and deal with what comes after: prisoners, defeat
export async function battle(cfg) {
  const song = currentSong;
  document.body.classList.add('inbattle');
  scene = 'battle';
  const r = await startBattle(cfg);
  scene = 'game';
  document.body.classList.remove('inbattle');
  if (r === 'lose' && !cfg.mayLose) { await defeated(); return 'lose'; }
  if (r === 'win' && B.captive) { const c = B.captive; B.captive = null; await persuade(c.id, c.lv); }
  if (!cfg.keepMusic) playMusic(F.mode === 'world' ? worldSong() : (F.map && F.map.music) || song || worldSong());
  return r;
}
G.battle = battle;
async function defeated() {
  stopMusic(0.5);
  await say(null, L('我軍潰敗……殘兵退回了城中。', 'The army is broken... what is left falls back to the city.'));
  S.gold = Math.floor(S.gold / 2);
  healAll(1);
  const id = S.lastTown || 'haiyan';
  await fade(() => toMap(id));
  await onEnterMap();
}
// ---------- the title ----------
const TITLE_BG = (() => { const c = canvas(W, H); return c; })();
function drawTitle() {
  titleT++;
  const g = ctx;
  const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#1a0e1a'); grd.addColorStop(0.55, '#5a1a14'); grd.addColorStop(1, '#14080a'); g.fillStyle = grd; g.fillRect(0, 0, W, H);
  // the river under a red sky, and distant hills
  g.fillStyle = '#2a0e10'; for (let x = 0; x < W; x++) { const h = 30 + Math.sin(x * 0.02) * 12 + Math.sin(x * 0.05) * 6; g.fillRect(x, 160 - h, 1, h); }
  g.fillStyle = '#1a2a48'; g.fillRect(0, 160, W, 110);
  g.fillStyle = '#3a5a88'; for (let i = 0; i < 40; i++) { const x = (i * 71 + titleT * (0.3 + (i % 3) * 0.2)) % (W + 40) - 20, y = 166 + (i * 37) % 100; g.fillRect(x, y, 10 + (i % 4) * 4, 1); }
  // a junk with red sails crossing
  const wo = G.WOBJ && G.WOBJ.junk_r;
  if (wo) { const x = (titleT * 0.25) % (W + 80) - 40; g.drawImage(G.tileset('wobj'), wo[0], wo[1], wo[2], wo[3], x, 136, wo[2] * 2, wo[3] * 2); }
  // the sun
  g.fillStyle = '#f8c060'; g.beginPath(); g.arc(380, 96, 22, 0, 7); g.fill(); g.fillStyle = 'rgba(248,192,96,0.25)'; g.beginPath(); g.arc(380, 96, 34, 0, 7); g.fill();
  big('江東霸業傳', W / 2, 40, '#f8e090');
  text('SAGA OF JIANGDONG', W / 2, 92, '#e0b858', { align: 'center' });
}
function big(s, x, y, col) {
  // the title drawn three times larger, pixel by pixel
  const c = canvas(textW(s) + 4, 16), g = c.x;
  const save = ctx; void save;
  text(s, 1, 1, col, { g, shadow: '#3a0a08' });
  ctx.drawImage(c, Math.round(x - c.width * 1.5), y, c.width * 3, c.height * 3);
}
async function title() {
  scene = 'title';
  playMusic('title');
  for (;;) {
    const has = [0, 1, 2].some((i) => slotInfo(i));
    const c = await menu([L('新的征程', 'New Game'), { label: L('繼續', 'Continue'), disabled: !has }, LANG === 'en' ? '中文' : 'English'], { x: W / 2 - 60, y: 150, w: 120, cancel: false });
    if (scene !== 'title') return;
    if (c === 2) { setLang(LANG === 'en' ? 'zh' : 'en'); continue; }
    if (c === 1) { const ok = await loadMenu(); if (ok) { scene = 'game'; await resumeGame(); return; } continue; }
    newGame();
    scene = 'game';
    await runIntro();
    return;
  }
}
export async function loadMenu() {
  const slots = [0, 1, 2].map((i) => slotInfo(i));
  const c = await menu(slots.map((s, i) => ({ label: s ? L(`記錄${i + 1}  第${s.chapter}章  Lv${s.lv}  武將${s.n}`, `Slot ${i + 1}  Ch.${s.chapter}  Lv${s.lv}  ${s.n} generals`) : L(`記錄${i + 1}  （空）`, `Slot ${i + 1}  (empty)`), disabled: !s })), { x: 100, y: 140, w: 280 });
  if (c < 0) return false;
  return load(c);
}
async function resumeGame() {
  if (S.pos.map === 'world') toWorld(S.pos.x, S.pos.y, S.pos.dir);
  else toMap(S.pos.map, S.pos.x, S.pos.y, S.pos.dir);
  playMusic(F.mode === 'world' ? worldSong() : F.map.music || worldSong());
}
G.resumeGame = resumeGame;

// ---------- the loop ----------
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  acc += Math.min(100, now - last); last = now;
  let steps = 0;
  const mult = G.speed || 1;
  if (mult > 1) { for (let i = 0; i < mult; i++) update(); acc = 0; }
  else while (acc >= 1000 / 60 && steps < 4) { acc -= 1000 / 60; steps++; update(); }
  draw();
  present(false);
}
function update() {
  pollInput();
  if (input.anyPressed()) initAudio();
  uiTick();
  if (scene === 'game' || scene === 'battle') {
    S.time = (S.time || 0) + 1 / 60;
    F.ppx = F.px; F.ppy = F.py;
    if (B.active) battleUpdate(); else if (!UI.active || F.moving) fieldUpdate();
  }
  if (UI.active) UI.update();
  if (fadeTo === 0 && fadeA > 0 && !busy) fadeA = Math.max(0, fadeA - 0.08);
  endInput();
}
function draw() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (scene === 'title') drawTitle();
  else if (scene === 'game' || scene === 'battle') {
    if (B.active) battleDraw(); else if (STORY.drawScene && STORY.scene) STORY.drawScene();
    else {
      // on screens faster than 60 Hz draw the walker between its last two ticks so the scroll stays even
      const px = F.px, py = F.py, a = Math.min(1, acc / (1000 / 60)) - 1;
      if (F.ppx != null && Math.abs(px - F.ppx) <= 8 && Math.abs(py - F.ppy) <= 8) { F.px = px + (px - F.ppx) * a; F.py = py + (py - F.ppy) * a; }
      try { fieldDraw(); } finally { F.px = px; F.py = py; }
    }
  }
  if (STORY.overlay) STORY.overlay();
  UI.draw();
  if (fadeA > 0) { ctx.fillStyle = `rgba(0,0,0,${fadeA})`; ctx.fillRect(0, 0, W, H); }
  if (flashA > 0) { ctx.fillStyle = `rgba(255,255,255,${flashA})`; ctx.fillRect(0, 0, W, H); }
  if (scene === 'boot') { text(L('載入中……', 'Loading...'), W / 2, H / 2, '#ccc', { align: 'center' }); }
}
// ---------- start ----------
setupTouch();
setupCanvasTap();
import { WOBJ, tileset } from './assets.js?v=7';
G.WOBJ = WOBJ; G.tileset = tileset;
requestAnimationFrame(frame);
// tests can run the game faster than the screen refreshes (and while the page is hidden)
setInterval(() => { if (G.turbo) for (let i = 0; i < G.turbo; i++) update(); }, 4);
await document.fonts.load('12px Cubic11').catch(() => {});
initWorld();
G.WD = FIELD.WD;
Object.assign(G, { BOT_NEED: (m, a) => STORY.need(m, a), UI, FH, toWorld, toMap, recruit, member, healAll, give, save, load, gainExp, setBanner, buildMap, portrait, fieldSheet, battleSheet, dollReady, overviewMap, menuOpen: openMenu, help: helpPage, STORY, F, fieldUpdate, troopsMax, tpMax, enterPlace: (id) => run(() => enterPlace(id)), exitPlace: () => run(exitPlace), setChapter: (n) => { S.chapter = n; }, itemDesc });
// for tests: skip the title and start with an army at a given chapter
G.debugStart = (ch = 1, ids = ['sunquan', 'zhoutai', 'shangxiang', 'jeff', 'erin', 'josh', 'jasper'], lv = 8) => {
  abortUI(); newGame(); scene = 'game'; G.mode = 'game';
  for (const id of ids) recruit(id, lv);
  S.chapter = ch; S.flags.ch1 = 1; S.flags.westerners = 1; S.strategist = ids.includes('jeff') ? 'jeff' : ids[0]; S.tp = tpMax(); S.gold = 5000;
  toWorld(229, 95, 'd'); playMusic(worldSong());
};
G.mode = 'title';
(async () => { for (;;) { await title(); G.mode = 'game'; return; } })();
