// Army battles, seen from the side: your generals on the right, the enemy on the left, each general with a
// little crowd of soldiers that thins out as their troops (兵力, their life) fall. Each round you give every
// general in the front line an order — attack, a tactic from the shared strategy pool, an item, defend,
// change formation — or order the whole army to charge, or retreat; then everyone acts in order of speed.
//
// The rules that make choices matter (all explained on the 兵法 help page, menu.js):
// - the unit triangle: horse beat foot, foot beat bow, bow beat horse (x1.3 / x0.8); navy rules the water
// - formations beat one another in circles (data.js BEATS): the winner hits 15% harder
// - back rows: melee blows on a general standing in the back of the formation do 40% less while the front holds
// - morale (士氣), one bar per side: it rises with kills and good play, falls with losses; low morale hits
//   softer, a beaten random army flees, and when every enemy leader falls the rest break and run
// - tactics may fail: the chance (shown in the menu) depends on INT, element, weather and terrain
// - statuses with turns, shown as small icons; bosses announce their big moves a turn ahead (bosses.js)
import { ctx, W, H, canvas, text, textW, windowBox, bar, HAND } from './gfx.js?v=4';
import { input } from './input.js?v=4';
import { sfx, playMusic, currentSong } from './audio.js?v=4';
import { UI, menu, say, wait as uiWait, descBox, fit, wrap } from './ui.js?v=4';
import { L } from './i18n.js?v=4';
import { IMG, FX, tileset } from './assets.js?v=4';
import { GENERALS, GEN_LIST, gearFor, genName, parseLook } from './generals.js?v=4';
import { ITEMS, TACTICS, FORMS, unitEdge, maxTroops, itemName, tacName, TAC_DESC, unitName, SWING, formName, formEdge, beatenBy, BEATS, BEAT_WHY, STATUS } from './data.js?v=4';
import { S, member, stat, atkOf, defOf, troopsMax, usableTactics, tpMax, gainExp, give, take, have, hasSkill, formOk, recruit } from './state.js?v=4';
import { battleSheet, fieldSheet } from './doll.js?v=4';
import { icon, digits, ICON_COL } from './icons.js?v=4';
import { pushRaw as UIpush, removeRaw as UIpop } from './ui.js?v=4';

export const B = { active: false };
const waits = [];
const tick = (n) => new Promise((res) => waits.push({ n, res }));
let fast = false;
const nums = [], fxs = [], shots = [];
let msg = '', msgT = 0;
const say1 = (s) => { msg = s; msgT = 0; if (window.G && G.blog) G.blog.push(`${B.round}: ${s}`); };
const N = (u) => genName(u.g);

// ---------- units ----------
// both armies stand in lanes from top to bottom. So that nobody covers anybody, the lanes are spread over
// three columns (lane i in column i % 3): two generals in the same column are three lanes apart, which is
// more than a mounted general is tall. The formation decides who is where: its front-row generals take the
// front column, its back row the rear column. Generals and horses are drawn at GSCALE.
const GSCALE = 0.72, COL_W = 56, LANE_GAP = 24, LANE_MID = 134;
const colOf = (u) => { const p = (FORMS[u.side === 'ally' ? B.form : B.foeForm] || FORMS.fangyuan).pos[u.slot]; return p ? p[0] : 1; };
const isBack = (u) => colOf(u) >= 2;
const frontHolds = (side) => alive(side).some((v) => !isBack(v));
function layoutSide(side, form, snap) {
  const pos = (FORMS[form] || FORMS.fangyuan).pos;
  const fkey = (u) => { const p = pos[u.slot] || [1, u.slot]; return p[0] * 10 + p[1] + u.slot * 0.01; };
  const list = B.units.filter((u) => u.side === side && !u.gone && u.troops > 0).sort((a, b) => fkey(a) - fkey(b)), n = list.length;
  if (!n) return;
  const gap = n > 1 ? Math.min(n <= 3 ? 40 : LANE_GAP, 96 / (n - 1)) : 0, top = LANE_MID - (gap * (n - 1)) / 2;
  // lanes, each with its column; the frontmost generals fill the front column first
  const lanes = [];
  for (let i = 0; i < n; i++) lanes.push({ y: Math.round(top + i * gap), col: n <= 3 ? i % 2 : i % 3, i });
  const slots = lanes.slice().sort((a, b) => a.col - b.col || a.i - b.i);
  const dir = side === 'ally' ? 1 : -1, x0 = side === 'ally' ? 296 : 184;
  list.forEach((u, k) => {
    const L2 = slots[k];
    u.hx = x0 + dir * L2.col * COL_W; u.hy = L2.y; u.lane = L2.i;
    if (snap || u.x === undefined) { u.x = u.hx; u.y = u.hy; }
  });
}
const SOLDIER_COL = { sun: 'red', sun_hao: 'purple', shanyue: 'forest', liu_xun: 'yellow', huang_zu: 'teal', cai_mao: 'bluegray', liu: 'green', cao: 'navy', yuan: 'yellow', dong: 'black', liu_zhang: 'orange', nanman: 'red', qiang: 'white', gongsun: 'white', shi: 'orange', pirate: 'navy', sect: 'black', free: 'gray' };
const soldierCache = {};
function soldierLook(faction, unit) {
  const k = faction + unit;
  if (soldierCache[k]) return soldierCache[k];
  const c = SOLDIER_COL[faction] || 'gray';
  let s = `b=m s=light h=buzz hc=black t=tunic tc=${c} l=pants lc=charcoal f=boots fc=black`;
  if (faction === 'sect') s += ' hat=hb_hood hatc=black';
  else if (faction === 'shanyue' || faction === 'nanman' || faction === 'pirate') s += ` hat=hb_bandana hatc=${c}`;
  const look = parseLook(s);
  const equip = { weapon: unit === 'arc' ? 'shortbow' : unit === 'nav' ? 'ironsword' : 'ironspear', armour: faction === 'shanyue' || faction === 'nanman' ? null : 'leather', helm: faction === 'sect' || faction === 'shanyue' || faction === 'nanman' || faction === 'pirate' ? null : 'ironhelm' };
  return (soldierCache[k] = { look, equip });
}
// how hard leaders hit and how much the announced moves do (tuned with the brute-vs-smart test, simstrat.mjs)
const BOSS_ATK = 1.6, BOSS_DEF = 1.15, BOSS_HP = 1.7, ELITE_ATK = 1.15;
const TELE_MUL = { single: 1.4, aoe: 1.5, tac: 1.35, fireships: 1.4 };
function makeUnit(side, spec, slot) {
  const g = GENERALS[spec.id], m = side === 'ally' ? member(spec.id) : null;
  const lv = m ? m.lv : spec.lv;
  const equip = m ? m.equip : gearFor(g, lv);
  const lead = m ? stat(m, 'lead') : g.lead;
  const sum = (k) => Object.values(equip).reduce((t, s) => t + ((s && ITEMS[s] && ITEMS[s][k]) || 0), 0);
  const max = m ? troopsMax(m) : Math.round(maxTroops(lv, lead, g.skills.includes('haoling')) * (spec.mul || 1) * (spec.boss ? BOSS_HP : 1));
  const u = {
    side, id: spec.id, g, m, lv, slot, equip, unit: g.unit, boss: !!spec.boss, faction: m ? 'sun' : spec.faction || g.faction, kidx: spec.kidx,
    max, troops: m ? Math.min(m.troops, max) : Math.round(max * (spec.hp || 1)),
    str: m ? stat(m, 'str') : g.str, int: m ? stat(m, 'int') : g.int + sum('int'), spd: (m ? stat(m, 'spd') : g.spd + sum('spd')),
    atk: m ? atkOf(m) : g.str + sum('atk'), def: m ? defOf(m) : Math.round(g.lead * 0.55 + sum('def')),
    own: m ? [...m.tactics] : enemyTactics(g, lv), st: {}, buf: {}, buqu: g.skills.includes('buqu'),
    sheet: null, x: undefined, y: 0, dx: 0, anim: 'idle', at: 0, flash: 0, alpha: 1, horse: equip.horse && ITEMS[equip.horse] ? ITEMS[equip.horse].horse : null,
    weakFire: !!(equip.armour && ITEMS[equip.armour] && ITEMS[equip.armour].weakFire), opts: { shield: g.shield || null, quiver: !!g.quiver },
    illusion: !!spec.illusion, bomb: spec.bomb || 0, petal: !!spec.petal, summon: !!spec.summon,
    hpMul: m ? 1 : (spec.mul || 1) * (spec.boss ? BOSS_HP : 1),
  };
  if (spec.boss) { u.atk = Math.round(u.atk * (spec.atkMul || BOSS_ATK)); u.def = Math.round(u.def * (spec.defMul || BOSS_DEF)); }
  else if (side === 'foe' && B.cfg && B.cfg.boss && !spec.summon) u.atk = Math.round(u.atk * ELITE_ATK);
  else if (side === 'foe' && spec.atkMul) u.atk = Math.round(u.atk * spec.atkMul);
  battleSheet(g.look, equip, u.opts).then((s) => { u.sheet = s; });
  const sl = soldierLook(u.faction, u.unit);
  u.soldier = sl;
  fieldSheet(sl.look, sl.equip);
  return u;
}
function enemyTactics(g, lv) {
  const out = [...(g.tac || [])];
  for (const t of Object.values(TACTICS)) if (!t.unique && !t.enemyOnly && t.int && g.int >= t.int && lv >= t.lv && !out.includes(t.id) && !t.field) out.push(t.id);
  return out.filter((t) => !['dunzou', 'zhencha', 'tianbian'].includes(t));
}
const alive = (side) => B.units.filter((u) => u.side === side && u.troops > 0);
const isEnemyOf = (a, b) => a.side !== b.side;
// the tactics a general can use right now: their own, and the strategist's while the strategist fights in the line
const stratUnit = () => B.units.find((u) => u.side === 'ally' && u.id === S.strategist && u.troops > 0) || null;
function tacticsOf(u) {
  if (u.side !== 'ally') return u.own;
  const set = new Set(u.own.filter((t) => TACTICS[t] && !TACTICS[t].enemyOnly));
  const s = stratUnit();
  if (s) for (const t of s.own) if (TACTICS[t] && !TACTICS[t].enemyOnly) set.add(t);
  return [...set].sort((a, b) => Object.keys(TACTICS).indexOf(a) - Object.keys(TACTICS).indexOf(b));
}
const disabled = (u) => !!(u.st.stun || u.st.sleep);
const kitBoss = (i) => B.units.find((u) => u.side === 'foe' && u.kidx === i);

// ---------- numbers ----------
const formOf = (side) => FORMS[side === 'ally' ? B.form : B.foeForm] || FORMS.fangyuan;
const formMul = (side) => { const e = side === 'ally' ? formEdge(B.form, B.foeForm) : formEdge(B.foeForm, B.form); return e > 0 ? 1.15 : e < 0 ? 0.88 : 1; };
const buffK = (u, k) => (u.buf[k] > 0 ? 1.25 : 1);
const moraleMul = (side) => 0.8 + 0.4 * (B.morale[side] / 100);
const scaleLv = (lv) => maxTroops(lv, 70) / 4;
const rnd = (a, b) => a + Math.random() * (b - a);
function skillOnSide(side, s) { return alive(side).some((u) => u.g.skills.includes(s)); }
const ranged = (u) => { const c = u.equip.weapon && ITEMS[u.equip.weapon] ? ITEMS[u.equip.weapon].cat : 'sword'; return c === 'bow' || c === 'xbow'; };
const pincered = (u) => { const k = B.kit; return k && k.pincer && k.pincer.includes(u.kidx) && k.pincer.every((i) => { const v = kitBoss(i); return v && v.troops > 0; }); };
const veiled = (u) => u.side === 'foe' && u.boss && B.kit && B.kit.moves && B.kit.moves.some((m) => m.kind === 'illusion') && alive('foe').some((v) => v.illusion);
const iceStance = (u) => u.stance === 'ice';
const mirrored = (u) => u.st.reflect > 0 || u.stance === 'mirror';
// how much harder a attacks d: the unit triangle
export const edgeOf = (a, d) => unitEdge(a.unit, d.unit, B.naval);
// opts: tele (an announced move: defending cuts it to 35%), snipe (ignores the back-row rule)
function physDamage(a, d, mul = 1, opts = {}) {
  const fa = formOf(a.side), fd = formOf(d.side);
  let A = a.atk * buffK(a, 'atk') * fa.atk * (a.st.provoke ? 1.2 : 1) * (a.st.fear ? 0.7 : 1) * (a.st.curse ? 0.8 : 1) * (a.berserk ? 1.4 : 1) * (pincered(a) ? 1.3 : 1);
  if (a.g.skills.includes('yongmeng')) A *= 1.1;
  if (skillOnSide(d.side, 'weifeng')) A *= 0.92;
  let D = d.def * buffK(d, 'def') * fd.def * (d.st.provoke ? 0.6 : 1) * (d.st.defdown ? 0.65 : 1) * (d.berserk ? 0.8 : 1);
  if (d.g.skills.includes('tiebi')) D *= 1.2;
  if (d.g.skills.includes('dunqiang')) D *= 1.3;
  if (a.g.skills.includes('shenshe')) D *= 0.75;
  let dmg = (A * A) / (A + D) / 52 * scaleLv(a.lv);
  dmg *= 0.55 + 0.45 * (a.troops / a.max);
  const edge = edgeOf(a, d); dmg *= edge;
  dmg *= formMul(a.side) * moraleMul(a.side);
  if (B.naval) { if (a.g.skills.includes('shuizhan')) dmg *= 1.25; if (d.g.skills.includes('shuizhan')) dmg /= 1.2; if (fa.naval) dmg *= fa.naval; if (fd.naval) dmg /= fd.naval; }
  if (B.round === 1) { if (a.g.skills.includes('tuji')) dmg *= 1.3; if (a.g.skills.includes('yexi')) dmg *= 1.15; if (fa.charge) dmg *= fa.charge; }
  if ((a.unit === 'arc') && fa.bow) dmg *= fa.bow;
  if (a.unit === 'arc' && B.weather === 'wind') dmg *= 1.15;
  if (a.g.skills.includes('danqi')) dmg *= 1 + 0.6 * (1 - a.troops / a.max);
  if (B.terrain === 'castle' && a.side === 'ally' && skillOnSide('ally', 'gongjiang')) dmg *= 1.12;
  // the back rows are hard to reach with a blade while the front holds
  const back = !opts.snipe && !ranged(a) && isBack(d) && frontHolds(d.side);
  if (back) dmg *= 0.6;
  // boss defences
  if (d.wall) dmg *= 0.25;
  if (iceStance(d)) dmg *= 0.3;
  if (veiled(d)) dmg *= 0.5;
  if (d.side === 'foe' && B.kit && B.kit.chained) dmg *= 0.75;
  if (B.lvgap && a.side === 'foe') dmg *= B.lvgap;
  const crit = 0.05 + (a.g.skills.includes('shenshe') ? 0.15 : 0) + (B.scouted && a.side === 'ally' ? 0.08 : 0);
  const isCrit = !opts.tele && Math.random() < crit;
  if (isCrit) dmg *= 1.5;
  if (d.guard) dmg *= opts.tele ? 0.35 : 0.5;
  dmg *= mul * rnd(0.88, 1.12);
  // misses: a nimble formation, fog on the river, a boss too quick for blades
  if (!opts.tele) {
    if (fd.evade && Math.random() < fd.evade) return { dmg: 0, miss: true };
    if (B.fog > 0 && a.side === 'ally' && Math.random() < 0.35) return { dmg: 0, miss: true, fog: true };
    if (B.kit && B.kit.evade && d.kidx === 0 && !ranged(a) && !disabled(d) && Math.random() < B.kit.evade) return { dmg: 0, miss: true };
  }
  return { dmg: Math.max(1, Math.round(dmg)), crit: isCrit, edge, back };
}
function tacPower(a) {
  let int = a.int;
  const s = a.side === 'ally' ? stratUnit() : null;
  if (s) int = Math.max(int, s.int * 0.92);
  return int;
}
const kitWeak = (d, el) => { const w = B.kit && B.kit.weak; return !!(w && w.el && el && w.el === el && d.kidx === (w.who || 0)); };
const kitImmuneEl = (d, el) => !!(B.kit && B.kit.immuneEl && el && B.kit.immuneEl[d.kidx] === el);
// the chance a tactic works on d: INT against INT, then element, weather and terrain
export function tacChance(a, d, t) {
  if (!t || !(t.pow || t.st) || t.t === 'self' || !isEnemyOf(a, d)) return 1;
  const P = tacPower(a);
  let c = t.pow ? 0.85 + (P - d.int) / 150 : 0.65 + (P - d.int) / 100;
  if (t.el === 'fire') { if (B.weather === 'rain') c -= 0.3; if (B.weather === 'wind') c += 0.1; if (B.terrain === 'forest') c += 0.05; }
  if (t.el === 'water' && (B.naval || B.terrain === 'river' || B.weather === 'rain')) c += 0.1;
  if (t.el === 'rock') { if (B.terrain === 'mountain' || B.terrain === 'hill') c += 0.1; if (B.naval) c -= 0.35; }
  if (t.el === 'thunder' && B.weather === 'rain') c += 0.15;
  if (kitWeak(d, t.el)) c += 0.15;
  if (t.st) {
    if (d.boss) c -= 0.2;
    const w = B.kit && B.kit.weak; if (w && w.st === t.st && d.kidx === 0) c += 0.35;
    if (d.boss && B.kit && B.kit.immune && B.kit.immune.includes(t.st)) return 0;
    if (d.g.skills.includes('kanpo') && ['confuse', 'stun', 'provoke', 'sleep'].includes(t.st)) return 0;
  }
  if (d.g.skills.includes('fanji')) c -= 0.2;
  const fd = formOf(d.side); if (fd.resist) c -= fd.resist;
  return Math.max(t.pow ? 0.1 : 0.05, Math.min(t.pow ? 0.97 : 0.95, c));
}
function tacDamage(a, d, t) {
  const int = tacPower(a), dint = d.int;
  // a clever caster against a dull target does more, but never wildly more
  let dmg = (t.pow || 1) * ((int + 40) / (dint * 0.6 + 70)) * 0.75 * scaleLv(a.lv);
  const f = formOf(a.side); dmg *= f.tac;
  dmg *= formMul(a.side) * moraleMul(a.side);
  if (a.g.skills.includes('guimou') || (a.side === 'ally' && S.strategist && GENERALS[S.strategist].skills.includes('guimou') && stratUnit())) dmg *= 1.15;
  if (t.el === 'fire') { if (B.weather === 'rain') dmg *= 0.6; if (B.weather === 'wind') dmg *= 1.3; if (B.terrain === 'forest') dmg *= 1.2; if (d.weakFire) dmg *= 2; if (a.g.skills.includes('gongjiang')) dmg *= 1.25; if (d.side === 'foe' && B.kit && B.kit.chained) dmg *= 1.4; }
  if (t.el === 'water') { if (B.weather === 'rain') dmg *= 1.3; if (B.naval || B.terrain === 'river') dmg *= 1.2; }
  if (t.el === 'thunder' && B.weather === 'rain') dmg *= 1.4;
  if (t.el === 'rock' && (B.terrain === 'mountain' || B.terrain === 'hill')) dmg *= 1.3;
  if (t.naval && B.naval) dmg *= t.naval;
  if (kitWeak(d, t.el)) dmg *= 1.5;
  if (B.kit && B.kit.resistAll && B.kit.resistAll[d.kidx]) dmg *= B.kit.resistAll[d.kidx];
  if (d.illusion) dmg *= 2;
  if (d.wall && t.el !== 'rock') dmg *= 0.25;
  if (veiled(d)) dmg *= 0.5;
  if (d.guard) dmg *= t.tele ? 0.35 : 0.5;
  if (B.lvgap && a.side === 'foe') dmg *= B.lvgap;
  return Math.max(1, Math.round(dmg * rnd(0.9, 1.1)));
}
function hurt(u, dmg) {
  if (dmg <= 0 || u.troops <= 0) return;
  u.troops -= dmg;
  if (u.st.sleep) { delete u.st.sleep; pop(u, L('驚醒', 'Woke'), '#80b0ff', 10); }
  if (u.troops <= 0 && u.buqu) { u.troops = 1; u.buqu = false; pop(u, L('不屈！', 'Unyielding!'), '#ffe080'); }
  if (u.troops <= 0) { u.troops = 0; u.anim = 'hurt'; u.at = 0; u.dead = true; fallen(u); }
  else { u.anim = 'hurt'; u.at = 0; }
  u.flash = 10; u.kb = Math.min(8, 3 + dmg / u.max * 30); u.sflinch = 8;
  checkPhases(u);
}
function heal(u, h) {
  if (u.troops <= 0) return 0;
  if (u.st.curse) { pop(u, L('詛咒阻止恢復', 'Curse blocks it'), '#d050d0'); return 0; }
  const before = u.troops; u.troops = Math.min(u.max, u.troops + Math.round(h)); return u.troops - before;
}
function pop(u, s, col = '#ffffff', dy = 0) { nums.push({ x: u.x + u.dx, y: u.y - (u.horse && !u.unhorsed ? 62 : 48) + dy, s: String(s), col, t: 0 }); }

// ---------- morale ----------
function morale(side, n) {
  if (!B.morale) return;
  const before = B.morale[side];
  B.morale[side] = Math.max(0, Math.min(100, B.morale[side] + n));
  return B.morale[side] - before;
}
// someone fell: their side loses heart, the other gains it; the last leader's fall breaks the enemy
function fallen(u) {
  if (u.summon) return;
  const other = u.side === 'ally' ? 'foe' : 'ally';
  morale(u.side, u.boss ? -25 : -12); morale(other, u.boss ? 15 : 8);
  if (B.kit && B.kit.fragile !== undefined && u.side === 'foe' && B.kit.fragile === u.kidx) { morale('foe', -40); B.pending.push({ say: L('紀靈倒下，袁軍軍心大亂！', 'Ji Ling falls and the Yuan army loses heart!') }); }
  if (B.kit && B.kit.avenge && u.boss) for (const v of alive('foe')) if (v.boss && !v.berserk) { v.berserk = true; B.pending.push({ say: L(`${N(v)}見同伴倒下，暴怒了！`, `${N(v)} sees his comrade fall and goes berserk!`), who: v }); }
  if (u.charge) delete u.charge;
}

// ---------- the battle ----------
// cfg: { foes: [{ id, lv, mul, boss }], boss, naval, terrain, canRun, music, foeForm, capture, intro, kit }
export function startBattle(cfg) {
  return new Promise((resolve) => {
    if (window.G && G.autoBattle && G.policy === 'smart') smartPrep(cfg);
    if (window.G && G.autoBattle && G.policy === 'brute') S.formation = 'fangyuan';
    Object.assign(B, { active: true, cfg, resolve, units: [], round: 0, weather: cfg.weather || 'clear', naval: !!cfg.naval, terrain: cfg.terrain || 'grass', form: formOk(S.formation) ? S.formation : 'fangyuan',
      foeForm: cfg.foeForm || ['fangyuan', 'yulin', 'heyi', 'changshe'][Math.floor(Math.random() * 4)], scouted: false, auto: false, over: false, fade: 30, prevSong: currentSong, ambush: {}, lvgap: cfg.lvgap || 0,
      kit: cfg.kit || null, morale: { ally: 50, foe: cfg.boss ? 55 : 50 }, fog: 0, pending: [], phaseDone: {}, nextMove: {}, cur: null, picking: null, stats: { tele: 0, cancel: 0 } });
    nums.length = 0; fxs.length = 0; shots.length = 0; fallers.length = 0; runners.length = 0; msg = '';
    S.front.filter((id) => member(id)).forEach((id, i) => B.units.push(makeUnit('ally', { id }, i)));
    cfg.foes.forEach((f, i) => B.units.push(makeUnit('foe', { ...f, kidx: i }, i)));
    layoutSide('ally', B.form, true); layoutSide('foe', B.foeForm, true);
    if (B.kit && B.kit.wall !== undefined) { const w = kitBoss(B.kit.wall); if (w) w.wall = true; }
    if (B.kit && B.kit.moves) B.kit.moves.forEach((m, i) => { B.nextMove[i] = m.first; });
    playMusic(cfg.music || (cfg.boss ? 'boss' : cfg.naval ? 'naval' : 'battle'));
    run().catch((e) => { console.error(e); finish('win'); });
  });
}
function finish(result) {
  B.active = false; B.over = true;
  // carry troops back to the army
  for (const u of B.units) if (u.side === 'ally' && u.m) u.m.troops = Math.max(0, u.troops);
  waits.length = 0;
  const r = B.resolve; B.resolve = null;
  if (r) r(result);
}
async function run() {
  await tick(26);
  const foes = alive('foe');
  const names = foes.slice(0, 3).map((u) => N(u)).join(L('、', ', '));
  say1(B.cfg.intro || L(`${names}${foes.length > 3 ? '等' : ''}的軍隊出現了！`, `The army of ${names}${foes.length > 3 ? ' and others' : ''} appears!`));
  await tick(50);
  // formations: does one side's formation beat the other's?
  const e = formEdge(B.form, B.foeForm);
  if (e > 0) { morale('ally', 10); morale('foe', -10); say1(L(`我軍陣形克制敵軍！（${BEAT_WHY[B.form][0]}）`, `Our formation beats theirs! (${BEAT_WHY[B.form][1]})`)); sfx('buff'); await tick(50); }
  else if (e < 0) { morale('ally', -10); morale('foe', 10); say1(L(`敵軍陣形克制我軍！（${BEAT_WHY[B.foeForm][0]}）`, `Their formation beats ours! (${BEAT_WHY[B.foeForm][1]})`)); sfx('buzz'); await tick(50); }
  if (B.kit && B.kit.info && B.cfg.boss) { say1(L('首領會預告大招：注意上方的提示。', 'Leaders announce their big moves: watch the line at the top.')); await tick(40); }
  // skills at the start
  for (const u of alive('ally').concat(alive('foe'))) if (u.g.skills.includes('jili')) { for (const v of alive(u.side)) v.buf.atk = 2; morale(u.side, 5); say1(L(`${N(u)}激勵全軍！`, `${N(u)} inspires the army!`)); sfx('buff'); await tick(30); }
  // a surprise attack: the enemy sometimes strikes first (scouts and surprise skills prevent it)
  let first = null;
  if (!B.cfg.boss && Math.random() < 0.08 && !skillOnSide('ally', 'qixi')) first = 'foe';
  else if (!B.cfg.boss && Math.random() < (skillOnSide('ally', 'yexi') ? 0.18 : 0.07)) first = 'ally';
  if (first) { say1(first === 'foe' ? L('敵軍突襲！', 'An enemy ambush!') : L('我軍搶得先機！', 'We strike first!')); await tick(40); }
  for (;;) {
    B.round++;
    await roundStart();
    if (await checkEnd()) return;
    const orders = new Map();
    if (first !== 'foe') { const r = await giveOrders(orders); if (r === 'run') { if (await tryRun()) return; orders.clear(); } }
    if (first === 'ally') { for (const u of alive('foe')) orders.set(u, { skip: true }); }
    first = null;
    // the enemy decides
    for (const u of alive('foe')) if (!orders.has(u)) orders.set(u, enemyOrder(u));
    for (const [u, o] of orders) if (u.side === 'foe' && o.kind === 'guard') u.guard = true;
    const order = [...orders.keys()].filter((u) => u.troops > 0).sort((a, b) => speedOf(b) - speedOf(a));
    for (const u of order) {
      if (u.troops <= 0) continue;
      let o = orders.get(u);
      if (o.skip) continue;
      // a general put to sleep or trapped after the orders were given loses the turn
      if (disabled(u)) { pop(u, u.st.sleep ? L('昏睡中', 'Asleep') : L('受困', 'Trapped'), '#c0c0ff'); await tick(14); continue; }
      if (u.st.confuse && !o.confused) o = { confused: true };
      await act(u, o);
      if (B.over) return;
      await processPending();
      if (await checkEnd()) return;
    }
    // a frenzied boss acts again
    for (const u of alive('foe').filter((v) => v.frenzy)) { if (disabled(u)) continue; await act(u, enemyOrder(u)); if (B.over) return; await processPending(); if (await checkEnd()) return; }
    await endOfRound();
    await processPending();
    if (await checkEnd()) return;
    // a battle cannot go on for ever: after forty rounds the supplies run out
    if (B.round >= 40) {
      say1(L('雙方兵糧耗盡，各自退兵了。', 'Both armies run out of supplies and fall back.')); await tick(60);
      finish(B.cfg.boss ? 'lose' : 'run'); return;
    }
  }
}
const speedOf = (u) => u.spd * buffK(u, 'spd') * formOf(u.side).spd * (u.g.skills.includes('jisu') ? 1.2 : 1) * (B.naval && u.g.skills.includes('guanxing') ? 1.2 : 1) * rnd(0.85, 1.15) + (u.guard ? 1000 : 0);

// ---------- boss mechanics ----------
const mvName = (m) => L(m.name[0], m.name[1]);
// at the start of each round: stances change, announced moves begin (or happen at once, for instant ones)
async function roundStart() {
  const k = B.kit;
  if (!k) return;
  if (k.stance) {
    const b = kitBoss(0);
    if (b && b.troops > 0) {
      const st = Math.floor((B.round - 1) / 2) % 2 ? 'ice' : 'mirror';
      if (b.stance !== st) { b.stance = st; say1(st === 'mirror' ? L(`${N(b)}擺出「鏡」之架勢：策略會被反彈！`, `${N(b)} takes the Mirror stance: ploys will bounce back!`) : L(`${N(b)}擺出「冰」之架勢：刀兵難傷！`, `${N(b)} takes the Ice stance: blades barely scratch him!`)); sfx('buff'); await tick(46); }
    }
  }
  if (k.wall !== undefined) {
    const b = kitBoss(k.wall);
    if (b && b.troops > 0 && !b.wall && !b.charge && b.wallT && B.round >= b.wallT) {
      const mv = k.moves.find((m) => m.kind === 'wall');
      b.charge = { mv, t: B.round }; b.wallT = 0;
      say1(L(`${N(b)}正在重整鐵壁……（迷魂、困陣可打斷）`, `${N(b)} is rebuilding his Iron Wall... (sleep or a trap stops him)`)); sfx('special'); await tick(46);
    }
  }
  if (!k.moves) return;
  for (let i = 0; i < k.moves.length; i++) {
    const mv = k.moves[i];
    if (mv.kind === 'wall' || B.round < B.nextMove[i]) continue;
    const u = kitBoss(mv.who);
    if (!u || u.troops <= 0) continue;
    if (u.charge || disabled(u) || u.st.confuse || (u.st.silence && isCast(mv))) { B.nextMove[i] = B.round + 1; continue; }
    B.nextMove[i] = B.round + mv.every;
    if (mv.instant || ['reflect', 'fog', 'ambush', 'shadows', 'illusion', 'curse'].includes(mv.kind)) { await instantMove(u, mv); continue; }
    const target = mv.kind === 'single' ? markTarget(u, mv) : null;
    u.charge = { mv, t: B.round, target };
    B.stats.tele++;
    say1(intentText(u));
    sfx('special'); await tick(50);
  }
}
const isCast = (mv) => ['tac', 'heal', 'decree', 'divide', 'freeze', 'curse'].includes(mv.kind);
// who a single-target move goes for: the strategist if it can reach them, else the weakest in reach
function markTarget(u, mv) {
  const list = alive('ally');
  const reach = mv.snipe ? list : list.filter((v) => !isBack(v) || !frontHolds('ally'));
  const s = stratUnit();
  if (s && reach.includes(s)) return s;
  return (reach.length ? reach : list).reduce((a, b) => (b.troops < a.troops ? b : a));
}
// the line at the top of the screen: what the enemy leaders are about to do
function intentText(u) {
  const c = u.charge; if (!c) return '';
  const m = c.mv;
  if (m.kind === 'single') return L(`${N(u)}蓄力中：下回合「${mvName(m)}」打向${N(c.target)}！`, `${N(u)} winds up: next turn, ${mvName(m)} at ${N(c.target)}!`);
  if (m.kind === 'wall') return L(`${N(u)}正在重整鐵壁`, `${N(u)} is rebuilding the Iron Wall`);
  if (m.kind === 'fireships') return L(`${N(u)}點燃火船：下回合火燒我全軍！`, `${N(u)} lights the fire ships: next turn they hit us all!`);
  if (m.kind === 'heal') return L(`${N(u)}準備「${mvName(m)}」：下回合全軍恢復！`, `${N(u)} prepares ${mvName(m)}: next turn his army recovers!`);
  if (m.kind === 'decree' || m.kind === 'divide' || m.kind === 'freeze') return L(`${N(u)}準備「${mvName(m)}」！`, `${N(u)} prepares ${mvName(m)}!`);
  return L(`${N(u)}蓄力中：下回合「${mvName(m)}」打向我全軍！`, `${N(u)} winds up: next turn, ${mvName(m)} on our whole army!`);
}
// what breaks off a charge, as a short hint
function cancelHint(m) {
  const c = m.cancel || [];
  const parts = [];
  if (c.includes('silence')) parts.push(L('封策', 'Seal'));
  if (c.includes('sleep')) parts.push(L('迷魂', 'Sleep'));
  if (c.includes('confuse')) parts.push(L('混亂', 'Confuse'));
  if (c.includes('stun')) parts.push(L('困陣', 'Trap'));
  if (c.includes('el:water')) parts.push(L('水計', 'Water'));
  if (c.includes('el:fire')) parts.push(L('火計', 'Fire'));
  if (c.includes('rain')) parts.push(L('下雨', 'Rain'));
  if (m.kind === 'fireships') parts.push(L('東風', 'Wind'));
  return parts.join('/');
}
export function intents() {
  const out = [], hints = [], more = [];
  if (!B.units) return out;
  for (const u of alive('foe')) {
    if (u.charge) {
      const m = u.charge.mv, h = cancelHint(m), def = m.kind === 'single' || m.kind === 'aoe' || m.kind === 'tac' || m.kind === 'fireships';
      out.push({ s: intentText(u), col: '#ffe060' });
      if (h || def) hints.push({ s: L(`對策：${[h && h + '可打斷', def && (m.kind === 'single' ? '被盯上的人防禦' : '全軍防禦')].filter(Boolean).join('，或')}`, `Answer: ${[h && h + ' breaks it off', def && (m.kind === 'single' ? 'the marked one defends' : 'everyone defends')].filter(Boolean).join(', or ')}`), col: '#c0f0a0' });
    }
    if (u.st.reflect > 0 || u.stance === 'mirror') more.push({ s: L(`${N(u)}：反計中，策略會被反彈 — 用攻擊`, `${N(u)}: ploys bounce back — attack instead`), col: '#c0f0ff' });
    if (u.stance === 'ice') more.push({ s: L(`${N(u)}：冰甲中，刀兵只剩三成 — 用策略`, `${N(u)}: ice armour, blades do 30% — use ploys`), col: '#a0e8ff' });
    if (u.wall) more.push({ s: L(`${N(u)}：鐵壁（傷害兩成五）— 落石、破甲或鋒矢陣可破`, `${N(u)}: Iron Wall (25% damage) — Rockfall, Armour Break or Arrowhead breaks it`), col: '#d0c8b8' });
  }
  out.push(...hints, ...more);
  if (B.fog > 0) out.push({ s: L('江霧瀰漫：我軍攻擊常落空 — 觀星、呼風可驅散', 'River fog: our blows often miss — Read the Stars or Call the Wind clears it'), col: '#c0d0e0' });
  if (B.ambush.foe && B.kit) out.push({ s: L('山上似有伏兵 — 偵察可識破', 'Something stirs on the slopes — Scout to reveal it'), col: '#c0e080' });
  return out;
}
async function instantMove(u, mv) {
  const allies = alive('ally');
  if (mv.kind === 'reflect') { u.st.reflect = (mv.turns || 2) + 1; say1(L(`${N(u)}擺出反計之陣：對他施計會反彈！`, `${N(u)} takes a Counterploy stance: ploys at him bounce back!`)); fxs.push({ k: 'circle', x: u.x, y: u.y - 30, t: 0 }); sfx('buff'); await tick(46); return; }
  if (mv.kind === 'fog') { B.fog = 4; say1(L(`${N(u)}喚起江霧！我軍攻擊會常常落空。`, `${N(u)} raises a river fog! Our blows will often miss.`)); sfx('spore'); await tick(46); return; }
  if (mv.kind === 'ambush') { B.ambush.foe = Math.round(tacDamage(u, allies[0] || u, { pow: 1.5 })); say1(L(`${N(u)}在山上埋下伏兵……`, `${N(u)} hides troops on the slopes...`)); await tick(40); return; }
  if (mv.kind === 'decree') { for (const v of alive('foe')) { v.buf.atk = 3; v.buf.def = 3; } morale('foe', 12); say1(L(`${N(u)}「${mvName(mv)}」：敵軍攻守上升！`, `${N(u)}: ${mvName(mv)}! The enemy grows stronger!`)); sfx('buff'); await tick(46); return; }
  if (mv.kind === 'curse') {
    say1(L(`${N(u)}「${mvName(mv)}」！`, `${N(u)}: ${mvName(mv)}!`)); sfx('spore');
    for (const v of allies) { if (v.g.skills.includes('kanpo')) { pop(v, L('看破！', 'Clear mind!'), '#a0d0ff'); continue; } v.st.curse = 4; pop(v, L('詛咒', 'Cursed'), '#d050d0'); fxs.push({ k: 'spirit', x: v.x, y: v.y - 30, t: 0 }); }
    await tick(50); return;
  }
  if (mv.kind === 'shadows' || mv.kind === 'illusion') {
    const room = 5 - alive('foe').length;
    if (room <= 0) return;
    let specs;
    if (mv.kind === 'shadows') {
      const pool = GEN_LIST.filter((g) => g.faction === 'sect' && !g.famous);
      specs = [0, 1].slice(0, room).map(() => ({ id: pool[Math.floor(Math.random() * pool.length)].id, lv: u.lv - 4, mul: 0.35, bomb: B.round + 1, summon: true }));
      say1(L(`${N(u)}召喚了影兵！影兵會在下一回合自爆！`, `${N(u)} summons Shadow Soldiers! They will blow up next turn!`));
    } else {
      const strong = alive('ally').sort((a, b) => b.atk - a.atk).slice(0, Math.min(2, room));
      specs = strong.map((v) => ({ id: v.id, lv: v.lv, mul: 0.35, illusion: true, summon: true, faction: 'sect' }));
      say1(L(`${N(u)}變出了${strong.map(N).join('、')}的幻影！`, `${N(u)} conjures copies of ${strong.map(N).join(' and ')}!`));
    }
    for (const sp of specs) addFoe(sp);
    sfx('special'); await tick(50);
  }
}
function addFoe(spec) {
  const used = new Set(B.units.filter((v) => v.side === 'foe' && !v.gone).map((v) => v.slot));
  let slot = 0; while (used.has(slot)) slot++;
  const u = makeUnit('foe', { kidx: 100 + B.units.length, ...spec }, slot);
  B.units.push(u);
  layoutSide('foe', B.foeForm);
  u.x = u.hx - 60; u.y = u.hy;
  fxs.push({ k: 'smoke', x: u.hx, y: u.hy - 30, t: 0 });
  return u;
}
// phases: at 60% / 30% troops a boss changes how it fights
function checkPhases(u) {
  const k = B.kit;
  if (!k || !k.phases || u.side !== 'foe' || u.troops <= 0) return;
  k.phases.forEach((p, i) => { if (!B.phaseDone[i] && p.who === u.kidx && u.troops / u.max <= p.at) { B.phaseDone[i] = 1; B.pending.push({ phase: p, who: u }); } });
}
async function processPending() {
  while (B.pending.length) {
    const p = B.pending.shift();
    if (p.say && !p.phase) { say1(p.say); if (p.who) { fxs.push({ k: 'boost', x: p.who.x, y: p.who.y - 30, t: 0 }); } sfx('buff'); await tick(46); continue; }
    const ph = p.phase, u = p.who;
    if (!ph || u.troops <= 0) continue;
    if (ph.say) { say1(L(ph.say[0], ph.say[1])); await tick(40); }
    if (ph.act === 'berserk' || ph.act === 'pill') {
      if (ph.act === 'pill') { const h = heal(u, u.max * 0.2); pop(u, '+' + h, '#80ffa0'); }
      u.berserk = true; morale('foe', 10); pop(u, L('暴怒！', 'Berserk!'), '#ff6040'); sfx('crit'); B.shake = 6;
      say1(L(`${N(u)}暴怒了！攻擊大增，防禦下降。`, `${N(u)} goes berserk! Much more attack, less defence.`)); await tick(46);
    } else if (ph.act === 'reinforce') {
      for (const f of ph.foes || []) if (alive('foe').length < 5) addFoe({ ...f });
      sfx('encounter'); await tick(40);
    } else if (ph.act === 'form') {
      const nf = beatenBy(B.form);
      if (nf && nf !== B.foeForm) { B.foeForm = nf; layoutSide('foe', nf); morale('foe', 5); say1(L(`敵軍變陣為「${FORMS[nf].zh}」，克制我軍的${FORMS[B.form].zh}！`, `The enemy shifts to ${FORMS[nf].en}, which beats our ${FORMS[B.form].en}!`)); sfx('buzz'); await tick(50); }
    } else if (ph.act === 'petals') {
      const pool = GEN_LIST.filter((g) => g.faction === 'sect' && !g.famous);
      for (let i = 0; i < 2 && alive('foe').length < 5; i++) addFoe({ id: pool[(i * 7 + B.round) % pool.length].id, lv: u.lv - 6, mul: 0.3, petal: true, summon: true });
      say1(L('兩朵黑蓮花瓣浮現，每回合為于吉療傷！', 'Two black lotus petals appear; they heal Yu Ji every turn!')); sfx('special'); await tick(46);
    } else if (ph.act === 'frenzy') { u.frenzy = true; u.berserk = true; sfx('crit'); B.shake = 8; await tick(30); }
  }
}
// something happened to a charging general: does it break off the move?
function tryCancel(u, cause) {
  if (!u.charge) return false;
  const m = u.charge.mv;
  if (!(m.cancel || []).includes(cause)) return false;
  delete u.charge;
  B.stats.cancel++;
  morale(u.side === 'foe' ? 'ally' : 'foe', 8); morale(u.side, -6);
  pop(u, L('打斷了！', 'Broken off!'), '#80ff80', -12);
  if (m.kind === 'wall') u.wallT = B.round + 2;
  return true;
}
// the announced move goes off
async function unleash(u) {
  const c = u.charge; delete u.charge;
  const m = c.mv, foeSide = 'ally';
  say1(L(`${N(u)}：「${mvName(m)}」！`, `${N(u)}: ${mvName(m)}!`));
  u.anim = m.kind === 'single' || m.kind === 'aoe' ? ((u.sheet && u.sheet.swing) || 'slash') : 'cast'; u.at = 0;
  sfx('special');
  for (let f = 0; f < 21; f++) { u.at = f; await tick(1); }
  u.anim = 'idle';
  const targets = alive(foeSide);
  if (m.kind === 'wall') { u.wall = true; pop(u, L('鐵壁！', 'Iron Wall!'), '#d0c8b8'); fxs.push({ k: 'shield', x: u.x, y: u.y - 30, t: 0 }); sfx('buff'); await tick(36); return; }
  if (m.kind === 'heal') { for (const v of alive('foe')) { const h = heal(v, v.max * m.heal); if (h) pop(v, '+' + h, '#80ffa0'); fxs.push({ k: 'boost', x: v.x, y: v.y - 30, t: 0 }); } sfx('heal'); morale('foe', 6); await tick(36); return; }
  if (m.kind === 'decree') { for (const v of alive('foe')) { v.buf.atk = 3; v.buf.def = 3; pop(v, L('攻防↑', 'ATK DEF↑'), '#ffe080'); } morale('foe', 15); sfx('buff'); await tick(36); return; }
  if (m.kind === 'divide' || m.kind === 'freeze') {
    const st = m.kind === 'divide' ? 'confuse' : 'stun';
    const strong = targets.filter((v) => !(v.g.skills.includes('kanpo'))).sort((a, b) => b.atk - a.atk).slice(0, 2);
    for (const v of strong) { v.st[st] = st === 'confuse' ? 3 : 2; pop(v, st === 'confuse' ? L('混亂', 'Confused') : L('凍結受困', 'Frozen'), st === 'confuse' ? '#e080ff' : '#a0e8ff'); fxs.push({ k: st === 'confuse' ? 'spirit' : 'ice', x: v.x, y: v.y - 30, t: 0 }); }
    morale('ally', -6); sfx('spore'); await tick(46); return;
  }
  let hitFoes = false;
  if (m.kind === 'fireships' && B.weather === 'wind') { hitFoes = true; say1(L('東風大作，火船被吹回了敵陣！', 'The wind blows the fire ships back into their own fleet!')); }
  const list = hitFoes ? alive('foe') : m.kind === 'single' ? [c.target && c.target.troops > 0 ? c.target : markTarget(u, m)] : targets;
  for (let t of list) {
    if (!t) continue;
    // a defending Shield Wall or Guardian general takes a blow aimed at a friend
    if (m.kind === 'single') {
      if (u.st.provoke && u.st.provoke.troops > 0) t = u.st.provoke;
      else { const g = alive('ally').find((v) => v !== t && v.guard && (v.g.skills.includes('dunqiang') || v.g.skills.includes('huwei'))); if (g) { say1(L(`${N(g)}挺身擋下！`, `${N(g)} steps in and takes it!`)); await tick(16); t = g; } }
    }
    let d;
    if (m.kind === 'single' || m.kind === 'aoe') d = physDamage(u, t, m.mul * TELE_MUL[m.kind], { tele: true, snipe: m.snipe || m.kind === 'aoe' }).dmg;
    else {
      d = tacDamage(u, t, { el: m.el, pow: m.pow * (TELE_MUL[m.kind] || 1.5), tele: true });
      if (m.kind === 'fireships' && B.weather === 'rain') d = Math.round(d * 0.35);
    }
    // a big move is meant to hurt, not to wipe out: capped at a share of the target's troops
    if (!hitFoes) d = Math.min(d, Math.round(t.max * (m.kind === 'single' ? 0.85 : 0.45) * (t.guard ? 0.35 : 1)));
    hurt(t, d); pop(t, d, t.guard ? '#c0d0ff' : '#ffb080');
    fxs.push({ k: m.el === 'fire' || m.kind === 'fireships' ? 'explosion' : m.el === 'water' ? 'pillar' : m.el === 'thunder' ? 'thunder' : m.el === 'dark' ? 'spirit' : 'cutx', x: t.x + t.dx, y: t.y - 28, t: 0, big: true });
    if (!t.guard && !hitFoes) morale('ally', -3);
  }
  sfx(m.el === 'fire' || m.kind === 'fireships' ? 'boom' : m.el === 'thunder' ? 'bolt' : 'crit'); B.shake = 8;
  await tick(40);
}

// ---------- your orders ----------
async function giveOrders(orders) {
  const fr = alive('ally');
  for (const u of fr) u.guard = false;
  if (window.G && G.autoBattle) {
    if (G.policy === 'brute') { for (const u of fr) orders.set(u, u.st.stun || u.st.sleep ? { skip: true } : u.st.confuse ? { confused: true } : bruteOrder(u)); }
    else smartOrders(fr, orders);
    for (const [u, o] of orders) if (o.kind === 'guard') u.guard = true;
    return;
  }
  if (B.auto) {
    if (input.held('b')) { B.auto = false; say1(L('停止全軍突擊。', 'The charge is called off.')); await tick(20); }
    else { for (const u of fr) orders.set(u, autoOrder(u)); return; }
  }
  let i = 0;
  while (i < fr.length) {
    const u = fr[i];
    if (u.st.stun || u.st.sleep) { orders.set(u, { skip: true, why: 'stun' }); i++; continue; }
    if (u.st.confuse) { orders.set(u, { confused: true }); i++; continue; }
    B.cur = u;
    const cmds = [L('攻擊', 'Attack'), L('策略', 'Tactic'), L('道具', 'Item'), L('防禦', 'Defend'), L('變陣', 'Formation'), L('兵法', 'Help'), L('全軍突擊', 'Charge!'), L('撤退', 'Retreat')];
    const dis = [false, !tacticsOf(u).length || !!u.st.silence, !Object.keys(S.items).some((k) => ITEMS[k] && ITEMS[k].kind === 'supply' && !ITEMS[k].fieldOnly), false, S.forms.length < 2, false, false, !B.cfg.canRun && B.cfg.canRun !== undefined];
    const c = await menu(cmds.map((s, k) => ({ label: s, disabled: dis[k] })), { x: 4, y: 186, w: 156, cols: 2, rowH: 13, cancel: true, title: N(u) });
    if (c === -1) { if (i > 0) { i--; while (i > 0 && (fr[i].st.stun || fr[i].st.sleep || fr[i].st.confuse)) i--; orders.delete(fr[i]); fr[i].guard = false; } continue; }
    if (c === 0) { const t = await pickTarget('foe', u); if (!t) continue; orders.set(u, { kind: 'attack', target: t }); i++; continue; }
    if (c === 1) { const o = await pickTactic(u); if (!o) continue; orders.set(u, o); i++; continue; }
    if (c === 2) { const o = await pickItem(u); if (!o) continue; orders.set(u, o); i++; continue; }
    if (c === 3) { orders.set(u, { kind: 'guard' }); u.guard = true; i++; continue; }
    if (c === 4) { const f = await pickForm(); if (!f) continue; orders.set(u, { kind: 'form', form: f }); i++; continue; }
    if (c === 5) { if (window.G && G.help) await G.help(true); continue; }
    if (c === 6) { B.auto = true; say1(L('全軍突擊！（按住B取消）', 'All-out charge! (hold B to stop)')); for (let k = i; k < fr.length; k++) orders.set(fr[k], autoOrder(fr[k])); B.cur = null; return; }
    if (c === 7) { B.cur = null; return 'run'; }
  }
  B.cur = null;
}
const tacCost = (t) => Math.max(1, Math.round(TACTICS[t].cost * (hasShensuan() ? 0.75 : 1)));
const hasShensuan = () => S.strategist && GENERALS[S.strategist].skills.includes('shensuan') && !!stratUnit();
function autoOrder(u) {
  const foes = alive('foe');
  const t = foes.reduce((a, b) => (b.troops < a.troops ? b : a), foes[0]);
  return { kind: 'attack', target: t };
}
// a change of formation, chosen in battle (it takes this general's turn)
async function pickForm() {
  const list = S.forms;
  let cur = Math.max(0, list.indexOf(B.form));
  const tag = (id) => { const e = formEdge(id, B.foeForm); return e > 0 ? L('克', '▲') : e < 0 ? L('被克', '▼') : ''; };
  const c = await menu(list.map((id) => ({ label: formName(id) + (B.form === id ? '◆' : ''), right: tag(id), rcolor: formEdge(id, B.foeForm) > 0 ? '#80ff90' : '#ff8080', disabled: !formOk(id) || id === B.form })), { x: 6, y: 40, w: 150, start: cur, maxRows: 9, title: L(`敵：${formName(B.foeForm)}`, `Foe: ${formName(B.foeForm)}`), onMove: (i) => { cur = i; },
    drawExtra: () => { const id = list[cur], f = FORMS[id]; descBox(L(f.desc[0], f.desc[1]) + '\n' + formCounterText(id), 196); } });
  return c < 0 ? null : list[c];
}
export function formCounterText(id) {
  const b = BEATS[id], by = beatenBy(id);
  if (!b && !by) return L('不在相剋之列。', 'Outside the circle of counters.');
  return L(`克制：${b ? FORMS[b].zh : '—'}　被克：${by ? FORMS[by].zh : '—'}`, `Beats: ${b ? FORMS[b].en : '-'}   Beaten by: ${by ? FORMS[by].en : '-'}`);
}
async function pickTarget(side, u, { all = false, down = false, tac = null } = {}) {
  let list = down ? B.units.filter((x) => x.side === side && x.troops <= 0 && !x.summon) : alive(side);
  if (!list.length) return null;
  if (all) return list;
  list = list.sort((a, b) => a.y - b.y || a.x - b.x);
  return new Promise((res) => {
    let i = 0;
    if (side === 'foe' && u && u.st.provoke && list.includes(u.st.provoke)) i = list.indexOf(u.st.provoke);
    const w = {
      update() {
        if (input.repeat('up') || input.repeat('left')) { i = (i + list.length - 1) % list.length; sfx('cursor'); }
        if (input.repeat('down') || input.repeat('right')) { i = (i + 1) % list.length; sfx('cursor'); }
        if (input.pressed('a')) { sfx('ok'); UIpop(w); B.picking = null; res(list[i]); return; }
        if (input.pressed('b')) { sfx('cancel'); UIpop(w); B.picking = null; res(null); return; }
        B.picking = { t: list[i], u, tac };
      },
      draw() {
        const t = list[i], f = (performance.now() / 120) | 0;
        ctx.drawImage(HAND, t.x + t.dx - 6 + (f % 2), t.y - 72);
      },
    };
    B.picking = { t: list[0], u, tac };
    UIpush(w);
  });
}
// the box at the top while choosing a target: who it is, how well we match up, and the chance a ploy works
// shown in the message panel while choosing a target: who it is, how well we match up, the chance a ploy works
function drawInfo(p) {
  const t = p.t, u = p.u, foe = t.side === 'foe';
  const X = 8; let y = 197;
  text(fit(`${N(t)} Lv${t.lv}`, 112), X, y, foe ? '#ffb0a0' : '#c0e0ff');
  icon(t.unit, 124, y + 3); y += 14;
  if (B.scouted || !foe) { text(fit(`${L('兵', 'T')}${t.troops} ${L('武', 'S')}${t.str} ${L('智', 'I')}${t.int}`, 146), X, y, '#e0e0e0'); y += 14; }
  else { text(unitName(t.unit), X, y, '#b8c8e0'); y += 14; }
  if (!foe || !u) return;
  const notes = [];
  if (p.tac) {
    const T = TACTICS[p.tac], ch = Math.round(tacChance(u, t, T) * 100);
    notes.push([L(`成功率 ${ch}%`, `Chance ${ch}%`), ch >= 70 ? '#80ff90' : ch >= 40 ? '#ffe070' : '#ff8080']);
    if (mirrored(t)) notes.push([L('會反彈！', 'Reflects!'), '#c0f0ff']);
    else if (kitWeak(t, T.el) && B.scouted) notes.push([L('弱點！', 'Weak point!'), '#80ff90']);
  } else {
    const e = edgeOf(u, t);
    if (e > 1.01) notes.push([L(`▲克制 x${e}`, `▲Strong x${e}`), '#80ff90']); else if (e < 0.99) notes.push([L(`▼被克制 x${e}`, `▼Weak x${e}`), '#ff8080']);
    if (!ranged(u) && isBack(t) && frontHolds(t.side)) notes.push([L('後排 -40%', 'Back row -40%'), '#ffc080']);
    if (B.kit && B.kit.guards && t.kidx === 0 && guardOf(t)) notes.push([L('有親兵護衛', 'Guarded'), '#ffc080']);
    else if (B.kit && B.kit.evade && t.kidx === 0 && !ranged(u)) notes.push([L('難以命中', 'Hard to hit'), '#ffc080']);
  }
  for (const [s1, c] of notes.slice(0, 3)) { if (y > 254) break; text(fit(s1, 146), X, y, c); y += 14; }
}
async function pickTactic(u) {
  const list = tacticsOf(u).filter((t) => TACTICS[t]);
  const foes = alive('foe');
  // the chance shown in the menu: against the average enemy (each target's own chance shows when aiming)
  const pct = (id) => { const t = TACTICS[id]; if (!(t.pow || t.st) || t.t === 'self' || t.t[0] !== 'e' || !foes.length) return ''; return Math.round(foes.reduce((s, f) => s + tacChance(u, f, t), 0) / foes.length * 100) + '%'; };
  const items = list.map((t) => ({ label: tacName(t), right: `${pct(t)} ${tacCost(t)}`.trim(), disabled: tacCost(t) > S.tp || (TACTICS[t].escape && B.cfg.boss) || (TACTICS[t].t === 'down' && !B.units.some((x) => x.side === 'ally' && x.troops <= 0 && !x.summon)) }));
  let cur = 0;
  const c = await menu(items, { x: 6, y: 34, w: 196, title: L(`策略值 ${S.tp}/${tpMax()}　成功率 消耗`, `SP ${S.tp}/${tpMax()}  chance cost`), maxRows: 8, onMove: (i) => { cur = i; }, drawExtra: () => { const d = TAC_DESC[list[cur]]; if (d) descBox(L(d[0], d[1]), 196); } });
  if (c < 0) return null;
  const t = TACTICS[list[c]];
  let target = null;
  if (t.t === 'e1') { target = await pickTarget('foe', u, { tac: t.id }); if (!target) return null; }
  else if (t.t === 'a1') { target = await pickTarget('ally', u); if (!target) return null; }
  else if (t.t === 'down') { target = await pickTarget('ally', u, { down: true }); if (!target) return null; }
  return { kind: 'tactic', tac: t.id, target, cost: tacCost(t.id) };
}
async function pickItem(u) {
  const ids = Object.keys(S.items).filter((k) => ITEMS[k] && ITEMS[k].kind === 'supply' && !ITEMS[k].fieldOnly);
  const c = await menu(ids.map((k) => ({ label: itemName(k), right: S.items[k] })), { x: 6, y: 60, w: 160, title: L('道具', 'Items'), maxRows: 7 });
  if (c < 0) return null;
  const it = ITEMS[ids[c]];
  let target = null;
  if (it.target === 'one') { target = await pickTarget('ally', u); if (!target) return null; }
  if (it.target === 'down') { target = await pickTarget('ally', u, { down: true }); if (!target) return null; }
  return { kind: 'item', item: ids[c], target };
}
async function tryRun() {
  if (B.cfg.boss || B.cfg.canRun === false) { say1(L('無法撤退！', 'There is no retreat!')); await tick(40); return false; }
  const mine = alive('ally').reduce((t, u) => t + u.spd, 0) / Math.max(1, alive('ally').length), theirs = alive('foe').reduce((t, u) => t + u.spd, 0) / Math.max(1, alive('foe').length);
  if (Math.random() < 0.55 + (mine - theirs) / 100) { say1(L('全軍撤退了。', 'The army withdraws.')); sfx('run'); await tick(40); finish('run'); return true; }
  say1(L('撤退失敗！', "Couldn't get away!")); await tick(40); return false;
}

// ---------- the test bots' generals ----------
// G.policy 'brute': the whole army charges and the clever ones throw the biggest tactic they can afford.
// G.policy 'smart' (the story bot): picks the formation that beats the enemy's, keeps the strategist in the back,
// scouts, answers announced moves, works the boss's weak point, heals and cures.
const weakest = (list) => list.reduce((a, b) => (b.troops < a.troops ? b : a), list[0]);
function bruteOrder(u) {
  const foes = alive('foe');
  if (u.int >= 80 && !u.st.silence) {
    const opts = tacticsOf(u).map((id) => TACTICS[id]).filter((t) => t && t.pow && (t.t === 'e1' || t.t === 'eall') && tacCost(t.id) <= S.tp);
    if (opts.length) {
      const score = (t) => t.pow * (t.t === 'eall' ? foes.length : 1.3);
      const t = opts.sort((a, b) => score(b) - score(a))[0];
      return { kind: 'tactic', tac: t.id, target: weakest(foes), cost: tacCost(t.id) };
    }
  }
  return autoOrder(u);
}
const power = (id) => { const g = GENERALS[id]; return g.str + g.lead + g.int * 0.5; };
// before the battle: who stands in the line, in which formation, and where
function smartPrep(cfg) {
  const kit = cfg.kit, live = Object.keys(S.roster).filter((id) => S.roster[id].troops > 0);
  const unitOf = (id) => GENERALS[id].unit;
  const kinds = kit && kit.moves ? kit.moves.map((m) => m.kind) : [];
  const want = [];
  if (S.strategist && S.roster[S.strategist]) want.push(S.strategist);
  if (kinds.some((k) => ['curse', 'divide', 'fog', 'freeze'].includes(k))) want.push('erin');
  if (kinds.includes('single')) want.push('josh');
  const archers = live.filter((id) => unitOf(id) === 'arc').sort((a, b) => GENERALS[b].str - GENERALS[a].str);
  if ((kit && kit.evade) || cfg.foeForm === 'tuzhen' || (kit && kit.weak && kit.weak.unit === 'arc')) want.push(...archers.slice(0, 2));
  const score = (id) => power(id) * (cfg.naval && unitOf(id) === 'nav' ? 1.35 : 1);
  let front = live.slice().sort((a, b) => score(b) - score(a)).slice(0, 5);
  for (const w of [...new Set(want)]) {
    if (!live.includes(w) || front.includes(w)) continue;
    const drop = front.filter((id) => !want.includes(id)).sort((a, b) => score(a) - score(b))[0];
    if (drop) front[front.indexOf(drop)] = w; else if (front.length < 5) front.push(w);
  }
  const must = new Set(want);
  // the formation: the one that beats theirs, else one theirs does not beat
  const foeF = cfg.foeForm;
  const tryForm = (f) => arrange(f, front, must, live);
  let pick = null;
  const counter = foeF ? beatenBy(foeF) : null;
  if (counter && S.forms.includes(counter)) pick = tryForm(counter) && counter;
  if (!pick && cfg.naval && S.forms.includes('shuijun') && tryForm('shuijun')) pick = 'shuijun';
  if (!pick) for (const f of ['heyi', 'fangyuan', 'yulin', 'changshe', 'bagua', 'yanyue', 'fengshi', 'yanxing', 'tuzhen']) if (S.forms.includes(f) && (!foeF || formEdge(f, foeF) >= 0) && tryForm(f)) { pick = f; break; }
  if (!pick) pick = 'fangyuan';
  S.front = arrange(pick, front, must, live) || front;
  S.formation = pick;
}
function arrange(f, front, must, live) {
  const F = FORMS[f]; let fr = front.slice();
  const st = (id, k) => stat(S.roster[id], k), unitOf = (id) => GENERALS[id].unit;
  const swapIn = (want, n) => {
    let need = n - fr.filter((id) => unitOf(id) === want).length;
    const extra = live.filter((id) => unitOf(id) === want && !fr.includes(id)).sort((a, b) => power(b) - power(a));
    while (need > 0 && extra.length) { const drop = fr.filter((id) => unitOf(id) !== want && !must.has(id)).sort((a, b) => power(a) - power(b))[0]; if (!drop) break; fr[fr.indexOf(drop)] = extra.shift(); need--; }
    return need <= 0;
  };
  let lead = null;
  switch (F.cond) {
    case 'lead_str80': lead = fr.slice().sort((a, b) => st(b, 'str') - st(a, 'str'))[0]; if (!lead || st(lead, 'str') < 80) return null; break;
    case 'lead_lead85': lead = fr.slice().sort((a, b) => st(b, 'lead') - st(a, 'lead'))[0]; if (!lead || st(lead, 'lead') < 85) return null; break;
    case 'str_int95': { const s = S.roster[S.strategist]; if (!s || stat(s, 'int') < 95 || !fr.includes(S.strategist)) return null; break; }
    case 'arc2': if (!swapIn('arc', 2)) return null; break;
    case 'nav3': if (!swapIn('nav', 3)) return null; break;
    case 'cav3': if (!swapIn('cav', 3)) return null; fr.sort((a, b) => (unitOf(a) === 'cav' ? 0 : 1) - (unitOf(b) === 'cav' ? 0 : 1)); break;
  }
  if (lead) fr = [lead, ...fr.filter((x) => x !== lead)];
  const fixed = F.cond === 'cav3' ? 3 : lead ? 1 : 0;
  const pos = F.pos, slots = fr.map((_, i) => i);
  const put = (id, ok) => { const i = fr.indexOf(id); if (i < fixed || i < 0) return; const j = slots.find((k) => k >= fixed && ok(pos[k]) && fr[k] !== id && !(fr[k] === S.strategist)); if (j === undefined || ok(pos[i])) return; [fr[i], fr[j]] = [fr[j], fr[i]]; };
  // the strategist at the back, a shield-wall general at the front
  if (fr.includes(S.strategist)) put(S.strategist, (p) => p[0] >= 2);
  for (const id of fr.filter((x) => GENERALS[x].skills.includes('dunqiang'))) put(id, (p) => p[0] === 0);
  return fr;
}
const S_TAC = { stun: ['qimen'], sleep: ['mihun'], confuse: ['hunluan'], silence: ['fengce'] };
function smartOrders(fr, orders) {
  const foes = alive('foe');
  let tp = S.tp;
  const free = fr.filter((u) => { if (u.st.stun || u.st.sleep) { orders.set(u, { skip: true }); return false; } if (u.st.confuse) { orders.set(u, { confused: true }); return false; } return true; });
  const assign = (u, o) => { orders.set(u, o); if (o.cost) tp -= o.cost; };
  const can = (u, id) => !u.st.silence && TACTICS[id] && tacticsOf(u).includes(id) && tacCost(id) <= tp;
  const pool = () => free.filter((u) => !orders.has(u));
  const bestCaster = (ids, target, minCh = 0) => { let best = null; for (const u of pool()) for (const id of ids) if (can(u, id)) { const ch = target ? tacChance(u, target, TACTICS[id]) : 1; if (ch >= minCh && (!best || ch > best.ch || (ch === best.ch && u.atk < best.u.atk))) best = { u, id, ch }; } return best; };
  const castOn = (b, target) => assign(b.u, { kind: 'tactic', tac: b.id, target, cost: tacCost(b.id) });
  let pills = have('qingxin');
  // the enemy changed formation to beat ours: change back to one that beats theirs
  if (B.round > 1 && formEdge(B.form, B.foeForm) < 0 && pool().length) {
    let f = beatenBy(B.foeForm);
    if (!(f && S.forms.includes(f) && formOk(f))) f = S.forms.find((x) => formOk(x) && formEdge(x, B.foeForm) >= 0);
    if (f) assign(pool().sort((a, b) => a.atk - b.atk)[0], { kind: 'form', form: f });
  }
  // announced moves: break them off while they charge, defend when they go off
  for (const c of foes.filter((v) => v.charge)) {
    const m = c.charge.mv, cancel = m.cancel || [], goesNow = B.round > c.charge.t;
    const harmless = ['single', 'aoe', 'tac', 'fireships'].includes(m.kind);
    if (!goesNow || !harmless) {
      const ids = [];
      for (const k of ['silence', 'sleep', 'stun', 'confuse']) if (cancel.includes(k)) ids.push(...S_TAC[k]);
      if (cancel.includes('el:water')) ids.push('shuiji', 'dashui', 'hongshui');
      if (cancel.includes('el:fire')) ids.push('huoji', 'dahuo', 'liehuo', 'huolong');
      let miss = 1, tries = 0;
      while (miss > 0.25 && tries < 3) { const b = bestCaster(ids, c, 0.3); if (!b) break; castOn(b, c); miss *= 1 - b.ch; tries++; }
      if (miss > 0.25 && cancel.includes('rain') && B.weather !== 'rain') { const b = bestCaster(['tianbian'], null); if (b) { castOn(b, null); miss = 0; } }
      if (miss > 0.25 && m.kind === 'fireships' && B.weather !== 'wind' && B.weather !== 'rain') { const b = bestCaster(['hufeng', 'tianbian'], null); if (b) { castOn(b, null); miss = 0; } }
    }
    if (goesNow) {
      if (m.kind === 'single') {
        const t = c.charge.target;
        const tank = pool().find((v) => v !== t && (v.g.skills.includes('dunqiang') || v.g.skills.includes('huwei')));
        if (t && pool().includes(t)) assign(t, { kind: 'guard' });
        if (tank) assign(tank, { kind: 'guard' });
      } else if (harmless && !(m.kind === 'fireships' && B.weather === 'wind')) {
        const keep = m.kind === 'aoe' ? pool().filter((v) => v.troops > v.max * 0.9).sort((a, b) => b.atk - a.atk).slice(0, 1) : [];
        for (const v of pool()) if (!keep.includes(v)) assign(v, { kind: 'guard' });
      }
    }
  }
  // scout the leader at the start, and whenever an ambush is laid
  if (B.cfg.boss && ((!B.scouted && B.round === 1) || B.ambush.foe)) { const b = bestCaster(['zhencha'], null); if (b) castOn(b, null); }
  // curses, confusion and fog
  const troubled = fr.filter((v) => v.st.curse || v.st.confuse);
  if (troubled.length >= 2 || B.fog > 0) { const b = bestCaster(['guanxing'], null); if (b) castOn(b, null); else if (B.fog > 0) { const w = bestCaster(['hufeng'], null); if (w && B.weather !== 'wind') castOn(w, null); } }
  for (const v of fr.filter((x) => x.st.confuse || (x.st.curse && x.troops < x.max * 0.5))) {
    if (pills <= 0) break;
    const u = pool().sort((a, b) => a.atk - b.atk)[0]; if (!u) break;
    assign(u, { kind: 'item', item: 'qingxin', target: v }); pills--;
  }
  // the fallen and the hurt
  const down = B.units.filter((v) => v.side === 'ally' && v.troops <= 0 && !v.fled);
  if (down.length) { const b = bestCaster(['fuhuo'], null); if (b) castOn(b, down[0]); else if (have('zhaohun') && pool().length) assign(pool().sort((a, b) => a.atk - b.atk)[0], { kind: 'item', item: 'zhaohun', target: down[0] }); }
  const low = () => fr.filter((v) => v.troops > 0 && v.troops < v.max * 0.45 && !v.st.curse);
  if (low().length >= 2) { const b = bestCaster(['dahui', 'huifu'], null); if (b) castOn(b, null); else if (have('rations') && pool().length) assign(pool().sort((a, b) => a.atk - b.atk)[0], { kind: 'item', item: 'rations' }); }
  for (const v of low()) {
    if ([...orders.values()].some((o) => o.target === v && (o.kind === 'item' || (o.kind === 'tactic' && TACTICS[o.tac].heal)))) continue;
    const b = bestCaster(['zhiliao'], null);
    if (b) { castOn(b, v); continue; }
    const it = have('jinchuang') ? 'jinchuang' : have('salve') ? 'salve' : null;
    const u = pool().sort((a, b) => a.atk - b.atk)[0];
    if (it && u) { assign(u, { kind: 'item', item: it, target: v }); S.items[it]--; }
  }
  // restore the items count (they are taken when used)
  for (const [, o] of orders) if (o.kind === 'item' && (o.item === 'jinchuang' || o.item === 'salve')) S.items[o.item]++;
  if (tp < tpMax() * 0.2 && B.cfg.boss && have('tpdan') && pool().length > 2) assign(pool().sort((a, b) => a.atk - b.atk)[0], { kind: 'item', item: 'tpdan' });
  // a healer on their side: seal it
  if (B.kit && B.kit.healer) { const h = kitBoss(B.kit.healer.who); if (h && h.troops > 0 && !h.st.silence) { const b = bestCaster(['fengce'], h, 0.3); if (b) castOn(b, h); } }
  // an iron wall: break it
  for (const w of foes.filter((v) => v.wall)) { const b = bestCaster(['luoshi', 'shanbeng', 'pojia'], w, 0.3); if (b) castOn(b, w); }
  // everyone else fights
  for (const u of pool()) { const o = smartFight(u, foes, tp); assign(u, o); }
}
// the focus of the attack: things that blow up or heal, then guards, healers, the weaker of a pair, the leader
function focusFor(u, foes, phys) {
  const pri = foes.filter((v) => v.bomb || v.petal);
  if (pri.length) return weakest(pri);
  const ill = foes.filter((v) => v.illusion);
  if (ill.length) return weakest(ill);
  const k = B.kit;
  let list = foes.filter((v) => v.boss);
  if (k && k.guards && phys) { const g = foes.filter((v) => k.guards.includes(v.kidx)); if (g.length) return weakest(g); }
  if (k && k.healer) { const h = kitBoss(k.healer.who); if (h && h.troops > 0) return h; }
  if (phys) {
    list = list.filter((v) => !v.wall && !iceStance(v) && !(k && k.evade && v.kidx === 0 && !ranged(u)));
  }
  const nearly = foes.filter((v) => !v.boss && v.troops < v.max * 0.2);
  if (nearly.length) return weakest(nearly);
  if (list.length) return list.reduce((a, b) => (b.troops / b.max < a.troops / a.max ? b : a));
  const rest = phys ? foes.filter((v) => !v.wall && !iceStance(v) && !(k && k.evade && v.kidx === 0 && !ranged(u))) : foes;
  return weakest(rest.length ? rest : foes);
}
function smartFight(u, foes, tp) {
  const ft = focusFor(u, foes, true);
  // expected damage of a plain attack on the focus, against the best tactic
  let phys = 0;
  for (let k = 0; k < 3; k++) { const r = physDamage(u, ft, 1); phys += Math.min(ft.troops, r.dmg) / 3; }
  if (guardOf(ft)) phys *= 0.8;
  const clever = !u.st.silence && (u.int >= 70 || u.int > u.str + 10);
  if (clever && tp > tpMax() * 0.12) {
    let best = null;
    for (const id of tacticsOf(u)) {
      const t = TACTICS[id];
      if (!t || !t.pow || !(t.t === 'e1' || t.t === 'eall') || tacCost(id) > tp) continue;
      const val = (x) => { if (mirrored(x)) return -tacDamage(u, u, t); if (kitImmuneEl(x, t.el)) return -tacDamage(u, x, t) * 0.5; return Math.min(x.troops, tacDamage(u, x, t)) * tacChance(u, x, t) * (x.bomb || x.petal ? 1.5 : 1); };
      let v, target = null;
      if (t.t === 'eall') v = foes.reduce((sum, x) => sum + val(x), 0);
      else {
        const focus = focusFor(u, foes, false);
        for (const x of new Set([focus, ...foes.filter((y) => y.boss || y.illusion || y.bomb)])) { const vx = val(x) * (x === focus ? 1.15 : 1); if (v === undefined || vx > v) { v = vx; target = x; } }
      }
      // spend points only where they buy clearly more than a blade would; cheap ploys are preferred
      const worth = v / (1 + tacCost(id) / 40);
      if (!best || worth > best.w) best = { w: worth, v, id, target };
    }
    if (best && best.v > phys * 1.2) return { kind: 'tactic', tac: best.id, target: best.target, cost: tacCost(best.id) };
  }
  return { kind: 'attack', target: ft };
}

// ---------- the enemy's choices ----------
function enemyOrder(u) {
  if (u.st.stun || u.st.sleep) return { skip: true, why: 'stun' };
  if (u.st.confuse) return { confused: true };
  if (u.charge) return B.round > u.charge.t ? { kind: 'unleash' } : { kind: 'charging' };
  if (u.bomb && B.round >= u.bomb) return { kind: 'explode' };
  if (u.petal) return { kind: 'bloom' };
  const full = !!B.cfg.boss;
  const allies = alive('ally');
  const hk = B.kit && B.kit.healer;
  if (hk && u.kidx === hk.who && !u.st.silence && !(u.healCd > B.round)) {
    const t = hk.of.map(kitBoss).filter((v) => v && v.troops > 0 && v.troops < v.max * 0.55).sort((a, b) => a.troops / a.max - b.troops / b.max)[0];
    if (t) return { kind: 'kitheal', target: t };
  }
  if (u.st.provoke && u.st.provoke.troops > 0) return { kind: 'attack', target: u.st.provoke };
  const tacs = u.st.silence ? [] : u.own.map((t) => TACTICS[t]).filter((t) => t && !t.escape && !t.scout && !t.weather && (full || !['sleep', 'silence', 'fear', 'defdown'].includes(t.st)));
  if (tacs.length && Math.random() < Math.min(0.6, u.int / 150 + (u.boss ? 0.1 : 0))) {
    const hurtFriend = alive('foe').filter((v) => v.troops < v.max * 0.4 && !v.summon).sort((a, b) => a.troops / a.max - b.troops / b.max)[0];
    const heal = tacs.find((t) => t.heal && t.t === 'aall') || tacs.find((t) => t.heal);
    if (hurtFriend && heal) return { kind: 'tactic', tac: heal.id, target: hurtFriend, free: true };
    if (full) {
      const buff = tacs.find((t) => t.buff && !alive('foe').some((v) => v.buf[t.buff] > 0));
      if (buff && Math.random() < 0.5) return { kind: 'tactic', tac: buff.id, target: u, free: true };
      const stt = tacs.filter((t) => t.st && t.t === 'e1');
      if (stt.length && Math.random() < 0.4) { const t = stt[Math.floor(Math.random() * stt.length)]; const strong = allies.filter((v) => !v.st[t.st]).sort((a, b) => b.atk - a.atk)[0]; if (strong) return { kind: 'tactic', tac: t.id, target: strong, free: true }; }
      const big = tacs.filter((t) => t.pow && t.t === 'eall'); if (big.length && allies.length >= 3) return { kind: 'tactic', tac: big[big.length - 1].id, free: true };
    }
    const atk = tacs.filter((t) => t.pow || (t.st && t.st !== 'ambush'));
    if (atk.length) {
      const t = atk[Math.floor(Math.random() * atk.length)];
      if (t.t === 'self' || t.t === 'aall') return { kind: 'tactic', tac: t.id, target: u, free: true };
      return { kind: 'tactic', tac: t.id, target: pickWeighted(allies, u), free: true };
    }
  }
  if (full && !u.boss && !u.summon && u.troops < u.max * 0.2 && Math.random() < 0.35) return { kind: 'guard' };
  return { kind: 'attack', target: pickWeighted(allies, u) };
}
// enemies aim by the formation's exposure, avoid the back rows with blades, like a good matchup; in leader
// fights they also go for the weak and for our strategist
function pickWeighted(list, a) {
  const f = formOf('ally'), full = B.cfg && B.cfg.boss, s = stratUnit();
  const wts = list.map((v) => {
    let w = f.hit[v.slot] || 1;
    if (a && !ranged(a) && isBack(v) && frontHolds(v.side)) w *= 0.25;
    if (a) { const e = edgeOf(a, v); w *= e > 1.01 ? 1.6 : e < 0.99 ? 0.6 : 1; }
    if (full) { w *= 1 + (1 - v.troops / v.max); if (v === s) w *= 1.5; }
    return w;
  });
  let r = Math.random() * wts.reduce((x, y) => x + y, 0);
  for (let i = 0; i < list.length; i++) { r -= wts[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}

// ---------- doing things ----------
async function act(u, o) {
  if (o.confused) {
    const all = B.units.filter((x) => x.troops > 0 && x !== u);
    const t = all[Math.floor(Math.random() * all.length)];
    say1(L(`${N(u)}陷入混亂，胡亂攻擊！`, `${N(u)} is confused and lashes out!`)); await tick(20);
    if (t) await attack(u, t, true);
    return;
  }
  if (o.kind === 'guard') { say1(L(`${N(u)}嚴陣以待。`, `${N(u)} stands on guard.`)); await tick(fast ? 6 : 14); return; }
  if (o.kind === 'charging') { say1(L(`${N(u)}正在蓄力……`, `${N(u)} is gathering strength...`)); pop(u, L('蓄力', 'Charging'), '#ffe040'); await tick(24); return; }
  if (o.kind === 'unleash') { if (u.charge) await unleash(u); return; }
  if (o.kind === 'bloom') {
    const b = kitBoss(0); if (!b || b.troops <= 0) return;
    const h = heal(b, b.max * 0.05); if (h) { pop(b, '+' + h, '#c080ff'); say1(L('黑蓮花瓣為于吉療傷。', 'A lotus petal heals Yu Ji.')); fxs.push({ k: 'spirit', x: b.x, y: b.y - 30, t: 0 }); await tick(24); }
    return;
  }
  if (o.kind === 'explode') {
    say1(L(`${N(u)}自爆了！`, `${N(u)} blows itself up!`)); fxs.push({ k: 'explosion', x: u.x, y: u.y - 26, t: 0, big: true }); sfx('boom'); B.shake = 7;
    for (const t of alive('ally')) { const d = tacDamage(u, t, { el: 'dark', pow: 0.5, tele: true }); hurt(t, d); pop(t, d, '#ffb080'); }
    u.troops = 0; u.dead = true; u.gone = true; await tick(36); return;
  }
  if (o.kind === 'kitheal') {
    const t = o.target && o.target.troops > 0 ? o.target : u;
    say1(L(`${N(u)}為${N(t)}療傷！`, `${N(u)} heals ${N(t)}!`));
    u.anim = 'cast'; u.at = 0; sfx('special'); for (let f = 0; f < 18; f++) { u.at = f; await tick(1); } u.anim = 'idle';
    const h = heal(t, t.max * B.kit.healer.heal); if (h) pop(t, '+' + h, '#80ffa0'); fxs.push({ k: 'boost', x: t.x, y: t.y - 30, t: 0 }); sfx('heal');
    u.healCd = B.round + (B.kit.healer.cd || 2); await tick(30); return;
  }
  if (o.kind === 'form') {
    if (!formOk(o.form)) { say1(L('條件不足，無法變陣。', 'The conditions are not met.')); await tick(30); return; }
    B.form = o.form; layoutSide('ally', B.form);
    const e = formEdge(B.form, B.foeForm);
    say1(L(`${N(u)}下令變陣為「${FORMS[B.form].zh}」！${e > 0 ? '克制敵陣！' : ''}`, `${N(u)} orders the ${FORMS[B.form].en} formation!${e > 0 ? ' It beats theirs!' : ''}`));
    if (e > 0) morale('ally', 6);
    sfx('buff'); await tick(46); return;
  }
  if (o.kind === 'attack') {
    let t = o.target;
    if (!t || t.troops <= 0) { const l = alive(u.side === 'ally' ? 'foe' : 'ally'); if (!l.length) return; t = u.side === 'foe' ? pickWeighted(l, u) : (B.kit && window.G && G.autoBattle ? focusFor(u, l, true) : l[0]); }
    if (u.st.provoke && u.st.provoke.troops > 0) t = u.st.provoke;
    if (u.g.skills.includes('guishen') || (u.g.skills.includes('yiqi') && Math.random() < 0.25)) { await attackAll(u); return; }
    await attack(u, t);
    if (u.troops > 0 && t.troops > 0 && u.g.skills.includes('lianji') && Math.random() < 0.3) { say1(L('連擊！', 'Double strike!')); await attack(u, t, false, 0.6); }
    if (u.equip.weapon === 'liannu' && t.troops > 0 && Math.random() < 0.5) { say1(L('連弩齊發！', 'The repeating crossbow fires again!')); await attack(u, t, false, 0.5); }
    return;
  }
  if (o.kind === 'tactic') { await castTactic(u, TACTICS[o.tac], o); return; }
  if (o.kind === 'item') { await useItem(u, o); }
}
// a bodyguard who stands in front of the leader they protect
function guardOf(t) {
  const k = B.kit;
  if (!k || !k.guards || t.side !== 'foe' || t.kidx !== 0) return null;
  return alive('foe').find((v) => k.guards.includes(v.kidx) && !disabled(v) && !v.st.confuse && !v.st.provoke) || null;
}
// who takes the blow: a bodyguard, or a guardian may step in front
function cover(t) {
  const g = guardOf(t); if (g) return g;
  for (const v of alive(t.side)) {
    if (v === t) continue;
    if (v.g.skills.includes('dunqiang') && Math.random() < 0.4) return v;
    if (v.g.skills.includes('huwei') && t.troops < t.max * 0.3 && Math.random() < 0.35) return v;
  }
  return t;
}
function breakWall(t, why) {
  if (!t.wall) return;
  t.wall = false; t.wallT = B.round + 3;
  pop(t, L('鐵壁破了！', 'Wall broken!'), '#ffe080', -12); fxs.push({ k: 'rock', x: t.x, y: t.y - 30, t: 0 }); morale('ally', 10); morale('foe', -8);
  void why;
}
async function moveTo(u, tx, frames) { const x0 = u.dx; u.anim = 'walk'; for (let f = 1; f <= frames; f++) { u.dx = x0 + ((tx - x0) * f) / frames; u.at++; await tick(1); } }
async function attack(u, t0, confused = false, mul = 1) {
  const t = confused ? t0 : cover(t0);
  if (t !== t0) { say1(guardOf(t0) === t ? L(`${N(t)}替${N(t0)}擋下了攻擊！`, `${N(t)} shields ${N(t0)}!`) : L(`${N(t)}挺身而出！`, `${N(t)} steps in the way!`)); await tick(14); }
  if (!confused) say1(L(`${N(u)}的攻擊！`, `${N(u)} attacks!`));
  const sw = (u.sheet && u.sheet.swing) || 'slash';
  const rng = ranged(u);
  const dir = u.side === 'ally' ? -1 : 1;
  const reach = rng ? 0 : Math.max(0, Math.abs((t.x + t.dx) - u.x) - 46) * dir;
  // a wind-up: lean back and raise the weapon, then go
  u.anim = 'windup'; u.at = 0;
  for (let f = 1; f <= 8; f++) { u.dx = -dir * Math.round(f / 2); await tick(1); }
  if (!rng) { sfx('step'); await moveTo(u, reach, Math.max(8, Math.round(Math.abs(reach) / 6))); }
  else u.dx = 0;
  u.anim = sw === 'cast' ? 'cast' : sw; u.at = 0;
  const n = sw === 'shoot' ? 13 : sw === 'thrust' ? 8 : sw === 'cast' ? 7 : 6, hitAt = Math.floor(n * (rng ? 0.7 : 0.55));
  for (let f = 0; f < n * 3; f++) {
    u.at = f;
    if (f === hitAt * 3) {
      if (rng) { sfx('slash'); shots.push({ x: u.x + u.dx - 20 * -dir, y: u.y - 34, tx: t.x + t.dx, ty: t.y - 30, t: 0, n: 12 }); await tick(12); }
      // a charge in Arrowhead breaks an iron wall
      if (t.wall && u.side === 'ally' && B.form === 'fengshi' && !rng) breakWall(t, 'fengshi');
      const r = physDamage(u, t, mul);
      if (r.miss) { pop(t, r.fog ? L('霧中落空', 'Lost in fog') : L('閃避', 'Miss'), '#c0c0ff'); sfx('miss'); }
      else {
        hurt(t, r.dmg); pop(t, r.dmg, r.crit ? '#ffe040' : r.edge > 1.01 ? '#a0ffa0' : r.edge < 0.99 ? '#c0c0c0' : '#ffffff');
        if (r.crit) { pop(t, L('會心！', 'Critical!'), '#ffe040', -12); morale(u.side, 3); }
        else if (r.edge > 1.01) { pop(t, L('克制!', 'Strong!'), '#80ff90', -12); morale(u.side, 1); }
        else if (r.edge < 0.99) pop(t, L('被克制', 'Weak'), '#b0b0b0', -12);
        else if (r.back) pop(t, L('後排', 'Back row'), '#ffc080', -12);
        sfx(r.crit ? 'crit' : 'hit'); B.shake = r.crit ? 6 : 3;
        fxs.push({ k: 'cutx', x: t.x + t.dx, y: t.y - 22, t: 0 });
        await tick(r.crit ? 5 : 3); // a moment of hit-stop
        // an ambush laid by the target's side springs
        if (B.ambush[t.side] && u.side !== t.side) { const am = B.ambush[t.side]; B.ambush[t.side] = null; await tick(10); say1(L('伏兵殺出！', 'The ambush springs!')); fxs.push({ k: 'leaf', x: u.x + u.dx, y: u.y - 30, t: 0 }); const d2 = Math.round(am * 1.2); hurt(u, d2); pop(u, d2, '#ffb060'); sfx('hit'); morale(u.side, -5); }
        // light fingers
        if (u.side === 'ally' && u.g.skills.includes('miaoshou') && Math.random() < 0.2) { const gold = 10 + t.lv * 12; S.gold += gold; pop(u, `+${gold}${L('金', 'g')}`, '#ffe080'); }
      }
    }
    await tick(1);
  }
  if (!rng) await moveTo(u, 0, Math.max(6, Math.round(Math.abs(reach) / 8)));
  u.anim = 'idle'; u.dx = 0;
  await tick(6);
}
async function attackAll(u) {
  say1(L(`${N(u)}橫掃千軍！`, `${N(u)} sweeps through the ranks!`));
  const sw = (u.sheet && u.sheet.swing) || 'slash';
  const dir = u.side === 'ally' ? -1 : 1;
  await moveTo(u, 40 * dir, 10);
  u.anim = sw === 'shoot' ? 'shoot' : sw; u.at = 0;
  for (let f = 0; f < 24; f++) { u.at = f; await tick(1); }
  for (const t of alive(u.side === 'ally' ? 'foe' : 'ally')) {
    const r = physDamage(u, t, u.g.skills.includes('guishen') ? 0.72 : 0.6);
    if (!r.miss) { hurt(t, r.dmg); pop(t, r.dmg, r.crit ? '#ffe040' : '#ffffff'); fxs.push({ k: 'cutx', x: t.x + t.dx, y: t.y - 30, t: 0 }); }
  }
  sfx('crit'); B.shake = 7;
  await tick(16);
  await moveTo(u, 0, 10); u.anim = 'idle'; u.dx = 0; await tick(6);
}
const ST_TURNS = { poison: 3, stun: () => 1 + Math.floor(Math.random() * 2), confuse: () => 2 + Math.floor(Math.random() * 2), sleep: 3, fear: 3, silence: 3, defdown: 3 };
const stName = (k) => (STATUS[k] ? L(STATUS[k][0], STATUS[k][1]) : k);
async function castTactic(u, t, o) {
  if (u.st.silence) { say1(L(`${N(u)}的策略被封住了！`, `${N(u)}'s ploys are sealed!`)); pop(u, stName('silence'), '#60e0d0'); await tick(30); return; }
  if (!o.free) { if (S.tp < o.cost) { say1(L('策略值不足！', 'Not enough strategy points!')); await tick(30); return; } S.tp -= o.cost; }
  say1(L(`${N(u)}使出「${t.zh}」！`, `${N(u)} uses ${t.en}!`));
  u.anim = 'cast'; u.at = 0;
  sfx('special');
  for (let f = 0; f < 21; f++) { u.at = f; await tick(1); }
  u.anim = 'idle';
  const foeSide = u.side === 'ally' ? 'foe' : 'ally';
  if (t.escape) { if (B.cfg.boss || B.cfg.canRun === false) { say1(L('無法撤退！', 'There is no retreat!')); await tick(30); return; } say1(L('全軍迅速撤離。', 'The army slips away.')); await tick(30); finish('run'); return; }
  if (t.scout) {
    B.scouted = true; say1(L('看清了敵軍的虛實！', 'The enemy lies open to us!')); await tick(30);
    if (B.ambush.foe) { B.ambush.foe = null; say1(L('識破了山上的伏兵！', 'The ambush on the slopes is revealed and scattered!')); morale('ally', 6); await tick(40); }
    if (B.kit && B.kit.info) { say1(L(B.kit.info[0], B.kit.info[1])); await tick(fast ? 60 : 150); }
    return;
  }
  if (t.weather) {
    B.weather = t.weather;
    say1({ rain: L('天降大雨。', 'Rain pours down.'), wind: L('東風大作。', 'A strong wind rises.'), clear: L('雲開見日。', 'The clouds part.') }[t.weather]);
    if (t.weather === 'wind' || t.weather === 'clear') { if (B.fog > 0) { B.fog = 0; pop(u, L('霧散了', 'Fog clears'), '#c0e0ff', -12); } }
    for (const v of alive('foe')) if (v.charge && tryCancel(v, t.weather)) { say1(L(`${N(v)}的招式被${t.weather === 'rain' ? '大雨澆熄' : '大風吹散'}了！`, `The ${t.weather === 'rain' ? 'rain douses' : 'wind scatters'} ${N(v)}'s move!`)); await tick(36); }
    if (t.buff2) for (const v of alive(u.side)) v.buf.spd = 3;
    // reading the stars also clears the mind
    if (t.id === 'guanxing') for (const v of alive(u.side)) { let c = false; for (const k of ['curse', 'confuse', 'fear', 'sleep']) if (v.st[k]) { delete v.st[k]; c = true; } if (c) pop(v, L('解除', 'Cured'), '#80ffa0'); }
    sfx('buff'); await tick(36); return;
  }
  let targets;
  if (t.t === 'eall') targets = alive(foeSide);
  else if (t.t === 'aall') targets = alive(u.side);
  else if (t.t === 'self') targets = [u];
  else if (t.t === 'down') targets = o.target && o.target.troops <= 0 ? [o.target] : B.units.filter((x) => x.side === u.side && x.troops <= 0 && !x.summon).slice(0, 1);
  else { let x = o.target; if (!x || (x.troops <= 0)) { const l = t.t === 'a1' ? alive(u.side) : alive(foeSide); x = l[0]; } targets = x ? [x] : []; }
  for (const x of targets) fxs.push({ k: t.fx || 'spark', x: x.x + x.dx, y: x.y - 24, t: 0, big: t.t === 'eall' });
  sfx(t.el === 'fire' ? 'fire' : t.el === 'water' ? 'bubble' : t.el === 'thunder' ? 'bolt' : t.el === 'rock' ? 'quake' : t.heal || t.revive ? 'heal' : t.buff ? 'buff' : 'spore');
  await tick(18);
  if (t.st === 'ambush') { B.ambush[u.side] = tacDamage(u, alive(foeSide)[0] || u, { pow: 1.2 }); say1(L('伏兵已就位。', 'The ambush is set.')); await tick(30); return; }
  let failed = false;
  for (const x of targets) {
    if (isEnemyOf(u, x) && (t.pow || t.st)) {
      // a mirror sends the ploy back at the one who cast it
      if (mirrored(x)) {
        pop(x, L('反彈！', 'Reflected!'), '#c0f0ff');
        if (t.pow) { const d = tacDamage(u, u, t); hurt(u, d); pop(u, d, '#ffd0a0'); fxs.push({ k: t.fx || 'spark', x: u.x, y: u.y - 24, t: 0 }); }
        else if (t.st && t.st !== 'provoke') { u.st[t.st] = typeof ST_TURNS[t.st] === 'function' ? ST_TURNS[t.st]() : ST_TURNS[t.st] || 2; pop(u, stName(t.st), '#e0a0ff', -12); }
        morale(u.side, -3); continue;
      }
      const ch = tacChance(u, x, t);
      if (Math.random() >= ch) { pop(x, ch <= 0 ? L('免疫', 'Immune') : t.pow ? L('失敗', 'Failed') : L('無效', 'No effect'), '#c0c0c0'); failed = true; continue; }
    }
    if (t.pow && isEnemyOf(u, x)) {
      if (t.el === 'rock' && x.wall) breakWall(x, 'rock');
      const d = tacDamage(u, x, t);
      if (kitImmuneEl(x, t.el)) { const h = heal(x, d * 0.5); pop(x, L('吸收', 'Absorbed') + (h ? ' +' + h : ''), '#ff9040'); }
      else {
        hurt(x, d); pop(x, d, kitWeak(x, t.el) ? '#a0ffa0' : '#ffd0a0');
        if (kitWeak(x, t.el)) pop(x, L('弱點！', 'Weak point!'), '#80ff90', -12);
        if (t.el === 'fire' && x.troops > 0 && Math.random() < 0.3) { x.st.burn = 3; }
        if (t.el) tryCancel(x, 'el:' + t.el);
      }
    } else if (t.pow) { const d = tacDamage(u, x, t); hurt(x, d); pop(x, d, '#ffd0a0'); }
    if (t.st && t.st !== 'ambush' && x.troops > 0) {
      if (!isEnemyOf(u, x)) continue;
      const turns = t.st === 'provoke' ? u : typeof ST_TURNS[t.st] === 'function' ? ST_TURNS[t.st]() : ST_TURNS[t.st] || 2;
      x.st[t.st] = turns; if (t.st === 'provoke') x.st.provokeT = 3;
      if (t.st === 'defdown') breakWall(x, 'pojia');
      pop(x, stName(t.st), STATUS[t.st] ? STATUS[t.st][2] : '#e0a0ff');
      if (tryCancel(x, t.st)) say1(L(`打斷了${N(x)}的招式！`, `${N(x)}'s move is broken off!`));
    }
    if (t.buff) { x.buf[t.buff] = 3; pop(x, { atk: L('攻↑', 'ATK↑'), def: L('防↑', 'DEF↑'), spd: L('速↑', 'SPD↑') }[t.buff], '#ffe080'); }
    // healing works on a general's own soldiers: a leader's huge host gains no more than an ordinary one
    if (t.heal) { const k = (u.g.skills.includes('guanxing') ? 1.2 : 1) * (0.6 + tacPower(u) / 250); const h = heal(x, x.max * t.heal * k / Math.max(1, x.hpMul || 1)); if (h) pop(x, '+' + h, '#80ffa0'); }
    if (t.revive) { x.troops = Math.round(x.max * t.revive); x.dead = false; x.anim = 'idle'; x.st = {}; pop(x, L('重整旗鼓！', 'Rallied!'), '#80ffa0'); morale(u.side, 5); }
  }
  if (t.buff === 'atk') morale(u.side, 10);
  if (failed) morale(u.side, -2);
  await tick(30);
}
async function useItem(u, o) {
  const it = ITEMS[o.item];
  if (!take(o.item)) return;
  say1(L(`${N(u)}使用了${it.zh}。`, `${N(u)} uses ${it.en}.`));
  await tick(16);
  if (it.escape) { if (B.cfg.boss || B.cfg.canRun === false) { say1(L('無法撤退！', 'There is no retreat!')); await tick(30); return; } sfx('run'); finish('run'); return; }
  if (it.fire) { for (const x of alive(u.side === 'ally' ? 'foe' : 'ally')) { const d = Math.round(scaleLv(Math.max(u.lv, 5)) * 0.9 * rnd(0.9, 1.1)); hurt(x, d); pop(x, d, '#ffd0a0'); fxs.push({ k: 'explosion', x: x.x + x.dx, y: x.y - 26, t: 0 }); tryCancel(x, 'el:fire'); } sfx('boom'); await tick(30); return; }
  if (it.tp) { const n = Math.min(tpMax() - S.tp, it.tp); S.tp += n; pop(u, `+${n} ${L('策', 'SP')}`, '#a0e0ff'); sfx('heal'); await tick(24); return; }
  const targets = it.target === 'all' ? alive(u.side) : [o.target || u];
  for (const x of targets) {
    if (it.revive) { if (x.troops > 0) continue; x.troops = Math.round(x.max * it.revive); x.dead = false; x.anim = 'idle'; x.st = {}; pop(x, L('重整旗鼓！', 'Rallied!'), '#80ffa0'); continue; }
    if (x.troops <= 0) continue;
    if (it.cure) { for (const k of ['confuse', 'fear', 'sleep', 'silence', 'curse']) delete x.st[k]; pop(x, L('神清氣爽', 'Clear-minded'), '#80ffa0'); fxs.push({ k: 'boost', x: x.x + x.dx, y: x.y - 30, t: 0 }); continue; }
    const h = heal(x, x.max * it.heal); if (h) pop(x, '+' + h, '#80ffa0');
    fxs.push({ k: 'boost', x: x.x + x.dx, y: x.y - 30, t: 0 });
  }
  sfx('heal'); await tick(24);
}
async function endOfRound() {
  if (window.G && G.blog) G.blog.push(`== end ${B.round}: ` + B.units.filter((u) => u.troops > 0 || !u.summon).map((u) => `${u.id}${u.side === 'foe' ? '*' : ''} ${u.troops}/${u.max}`).join(', ') + ` | SP ${S.tp} | M ${B.morale.ally}/${B.morale.foe}`);
  let dot = false;
  for (const u of B.units.filter((x) => x.troops > 0)) {
    for (const [k, f, col] of [['poison', 0.06, '#a0e060'], ['burn', 0.05, '#ff9040'], ['curse', 0.04, '#d050d0']]) {
      if (!u.st[k]) continue;
      const d = Math.max(1, Math.round(u.max * f)); hurt(u, d); pop(u, d, col); dot = true;
    }
    for (const k of ['poison', 'burn', 'curse', 'confuse', 'stun', 'sleep', 'fear', 'silence', 'defdown', 'reflect']) if (u.st[k]) { u.st[k]--; if (u.st[k] <= 0) delete u.st[k]; }
    if (u.st.provoke) { u.st.provokeT--; if (u.st.provokeT <= 0 || u.st.provoke.troops <= 0) { delete u.st.provoke; delete u.st.provokeT; } }
    for (const k of Object.keys(u.buf)) { u.buf[k]--; if (u.buf[k] <= 0) delete u.buf[k]; }
    if (u.g.skills.includes('yinjiang') && u.troops > 0 && !u.summon) { const h = heal(u, u.max * 0.05); if (h) pop(u, '+' + h, '#c080ff'); }
    u.guard = false;
  }
  for (const side of ['ally', 'foe']) if (skillOnSide(side, 'yishu')) for (const u of alive(side)) heal(u, u.max * 0.04);
  if (B.fog > 0) { B.fog--; if (!B.fog) { say1(L('江霧散去了。', 'The fog lifts.')); await tick(24); } }
  if (dot) await tick(20);
  // a beaten army in the field loses heart and runs (leaders' armies stand until their leader falls)
  if (!B.cfg.boss && alive('foe').length) {
    const flee = [];
    if (B.morale.foe <= 15) flee.push(...alive('foe'));
    else if (B.morale.foe < 40) for (const u of alive('foe')) if (u.troops < u.max * 0.3 && Math.random() < 0.4) flee.push(u);
    if (flee.length) {
      say1(flee.length === alive('foe').length ? L('敵軍士氣崩潰，四散奔逃！', 'The enemy\'s morale breaks and they scatter!') : L(`${flee.map(N).join('、')}落荒而逃！`, `${flee.map(N).join(', ')} flee${flee.length > 1 ? '' : 's'} the field!`));
      for (const u of flee) { u.troops = 0; u.fled = true; u.at = 0; }
      morale('ally', 5); sfx('run'); await tick(40);
    }
  }
}
async function checkEnd() {
  if (!alive('foe').length) { await victory(); return true; }
  if (!alive('ally').length) { await defeat(); return true; }
  // every leader down: the rest of their army breaks
  if (B.cfg.boss && B.units.some((u) => u.side === 'foe' && u.boss) && !alive('foe').some((u) => u.boss)) {
    say1(L('敵軍首領倒下，殘兵潰散了！', 'With their leaders down, the rest of the enemy breaks and runs!'));
    for (const u of alive('foe')) { u.troops = 0; u.fled = !u.summon; u.gone = !!u.summon; u.at = 0; }
    sfx('run'); await tick(50);
    await victory(); return true;
  }
  return false;
}
// ---------- the end ----------
async function victory() {
  await tick(30);
  for (const u of alive('ally')) { u.cheer = true; u.anim = 'cast'; u.at = 0; }
  playMusic('victory');
  const foes = B.units.filter((u) => u.side === 'foe' && !u.summon);
  let exp = 0, gold = 0;
  for (const f of foes) { exp += Math.round((6 + 3.4 * f.lv * f.lv) * (f.boss ? 4 : 1)); gold += Math.round((8 + f.lv * 6) * (f.boss ? 5 : 1)); }
  if (skillOnSide('ally', 'lueduo')) gold = Math.round(gold * 1.3);
  S.gold += gold; S.wins++;
  say1(L(`勝利！得到${gold}金。`, `Victory! ${gold} gold won.`));
  await tick(60);
  const lines = [];
  const per = Math.max(1, Math.round(exp * 0.75));
  for (const id of Object.keys(S.roster)) {
    const m = S.roster[id], inFront = S.front.includes(id);
    const u = B.units.find((x) => x.side === 'ally' && x.id === id);
    if (inFront && u && u.troops <= 0) continue;
    // little is learned from much weaker enemies, more from stronger ones
    const avg = foes.reduce((t, f) => t + f.lv, 0) / foes.length;
    const gap = m.lv - avg, k = gap > 4 ? Math.pow(0.5, (gap - 4) / 4) : gap < 0 ? 1 + Math.min(1.5, -gap * 0.15) : 1;
    const ups = gainExp(m, Math.max(1, Math.round(per * k * (inFront ? 1 : 0.3))));
    if (u && ups.length) { u.max = troopsMax(m); }
    for (const up of ups) {
      lines.push(L(`${genName(id)}升到了${up.lv}級！`, `${genName(id)} reached level ${up.lv}!`));
      for (const t of up.learned) lines.push(L(`${genName(id)}學會了「${TACTICS[t].zh}」！`, `${genName(id)} learned ${TACTICS[t].en}!`));
    }
  }
  for (const u of B.units) if (u.side === 'ally' && u.m) u.m.troops = Math.max(0, Math.min(troopsMax(u.m), u.troops));
  for (const s of lines.slice(0, 8)) { say1(s); sfx('level'); await tick(50); }
  // a beaten general may be taken prisoner
  for (const f of foes) S.met[f.id] = Math.max(S.met[f.id] || 0, 1);
  if (B.cfg.capture !== false && !B.cfg.boss) {
    const cands = foes.filter((f) => !S.roster[f.id] && !f.g.guest && f.g.faction !== 'sect' && !(f.g.famous && f.g.noCapture) && !S.flags['gone_' + f.id]);
    if (cands.length && Math.random() < 0.3) {
      const c = cands[Math.floor(Math.random() * cands.length)];
      B.captive = { id: c.id, lv: c.lv };
    }
  }
  await tick(20);
  finish('win');
}
async function defeat() {
  say1(L('我軍全軍覆沒……', 'Our army is routed...'));
  await tick(90);
  finish('lose');
}

// ---------- update and drawing ----------
export function battleUpdate() {
  fast = input.held('fast') || B.auto;
  const steps = fast ? 3 : 1;
  for (let s = 0; s < steps; s++) {
    for (let i = waits.length - 1; i >= 0; i--) { const w = waits[i]; if (--w.n <= 0) { waits.splice(i, 1); w.res(); } }
    for (const u of B.units) {
      u.at++; if (u.flash) u.flash--; if (u.anim === 'hurt' && !u.dead && u.at > 14) u.anim = 'idle';
      // walk to a new place in the line (a change of formation, a newcomer)
      if (u.hx !== undefined && u.troops > 0) { const dx = u.hx - u.x, dy = u.hy - u.y; if (dx || dy) { u.x += Math.sign(dx) * Math.min(2, Math.abs(dx)); u.y += Math.sign(dy) * Math.min(2, Math.abs(dy)); } }
      if (u.fled) u.x += u.side === 'foe' ? -3 : 3;
      animStep(u);
    }
    for (const f of fallers) f.t++;
    for (const r of runners) { r.t++; r.x += r.away * 3; }
    for (const n of nums) n.t++;
    for (const f of fxs) f.t++;
    for (const sh of shots) sh.t++;
    if (B.shake) B.shake--;
  }
  for (let i = nums.length - 1; i >= 0; i--) if (nums[i].t > 50) nums.splice(i, 1);
  for (let i = fxs.length - 1; i >= 0; i--) if (fxs[i].t > 40) fxs.splice(i, 1);
  for (let i = shots.length - 1; i >= 0; i--) if (shots[i].t > shots[i].n) shots.splice(i, 1);
  if (B.fade > 0) B.fade--;
  msgT++;
}
// ---- the backdrop ----
const bgCache = {};
function backdrop() {
  const key = B.terrain + (B.naval ? 'n' : '') + B.weather;
  if (bgCache[key]) return bgCache[key];
  const c = canvas(W, H), g = c.x;
  const sky = { grass: ['#5a8ad8', '#b8dcf0'], forest: ['#4a7ac0', '#a8d0e0'], hill: ['#5a84d0', '#c0dcec'], mountain: ['#6a7ab8', '#c8d0e0'], desert: ['#d89a58', '#f4dca0'], snow: ['#8aa0c8', '#e8f0f8'], river: ['#4a80d0', '#b0d8f0'], castle: ['#3a4a78', '#8890b0'], cave: ['#100c14', '#2a2028'], sect: ['#1a0a20', '#4a2050'], steppe: ['#6a90d0', '#e0e0b0'] }[B.naval ? 'river' : B.terrain] || ['#5a8ad8', '#b8dcf0'];
  const grd = g.createLinearGradient(0, 0, 0, 90); grd.addColorStop(0, sky[0]); grd.addColorStop(1, sky[1]); g.fillStyle = grd; g.fillRect(0, 0, W, 96);
  // far hills
  const far = B.terrain === 'desert' ? '#c89060' : B.terrain === 'snow' ? '#a8b8d0' : B.terrain === 'cave' || B.terrain === 'sect' ? '#1a1018' : '#5a7a8a';
  g.fillStyle = far;
  for (let x = 0; x < W; x++) { const h = 20 + Math.sin(x * 0.021) * 9 + Math.sin(x * 0.057 + 1) * 5 + (B.terrain === 'mountain' ? Math.abs(Math.sin(x * 0.03)) * 26 : 0); g.fillRect(x, 70 - h, 1, h + 30); }
  // ground: a floor texture from the tilesets
  const fl = tileset('floor');
  const tile = B.naval || B.terrain === 'river' ? null : { grass: [0, 12], forest: [11, 12], hill: [0, 12], mountain: [11, 14], desert: [1, 1], snow: [6, 18], castle: [1, 13, 'interiorfloor'], cave: [13, 13, 'interiorfloor'], sect: [13, 13, 'interiorfloor'], steppe: [0, 12] }[B.terrain] || [0, 12];
  if (tile) { const im = tile[2] ? tileset(tile[2]) : fl; for (let y = 72; y < H; y += 16) for (let x = 0; x < W; x += 16) g.drawImage(im, tile[0] * 16, tile[1] * 16, 16, 16, x, y, 16, 16); if (B.terrain === 'sect') { g.fillStyle = 'rgba(60,10,70,0.35)'; g.fillRect(0, 72, W, H); } }
  else { g.fillStyle = '#3a88c8'; g.fillRect(0, 70, W, H); g.fillStyle = '#5aa8e0'; for (let y = 74; y < H; y += 7) for (let x = (y * 13) % 23; x < W; x += 31) g.fillRect(x, y, 9, 1); }
  // a darker band at the horizon, and haze
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 70, W, 6);
  if (B.terrain === 'forest') { for (let x = -8; x < W; x += 22) { g.fillStyle = '#2a5a34'; g.beginPath(); g.arc(x + 11, 64, 14, 0, 7); g.fill(); g.fillStyle = '#3a7a40'; g.beginPath(); g.arc(x + 8, 60, 8, 0, 7); g.fill(); } }
  if (B.terrain === 'castle') { g.fillStyle = '#7e7468'; g.fillRect(0, 34, W, 38); g.fillStyle = '#a89c8a'; for (let x = 0; x < W; x += 12) g.fillRect(x, 28, 7, 8); g.fillStyle = '#5a5048'; g.fillRect(0, 66, W, 6); }
  if (B.naval) { // the decks of two fleets
    for (const [x0, x1] of [[0, 230], [250, 480]]) { g.fillStyle = '#5a3820'; g.fillRect(x0, 196, x1 - x0, 10); g.fillStyle = '#7e5230'; g.fillRect(x0, 190, x1 - x0, 7); }
  }
  bgCache[key] = c;
  return c;
}
function drawShadow(x, y, w = 22) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y, w / 2, 3, 0, 0, 7); ctx.fill(); }
// which picture of the battle sheet to show. Death is a sequence, never a jump: a stagger, the knees give,
// the fall over several frames, a puff of dust, and the body fades to a dim shape.
const DEATH_STAGGER = 14, DEATH_FALL = 36, DEATH_FADE = 40;
function frameOf(u) {
  const s = u.sheet; if (!s) return null;
  const m = s.meta;
  let a = u.anim, f = 0, row = 0;
  if (u.troops <= 0 && !u.fled) {
    a = 'hurt'; const t = u.deathT || 0;
    f = t < DEATH_STAGGER ? 0 : Math.min(5, 1 + Math.floor((t - DEATH_STAGGER) / (DEATH_FALL / 5)));
  } else if (a === 'walk' || u.fled || (u.hx !== undefined && (Math.abs(u.hx - u.x) > 1 || Math.abs(u.hy - u.y) > 1))) { a = 'walk'; f = 1 + (Math.floor(u.at / 4) % 8); row = 1; }
  else if (a === 'idle') { f = Math.floor(u.at / 30) % 2; }
  else if (a === 'hurt') { f = Math.min(2, Math.floor(u.at / 4)); }
  else if (a === 'windup') { a = (u.sheet && u.sheet.swing) || 'slash'; f = 0; }
  else if (m[a]) { f = Math.min(m[a].n - 1, Math.floor(u.at / 3)); }
  if (!m[a]) { a = 'idle'; f = 0; row = 0; }
  const b = m[a];
  return { img: s.img, sx: f * b.cell, sy: b.y + row * b.cell, cell: b.cell };
}
// how a general is pushed about: a knock-back when hit, a lean back when guarding, a step back to wind up
function bodyOffset(u) {
  const away = u.side === 'ally' ? 1 : -1;
  let ox = 0, oy = 0;
  if (u.kb) ox += away * u.kb;
  if (u.guard && u.troops > 0) ox += away * 2;
  if (u.troops <= 0 && !u.fled && (u.deathT || 0) < DEATH_STAGGER) ox += ((u.deathT >> 1) % 2 ? 1 : -1) * 1.5;
  if (u.anim === 'idle' && u.troops > 0) oy += Math.floor(u.at / 40) % 2 ? 0 : -0.5;
  if (u.cheer && u.troops > 0) oy -= Math.abs(Math.sin(u.at / 6)) * 4;
  return [ox, oy];
}
// the crowd of soldiers: a compact block behind the general, drawn under every general so none is covered.
// A soldier who falls topples and fades; they all flinch when their general is hit.
const CROWD = [[14, -7], [24, -7], [34, -7], [19, 1], [29, 1], [39, 1]];
const fallers = [], runners = [];
function crowdPos(u, i) { const [ox, oy] = CROWD[i], flip = u.side === 'foe', fl = u.sflinch ? 2 : 0; return [Math.round(u.x + u.dx) + (flip ? -(ox + fl) : ox + fl), u.y + oy]; }
function drawCrowd(u) {
  if (u.gone || u.illusion || u.petal || (u.fled && u.at > 40)) return;
  const ss = fieldSheet(u.soldier.look, u.soldier.equip); if (!ss) return;
  const flip = u.side === 'foe';
  const n = u.troops <= 0 && !u.fled ? 0 : u.fled ? 3 : Math.ceil(6 * (u.troops / u.max));
  if (u.shown === undefined) u.shown = n;
  // soldiers lost since the last picture fall over
  while (u.shown > n) { u.shown--; const [sx, sy] = crowdPos(u, u.shown); fallers.push({ ss, x: sx, y: sy, flip, t: 0, row: flip ? 3 : 1 }); }
  u.shown = n;
  const walking = u.anim === 'walk' || u.fled || (u.hx !== undefined && Math.abs(u.hx - u.x) > 1);
  if (u.fled) ctx.globalAlpha = Math.max(0, 1 - u.at / 40);
  for (let i = 0; i < n; i++) {
    const [sx, sy] = crowdPos(u, i);
    const fr = walking ? 1 + ((Math.floor(u.at / 4) + i) % 8) : u.cheer ? 1 + ((Math.floor(u.at / 5) + i) % 3) : 0;
    drawShadow(sx, sy, 12);
    ctx.drawImage(ss, fr * 32, (u.fled ? (flip ? 1 : 3) : (flip ? 3 : 1)) * 32, 32, 32, sx - 16, sy - 30, 32, 32);
  }
  ctx.globalAlpha = 1;
}
function drawFallers() {
  for (let i = fallers.length - 1; i >= 0; i--) {
    const f = fallers[i];
    if (f.t > 50) { fallers.splice(i, 1); continue; }
    const k = Math.min(1, f.t / 12), ang = k * Math.PI / 2 * (f.flip ? -1 : 1);
    ctx.globalAlpha = f.t < 20 ? 1 : Math.max(0, 1 - (f.t - 20) / 30);
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(ang); ctx.drawImage(f.ss, 0, f.row * 32, 32, 32, -16, -30, 32, 32); ctx.restore();
  }
  ctx.globalAlpha = 1;
}
// a riderless horse running off the field
function drawRunners() {
  for (let i = runners.length - 1; i >= 0; i--) {
    const r = runners[i];
    if (r.t > 70) { runners.splice(i, 1); continue; }
    const hi = IMG['h:' + (r.horse === 'red' ? 'brown' : r.horse)]; if (!hi) continue;
    ctx.globalAlpha = r.t < 40 ? 1 : Math.max(0, 1 - (r.t - 40) / 30);
    ctx.save(); ctx.translate(r.x, r.y); ctx.scale(r.away * GSCALE, GSCALE);
    if (r.horse === 'red') ctx.filter = 'hue-rotate(-18deg) saturate(1.8)';
    ctx.drawImage(hi, (Math.floor(r.t / 3) % 4) * 128, 128, 128, 128, -59, 1 - 90, 128, 128);
    ctx.restore(); ctx.filter = 'none';
  }
  ctx.globalAlpha = 1;
}
function drawUnit(u) {
  if (u.gone || (u.fled && u.at > 40)) return;
  const [bx, by] = bodyOffset(u);
  const x = Math.round(u.x + u.dx + bx), y = Math.round(u.y + by), flip = u.side === 'foe';
  const F = frameOf(u);
  const walking = u.anim === 'walk' || u.fled || (u.hx !== undefined && Math.abs(u.hx - u.x) > 1);
  if (!F) return;
  const dead = u.troops <= 0 && !u.fled;
  const mounted = u.horse && !dead && !u.unhorsed;
  let alpha = 1;
  if (u.illusion || u.bomb || u.petal) alpha = 0.55 + 0.15 * Math.sin(performance.now() / 200);
  if (u.fled) alpha = Math.max(0, 1 - u.at / 40);
  if (dead) { const t = (u.deathT || 0) - DEATH_STAGGER - DEATH_FALL; alpha = t <= 0 ? 1 : Math.max(0.45, 1 - t / DEATH_FADE * 0.55); }
  if (u.flash && (u.flash % 4) < 2 && !dead) alpha *= 0.5;
  drawShadow(x, u.y, (mounted ? 40 : 22) * GSCALE + 4);
  // a tactic being cast: a soft glow at the caster's feet
  if (u.anim === 'cast' && !dead) {
    const r = 16 + 3 * Math.sin(u.at / 3), g = ctx.createRadialGradient(x, u.y - 14, 2, x, u.y - 14, r);
    g.addColorStop(0, 'rgba(255,240,160,0.55)'); g.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, u.y - 14, r, r * 1.2, 0, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = alpha;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((flip !== !!u.fled ? -1 : 1) * GSCALE, GSCALE);
  if (u.berserk && !dead) ctx.filter = 'saturate(1.6) hue-rotate(-12deg) brightness(1.1)';
  if (mounted) {
    const hi = IMG['h:' + (u.horse === 'red' ? 'brown' : u.horse)];
    // horse frames are 128px; facing left the walking horse stands on y 94 with its saddle at (62, 52),
    // galloping on y 87 with the saddle at (60, 50)
    const running = walking;
    const row = running ? 1 : 5, fr = running ? Math.floor(u.at / 4) % 4 : (u.anim === 'idle' ? 0 : 1);
    const feet = running ? 90 : 94, sx = running ? 60 : 62, sy = running ? 50 : 52;
    if (hi) {
      if (u.horse === 'red') ctx.filter = 'hue-rotate(-18deg) saturate(1.8)';
      ctx.drawImage(hi, fr * 128, row * 128, 128, 128, -59, 1 - feet, 128, 128);
      ctx.filter = u.berserk ? 'saturate(1.6) hue-rotate(-12deg) brightness(1.1)' : 'none';
    }
    // the rider sits with the hips (about 44px down the 64px figure) on the saddle; legs are cut at the thigh
    const off = (F.cell - 64) / 2, cut = 50;
    const top = 1 - feet + sy - 44 + (running ? Math.floor(u.at / 4) % 2 : 0);
    ctx.drawImage(F.img, F.sx, F.sy, F.cell, off + cut, -59 + sx - F.cell / 2, top - off, F.cell, off + cut);
  } else {
    ctx.drawImage(F.img, F.sx, F.sy, F.cell, F.cell, -F.cell / 2, -60 - (F.cell - 64) / 2, F.cell, F.cell);
  }
  ctx.filter = 'none';
  ctx.restore();
  // defending: a shield of light in front
  if (u.guard && !dead) {
    const fx = x + (u.side === 'ally' ? -12 : 12);
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(performance.now() / 160);
    ctx.strokeStyle = '#a0d0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(fx, u.y - 18, 5, 18, 0, 0, 7); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
// the step-by-step bits of a general's animation, run once per frame
function animStep(u) {
  if (u.kb) u.kb = Math.max(0, u.kb - 0.7);
  if (u.sflinch) u.sflinch--;
  if (u.troops <= 0 && !u.fled && !u.gone) {
    if (u.deathT === undefined) u.deathT = 0;
    u.deathT++;
    // a mounted general is thrown and the horse bolts
    if (u.deathT === 2 && u.horse && !u.unhorsed) { u.unhorsed = true; runners.push({ horse: u.horse, x: Math.round(u.x + u.dx), y: u.y, away: u.side === 'ally' ? 1 : -1, t: 0 }); }
    if (u.deathT === DEATH_STAGGER + DEATH_FALL - 4) fxs.push({ k: 'smoke', x: Math.round(u.x + u.dx) + (u.side === 'ally' ? 10 : -10), y: u.y - 6, t: 0 });
  } else if (u.troops > 0 && u.deathT !== undefined) { u.deathT = undefined; u.unhorsed = false; }
}
// the little row under a general's feet: unit type, troop bar, statuses with turns left
function statusIcons(u) {
  const out = [];
  for (const k of ['confuse', 'stun', 'sleep', 'fear', 'burn', 'poison', 'silence', 'curse', 'defdown']) if (u.st[k]) out.push([k === 'defdown' ? 'down' : k, k === 'defdown' ? ICON_COL.defdown : ICON_COL[k], u.st[k]]);
  if (u.st.provoke) out.push(['provoke', ICON_COL.provoke, u.st.provokeT]);
  if (u.st.reflect > 0 || u.stance === 'mirror') out.push(['mirror', ICON_COL.mirror, u.st.reflect > 1 ? u.st.reflect - 1 : 0]);
  if (u.stance === 'ice') out.push(['ice', ICON_COL.ice, 0]);
  if (u.wall) out.push(['wall', ICON_COL.wall, 0]);
  if (veiled(u)) out.push(['veil', ICON_COL.veil, 0]);
  if (u.berserk) out.push(['berserk', ICON_COL.berserk, 0]);
  if (u.guard) out.push(['guard', ICON_COL.guard, 0]);
  for (const [k, col] of [['atk', ICON_COL.atkup], ['def', ICON_COL.defup], ['spd', ICON_COL.spdup]]) if (u.buf[k] > 0) out.push(['up', col, u.buf[k]]);
  return out;
}
function drawIconRow(list, x, y, maxW) {
  let cx = x;
  for (const [name, col, n] of list) {
    if (cx - x > maxW - 7) break;
    cx += icon(name, cx, y, col);
    if (n) cx += digits(Math.min(9, n), cx, y + 2, '#ffffff') + 1; else cx += 1;
  }
}
function drawUnitHud(u) {
  if (u.gone || u.fled) return;
  const x = Math.round(u.x + u.dx), y = u.y;
  const bw = 30;
  icon(u.unit, x - bw / 2 - 11, y + 1);
  ctx.fillStyle = '#101018'; ctx.fillRect(x - bw / 2 - 1, y + 3, bw + 2, 4);
  const f = u.troops / u.max;
  ctx.fillStyle = f > 0.5 ? (u.side === 'ally' ? '#58d070' : '#e06050') : f > 0.25 ? '#e0c040' : '#e04040';
  ctx.fillRect(x - bw / 2, y + 4, Math.round(bw * f), 2);
  if (u.troops <= 0) return;
  if (u.boss && u.side === 'foe') { ctx.fillStyle = '#e0b858'; ctx.fillRect(x - bw / 2 - 1, y + 7, bw + 2, 1); }
  drawIconRow(statusIcons(u), x + bw / 2 + 3, y + 1, 60);
  // an announced move: a pulsing "!" beside the head, and a crosshair over the one it is aimed at
  if (u.charge) {
    const b = Math.floor(performance.now() / 150) % 2;
    const big = (name, px, py, col) => { ctx.save(); ctx.translate(px, py); ctx.scale(2, 2); icon(name, 0, 0, col); ctx.restore(); };
    const headY = (v) => v.y - (v.horse && !v.unhorsed ? 66 : 46);
    big('charge', x + (u.side === 'foe' ? 10 : -26), headY(u) - b, ICON_COL.charge);
    const t = u.charge.target;
    if (t && t.troops > 0) big('mark', Math.round(t.x + t.dx) - 8, headY(t) - 14 + b, ICON_COL.mark);
  }
  // while choosing whom to hit: who we beat, who beats us
  const me = (B.picking && B.picking.u) || B.cur;
  if (me && u.side === 'foe' && !(B.picking && B.picking.tac)) {
    const e = edgeOf(me, u);
    if (e > 1.01) icon('good', x - bw / 2 - 19, y, ICON_COL.good); else if (e < 0.99) icon('bad', x - bw / 2 - 19, y, ICON_COL.bad);
  }
}
function drawFx() {
  for (const f of fxs) {
    const im = IMG['x:' + f.k], d = FX[f.k];
    if (!im || !d) continue;
    const [fw, n] = d, fr = Math.min(n - 1, Math.floor(f.t / 3));
    if (f.t / 3 >= n) continue;
    const s = f.big ? 2 : 1.5;
    ctx.drawImage(im, fr * fw, 0, fw, im.height, f.x - (fw * s) / 2, f.y - (im.height * s) / 2, fw * s, im.height * s);
  }
  for (const sh of shots) {
    const k = sh.t / sh.n, x = sh.x + (sh.tx - sh.x) * k, y = sh.y + (sh.ty - sh.y) * k - Math.sin(k * Math.PI) * 18;
    ctx.fillStyle = '#f0e0c0'; ctx.fillRect(Math.round(x) - 4, Math.round(y), 9, 1); ctx.fillStyle = '#a07040'; ctx.fillRect(Math.round(x) - 5, Math.round(y), 2, 1);
  }
}
function moraleBar(x, y, w, v, col) {
  ctx.fillStyle = '#101018'; ctx.fillRect(x - 1, y - 1, w + 2, 6);
  ctx.fillStyle = '#3a3040'; ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = v <= 20 ? '#e04040' : col; ctx.fillRect(x, y, Math.round(w * v / 100), 4);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y, Math.round(w * v / 100), 1);
  ctx.fillStyle = '#101018'; ctx.fillRect(x + Math.round(w / 2), y, 1, 4);
}
export function battleDraw() {
  const sh = B.shake ? (B.shake % 2 ? 2 : -2) : 0;
  ctx.drawImage(backdrop(), sh, 0);
  if (B.weather === 'rain') { ctx.fillStyle = 'rgba(180,200,255,0.5)'; const t = performance.now() / 16; for (let i = 0; i < 70; i++) { const x = (i * 97 + t * 3) % W, y = (i * 53 + t * 9) % 190; ctx.fillRect(x, y, 1, 6); } }
  const order = [...B.units].sort((a, b) => a.y - b.y || (a.side === 'ally' ? 1 : -1));
  // crowds under everyone, then the fallen, then the generals (the dead first, so the living stand over them)
  for (const u of order) drawCrowd(u);
  drawFallers();
  for (const u of order) if (u.troops <= 0) drawUnit(u);
  drawRunners();
  for (const u of order) if (u.troops > 0) drawUnit(u);
  for (const u of order) drawUnitHud(u);
  if (B.fog > 0) { ctx.fillStyle = 'rgba(220,230,240,0.28)'; ctx.fillRect(0, 30, W, 160); }
  drawFx();
  for (const n of nums) { const k = Math.min(1, n.t / 10); text(n.s, n.x, n.y - k * 14, n.col, { align: 'center' }); }
  // the top line: strategy points, both formations and morale, the weather
  ctx.fillStyle = 'rgba(8,6,16,0.55)'; ctx.fillRect(0, 0, W, 17);
  text(L(`策略 ${S.tp}/${tpMax()}`, `SP ${S.tp}/${tpMax()}`), 6, 3, '#a0e0ff');
  const fe = formEdge(B.form, B.foeForm);
  text(formName(B.foeForm), 106, 3, fe < 0 ? '#ff7060' : '#ffb0a0');
  text(L('士氣', 'MOR'), 164, 3, '#c8b8b0'); moraleBar(190, 7, 44, B.morale.foe, '#e07050');
  if (B.weather !== 'clear') text({ rain: L('雨', 'Rain'), wind: L('風', 'Wind') }[B.weather] || '', 240, 3, '#c0e0ff', { align: 'center' });
  text(L('士氣', 'MOR'), 256, 3, '#c8b8b0'); moraleBar(282, 7, 44, B.morale.ally, '#60d080');
  text(formName(B.form), 420, 3, fe > 0 ? '#80ff90' : '#ffe080', { align: 'right' });
  if (fe) text(fe > 0 ? '▲' : '▼', 420 - textW(formName(B.form)) - 4, 3, fe > 0 ? '#80ff90' : '#ff7060', { align: 'right' });
  // what the enemy leaders are about to do
  const its = intents().slice(0, 3);
  its.forEach((it, i) => {
    const s = fit(it.s, W - 24), w = textW(s) + 12, y = 19 + i * 14;
    ctx.fillStyle = 'rgba(16,6,8,0.72)'; ctx.fillRect(Math.round((W - w) / 2), y, w, 13);
    text(s, W / 2, y + 1, it.col, { align: 'center' });
  });
  // the panel at the bottom
  windowBox(0, 190, 160, 80);
  if (B.picking) drawInfo(B.picking);
  if (msg && !UI.active) { const lines = wrapShort(msg, 144); lines.slice(0, 4).forEach((l, i) => text(l, 8, 198 + i * 16)); }
  windowBox(160, 190, 320, 80);
  const allies = B.units.filter((u) => u.side === 'ally');
  allies.forEach((u, i) => {
    const y = 197 + i * 14;
    const col = u.troops <= 0 ? '#8a8a98' : B.cur === u ? '#ffe070' : '#f0f0f0';
    text(fit(genName(u.g) + (u.id === S.strategist ? L('〔師〕', '*') : ''), 66), 168, y, col);
    icon(u.unit, 236, y + 3);
    drawIconRow(statusIcons(u), 247, y + 3, 50);
    bar(300, y + 5, 112, u.troops, u.max, u.troops / u.max > 0.25 ? '#58d070' : '#e04040');
    text(String(u.troops), 470, y, col, { align: 'right' });
  });
  if (B.auto) text(L('全軍突擊中（B取消）', 'Charging (B to stop)'), W / 2, 178, '#ffe070', { align: 'center' });
  if (B.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${B.fade / 30})`; ctx.fillRect(0, 0, W, H); }
}
function wrapShort(s, w) {
  const out = []; let line = '';
  for (const ch of String(s).match(/[A-Za-z0-9'".,!?:;()\-]+ ?|./gu) || []) { if (textW(line + ch) > w && line) { out.push(line.trimEnd()); line = ch.trimStart(); } else line += ch; }
  out.push(line); return out;
}
export { tick as battleTick, uiWait, say };
// for the layout test: the box each living general's picture covers (drawn alone), and its troop bar
export function measureBoxes() {
  const k = ctx.getTransform().a || 1, cw = ctx.canvas.width, ch = ctx.canvas.height, out = [];
  for (const u of B.units.filter((v) => v.troops > 0 && !v.gone)) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cw, ch); ctx.restore();
    const g = u.guard; u.guard = false; drawUnit(u); u.guard = g;
    const d = ctx.getImageData(0, 0, cw, ch).data;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (d[(y * cw + x) * 4 + 3] > 120) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    out.push({ id: u.id, side: u.side, mounted: !!u.horse, body: [x0 / k, y0 / k, (x1 + 1) / k, (y1 + 1) / k], bar: [u.x - 16, u.y + 3, u.x + 16, u.y + 7] });
  }
  return out;
}
