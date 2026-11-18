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
//   softer, a beaten army flees when its heart breaks (a leader's army fights to the last)
// - tactics may fail: the chance (shown in the menu) depends on INT, element, weather and terrain
// - statuses with turns, shown as small icons; leaders are strong only by the general rules (level, traits, gear, formation, a strategist)
import { ctx, W, H, canvas, text, textW, windowBox, bar, HAND, HAS_FILTER, filtered } from './gfx.js?v=8';
import { input } from './input.js?v=8';
import { sfx, playMusic, currentSong } from './audio.js?v=8';
import { UI, menu, say, wait as uiWait, descBox, fit, wrap } from './ui.js?v=8';
import { L } from './i18n.js?v=8';
import { IMG, FX, tileset } from './assets.js?v=8';
import { GENERALS, GEN_LIST, gearFor, genName, parseLook } from './generals.js?v=8';
import { maxTP } from './data.js?v=8';
import { ITEMS, TACTICS, FORMS, unitEdge, maxTroops, itemName, tacName, TAC_DESC, unitName, SWING, formName, formEdge, beatenBy, BEATS, BEAT_WHY, STATUS } from './data.js?v=8';
import { S, member, stat, atkOf, defOf, troopsMax, usableTactics, tpMax, gainExp, give, take, have, hasSkill, formOk, recruit, canEquip } from './state.js?v=8';
import { battleSheet, fieldSheet } from './doll.js?v=8';
import { drawPose } from './equipui.js?v=8';
import { horseImg } from './horses.js?v=8';
import { gearFx, fxText, RELIC_FX, SRC, TREASURES, RARITY } from './data.js?v=8';
import { icon, digits, ICON_COL } from './icons.js?v=8';
import { pushRaw as UIpush, removeRaw as UIpop } from './ui.js?v=8';
import { TRAITS, traitName, traitDesc } from './traits.js?v=8';

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
// every army's leader is its commander (主將): the head of our line and the enemy's leader alike fight with
// +15% attack and defence. That is the only thing a leader has that others do not.
const CMD = 1.15;
const TELE_MUL = { single: 1.4, aoe: 1.5, tac: 1.35, fireships: 1.4 };
function makeUnit(side, spec, slot) {
  const g = GENERALS[spec.id], m = side === 'ally' ? member(spec.id) : null;
  const lv = m ? m.lv : spec.lv;
  // an enemy commander may wear treasures (spec.tr: the best pieces of the chapters up to that one)
  const equip = m ? m.equip : spec.tr ? bestGear(g, gearFor(g, lv), spec.tr) : gearFor(g, lv);
  const lead = m ? stat(m, 'lead') : g.lead;
  const sum = (k) => Object.values(equip).reduce((t, s) => t + ((s && ITEMS[s] && ITEMS[s][k]) || 0), 0);
  const max = m ? troopsMax(m) : Math.round(maxTroops(lv, lead, g.skills.includes('haoling')) * (spec.mul || 1));
  const u = {
    side, id: spec.id, g, m, lv, slot, equip, unit: g.unit, boss: !!spec.boss, faction: m ? 'sun' : spec.faction || g.faction, kidx: spec.kidx,
    max, troops: m ? Math.min(m.troops, max) : Math.round(max * (spec.hp || 1)),
    str: m ? stat(m, 'str') : g.str, int: m ? stat(m, 'int') : g.int + sum('int'), spd: (m ? stat(m, 'spd') : g.spd + sum('spd')),
    atk: m ? atkOf(m) : g.str + sum('atk'), def: m ? defOf(m) : Math.round(g.lead * 0.55 + sum('def')),
    own: m ? [...m.tactics] : enemyTactics(g, lv), st: {}, buf: {}, buqu: g.skills.includes('buqu'),
    sheet: null, x: undefined, y: 0, dx: 0, anim: 'idle', at: 0, flash: 0, alpha: 1, horse: equip.horse && ITEMS[equip.horse] ? ITEMS[equip.horse].horse : null,
    weakFire: !!(equip.armour && ITEMS[equip.armour] && ITEMS[equip.armour].weakFire), opts: { shield: g.shield || null, quiver: !!g.quiver },
    illusion: !!spec.illusion, bomb: spec.bomb || 0, petal: !!spec.petal, summon: !!spec.summon,
    hpMul: m ? 1 : (spec.mul || 1),
    fx: gearFx(equip),
    // the two traits (summoned shadows, petals and copies have none); tshown: traits already announced
    tr: new Set(spec.summon ? [] : g.traits || []), tshown: {},
  };
  // tests may hand extra traits to our side (traittest.mjs)
  if (side === 'ally' && window.G && G.testTraits) for (const t of G.testTraits) u.tr.add(t);
  u.buqu = u.tr.has('buqu');
  // random armies of the later lands are fiercer (spec.atkMul); leaders get nothing of their own but the
  // commander's edge (CMD, given in startBattle)
  if (side === 'foe' && spec.atkMul && !spec.boss) u.atk = Math.round(u.atk * spec.atkMul);
  battleSheet(g.look, equip, u.opts).then((s) => { u.sheet = s; });
  const sl = soldierLook(u.faction, u.unit);
  u.soldier = sl;
  fieldSheet(sl.look, sl.equip);
  return u;
}
// the treasures an enemy commander wears: for each slot one of the best three pieces of the chapters so far
// (picked by his id, so he always wears the same), none of the trials' own rewards; a famous general keeps
// any treasure he is known for
function bestGear(g, base, ch) {
  const eq = { ...base }, fake = { id: g.id, equip: eq };
  const val = (it) => (it.atk || 0) + (it.def || 0) + (it.int || 0) * (g.int > g.str ? 1 : 0.4) + (it.lead || 0) + (it.spd || 0) + it.rar * 4;
  let k = 0; for (const c of g.id) k = (k * 31 + c.charCodeAt(0)) >>> 0;
  for (const slot of ['weapon', 'armour', 'helm', 'cape', 'horse', 'treasure', 'shield']) {
    if (eq[slot] && ITEMS[eq[slot]] && ITEMS[eq[slot]].tr) continue;
    if (slot === 'horse' && g.unit !== 'cav' && !eq.horse) continue;
    const list = TREASURES.filter((id) => { const it = ITEMS[id]; return it.kind === slot && it.ch <= ch && !(SRC[id] && SRC[id].t === 'sq') && canEquip(fake, id) && (slot !== 'weapon' || (it.cat === 'staff') === (g.int > g.str + 10)); })
      .sort((a, b) => val(ITEMS[b]) - val(ITEMS[a])).slice(0, 3);
    if (list.length) eq[slot] = list[(k + slot.length) % list.length];
  }
  return eq;
}
function enemyTactics(g, lv) {
  const out = [...(g.tac || [])];
  for (const t of Object.values(TACTICS)) if (!t.unique && !t.enemyOnly && t.int && g.int >= t.int && lv >= t.lv && !out.includes(t.id) && !t.field) out.push(t.id);
  return out.filter((t) => !['dunzou', 'zhencha', 'tianbian'].includes(t));
}
const alive = (side) => B.units.filter((u) => u.side === side && u.troops > 0);
// traits: has(u, id) for one general, sideHas for anyone standing on a side
const has = (u, id) => !!(u && u.tr && u.tr.has(id));
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
const curForm = (side) => (side === 'ally' ? B.form : B.foeForm);
// one of a formation's numbers (atk, def, spd, tac, naval, bow, charge); a Formation Master (陣法家) standing
// with his side makes every bonus half again as big
function formK(side, k) {
  const f = formOf(side), v = f[k] === undefined ? 1 : f[k];
  return v > 1 && sideHas(side, 'zhenfa') ? 1 + Math.min((v - 1) * 1.5, v - 1 + 0.08) : v;
}
const edgeSide = (side) => (side === 'ally' ? formEdge(B.form, B.foeForm) : formEdge(B.foeForm, B.form));
// the formation counter: +15% for the winner (+25% with 美周郎), -12% for the loser (破陣 ignores it)
const formMul = (side, u) => { const e = edgeSide(side); if (e > 0) return (sideHas(side, 'meizhoulang') ? 1.25 : 1.15) * (has(u, 'pozhen') ? 1.1 : 1); if (e < 0) return has(u, 'pozhen') ? 1 : 0.88; return 1; };
const buffK = (u, k) => (u.buf[k] > 0 ? 1.25 : 1);
const moraleMul = (side) => 0.8 + 0.4 * (B.morale[side] / 100);
const scaleLv = (lv) => maxTroops(lv, 70) / 4;
const rnd = (a, b) => a + Math.random() * (b - a);
function sideHas(side, s) { return alive(side).some((u) => has(u, s)); }
const ranged = (u) => { const c = u.equip.weapon && ITEMS[u.equip.weapon] ? ITEMS[u.equip.weapon].cat : 'sword'; return c === 'bow' || c === 'xbow'; };
const pincered = (u) => { const k = B.kit; return k && k.pincer && k.pincer.includes(u.kidx) && k.pincer.every((i) => { const v = kitBoss(i); return v && v.troops > 0; }); };
const veiled = (u) => u.side === 'foe' && u.boss && B.kit && B.kit.moves && B.kit.moves.some((m) => m.kind === 'illusion') && alive('foe').some((v) => v.illusion);
const iceStance = (u) => u.stance === 'ice';
const mirrored = (u) => u.st.reflect > 0 || u.stance === 'mirror';
const ROUGH = new Set(['hill', 'mountain', 'forest', 'cave']);
// how much harder a attacks d: the unit triangle
export const edgeOf = (a, d) => unitEdge(a.unit, d.unit, B.naval);
// a general's own attack and defence multipliers before they meet anyone: buffs, statuses, formation, gear,
// traits (the info card shows the same numbers)
function atkMul(a, d = null) {
  let k = buffK(a, 'atk') * formK(a.side, 'atk') * (a.st.provoke ? 1.2 : 1) * (a.st.fear ? 0.7 : 1) * (a.st.curse ? 0.8 : 1) * (a.berserk ? 1.4 : 1) * (pincered(a) ? 1.3 : 1);
  if (has(a, 'yongmeng')) k *= 1.1;
  if (has(a, 'mengjin')) k *= 1.2;
  if (has(a, 'xianfeng') && colOf(a) === 0) k *= 1.15;
  const ax = a.fx || {};
  k *= 1 + ((d && ax.vs && ax.vs[d.unit]) || 0) + ((ax.as && ax.as[a.unit]) || 0) + ((ax.form && ax.form[curForm(a.side)]) || 0);
  return k;
}
function defMul(d, a = null) {
  const fd = formK(d.side, 'def');
  let k = buffK(d, 'def') * (has(a, 'pozhen') ? Math.min(1, fd) : fd) * (d.st.provoke ? 0.6 : 1) * (d.st.defdown ? 0.65 : 1) * (d.berserk ? 0.8 : 1);
  if (has(d, 'tiebi')) k *= 1.2;
  const dx = d.fx || {};
  k *= 1 + ((dx.form && dx.form[curForm(d.side)]) || 0);
  if (has(d, 'dunqiang')) k *= 1.3;
  if (has(d, 'mengjin')) k *= 0.85;
  if (has(d, 'xianfeng') && colOf(d) === 0) k *= 1.1;
  if (has(d, 'shanzhan') && ROUGH.has(B.terrain)) k *= 1.1;
  if (sideHas(d.side, 'biyan')) k *= 1.08;
  return k;
}
// opts: tele (an announced move: defending cuts it to 35%), snipe (ignores the back-row rule).
// tr: the traits that made a difference to this blow (the caller shows their names)
function physDamage(a, d, mul = 1, opts = {}) {
  const fa = formOf(a.side), fd = formOf(d.side), ax = a.fx || {}, dx = d.fx || {}, tr = [];
  let A = a.atk * atkMul(a, d);
  if (sideHas(d.side, 'weifeng')) { A *= 0.92; tr.push('weifeng:ds'); }
  let D = d.def * defMul(d, a);
  if (has(a, 'shenshe')) { D *= 0.75; tr.push('shenshe'); }
  for (const id of ['yongmeng', 'mengjin', 'jdhu']) if (has(a, id)) tr.push(id);
  if (has(a, 'xianfeng') && colOf(a) === 0) tr.push('xianfeng');
  if (has(d, 'mengjin')) tr.push('mengjin:d');
  if (sideHas(d.side, 'biyan')) tr.push('biyan:ds');
  if (has(a, 'pozhen') && (edgeSide(a.side) !== 0 || formK(d.side, 'def') > 1)) tr.push('pozhen');
  if (B.naval && (has(a, 'shuizhan') || has(d, 'shuizhan'))) tr.push(has(a, 'shuizhan') ? 'shuizhan' : 'shuizhan:d');
  if (B.round === 1 && has(a, 'yexi')) tr.push('yexi');
  if (has(d, 'changshan')) tr.push('changshan:d');
  let dmg = (A * A) / (A + D) / 52 * scaleLv(a.lv);
  dmg *= 0.55 + 0.45 * (a.troops / a.max);
  const edge = edgeOf(a, d); dmg *= edge;
  dmg *= formMul(a.side, a) * moraleMul(a.side);
  if (B.naval && ax.nav) dmg *= 1 + ax.nav;
  if (B.naval) {
    if (has(a, 'shuizhan')) dmg *= 1.25; if (has(d, 'shuizhan')) dmg /= 1.2; if (fa.naval) dmg *= formK(a.side, 'naval'); if (fd.naval) dmg /= fd.naval;
    if (sideHas(a.side, 'shuishi')) { dmg *= 1.1; tr.push('shuishi'); }
  }
  if (B.round === 1) { if (has(a, 'tuji')) { dmg *= 1.3; tr.push('tuji'); } if (has(a, 'yexi')) dmg *= 1.15; if (fa.charge) dmg *= formK(a.side, 'charge'); }
  if ((a.unit === 'arc') && fa.bow) dmg *= formK(a.side, 'bow');
  if (a.unit === 'arc' && B.weather === 'wind') dmg *= 1.15;
  if (has(a, 'danqi')) { const k = 1 + 0.6 * (1 - a.troops / a.max); dmg *= k; if (k >= 1.3) tr.push('danqi'); }
  if (B.terrain === 'castle' && a.side === 'ally' && sideHas('ally', 'gongjiang')) dmg *= 1.12;
  // traits that depend on who is hit
  if (has(a, 'tieqi') && a.horse && d.unit === 'inf') { dmg *= 1.2; tr.push('tieqi'); }
  if (d.unit === 'cav' && has(a, 'qiangzhen')) { dmg *= 1.25; tr.push('qiangzhen'); }
  if (a.unit === 'cav' && has(d, 'qiangzhen')) { dmg *= 0.8; tr.push('qiangzhen:d'); }
  if (has(a, 'shanzhan') && ROUGH.has(B.terrain)) { dmg *= 1.2; tr.push('shanzhan'); }
  if (ranged(a) && has(d, 'dangjian')) { dmg *= 0.7; tr.push('dangjian:d'); }
  if (has(a, 'mengzhui') && d.troops < d.max * 0.3) { dmg *= 1.4; tr.push('mengzhui'); }
  if ((d.boss || d.g.famous) && has(a, 'zhanjiang')) { dmg *= 1.2; tr.push('zhanjiang'); }
  if ((d.boss || d.g.famous) && has(a, 'wusheng')) { dmg *= 1.25; tr.push('wusheng'); }
  if (has(d, 'tiebi') && !d.guard) tr.push('tiebi:d');
  if (has(d, 'dunqiang')) tr.push('dunqiang:d');
  if (has(a, 'jdhu')) dmg *= 1.15;
  if (has(a, 'heyizhi') && ['heyi', 'yanxing'].includes(curForm(a.side))) { dmg *= 1.2; tr.push('heyizhi'); }
  if (has(a, 'xiandeng') && !a.xdDone) { dmg *= 1.25; tr.push('xiandeng'); }
  if (has(a, 'quxie') && d.faction === 'sect') { dmg *= 1.2; tr.push('quxie'); }
  if (has(d, 'changshan')) dmg *= 0.75;
  // the back rows are hard to reach with a blade while the front holds (騎射 reaches them)
  let back = !opts.snipe && !ranged(a) && isBack(d) && frontHolds(d.side);
  if (back && has(a, 'qishe')) { back = false; tr.push('qishe'); }
  if (back) dmg *= 0.6;
  // boss defences
  if (d.wall) dmg *= 0.25;
  if (iceStance(d)) dmg *= 0.3;
  if (veiled(d)) { if (has(a, 'shipo')) tr.push('shipo'); else dmg *= 0.5; }
  if (d.side === 'foe' && B.kit && B.kit.chained) dmg *= 0.75;
  if (B.lvgap && a.side === 'foe') dmg *= B.lvgap;
  const crit = 0.05 + (has(a, 'shenshe') ? 0.15 : 0) + (has(a, 'huixin') ? 0.1 : 0) + (has(a, 'wusheng') ? 0.1 : 0) + (B.scouted && a.side === 'ally' ? 0.08 : 0) + (ax.crit || 0);
  const isCrit = !opts.tele && Math.random() < crit;
  if (isCrit) { dmg *= has(a, 'huixin') ? 1.8 : 1.5; if (has(a, 'huixin')) tr.push('huixin'); }
  if (d.guard) { dmg *= opts.tele || has(d, 'tiebi') ? 0.35 : 0.5; if (has(d, 'tiebi') && !opts.tele) tr.push('tiebi:d'); }
  dmg *= mul * rnd(0.88, 1.12);
  // misses: a nimble formation or general, fog on the river, a boss too quick for blades
  if (!opts.tele) {
    if (fd.evade && Math.random() < fd.evade) return { dmg: 0, miss: true, tr: [] };
    if (dx.eva && Math.random() < dx.eva) return { dmg: 0, miss: true, tr: [] };
    if (has(d, 'shenfa') && !disabled(d) && Math.random() < 0.12) return { dmg: 0, miss: true, tr: ['shenfa:d'] };
    if (B.fog > 0 && a.side === 'ally' && Math.random() < 0.35) return { dmg: 0, miss: true, fog: true, tr: [] };
    if (B.kit && B.kit.evade && d.kidx === 0 && !ranged(a) && !disabled(d) && Math.random() < B.kit.evade) return { dmg: 0, miss: true, tr: [] };
  }
  return { dmg: Math.max(1, Math.round(dmg)), crit: isCrit, edge, back, tr };
}
function tacPower(a) {
  let int = a.int;
  const s = a.side === 'ally' ? stratUnit() : null;
  if (s) int = Math.max(int, s.int * 0.92);
  return int;
}
const kitWeak = (d, el) => { const w = B.kit && B.kit.weak; return !!(w && w.el && el && w.el === el && d.kidx === (w.who || 0)); };
const kitImmuneEl = (d, el) => !!(B.kit && B.kit.immuneEl && el && B.kit.immuneEl[d.kidx] === el);
// statuses a trait keeps off: the trait's id, or null
const IMMUNE = { kanpo: ['confuse', 'stun', 'provoke', 'sleep'], lengjing: ['confuse', 'fear'], bumian: ['sleep', 'silence'], baidu: ['poison', 'burn'], quxie: ['curse'] };
function immuneBy(u, st) { for (const [id, l] of Object.entries(IMMUNE)) if (l.includes(st) && has(u, id)) return id; return null; }
// the chance a tactic works on d: INT against INT, then element, weather, terrain and traits
export function tacChance(a, d, t) {
  if (!t || !(t.pow || t.st) || t.t === 'self' || !isEnemyOf(a, d)) return 1;
  const P = tacPower(a);
  let c = t.pow ? 0.85 + (P - d.int) / 150 : 0.65 + (P - d.int) / 100;
  if (t.el === 'fire') { if (B.weather === 'rain') c -= 0.3; if (B.weather === 'wind') c += 0.1; if (B.terrain === 'forest') c += 0.05; }
  if (t.el === 'water' && (B.naval || B.terrain === 'river' || B.weather === 'rain')) c += 0.1;
  if (t.el === 'water' && has(a, 'shuigong')) c += 0.1;
  if (t.el === 'rock') { if (B.terrain === 'mountain' || B.terrain === 'hill') c += 0.1; if (B.naval) c -= 0.35; }
  if (t.el === 'thunder' && B.weather === 'rain') c += 0.15;
  if (sideHas(a.side, 'wolong')) c += 0.1;
  if (kitWeak(d, t.el)) c += 0.15;
  if (t.st) {
    if (d.boss) c -= 0.2;
    const w = B.kit && B.kit.weak; if (w && w.st === t.st && d.kidx === 0) c += 0.35;
    if (d.boss && B.kit && B.kit.immune && B.kit.immune.includes(t.st)) return 0;
    if (immuneBy(d, t.st)) return 0;
    if (has(a, 'yaoshu')) c += 0.15;
    if (d.fx && d.fx.res && d.fx.res[t.st]) c *= 1 - d.fx.res[t.st];
  }
  if (has(d, 'fanji')) c -= 0.2;
  if (has(d, 'langgu')) c -= 0.25;
  const fd = formOf(d.side); if (fd.resist) c -= fd.resist;
  return Math.max(t.pow ? 0.1 : 0.05, Math.min(t.pow ? 0.97 : 0.95, c));
}
// how much stronger a's ploys are from traits
function tacTraitMul(a, t, d = null) {
  let k = 1;
  if (has(a, 'huoshen') && t.el === 'fire') k *= 1.25;
  if (has(a, 'shuigong') && t.el === 'water') k *= 1.25;
  if (has(a, 'leigong') && t.el === 'thunder') k *= B.weather === 'rain' ? 1.4 : 1.25;
  if (has(a, 'jushi') && t.el === 'rock') k *= 1.3;
  if (has(a, 'fengchu') && t.t === 'eall') k *= 1.3;
  if (has(a, 'heyizhi') && ['heyi', 'yanxing'].includes(curForm(a.side))) k *= 1.2;
  if (sideHas(a.side, 'wolong')) k *= 1.15;
  if (d && has(a, 'quxie') && d.faction === 'sect') k *= 1.2;
  return k;
}
function tacDamage(a, d, t) {
  const int = tacPower(a), dint = d.int;
  // a clever caster against a dull target does more, but never wildly more
  let dmg = (t.pow || 1) * ((int + 40) / (dint * 0.6 + 70)) * 0.75 * scaleLv(a.lv);
  dmg *= formK(a.side, 'tac');
  const ax = a.fx || {}, dx = d.fx || {};
  dmg *= 1 + (ax.tac || 0) + ((ax.el && t.el && ax.el[t.el]) || 0);
  if (dx.resel && t.el && dx.resel[t.el]) dmg *= 1 - dx.resel[t.el];
  dmg *= formMul(a.side, a) * moraleMul(a.side);
  if (has(a, 'guimou') || (a.side === 'ally' && S.strategist && GENERALS[S.strategist].skills.includes('guimou') && stratUnit())) dmg *= 1.15;
  dmg *= tacTraitMul(a, t, d);
  if (t.el === 'fire') { if (B.weather === 'rain') dmg *= 0.6; if (B.weather === 'wind') dmg *= 1.3; if (B.terrain === 'forest') dmg *= 1.2; if (d.weakFire) dmg *= 2; if (has(a, 'gongjiang')) dmg *= 1.25; if (d.side === 'foe' && B.kit && B.kit.chained) dmg *= 1.4; }
  if (t.el === 'water') { if (B.weather === 'rain') dmg *= 1.3; if (B.naval || B.terrain === 'river') dmg *= 1.2; }
  if (t.el === 'thunder' && B.weather === 'rain') dmg *= 1.4;
  if (t.el === 'rock' && (B.terrain === 'mountain' || B.terrain === 'hill')) dmg *= 1.3;
  if (t.naval && B.naval) dmg *= t.naval;
  if (kitWeak(d, t.el)) dmg *= 1.5;
  if (B.kit && B.kit.resistAll && B.kit.resistAll[d.kidx]) dmg *= B.kit.resistAll[d.kidx];
  if (d.illusion) dmg *= 2;
  if (d.wall && t.el !== 'rock') dmg *= 0.25;
  if (veiled(d) && !has(a, 'shipo')) dmg *= 0.5;
  if (d.guard) dmg *= t.tele ? 0.35 : 0.5;
  if (B.lvgap && a.side === 'foe') dmg *= B.lvgap;
  return Math.max(1, Math.round(dmg * rnd(0.9, 1.1)));
}
// by: who dealt the blow (a kill may set off the killer's traits)
function hurt(u, dmg, by = null) {
  if (dmg <= 0 || u.troops <= 0) return;
  u.troops -= dmg;
  if (u.st.sleep) { delete u.st.sleep; pop(u, L('驚醒', 'Woke'), '#80b0ff', 10); }
  if (u.troops <= 0 && u.buqu) { u.troops = 1; u.buqu = false; tpop(u, 'buqu'); }
  if (u.troops <= 0) { u.troops = 0; u.anim = 'hurt'; u.at = 0; u.dead = true; fallen(u); if (by && by.troops > 0 && by.side !== u.side) onKill(by, u); }
  else { u.anim = 'hurt'; u.at = 0; }
  u.flash = 10; u.kb = Math.min(8, 3 + dmg / u.max * 30); u.sflinch = 8;
  checkPhases(u);
}
function heal(u, h) {
  if (u.troops <= 0) return 0;
  if (u.st.curse) { pop(u, L('詛咒阻止恢復', 'Curse blocks it'), '#d050d0'); return 0; }
  const before = u.troops; u.troops = Math.min(u.max, u.troops + Math.round(h)); return u.troops - before;
}
// numbers and words rising over a general; several at once stack upwards instead of covering each other
function pop(u, s, col = '#ffffff', dy = 0, trait = false) {
  const x = u.x + u.dx, y = u.y - (u.horse && !u.unhorsed ? 62 : 48) + dy;
  const near = nums.filter((n) => n.t < 18 && Math.abs(n.x - x) < 20 && Math.abs(n.y0 - y) < 13).length;
  nums.push({ x, y: y - near * 12, y0: y, s: String(s), col, t: 0, trait });
}
// a trait's name over the general when it does something, so the player learns what each one does.
// once: shown only the first time in a battle (for traits that work all the time)
function tpop(u, id, once = false) {
  if (!u || !TRAITS[id]) return;
  if (once) { if (u.tshown[id]) return; u.tshown[id] = 1; }
  pop(u, L(`「${TRAITS[id].zh}」`, TRAITS[id].en + '!'), TRAITS[id].fam === 'legend' ? '#ffd860' : '#ffe8a8', -10, true);
  if (window.G && G.blog) G.blog.push(`${B.round}: trait ${id} (${u.id})`);
  if (window.G) { G.traitHits = G.traitHits || {}; G.traitHits[id] = (G.traitHits[id] || 0) + 1; }
}
// traits that work all through the fight show once; these happen now and then and show every time
const PROC = new Set(['lianji', 'buqu', 'fanshou', 'dunjia', 'fanjian', 'pojun', 'duji', 'xuezhan', 'xiaobawang', 'lianhuan', 'huzhu', 'changshan', 'huwei', 'dunqiang', 'shenfa', 'huixin', 'yiqi', 'xiandeng', 'langgu', 'shipo']);
function showTraits(a, d, list) {
  for (const k of list || []) {
    const [id, who] = k.split(':');
    // ds / as: a trait that works for a whole side, shown over the one who has it
    const u = who === 'd' ? d : who === 'ds' ? sideUnit(d.side, id) : who === 'as' ? sideUnit(a.side, id) : a;
    if (u) tpop(u, id, !PROC.has(id) || who === 'd' && id === 'changshan');
  }
}
// a general felled a foe
function onKill(u, t) {
  if (t.summon && !t.illusion) return;
  if (has(u, 'xuezhan')) { const h = heal(u, u.max * 0.12); u.buf.atk = Math.max(u.buf.atk || 0, 3); tpop(u, 'xuezhan'); if (h) pop(u, '+' + h, '#80ffa0'); }
  if (has(u, 'xiaobawang') && u.xbw !== B.round) { u.xbw = B.round; u.again = true; }
}

// ---------- morale ----------
// floors: 江東之虎 and 碧眼兒 keep their side from losing heart while they stand
function moraleFloor(side) { return sideHas(side, 'jdhu') ? 40 : sideHas(side, 'biyan') ? 35 : 0; }
function morale(side, n) {
  if (!B.morale) return;
  const before = B.morale[side];
  B.morale[side] = Math.max(0, Math.min(100, B.morale[side] + n));
  const fl = n < 0 ? moraleFloor(side) : 0;
  if (fl && B.morale[side] < fl) { B.morale[side] = Math.max(B.morale[side], Math.min(before, fl)); const k = sideUnit(side, 'jdhu') || sideUnit(side, 'biyan'); if (k) tpop(k, has(k, 'jdhu') ? 'jdhu' : 'biyan', true); }
  return B.morale[side] - before;
}
const sideUnit = (side, s) => alive(side).find((u) => has(u, s)) || null;
// someone fell: their side loses heart, the other gains it; the last leader's fall breaks the enemy
function fallen(u) {
  if (u.summon) return;
  const other = u.side === 'ally' ? 'foe' : 'ally';
  const cc = sideUnit(u.side, 'jianxiong');
  if (cc) { for (const v of alive(u.side)) v.buf.atk = Math.max(v.buf.atk || 0, 2); tpop(cc, 'jianxiong'); }
  else morale(u.side, u.cmd ? -25 : -12);
  morale(other, u.cmd ? 15 : 8);
  // an army whose commander has fallen may break and run when its heart goes (both sides, any battle)
  if (u.cmd) B.cmdDown = { ...(B.cmdDown || {}), [u.side]: true };
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
      foeForm: cfg.foeForm || ['fangyuan', 'yulin', 'heyi', 'changshe'][Math.floor(Math.random() * 4)], scouted: false, auto: false, over: false, fade: 30, prevSong: currentSong, ambush: {}, lvgap: 0, cmdDown: null,
      kit: null, morale: { ally: 50, foe: cfg.boss ? 55 : 50 }, fog: 0, pending: [], phaseDone: {}, nextMove: {}, cur: null, picking: null, card: null, stats: { tele: 0, cancel: 0 } });
    nums.length = 0; fxs.length = 0; shots.length = 0; fallers.length = 0; runners.length = 0; msg = '';
    // a trial may allow only the first few of the front line (onlyFront)
    S.front.filter((id) => member(id)).slice(0, cfg.onlyFront || 5).forEach((id, i) => B.units.push(makeUnit('ally', { id }, i)));
    cfg.foes.forEach((f, i) => B.units.push(makeUnit('foe', { ...f, kidx: i }, i)));
    // the commanders: the head of our line, and the enemy's leader (or first general)
    const ourCmd = B.units.find((u) => u.side === 'ally'), foeCmd = B.units.find((u) => u.side === 'foe' && u.boss) || B.units.find((u) => u.side === 'foe');
    for (const u of [ourCmd, foeCmd]) if (u) { u.cmd = true; u.atk = Math.round(u.atk * CMD); u.def = Math.round(u.def * CMD); }
    // the enemy's strategy pool works like ours: its cleverest general's strategy points (plus gear)
    const foes0 = B.units.filter((u) => u.side === 'foe'), sage = foes0.reduce((a, b) => (b.int > a.int ? b : a), foes0[0]);
    B.foeTpMax = sage ? maxTP(sage.int, sage.lv) + Math.min(20, foes0.reduce((t, u) => t + (u.fx.sp || 0), 0)) : 0; B.foeTp = B.foeTpMax; B.foeSage = sage;
    layoutSide('ally', B.form, true); layoutSide('foe', B.foeForm, true);
    B.morale.ally = Math.min(100, B.morale.ally + Math.min(15, alive('ally').reduce((t, u) => t + (u.fx.mor || 0), 0)));
    B.relicUsed = {};
    if (B.kit && B.kit.wall !== undefined) { const w = kitBoss(B.kit.wall); if (w) w.wall = true; }
    if (B.kit && B.kit.moves) B.kit.moves.forEach((m, i) => { B.nextMove[i] = m.first; });
    playMusic(cfg.music || (cfg.boss ? 'boss' : cfg.naval ? 'naval' : 'battle'));
    run().catch((e) => { console.error(e); finish('win'); });
  });
}
function finish(result) {
  B.active = false; B.over = true;
  if (B.card) closeCard();
  // carry troops back to the army
  for (const u of B.units) if (u.side === 'ally' && u.m) u.m.troops = Math.max(0, u.troops);
  waits.length = 0;
  const r = B.resolve; B.resolve = null;
  if (r) r(result);
}
// the strongest standing foe of u (by attack), for traits that pick one out
const strongestFoe = (side) => alive(side === 'ally' ? 'foe' : 'ally').filter((v) => !v.summon).sort((a, b) => b.atk - a.atk)[0] || null;
// traits that act when the battle begins
async function traitsAtStart() {
  const both = alive('ally').concat(alive('foe'));
  for (const u of both) if (has(u, 'jili')) { for (const v of alive(u.side)) v.buf.atk = 2; morale(u.side, 5); tpop(u, 'jili'); say1(L(`${N(u)}激勵全軍！`, `${N(u)} inspires the army!`)); sfx('buff'); await tick(30); }
  for (const u of both) if (has(u, 'meizhoulang')) { morale(u.side, 10); tpop(u, 'meizhoulang'); }
  for (const side of ['ally', 'foe']) { const z = sideUnit(side, 'zhenfa'); if (z && ['atk', 'def', 'spd', 'tac'].some((k) => (formOf(side)[k] || 1) > 1)) tpop(z, 'zhenfa'); }
  for (const u of both) if (has(u, 'weiya')) { const o = u.side === 'ally' ? 'foe' : 'ally'; morale(o, -8); tpop(u, 'weiya'); say1(L(`${N(u)}威壓全場，敵軍士氣下降！`, `${N(u)} overawes the field; the enemy loses heart!`)); await tick(26); }
  // a roar that frightens the foe
  for (const u of both) if (has(u, 'yanren')) {
    tpop(u, 'yanren'); say1(L(`${N(u)}一聲大喝！`, `${N(u)} roars!`)); sfx('crit'); B.shake = 5;
    for (const v of alive(u.side === 'ally' ? 'foe' : 'ally')) { if (immuneBy(v, 'fear')) { tpop(v, immuneBy(v, 'fear'), true); continue; } if (Math.random() < (v.boss ? 0.3 : 0.5)) { v.st.fear = 2; pop(v, stName('fear'), STATUS.fear[2]); } }
    await tick(36);
  }
  // a taunt: the strongest foe is provoked into attacking the taunter
  for (const u of both) if (has(u, 'tiaoxin')) {
    const v = strongestFoe(u.side); if (!v) continue;
    tpop(u, 'tiaoxin');
    const imm = immuneBy(v, 'provoke');
    if (imm) { tpop(v, imm, true); continue; }
    if (Math.random() < (v.boss ? 0.4 : 0.75)) { v.st.provoke = u; v.st.provokeT = 2; pop(v, stName('provoke'), STATUS.provoke[2]); say1(L(`${N(u)}挑釁${N(v)}！`, `${N(u)} taunts ${N(v)}!`)); await tick(26); }
  }
  // scouts and a ghost talent see through the enemy
  for (const u of alive('ally')) {
    if (has(u, 'guicai') && !B.scouted) { B.scouted = true; tpop(u, 'guicai'); say1(L(`${N(u)}一眼看穿了敵軍的虛實！`, `${N(u)} sees right through the enemy!`)); await tick(40); if (B.kit && B.kit.info) { say1(L(B.kit.info[0], B.kit.info[1])); await tick(fast ? 60 : 120); } }
    if (has(u, 'chihou')) { const t = alive('foe').find((v) => v.kidx === 0 && v.boss) || strongestFoe('ally'); if (t && !t.revealed) { t.revealed = true; tpop(u, 'chihou'); say1(L(`${N(u)}的斥候探明了${N(t)}的虛實（弱點、抗性與下一招）。`, `${N(u)}'s scouts learn ${N(t)}'s weak points, resistances and next move.`)); await tick(40); } }
  }
  // a free volley from a Bow Saint
  for (const u of both) if (has(u, 'gongshen') && u.troops > 0) { const t = strongestFoe(u.side); if (!t) continue; tpop(u, 'gongshen'); say1(L(`${N(u)}開戰先射一輪冷箭！`, `${N(u)} opens with a volley!`)); await attack(u, t, false, 0.6, true); if (B.over) return; }
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
  // traits at the start
  await traitsAtStart();
  if (await checkEnd()) return;
  // a surprise attack: the enemy sometimes strikes first (scouts and surprise traits prevent it)
  let first = null;
  const qx = sideUnit('ally', 'qixi');
  if (!B.cfg.boss && Math.random() < 0.08 && !qx) first = 'foe';
  else if (!B.cfg.boss && Math.random() < (sideHas('ally', 'yexi') ? 0.18 : 0.07) + (qx ? 0.1 : 0) + Math.max(0, ...alive('ally').map((u) => (u.fx.first || 0) * 0.4))) first = 'ally';
  if (first) { say1(first === 'foe' ? L('敵軍突襲！', 'An enemy ambush!') : L('我軍搶得先機！', 'We strike first!')); if (first === 'ally' && qx) tpop(qx, 'qixi'); await tick(40); }
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
    // a trial against the clock (maxRounds): the enemy gets what it came for
    if (B.cfg.maxRounds && B.round >= B.cfg.maxRounds) {
      say1(B.cfg.timeout ? L(B.cfg.timeout[0], B.cfg.timeout[1]) : L('時限已到，功虧一簣……', 'Time runs out...')); await tick(80);
      finish('lose'); return;
    }
    // a battle cannot go on for ever: after forty rounds the supplies run out
    if (B.round >= 40) {
      say1(L('雙方兵糧耗盡，各自退兵了。', 'Both armies run out of supplies and fall back.')); await tick(60);
      finish(B.cfg.boss ? 'lose' : 'run'); return;
    }
  }
}
// speed this round (without the dice: the card shows it)
const speedBase = (u) => u.spd * (B.round <= 1 && u.fx && u.fx.first ? 1 + u.fx.first : 1) * buffK(u, 'spd') * formK(u.side, 'spd') * (has(u, 'jisu') ? 1.2 : 1) * (B.naval && has(u, 'guanxing') ? 1.2 : 1) * (B.round <= 1 && has(u, 'xiandeng') ? 2 : 1);
const speedOf = (u) => speedBase(u) * rnd(0.85, 1.15) + (u.guard ? 1000 : 0);

// ---------- boss mechanics ----------
const mvName = (m) => L(m.name[0], m.name[1]);
// any army whose commander or cleverest general is sharp enough (INT or LEAD 85+) sees our formation beat theirs
// and changes to the one that beats ours, once in a battle, from the second round; we may answer in turn
async function readFormation() {
  if (B.round < 2 || B.foeRead || formEdge(B.foeForm, B.form) >= 0) return;
  const r = alive('foe').find((u) => !u.summon && !disabled(u) && !u.st.confuse && (u.int >= 85 || u.g.lead >= 85));
  if (!r) return;
  const nf = beatenBy(B.form);
  B.foeRead = true;
  if (!nf || nf === B.foeForm) return;
  B.foeForm = nf; layoutSide('foe', nf); morale('foe', 5);
  say1(L(`${N(r)}看穿了我軍的陣形，變陣為「${FORMS[nf].zh}」！`, `${N(r)} reads our formation and changes to the ${FORMS[nf].en}!`)); sfx('buff'); await tick(46);
}
// at the start of each round: stances change, announced moves begin (or happen at once, for instant ones)
async function roundStart() {
  await readFormation();
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
    for (const v of allies) { const im = has(v, 'kanpo') ? 'kanpo' : immuneBy(v, 'curse'); if (im) { tpop(v, im); continue; } if (v.fx.res && v.fx.res.curse && Math.random() < v.fx.res.curse) { pop(v, L('抵抗', 'Resisted'), '#a0d0ff'); continue; } v.st.curse = 4; pop(v, L('詛咒', 'Cursed'), '#d050d0'); fxs.push({ k: 'spirit', x: v.x, y: v.y - 30, t: 0 }); }
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
    const strong = targets.filter((v) => { const im = immuneBy(v, st); if (im) tpop(v, im); return !im; }).sort((a, b) => b.atk - a.atk).slice(0, 2).filter((v) => { const r = v.fx.res && v.fx.res[st]; if (r && Math.random() < r) { pop(v, L('抵抗', 'Resisted'), '#a0d0ff'); return false; } return true; });
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
      else { const g = alive('ally').find((v) => v !== t && v.guard && (has(v, 'dunqiang') || has(v, 'huwei') || has(v, 'huzhu') || has(v, 'changshan'))); if (g) { tpop(g, ['dunqiang', 'huzhu', 'changshan', 'huwei'].find((k) => has(g, k))); say1(L(`${N(g)}挺身擋下！`, `${N(g)} steps in and takes it!`)); await tick(16); t = g; } }
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
    // 情報 (Info) looks at anyone on the field without using the turn; the menu key does the same
    const cmds = [L('攻擊', 'Attack'), L('策略', 'Tactic'), L('道具', 'Item'), L('防禦', 'Defend'), L('變陣', 'Formation'), L('情報', 'Info'), L('兵法', 'Help'), L('全軍突擊', 'Charge!'), L('撤退', 'Retreat')];
    const dis = [false, !tacticsOf(u).length || !!u.st.silence, !battleItems().length, false, S.forms.length < 2, false, false, false, !B.cfg.canRun && B.cfg.canRun !== undefined];
    const c = await menu(cmds.map((s, k) => ({ label: s, disabled: dis[k] })), { x: 4, y: 186, w: 156, cols: 2, rowH: 13, cancel: true, title: N(u), keys: { menu: () => true } });
    if (c && c.key === 'menu') { await openCard(u); continue; }
    if (c === -1) { if (i > 0) { i--; while (i > 0 && (fr[i].st.stun || fr[i].st.sleep || fr[i].st.confuse)) i--; orders.delete(fr[i]); fr[i].guard = false; } continue; }
    if (c === 0) { const t = await pickTarget('foe', u); if (!t) continue; orders.set(u, { kind: 'attack', target: t }); i++; continue; }
    if (c === 1) { const o = await pickTactic(u); if (!o) continue; orders.set(u, o); i++; continue; }
    if (c === 2) { const o = await pickItem(u); if (!o) continue; orders.set(u, o); i++; continue; }
    if (c === 3) { orders.set(u, { kind: 'guard' }); u.guard = true; i++; continue; }
    if (c === 4) { const f = await pickForm(); if (!f) continue; orders.set(u, { kind: 'form', form: f }); i++; continue; }
    if (c === 5) { await openCard(alive('foe').find((v) => v.boss) || alive('foe')[0] || u); continue; }
    if (c === 6) { if (window.G && G.help) await G.help(true); continue; }
    if (c === 7) { B.auto = true; say1(L('全軍突擊！（按住B取消）', 'All-out charge! (hold B to stop)')); for (let k = i; k < fr.length; k++) orders.set(fr[k], autoOrder(fr[k])); B.cur = null; return; }
    if (c === 8) { B.cur = null; return 'run'; }
  }
  B.cur = null;
}
// what a ploy costs: the strategist's Foresight (神算), the caster's own Thrift (節約), gear
const tacCost = (t, u) => Math.max(1, Math.round(TACTICS[t].cost * (hasShensuan() ? 0.75 : 1) * (has(u, 'jieyue') ? 0.7 : 1) * (1 - ((u && u.fx && u.fx.cost) || 0))));
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
    drawExtra: () => { const id = list[cur], f = FORMS[id]; sideNote(L(f.desc[0], f.desc[1]) + '\n' + formCounterText(id)); } });
  return c < 0 ? null : list[c];
}
export function formCounterText(id) {
  const b = BEATS[id], by = beatenBy(id);
  if (!b && !by) return L('不在相剋之列。', 'Outside the circle of counters.');
  return L(`克制：${b ? FORMS[b].zh : '—'}　被克：${by ? FORMS[by].zh : '—'}`, `Beats: ${b ? FORMS[b].en : '-'}   Beaten by: ${by ? FORMS[by].en : '-'}`);
}
async function pickTarget(side, u, { all = false, down = false, tac = null, heal: healFn = null } = {}) {
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
        // the menu key (選單 on the touch pad) opens the full card of the one under the hand
        if (input.pressed('menu') && list[i].troops > 0) { openCard(list[i]); return; }
        if (input.pressed('a')) { sfx('ok'); UIpop(w); B.picking = null; B.preview = null; res(list[i]); return; }
        if (input.pressed('b')) { sfx('cancel'); UIpop(w); B.picking = null; B.preview = null; res(null); return; }
        B.picking = { t: list[i], u, tac };
        B.preview = healFn ? (x) => (x === list[i] ? healFn(x) : 0) : null;
      },
      draw() {
        const t = list[i], f = (performance.now() / 120) | 0;
        ctx.drawImage(HAND, t.x + t.dx - 6 + (f % 2), t.y - 72);
      },
    };
    B.picking = { t: list[i], u, tac };
    UIpush(w);
  });
}
// shown in the message panel while choosing a target: who it is, troops, the two traits, how well we match
// up, the chance a ploy works; the menu key opens the full card
function drawInfo(p) {
  const t = p.t, u = p.u, foe = t.side === 'foe';
  const X = 8; let y = 195;
  text(fit(`${N(t)} Lv${t.lv}`, 112), X, y, foe ? '#ffb0a0' : '#c0e0ff');
  icon(t.unit, 124, y + 3); y += 13;
  text(fit(`${L('兵', 'T')} ${t.troops}/${t.max}`, 146), X, y, '#e0e0e0'); y += 13;
  const h = !foe && B.preview ? B.preview(t) : 0;
  const lines = [];
  if (h > 0) lines.push([L(`恢復 +${h} → ${t.troops + h}`, `Heals +${h} -> ${t.troops + h}`), '#90ffa8']);
  if (foe && u) {
    if (p.tac) {
      const T = TACTICS[p.tac], ch = Math.round(tacChance(u, t, T) * 100);
      lines.push([L(`成功率 ${ch}%`, `Chance ${ch}%`), ch >= 70 ? '#80ff90' : ch >= 40 ? '#ffe070' : '#ff8080']);
      if (mirrored(t)) lines.push([L('會反彈！', 'Reflects!'), '#c0f0ff']);
      else if (kitWeak(t, T.el) && seen(t)) lines.push([L('弱點！', 'Weak point!'), '#80ff90']);
    } else {
      const e = edgeOf(u, t);
      if (e > 1.01) lines.push([L(`▲克制 x${e}`, `▲Strong x${e}`), '#80ff90']); else if (e < 0.99) lines.push([L(`▼被克制 x${e}`, `▼Weak x${e}`), '#ff8080']);
      if (!ranged(u) && !has(u, 'qishe') && isBack(t) && frontHolds(t.side)) lines.push([L('後排 -40%', 'Back row -40%'), '#ffc080']);
      if (B.kit && B.kit.guards && t.kidx === 0 && guardOf(t)) lines.push([L('有親兵護衛', 'Guarded'), '#ffc080']);
      else if (B.kit && B.kit.evade && t.kidx === 0 && !ranged(u)) lines.push([L('難以命中', 'Hard to hit'), '#ffc080']);
    }
  }
  lines.splice(Math.min(lines.length, 2), 0, ...(t.tr.size ? [[[...t.tr].map(traitName).join(L('・', ' / ')), '#ffe8a8']] : []));
  for (const [s1, c] of lines.slice(0, 3)) { text(fit(s1, 146), X, y, c); y += 13; }
}
// how many troops a heal would bring back (shown on the army panel before choosing)
// a healer's power: INT, Stargazer, Physician, gear
const healK = (u) => (has(u, 'guanxing') ? 1.2 : 1) * (has(u, 'yizhe') ? 1.3 : 1) * (0.6 + tacPower(u) / 250) * (1 + ((u.fx && u.fx.heal) || 0));
function tacHealAmt(u, x, t) { if (x.troops <= 0) return 0; const k = healK(u); return Math.max(0, Math.min(x.max - x.troops, Math.round(x.max * t.heal * k / Math.max(1, x.hpMul || 1)))); }
function itemHealAmt(x, it, u = null) { return x.troops <= 0 ? 0 : Math.max(0, Math.min(x.max - x.troops, Math.round(x.max * it.heal * (has(u, 'liangguan') ? 1.4 : 1)))); }
function healAllPreview(u, t) { return t && t.heal && t.t === 'aall' ? (x) => tacHealAmt(u, x, t) : null; }
function itemNote(it) {
  if (it.heal) return it.target === 'all' ? L(`全軍恢復${Math.round(it.heal * 100)}%兵力。`, `Restores ${Math.round(it.heal * 100)}% troops to the whole army.`) : L(`一支部隊恢復${Math.round(it.heal * 100)}%兵力。`, `Restores ${Math.round(it.heal * 100)}% troops to one unit.`);
  return it.desc ? L(it.desc[0], it.desc[1]) : '';
}
// a note in the left box of the bottom panel (descriptions while a menu is open), leaving the army panel in view
function sideNote(s) {
  if (!s) return;
  ctx.fillStyle = '#10142c'; ctx.fillRect(4, 194, 152, 72);
  const parts = String(s).split('\n'), lines = [];
  parts.forEach((p, k) => { for (const l of wrapShort(p, 144)) lines.push([l, k > 0 ? '#ffe070' : '#f0f0f0']); });
  lines.slice(0, 5).forEach(([l, c], i) => text(l, 8, 196 + i * 14, c));
}
async function pickTactic(u) {
  const list = tacticsOf(u).filter((t) => TACTICS[t]);
  const foes = alive('foe');
  // the chance shown in the menu: against the average enemy (each target's own chance shows when aiming)
  const pct = (id) => { const t = TACTICS[id]; if (!(t.pow || t.st) || t.t === 'self' || t.t[0] !== 'e' || !foes.length) return ''; return Math.round(foes.reduce((s, f) => s + tacChance(u, f, t), 0) / foes.length * 100) + '%'; };
  const items = list.map((t) => ({ label: tacName(t), right: `${pct(t)} ${tacCost(t, u)}`.trim(), disabled: tacCost(t, u) > S.tp || (TACTICS[t].escape && B.cfg.boss) || (TACTICS[t].t === 'down' && !B.units.some((x) => x.side === 'ally' && x.troops <= 0 && !x.summon)) }));
  let cur = 0;
  const c = await menu(items, { x: 6, y: 34, w: 196, title: L(`策略值 ${S.tp}/${tpMax()}　成功率 消耗`, `SP ${S.tp}/${tpMax()}  chance cost`), maxRows: 8, onMove: (i) => { cur = i; B.preview = healAllPreview(u, TACTICS[list[i]]); }, drawExtra: () => { const d = TAC_DESC[list[cur]]; if (d) sideNote(L(d[0], d[1])); } });
  B.preview = null;
  if (c < 0) return null;
  const t = TACTICS[list[c]];
  let target = null;
  if (t.t === 'e1') { target = await pickTarget('foe', u, { tac: t.id }); if (!target) return null; }
  else if (t.t === 'a1') { target = await pickTarget('ally', u, { heal: t.heal ? (x) => tacHealAmt(u, x, t) : null }); if (!target) return null; }
  else if (t.t === 'down') { target = await pickTarget('ally', u, { down: true }); if (!target) return null; }
  return { kind: 'tactic', tac: t.id, target, cost: tacCost(t.id, u) };
}
const battleItems = () => Object.keys(S.items).filter((k) => ITEMS[k] && ((ITEMS[k].kind === 'supply' && !ITEMS[k].fieldOnly) || ITEMS[k].kind === 'relic'));
async function pickItem(u) {
  const ids = battleItems().sort((a, b) => (ITEMS[a].kind === 'relic') - (ITEMS[b].kind === 'relic'));
  let cur = 0;
  const c = await menu(ids.map((k) => ({ label: itemName(k), right: ITEMS[k].kind === 'relic' ? (B.relicUsed[k] ? L('已用', 'used') : L('戰具', 'relic')) : S.items[k], color: ITEMS[k].kind === 'relic' ? RARITY[ITEMS[k].rar][2] : undefined, disabled: !!B.relicUsed[k] })), { x: 6, y: 34, w: 170, title: L('道具', 'Items'), maxRows: 7, onMove: (i) => { cur = i; const it = ITEMS[ids[i]]; B.preview = it && it.heal && it.target === 'all' ? (x) => itemHealAmt(x, it, u) : null; }, drawExtra: () => { const it = ITEMS[ids[cur]]; if (it) sideNote(it.kind === 'relic' ? L(RELIC_FX[it.relic][0], RELIC_FX[it.relic][1]) : itemNote(it)); } });
  B.preview = null;
  if (c < 0) return null;
  const it = ITEMS[ids[c]];
  if (it.kind === 'relic') { B.relicUsed[ids[c]] = 1; let target = null; if (it.relic === 'incense') { target = await pickTarget('ally', u, { down: true }); if (!target) { B.relicUsed[ids[c]] = 0; return null; } } return { kind: 'item', item: ids[c], target, relic: it.relic }; }
  let target = null;
  if (it.target === 'one') { target = await pickTarget('ally', u, { heal: it.heal ? (x) => itemHealAmt(x, it, u) : null }); if (!target) return null; }
  if (it.target === 'down') { target = await pickTarget('ally', u, { down: true }); if (!target) return null; }
  return { kind: 'item', item: ids[c], target };
}
async function tryRun() {
  if (B.cfg.boss || B.cfg.canRun === false) { say1(L('無法撤退！', 'There is no retreat!')); await tick(40); return false; }
  const mine = alive('ally').reduce((t, u) => t + u.spd, 0) / Math.max(1, alive('ally').length), theirs = alive('foe').reduce((t, u) => t + u.spd, 0) / Math.max(1, alive('foe').length);
  const esc = sideUnit('ally', 'shantui'); if (esc) tpop(esc, 'shantui');
  if (esc || Math.random() < 0.55 + (mine - theirs) / 100) { say1(L('全軍撤退了。', 'The army withdraws.')); sfx('run'); await tick(40); finish('run'); return true; }
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
    const opts = tacticsOf(u).map((id) => TACTICS[id]).filter((t) => t && t.pow && (t.t === 'e1' || t.t === 'eall') && tacCost(t.id, u) <= S.tp);
    if (opts.length) {
      const score = (t) => t.pow * (t.t === 'eall' ? foes.length : 1.3);
      const t = opts.sort((a, b) => score(b) - score(a))[0];
      return { kind: 'tactic', tac: t.id, target: weakest(foes), cost: tacCost(t.id, u) };
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
  // a trial that lets only a few fight (onlyFront): send the strongest, favouring the troops the enemy is weak to
  if (cfg.onlyFront) {
    const wk = kit && kit.weak && kit.weak.unit, sc = (id) => score(id) * (wk && unitOf(id) === wk ? 1.6 : 1);
    const few = live.slice().sort((a, b) => sc(b) - sc(a)).slice(0, cfg.onlyFront);
    S.front = few.concat(S.front.filter((id) => !few.includes(id))).slice(0, 5);
  }
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
  const can = (u, id) => !u.st.silence && TACTICS[id] && tacticsOf(u).includes(id) && tacCost(id, u) <= tp;
  const pool = () => free.filter((u) => !orders.has(u));
  const bestCaster = (ids, target, minCh = 0) => { let best = null; for (const u of pool()) for (const id of ids) if (can(u, id)) { const ch = target ? tacChance(u, target, TACTICS[id]) : 1; if (ch >= minCh && (!best || ch > best.ch || (ch === best.ch && u.atk < best.u.atk))) best = { u, id, ch }; } return best; };
  const castOn = (b, target) => assign(b.u, { kind: 'tactic', tac: b.id, target, cost: tacCost(b.id, b.u) });
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
        const tank = pool().find((v) => v !== t && (has(v, 'dunqiang') || has(v, 'huwei')));
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
      if (!t || !t.pow || !(t.t === 'e1' || t.t === 'eall') || tacCost(id, u) > tp) continue;
      const val = (x) => { if (mirrored(x)) return -tacDamage(u, u, t); if (kitImmuneEl(x, t.el)) return -tacDamage(u, x, t) * 0.5; return Math.min(x.troops, tacDamage(u, x, t)) * tacChance(u, x, t) * (x.bomb || x.petal ? 1.5 : 1); };
      let v, target = null;
      if (t.t === 'eall') v = foes.reduce((sum, x) => sum + val(x), 0);
      else {
        const focus = focusFor(u, foes, false);
        for (const x of new Set([focus, ...foes.filter((y) => y.boss || y.illusion || y.bomb)])) { const vx = val(x) * (x === focus ? 1.15 : 1); if (v === undefined || vx > v) { v = vx; target = x; } }
      }
      // spend points only where they buy clearly more than a blade would; cheap ploys are preferred
      const worth = v / (1 + tacCost(id, u) / 40);
      if (!best || worth > best.w) best = { w: worth, v, id, target };
    }
    if (best && best.v > phys * 1.2) return { kind: 'tactic', tac: best.id, target: best.target, cost: tacCost(best.id, u) };
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
  // when hard pressed, a general who is not the leader stands on guard; the leader too, when his army is still strong
  if (full && u.troops < u.max * 0.22 && !u.summon && alive('foe').length > 1 && Math.random() < (u.boss ? 0.2 : 0.4)) return { kind: 'guard' };
  const tacs = u.st.silence ? [] : u.own.map((t) => TACTICS[t]).filter((t) => t && !t.escape && !t.scout && !t.weather && foeCost(t, u) <= B.foeTp && (full || !['sleep', 'silence', 'fear', 'defdown'].includes(t.st)));
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
  return { kind: 'attack', target: pickWeighted(allies, u) };
}
// what a ploy costs the enemy: the same as ours, less for a Thrifty (節約) caster or a Foresight (神算) sage
const foeCost = (t, u) => Math.max(1, Math.round(t.cost * (B.foeSage && has(B.foeSage, 'shensuan') ? 0.75 : 1) * (has(u, 'jieyue') ? 0.7 : 1)));
// enemies aim by the formation's exposure, avoid the back rows with blades, like a good matchup; in leader
// fights they also go for the weak and for our strategist
function pickWeighted(list, a) {
  const f = formOf('ally'), full = B.cfg && B.cfg.boss, s = stratUnit();
  const wts = list.map((v) => {
    let w = f.hit[v.slot] || 1;
    if (a && !ranged(a) && !has(a, 'qishe') && isBack(v) && frontHolds(v.side)) w *= 0.25;
    if (a) { const e = edgeOf(a, v); w *= e > 1.01 ? 1.6 : e < 0.99 ? 0.6 : 1; }
    if (full) { w *= 1 + (1 - v.troops / v.max); if (v === s) w *= 1.5; }
    // a taunter draws the enemy's eye
    if (has(v, 'tiaoxin')) w *= 2.5;
    return w;
  });
  let r = Math.random() * wts.reduce((x, y) => x + y, 0);
  for (let i = 0; i < list.length; i++) { r -= wts[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}

// ---------- doing things ----------
async function act(u, o) {
  for (const id of ['jisu', 'haoling', 'jianren', 'xiandeng']) if (has(u, id) && (id !== 'xiandeng' || B.round <= 1)) tpop(u, id, true);
  if (o.confused) {
    const all = B.units.filter((x) => x.troops > 0 && x !== u);
    const t = all[Math.floor(Math.random() * all.length)];
    say1(L(`${N(u)}陷入混亂，胡亂攻擊！`, `${N(u)} is confused and lashes out!`)); await tick(20);
    if (t) await attack(u, t, true);
    return;
  }
  if (o.kind === 'guard') { say1(L(`${N(u)}嚴陣以待。`, `${N(u)} stands on guard.`)); if (has(u, 'tiebi')) tpop(u, 'tiebi', true); await tick(fast ? 6 : 14); return; }
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
    // an adaptable commander turns the change into a surge
    if (has(u, 'yingbian')) { for (const v of alive(u.side)) v.buf.atk = Math.max(v.buf.atk || 0, 2); morale(u.side, 8); tpop(u, 'yingbian'); }
    sfx('buff'); await tick(46); return;
  }
  if (o.kind === 'attack') {
    let t = o.target;
    if (!t || t.troops <= 0) { const l = alive(u.side === 'ally' ? 'foe' : 'ally'); if (!l.length) return; t = u.side === 'foe' ? pickWeighted(l, u) : (B.kit && window.G && G.autoBattle ? focusFor(u, l, true) : l[0]); }
    if (u.st.provoke && u.st.provoke.troops > 0) t = u.st.provoke;
    if (has(u, 'guishen') || (has(u, 'yiqi') && Math.random() < 0.25)) { tpop(u, has(u, 'guishen') ? 'guishen' : 'yiqi', has(u, 'guishen')); await attackAll(u); return; }
    await attack(u, t);
    if (u.troops > 0 && t.troops > 0 && has(u, 'lianji') && Math.random() < 0.3) { tpop(u, 'lianji'); say1(L('連擊！', 'Double strike!')); await attack(u, t, false, 0.6); }
    if (u.equip.weapon === 'liannu' && t.troops > 0 && Math.random() < 0.5) { say1(L('連弩齊發！', 'The repeating crossbow fires again!')); await attack(u, t, false, 0.5); }
    // the Little Conqueror: a kill and he is at the next one at once
    if (u.again && u.troops > 0) { u.again = false; const l = alive(u.side === 'ally' ? 'foe' : 'ally'); if (l.length) { tpop(u, 'xiaobawang'); say1(L(`${N(u)}乘勝追擊！`, `${N(u)} rides on to the next!`)); await attack(u, l.reduce((a, b) => (b.troops < a.troops ? b : a))); } }
    u.again = false;
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
// the one a Loyal Guard (護主) protects: our strategist and the general at the head of the line; on the
// enemy's side their leaders and their cleverest
function isLord(t) {
  if (t.side === 'ally') return t === stratUnit() || t.slot === 0;
  if (t.boss) return true;
  const foes = alive('foe').filter((v) => !v.summon);
  return !foes.some((v) => v.boss) && foes.length > 1 && t === foes.reduce((a, b) => (b.int > a.int ? b : a));
}
// who takes the blow: a bodyguard, or a guardian may step in front
function cover(t) {
  const g = guardOf(t); if (g) return g;
  for (const v of alive(t.side)) {
    if (v === t || disabled(v) || v.st.confuse) continue;
    if (v.fx && v.fx.guard && t.troops < t.max * 0.5 && Math.random() < v.fx.guard) return v;
    if (has(v, 'changshan') && t.troops < t.max * 0.35) { tpop(v, 'changshan'); return v; }
    if (has(v, 'huzhu') && isLord(t) && Math.random() < 0.5) { tpop(v, 'huzhu'); return v; }
    if (has(v, 'dunqiang') && Math.random() < 0.4) { tpop(v, 'dunqiang'); return v; }
    if (has(v, 'huwei') && t.troops < t.max * 0.3 && Math.random() < 0.35) { tpop(v, 'huwei'); return v; }
  }
  return t;
}
function breakWall(t, why) {
  if (!t.wall) return;
  t.wall = false; t.wallT = B.round + 3;
  pop(t, L('鐵壁破了！', 'Wall broken!'), '#ffe080', -12); fxs.push({ k: 'rock', x: t.x, y: t.y - 30, t: 0 }); morale('ally', 10); morale('foe', -8);
  void why;
}
// a status put on x by a trait (破軍, 毒計, 燒傷); immunities show their trait's name
function traitStatus(x, st, turns, by) {
  if (x.troops <= 0) return false;
  const im = immuneBy(x, st);
  if (im) { tpop(x, im, true); return false; }
  if (x.fx && x.fx.res && x.fx.res[st] && Math.random() < x.fx.res[st]) return false;
  x.st[st] = Math.max(x.st[st] || 0, turns);
  pop(x, stName(st), STATUS[st] ? STATUS[st][2] : '#e0a0ff', -12);
  if (by) tpop(by, st === 'defdown' ? 'pojun' : 'duji');
  return true;
}
async function moveTo(u, tx, frames) { const x0 = u.dx; u.anim = 'walk'; for (let f = 1; f <= frames; f++) { u.dx = x0 + ((tx - x0) * f) / frames; u.at++; await tick(1); } }
async function attack(u, t0, confused = false, mul = 1, isCounter = false) {
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
      u.xdDone = true;
      showTraits(u, t, r.tr);
      if (r.miss) { pop(t, r.fog ? L('霧中落空', 'Lost in fog') : L('閃避', 'Miss'), '#c0c0ff'); sfx('miss'); }
      else {
        hurt(t, r.dmg, u); pop(t, r.dmg, r.crit ? '#ffe040' : r.edge > 1.01 ? '#a0ffa0' : r.edge < 0.99 ? '#c0c0c0' : '#ffffff');
        if (r.crit) { pop(t, L('會心！', 'Critical!'), '#ffe040', -12); morale(u.side, 3); }
        else if (r.edge > 1.01) { pop(t, L('克制!', 'Strong!'), '#80ff90', -12); morale(u.side, 1); }
        else if (r.edge < 0.99) pop(t, L('被克制', 'Weak'), '#b0b0b0', -12);
        else if (r.back) pop(t, L('後排', 'Back row'), '#ffc080', -12);
        sfx(r.crit ? 'crit' : 'hit'); B.shake = r.crit ? 6 : 3;
        fxs.push({ k: 'cutx', x: t.x + t.dx, y: t.y - 22, t: 0 });
        await tick(r.crit ? 5 : 3); // a moment of hit-stop
        // traits that ride on a blow
        if (has(u, 'weiya') && t.side !== u.side) morale(t.side, -2);
        if (has(u, 'pojun') && t.troops > 0 && !t.st.defdown && Math.random() < 0.25) traitStatus(t, 'defdown', 2, u);
        if (has(u, 'duji') && t.troops > 0 && !t.st.poison && Math.random() < 0.25) traitStatus(t, 'poison', 3, u);
        // an ambush laid by the target's side springs (unless an Insight general sees it coming)
        if (B.ambush[t.side] && u.side !== t.side) {
          const am = B.ambush[t.side]; B.ambush[t.side] = null; await tick(10);
          const seer = sideUnit(u.side, 'shipo');
          if (seer) { tpop(seer, 'shipo'); say1(L(`${N(seer)}識破了伏兵！`, `${N(seer)} sees through the ambush!`)); morale(u.side, 4); }
          else { say1(L('伏兵殺出！', 'The ambush springs!')); fxs.push({ k: 'leaf', x: u.x + u.dx, y: u.y - 30, t: 0 }); const d2 = Math.round(am * 1.2); hurt(u, d2); pop(u, d2, '#ffb060'); sfx('hit'); morale(u.side, -5); }
        }
        // light fingers
        if (u.side === 'ally' && Math.random() < (has(u, 'miaoshou') ? 0.2 : 0) + (u.fx.steal || 0)) { const gold = 10 + t.lv * 12; S.gold += gold; pop(u, `+${gold}${L('金', 'g')}`, '#ffe080'); if (has(u, 'miaoshou')) tpop(u, 'miaoshou', true); }
      }
    }
    await tick(1);
  }
  if (!rng) await moveTo(u, 0, Math.max(6, Math.round(Math.abs(reach) / 8)));
  u.anim = 'idle'; u.dx = 0;
  await tick(6);
  // a counter-blow from a general whose gear is made for it, or who has Riposte (反擊)
  if (!isCounter && !confused && t.troops > 0 && u.troops > 0 && !disabled(t) && !t.st.confuse && !rng && t.side !== u.side) {
    const gear = t.fx && t.fx.ctr && Math.random() < t.fx.ctr, rip = !gear && has(t, 'fanshou') && Math.random() < 0.3;
    if (gear || rip) { if (rip) tpop(t, 'fanshou'); say1(L(`${N(t)}反擊！`, `${N(t)} strikes back!`)); await tick(10); await attack(t, u, false, 0.5, true); }
  }
}
async function attackAll(u) {
  say1(L(`${N(u)}橫掃千軍！`, `${N(u)} sweeps through the ranks!`));
  const sw = (u.sheet && u.sheet.swing) || 'slash';
  const dir = u.side === 'ally' ? -1 : 1;
  await moveTo(u, 40 * dir, 10);
  u.anim = sw === 'shoot' ? 'shoot' : sw; u.at = 0;
  for (let f = 0; f < 24; f++) { u.at = f; await tick(1); }
  for (const t of alive(u.side === 'ally' ? 'foe' : 'ally')) {
    const r = physDamage(u, t, has(u, 'guishen') ? 0.72 : 0.6);
    if (!r.miss) { hurt(t, r.dmg, u); pop(t, r.dmg, r.crit ? '#ffe040' : '#ffffff'); fxs.push({ k: 'cutx', x: t.x + t.dx, y: t.y - 30, t: 0 }); }
  }
  u.xdDone = true;
  sfx('crit'); B.shake = 7;
  await tick(16);
  await moveTo(u, 0, 10); u.anim = 'idle'; u.dx = 0; await tick(6);
}
const ST_TURNS = { poison: 3, stun: () => 1 + Math.floor(Math.random() * 2), confuse: () => 2 + Math.floor(Math.random() * 2), sleep: 3, fear: 3, silence: 3, defdown: 3 };
const stName = (k) => (STATUS[k] ? L(STATUS[k][0], STATUS[k][1]) : k);
const stTurns = (st, u) => (typeof ST_TURNS[st] === 'function' ? ST_TURNS[st]() : ST_TURNS[st] || 2) + (has(u, 'yaoshu') ? 1 : 0);
async function castTactic(u, t, o) {
  if (u.st.silence) { say1(L(`${N(u)}的策略被封住了！`, `${N(u)}'s ploys are sealed!`)); pop(u, stName('silence'), '#60e0d0'); await tick(30); return; }
  if (u.side === 'foe' && !o.kitFree) { const c = foeCost(t, u); if (B.foeTp < c) { await attack(u, pickWeighted(alive('ally'), u)); return; } B.foeTp -= c; }
  else if (!o.free) { if (S.tp < o.cost) { say1(L('策略值不足！', 'Not enough strategy points!')); await tick(30); return; } S.tp -= o.cost; if (has(u, 'jieyue')) tpop(u, 'jieyue', true); }
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
  if (u.side === 'ally' && !o.free && hasShensuan()) tpop(stratUnit(), 'shensuan', true);
  if ((t.pow || t.st) && targets.some((x) => isEnemyOf(u, x))) {
    const on = { huoshen: t.el === 'fire', shuigong: t.el === 'water', leigong: t.el === 'thunder', jushi: t.el === 'rock', fengchu: t.t === 'eall' && t.pow, heyizhi: ['heyi', 'yanxing'].includes(curForm(u.side)), gongjiang: t.el === 'fire', guimou: !!t.pow };
    if (t.pow && u.side === 'ally' && !has(u, 'guimou') && S.strategist && GENERALS[S.strategist].skills.includes('guimou')) { const st = stratUnit(); if (st) tpop(st, 'guimou', true); }
    for (const [id, ok] of Object.entries(on)) if (ok && has(u, id)) tpop(u, id, true);
    const wl = sideUnit(u.side, 'wolong'); if (wl) tpop(wl, 'wolong', true);
  }
  let failed = false;
  const hit = [];
  for (const x of targets) {
    if (isEnemyOf(u, x) && (t.pow || t.st)) {
      // Dunjia slips the ploy; a mirror, gear or Turnabout sends it back (a Wolf's Glance ploy never bounces)
      if (has(x, 'dunjia') && Math.random() < 0.2) { tpop(x, 'dunjia'); pop(x, L('躲開了', 'Slipped it'), '#c0c0ff', -12); continue; }
      const back = mirrored(x) || (x.fx && x.fx.refl && Math.random() < x.fx.refl) || (has(x, 'fanjian') && Math.random() < 0.2);
      if (back && has(u, 'langgu')) tpop(u, 'langgu');
      else if (back) {
        if (has(x, 'fanjian') && !mirrored(x)) tpop(x, 'fanjian');
        pop(x, L('反彈！', 'Reflected!'), '#c0f0ff');
        if (t.pow) { const d = tacDamage(u, u, t); hurt(u, d); pop(u, d, '#ffd0a0'); fxs.push({ k: t.fx || 'spark', x: u.x, y: u.y - 24, t: 0 }); }
        else if (t.st && t.st !== 'provoke' && !immuneBy(u, t.st)) { u.st[t.st] = stTurns(t.st); pop(u, stName(t.st), '#e0a0ff', -12); }
        morale(u.side, -3); continue;
      }
      if (has(x, 'fanji') || has(x, 'langgu')) tpop(x, has(x, 'langgu') ? 'langgu' : 'fanji', true);
      const ch = tacChance(u, x, t);
      if (Math.random() >= ch) {
        const im = t.st && immuneBy(x, t.st);
        if (im) tpop(x, im, true);
        pop(x, ch <= 0 ? L('免疫', 'Immune') : t.pow ? L('失敗', 'Failed') : L('無效', 'No effect'), '#c0c0c0'); failed = true; continue;
      }
    }
    if (t.pow && isEnemyOf(u, x)) {
      if (t.el === 'rock' && x.wall) breakWall(x, 'rock');
      const d = tacDamage(u, x, t);
      if (kitImmuneEl(x, t.el)) { const h = heal(x, d * 0.5); pop(x, L('吸收', 'Absorbed') + (h ? ' +' + h : ''), '#ff9040'); }
      else {
        hurt(x, d, u); pop(x, d, kitWeak(x, t.el) ? '#a0ffa0' : '#ffd0a0'); hit.push([x, d]);
        if (kitWeak(x, t.el)) pop(x, L('弱點！', 'Weak point!'), '#80ff90', -12);
        if (t.el === 'fire' && x.troops > 0 && Math.random() < (has(u, 'huoshen') ? 0.6 : 0.3)) traitStatus(x, 'burn', 3, null);
        if (has(u, 'duji') && x.troops > 0 && !x.st.poison && Math.random() < 0.25) traitStatus(x, 'poison', 3, u);
        if (t.el) tryCancel(x, 'el:' + t.el);
      }
    } else if (t.pow) { const d = tacDamage(u, x, t); hurt(x, d); pop(x, d, '#ffd0a0'); }
    if (t.st && t.st !== 'ambush' && x.troops > 0) {
      if (!isEnemyOf(u, x)) continue;
      const turns = t.st === 'provoke' ? u : stTurns(t.st, u);
      x.st[t.st] = turns; if (t.st === 'provoke') x.st.provokeT = 3 + (has(u, 'yaoshu') ? 1 : 0);
      if (has(u, 'yaoshu')) tpop(u, 'yaoshu', true);
      if (t.st === 'defdown') breakWall(x, 'pojia');
      pop(x, stName(t.st), STATUS[t.st] ? STATUS[t.st][2] : '#e0a0ff');
      if (tryCancel(x, t.st)) say1(L(`打斷了${N(x)}的招式！`, `${N(x)}'s move is broken off!`));
    }
    if (t.buff) { x.buf[t.buff] = 3; pop(x, { atk: L('攻↑', 'ATK↑'), def: L('防↑', 'DEF↑'), spd: L('速↑', 'SPD↑') }[t.buff], '#ffe080'); }
    // healing works on a general's own soldiers: a leader's huge host gains no more than an ordinary one
    if (t.heal) { const k = healK(u); if (has(u, 'yizhe')) tpop(u, 'yizhe', true); if (has(u, 'guanxing')) tpop(u, 'guanxing', true); const h = heal(x, x.max * t.heal * k / Math.max(1, x.hpMul || 1)); if (h) pop(x, '+' + h, '#80ffa0'); }
    if (t.revive) { x.troops = Math.round(x.max * t.revive); x.dead = false; x.anim = 'idle'; x.st = {}; pop(x, L('重整旗鼓！', 'Rallied!'), '#80ffa0'); morale(u.side, 5); }
  }
  // Chain Plot: a ploy on one foe may run on into another
  if (t.t === 'e1' && t.pow && hit.length && has(u, 'lianhuan') && Math.random() < 0.35) {
    const next = alive(foeSide).filter((v) => v !== hit[0][0] && !kitImmuneEl(v, t.el));
    if (next.length) { const v = next[Math.floor(Math.random() * next.length)]; const d = Math.round(tacDamage(u, v, t) * 0.5); tpop(u, 'lianhuan'); fxs.push({ k: t.fx || 'spark', x: v.x + v.dx, y: v.y - 24, t: 0 }); await tick(10); hurt(v, d, u); pop(v, d, '#ffd0a0'); }
  }
  if (t.buff === 'atk') morale(u.side, 10);
  if (failed) morale(u.side, -2);
  await tick(30);
}
async function useRelic(u, o, it) {
  say1(L(`${N(u)}祭出了${it.zh}！`, `${N(u)} brings out the ${it.en}!`));
  u.anim = 'cast'; u.at = 0; sfx('special'); for (let f = 0; f < 18; f++) { u.at = f; await tick(1); } u.anim = 'idle';
  const mine = alive(u.side), foes = alive(u.side === 'ally' ? 'foe' : 'ally');
  const boom = (k, el, pow) => { for (const x of foes) { const d = tacDamage(u, x, { el, pow }); hurt(x, d); pop(x, d, '#ffd0a0'); fxs.push({ k, x: x.x + x.dx, y: x.y - 26, t: 0 }); if (el === 'rock') breakWall(x, 'rock'); tryCancel(x, 'el:' + el); } };
  switch (o.relic) {
    case 'drum': morale(u.side, 20); for (const v of mine) { v.buf.atk = 3; pop(v, L('攻↑', 'ATK↑'), '#ffe080'); } sfx('buff'); break;
    case 'fireox': boom('explosion', 'fire', 0.5); sfx('boom'); B.shake = 6; break;
    case 'bell': for (const v of mine) { let c = false; for (const k of ['confuse', 'fear', 'sleep', 'silence', 'curse']) if (v.st[k]) { delete v.st[k]; c = true; } if (c) pop(v, L('解除', 'Cured'), '#80ffa0'); } sfx('heal'); break;
    case 'pouch': { const n = Math.min(tpMax() - S.tp, 20); S.tp += n; pop(u, `+${n} ${L('策', 'SP')}`, '#a0e0ff'); sfx('heal'); break; }
    case 'ox': for (const v of mine) { const h = heal(v, v.max * 0.15 / Math.max(1, v.hpMul || 1)); if (h) pop(v, '+' + h, '#80ffa0'); } sfx('heal'); break;
    case 'chariot': B.weather = 'clear'; B.fog = 0; for (const v of mine) v.buf.spd = 3; say1(L('指南車破霧而出，天色轉晴！', 'The chariot drives through; the sky clears!')); sfx('buff'); break;
    case 'catapult': boom('rock', 'rock', 0.55); sfx('quake'); B.shake = 7; break;
    case 'maze': for (const v of mine) { v.buf.def = 3; pop(v, L('防↑', 'DEF↑'), '#ffe080'); } sfx('buff'); break;
    case 'incense': { const x = o.target && o.target.troops <= 0 ? o.target : B.units.find((v) => v.side === u.side && v.troops <= 0 && !v.summon); if (x) { x.troops = Math.round(x.max * 0.3); x.dead = false; x.anim = 'idle'; x.st = {}; pop(x, L('重整旗鼓！', 'Rallied!'), '#80ffa0'); morale(u.side, 5); } sfx('heal'); break; }
    case 'altar': B.weather = 'wind'; if (B.fog > 0) B.fog = 0; say1(L('七星壇上東風大作！', 'An east wind rises over the altar!')); for (const v of foes) if (v.charge && tryCancel(v, 'wind')) say1(L(`${N(v)}的招式被大風吹散了！`, `The wind scatters ${N(v)}'s move!`)); sfx('buff'); break;
  }
  await tick(36);
}
async function useItem(u, o) {
  const it = ITEMS[o.item];
  if (it && it.kind === 'relic') { await useRelic(u, o, it); return; }
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
    const h = heal(x, x.max * it.heal * (has(u, 'liangguan') ? 1.4 : 1)); if (h) pop(x, '+' + h, '#80ffa0');
    if (h && has(u, 'liangguan')) tpop(u, 'liangguan', true);
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
    // a Tenacious general shakes bad statuses off twice as fast
    const tough = has(u, 'jianren');
    for (const k of ['poison', 'burn', 'curse', 'confuse', 'stun', 'sleep', 'fear', 'silence', 'defdown', 'reflect']) if (u.st[k]) { const bad = k !== 'reflect'; u.st[k] -= tough && bad ? 2 : 1; if (tough && bad) tpop(u, 'jianren', true); if (u.st[k] <= 0) delete u.st[k]; }
    if (u.st.provoke) { u.st.provokeT--; if (u.st.provokeT <= 0 || u.st.provoke.troops <= 0) { delete u.st.provoke; delete u.st.provokeT; } }
    for (const k of Object.keys(u.buf)) { u.buf[k]--; if (u.buf[k] <= 0) delete u.buf[k]; }
    if (u.fx && u.fx.regen && u.troops > 0) { const h = heal(u, u.max * u.fx.regen); if (h) pop(u, '+' + h, '#90ffb0'); }
    if (has(u, 'yinjiang') && u.troops > 0 && !u.summon) { const h = heal(u, u.max * 0.05); if (h) { pop(u, '+' + h, '#c080ff'); tpop(u, 'yinjiang', true); } }
    if (has(u, 'tuntian') && u.troops > 0) { const h = heal(u, u.max * 0.02); if (h) { pop(u, '+' + h, '#90ffb0'); tpop(u, 'tuntian', true); } }
    u.guard = false;
  }
  for (const side of ['ally', 'foe']) { const doc = sideUnit(side, 'yishu'); if (doc) { let any = 0; for (const u of alive(side)) any += heal(u, u.max * 0.04); if (any) tpop(doc, 'yishu', true); } }
  // war drums keep the army's heart up
  for (const side of ['ally', 'foe']) { const dr = sideUnit(side, 'gushi'); if (dr && B.morale[side] < 70) { morale(side, Math.min(3, 70 - B.morale[side])); tpop(dr, 'gushi', true); } }
  if (B.fog > 0) { B.fog--; if (!B.fog) { say1(L('江霧散去了。', 'The fog lifts.')); await tick(24); } }
  if (dot) await tick(20);
  // a beaten army in the field loses heart and runs (a leader's army fights to the last)
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
  if (sideHas('ally', 'lueduo')) { gold = Math.round(gold * 1.3); tpop(sideUnit('ally', 'lueduo'), 'lueduo'); }
  if (sideHas('ally', 'shangcai')) { gold = Math.round(gold * 1.15); tpop(sideUnit('ally', 'shangcai'), 'shangcai'); }
  S.gold += gold; S.wins++;
  const dropped = rollDrop();
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
  if (dropped) { const it = ITEMS[dropped]; give(dropped); say1(L(`敵軍丟下了寶物「${it.zh}」！`, `The enemy left behind a treasure: ${it.en}!`)); sfx('chest'); await tick(70); }
  for (const s of lines.slice(0, 8)) { say1(s); sfx('level'); await tick(50); }
  // a beaten general may be taken prisoner
  for (const f of foes) S.met[f.id] = Math.max(S.met[f.id] || 0, 1);
  if (B.cfg.capture !== false && !B.cfg.boss) {
    const cands = foes.filter((f) => !S.roster[f.id] && !f.g.guest && f.g.faction !== 'sect' && !(f.g.famous && f.g.noCapture) && !S.flags['gone_' + f.id]);
    const per = sideUnit('ally', 'shouxiang');
    if (cands.length && Math.random() < (per ? 0.55 : 0.3)) {
      if (per) tpop(per, 'shouxiang');
      const c = cands[Math.floor(Math.random() * cands.length)];
      B.captive = { id: c.id, lv: c.lv };
    }
  }
  await tick(20);
  finish('win');
}
function rollDrop() {
  const rg = B.cfg.region;
  if (!rg || B.cfg.boss) return null;
  const pool = TREASURES.filter((id) => SRC[id] && SRC[id].t === 'drop' && SRC[id].region === rg && !S.found[id] && !S.items[id]);
  if (!pool.length) return null;
  S.dropPity[rg] = (S.dropPity[rg] || 0) + 1;
  const scout = alive('ally').reduce((t, u) => t + (u.fx.scout || 0) + (u.fx.steal || 0) * 2, 0);
  const eye = sideUnit('ally', 'shibao');
  const chance = 0.05 + 0.03 * Math.min(3, scout) + (eye ? 0.05 : 0) + Math.max(0, S.dropPity[rg] - 12) * 0.03;
  if (Math.random() >= chance) return null;
  S.dropPity[rg] = 0;
  if (eye) tpop(eye, 'shibao');
  return pool[Math.floor(Math.random() * pool.length)];
}
async function defeat() {
  say1(L('我軍全軍覆沒……', 'Our army is routed...'));
  await tick(90);
  finish('lose');
}

// ---------- the info card (情報) ----------
// Anyone on the field, friend or foe: picture, level, unit type and how it matches the general giving orders,
// troops, numbers before and after formation, morale, buffs and traits, the formation's effect on them,
// statuses with turns, the two traits, tactics, gear, weak points and resistances, and a leader's mechanics.
// Basic numbers, traits and statuses always show; weak points, exact resistances and a leader's next move stay
// hidden (？？？) until 偵察 or a Scouts (斥候) / Ghost Talent (鬼才) trait reveals them. Looking costs no turn:
// the battle waits while the card is open.
const seen = (u) => u.side === 'ally' || B.scouted || !!u.revealed;
const EL_NAME = { fire: ['火', 'fire'], water: ['水', 'water'], rock: ['落石', 'rock'], thunder: ['雷', 'thunder'], dark: ['暗', 'dark'] };
const elN = (e) => (EL_NAME[e] ? L(EL_NAME[e][0], EL_NAME[e][1]) : e);
const MOVE_KIND = { single: ['單體', 'one target'], aoe: ['全體', 'all of us'], tac: ['計策', 'ploy'], fireships: ['火船', 'fire ships'], heal: ['療傷', 'heal'], decree: ['強化', 'buff'], divide: ['離間', 'discord'], freeze: ['凍結', 'freeze'], wall: ['鐵壁', 'wall'], reflect: ['反計', 'mirror'], fog: ['江霧', 'fog'], ambush: ['伏兵', 'ambush'], shadows: ['影兵', 'shadows'], illusion: ['幻影', 'copies'], curse: ['詛咒', 'curse'] };
const PHASE_ACT = { berserk: ['暴怒', 'berserk'], pill: ['吞丹暴怒', 'pill and rage'], reinforce: ['增援', 'reinforcements'], form: ['變陣', 'new formation'], petals: ['黑蓮花瓣', 'lotus petals'], frenzy: ['一回合兩動', 'two actions a round'] };
let cardClose = null;
function closeCard() { if (cardClose) cardClose(); }
function cardList() {
  const by = (a, b) => a.y - b.y || a.x - b.x;
  return [...alive('foe').filter((v) => !v.gone).sort(by), ...alive('ally').sort(by)];
}
export function openCard(u) {
  if (B.card || !B.active) return Promise.resolve();
  return new Promise((res) => {
    let list = cardList(), i = Math.max(0, list.indexOf(u));
    const w = {
      update() {
        list = cardList();
        if (!list.length || !B.active) { close(); return; }
        if (i >= list.length) i = list.length - 1;
        const step = (d) => { i = (i + d + list.length) % list.length; sfx('cursor'); };
        if (input.repeat('right') || input.repeat('down')) step(1);
        if (input.repeat('left') || input.repeat('up')) step(-1);
        // touch: the sides page, the cross or the middle closes
        const tp = input.takeTap();
        if (tp) { if (tp.x > W - 122 && tp.x < W - 84 && tp.y < 30) { sfx('cancel'); close(); return; } if (tp.x < W * 0.3) step(-1); else if (tp.x > W * 0.7) step(1); else { sfx('cancel'); close(); return; } }
        if (input.pressed('b') || input.pressed('a') || input.pressed('menu')) { sfx('cancel'); close(); }
      },
      draw() { if (list[i]) drawCard(list[i], i, list.length); },
    };
    const close = () => { UIpop(w); B.card = null; cardClose = null; res(); };
    B.card = w; cardClose = close;
    sfx('ok');
    UIpush(w);
  });
}
// the general on the battlefield (or in the army panel) under a tap
function unitAt(x, y) {
  if (y >= 194 && y < 194 + 5 * 14 && x >= 160) { const al = B.units.filter((u) => u.side === 'ally'); const v = al[Math.floor((y - 195) / 14)]; return v && v.troops > 0 ? v : null; }
  let best = null, bd = 1e9;
  for (const u of B.units) {
    if (u.troops <= 0 || u.gone) continue;
    const cx = u.x + u.dx, top = u.y - (u.horse && !u.unhorsed ? 66 : 50);
    if (x < cx - 16 || x > cx + 16 || y < top || y > u.y + 10) continue;
    const d = Math.abs(x - cx) + Math.abs(y - (top + u.y) / 2);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}
// what an element or a status does to u: weak points, resistances and immunities
function elemInfo(u) {
  const k = B.kit, weak = [], res = [], imm = [];
  if (k && u.side === 'foe') {
    const w = k.weak;
    if (w && (w.who || 0) === u.kidx) { if (w.el) weak.push(L(`${elN(w.el)}×1.5`, `${elN(w.el)} x1.5`)); if (w.st) weak.push(L(`易中${STATUS[w.st] ? STATUS[w.st][0] : w.st}`, `${STATUS[w.st] ? STATUS[w.st][1] : w.st} lands easily`)); if (w.unit) weak.push(L(`怕${unitName(w.unit)}`, `fears ${unitName(w.unit)}`)); if (w.phys) weak.push(L('刀兵', 'blades')); }
    if (k.immuneEl && k.immuneEl[u.kidx]) res.push(L(`吸收${elN(k.immuneEl[u.kidx])}`, `drinks ${elN(k.immuneEl[u.kidx])}`));
    if (k.resistAll && k.resistAll[u.kidx]) res.push(L(`計策−${Math.round((1 - k.resistAll[u.kidx]) * 100)}%`, `ploys -${Math.round((1 - k.resistAll[u.kidx]) * 100)}%`));
    if (u.boss && k.immune) for (const st of k.immune) res.push(L(`免疫${STATUS[st][0]}`, `immune: ${STATUS[st][1]}`));
    if (k.chained) { res.push(L('刀兵−25%', 'blades -25%')); weak.push(L('火×1.4', 'fire x1.4')); }
  }
  if (u.weakFire) weak.push(L('火×2（藤甲）', 'fire x2 (rattan)'));
  const fx = u.fx || {};
  for (const [e, v] of Object.entries(fx.resel || {})) res.push(L(`${elN(e)}−${Math.round(v * 100)}%`, `${elN(e)} -${Math.round(v * 100)}%`));
  for (const [st, v] of Object.entries(fx.res || {})) if (STATUS[st]) res.push(L(`抗${STATUS[st][0]}${Math.round(v * 100)}%`, `${Math.round(v * 100)}% vs ${STATUS[st][1]}`));
  if (fx.refl) res.push(L(`反彈${Math.round(fx.refl * 100)}%`, `reflect ${Math.round(fx.refl * 100)}%`));
  for (const st of Object.keys(STATUS)) { const id = immuneBy(u, st); if (id) imm.push(L(STATUS[st][0], STATUS[st][1])); }
  if (has(u, 'dunjia')) res.push(L('兩成躲開計策', 'slips 20% of ploys'));
  if (has(u, 'fanji') || has(u, 'langgu')) res.push(L(`敵計−${has(u, 'langgu') ? 25 : 20}%`, `foe ploys -${has(u, 'langgu') ? 25 : 20}%`));
  return { weak, res, imm };
}
// what makes a general dangerous by the general rules: commander, the enemy's strategist and its pool, a sharp
// eye for formations, and how the army fights
function bossLines(u) {
  const out = [], foe = u.side === 'foe';
  if (u.cmd) out.push([L('主將：攻擊與防禦+15%', 'Commander: attack and defence +15%'), '#ffc8a0']);
  if (foe && B.foeSage === u) out.push([L(`敵軍軍師：策略值 ${B.foeTp}/${B.foeTpMax}，用完就只能攻擊`, `Enemy strategist: SP ${B.foeTp}/${B.foeTpMax}; when it runs out they can only fight`), '#a0d0ff']);
  if (foe && !u.summon && (u.int >= 85 || u.g.lead >= 85)) out.push([L(B.foeRead ? '已看穿過我軍陣形' : '善觀陣形：我軍陣形克制敵陣時，會變陣反制一次', B.foeRead ? 'Has already read our formation' : 'Reads formations: if ours beats theirs, he changes to answer it (once)'), '#ffe8a0']);
  if (foe && u.cmd && B.cfg.boss) out.push([L('首領戰：敵軍集中攻擊兵力少的人與我軍軍師，兵力少時防禦，戰到最後一人', 'A leader\'s army: they go for the weakened and for our strategist, stand on guard when low, and fight to the last'), '#d0c0b0']);
  return out;
}
function drawCard(u, i, n) {
  const foe = u.side === 'foe', see = seen(u), g = u.g, m = u.m;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
  windowBox(4, 4, W - 8, H - 8);
  // header: name, level, side, page
  const nm = N(u);
  text(fit(nm, 150), 14, 10, '#f8e070');
  const nx = 14 + Math.min(150, textW(nm)) + 6;
  text(`Lv${u.lv}`, nx, 10, '#c0d8f0');
  const tag = foe ? (u.boss ? L('敵軍首領', 'Enemy leader') : L('敵軍', 'Enemy')) : u.id === S.strategist ? L('我軍・軍師', 'Ours, strategist') : L('我軍', 'Ours');
  text(tag, nx + textW(`Lv${u.lv}`) + 8, 10, foe ? '#ff9080' : '#90d0ff');
  // the page count and a close box, kept clear of the music button in the corner
  text(`${i + 1}/${n}`, W - 126, 10, '#a0a8c0', { align: 'right' });
  if (g.famous) text(L('名將', 'Famous'), W - 126 - textW(`${i + 1}/${n}`) - 10, 10, '#ffe080', { align: 'right' });
  windowBox(W - 118, 7, 30, 18); text('✕', W - 103, 10, '#ffb0a0', { align: 'center' });
  // the picture
  const X0 = 12;
  ctx.fillStyle = '#18101c'; ctx.fillRect(X0, 26, 72, 74); ctx.fillStyle = '#2a1e22'; ctx.fillRect(X0, 88, 72, 12);
  ctx.save(); ctx.beginPath(); ctx.rect(X0, 26, 72, 74); ctx.clip();
  if (foe) { ctx.translate(X0 * 2 + 72, 0); ctx.scale(-1, 1); }
  drawPose(u.id, u.equip, X0 + 36 + (u.horse ? 4 : 0), 96, u.horse ? 0.56 : 1);
  ctx.restore();
  // beside the picture: type and matchup, troops, row and morale
  const RX = 92; let y = 28;
  icon(u.unit, RX, y + 3); text(unitName(u.unit), RX + 11, y, ICON_COL[u.unit]);
  if (u.horse) text(L('騎馬', 'mounted'), RX + 142, y, '#a8a090', { align: 'right' });
  y += 13;
  // the unit triangle against the general giving orders now
  const me = (B.picking && B.picking.u) || B.cur;
  if (me && me.side !== u.side && me.troops > 0) {
    const e1 = edgeOf(me, u), e2 = edgeOf(u, me), col = e1 > 1.01 ? '#80ff90' : e1 < 0.99 ? '#ff8080' : '#c0c8d8';
    text(fit(L(`${N(me)}：打×${e1} 受×${e2}`, `Deals x${e1}, takes x${e2}`), 144), RX, y, col);
  } else if (me && me !== u && me.side === u.side) text(fit(L(`與${N(me)}同軍`, `Fights beside ${N(me)}`), 144), RX, y, '#a8b0c8');
  y += 14;
  const r = u.troops / u.max;
  text(L(`兵力 ${u.troops}/${u.max}`, `Troops ${u.troops}/${u.max}`), RX, y, '#ffffff'); y += 13;
  bar(RX, y, 142, u.troops, u.max, r > 0.5 ? (foe ? '#e06050' : '#58d070') : r > 0.25 ? '#e0c040' : '#e04040'); y += 7;
  text(L(`${isBack(u) ? '後排' : '前排'}・第${colOf(u) + 1}列　士氣${B.morale[u.side]}`, `${isBack(u) ? 'Back' : 'Front'} row, col ${colOf(u) + 1}  morale ${B.morale[u.side]}`), RX, y, '#c8c0d8'); y += 14;
  if (u.boss) { ctx.fillStyle = '#e0b858'; ctx.fillRect(RX, y + 4, 142, 1); }
  // numbers: own -> now (gear, formation, buffs, statuses, morale, traits)
  const atkNow = Math.round(u.atk * atkMul(u) * moraleMul(u.side) * formMul(u.side, u)), defNow = Math.round(u.def * defMul(u));
  const rows = [[L('武力', 'STR'), g.str, u.str], [L('智力', 'INT'), g.int, Math.round(tacPower(u))], [L('統率', 'LEAD'), g.lead, m ? stat(m, 'lead') : g.lead], [L('速度', 'SPD'), g.spd, Math.round(speedBase(u))], [L('攻擊', 'ATK'), u.atk, atkNow], [L('防禦', 'DEF'), u.def, defNow]];
  y = 104;
  rows.forEach(([k, a, b], j) => {
    const x = X0 + (j % 2) * 116, yy = y + Math.floor(j / 2) * 13;
    text(k, x, yy, '#c8c8d8');
    text(a === b ? String(a) : `${a}→${b}`, x + 108, yy, b > a ? '#80ffa0' : b < a ? '#ff9080' : '#ffffff', { align: 'right' });
  });
  y += 42;
  // the formation and what it does for this general
  const f = formOf(u.side), fp = (k) => Math.round((formK(u.side, k) - 1) * 100), sg = (v) => (v > 0 ? '+' : '') + v;
  const fparts = [[L('攻', 'ATK'), fp('atk')], [L('防', 'DEF'), fp('def')], [L('速', 'SPD'), fp('spd')], [L('計', 'TAC'), fp('tac')]].filter(([, v]) => v).map(([k, v]) => `${k}${sg(v)}%`);
  if (u.unit === 'arc' && f.bow) fparts.push(L(`弓${sg(fp('bow'))}%`, `bows ${sg(fp('bow'))}%`));
  if (B.naval && f.naval) fparts.push(L(`水戰${sg(fp('naval'))}%`, `sea ${sg(fp('naval'))}%`));
  text(fit(`${formName(curForm(u.side))}${sideHas(u.side, 'zhenfa') ? L('（陣法家）', ' (master)') : ''}  ${fparts.join(' ') || L('無加成', 'no bonus')}`, 224), X0, y, '#e0e8ff'); y += 13;
  const ed = edgeSide(u.side), fm = Math.round((formMul(u.side, u) - 1) * 100);
  text(fit(ed > 0 ? L(`克制敵陣：傷害${sg(fm)}%`, `Beats their formation: ${sg(fm)}%`) : ed < 0 ? L(`被敵陣克制：傷害${sg(fm)}%`, `Beaten by their formation: ${sg(fm)}%`) : L('陣形不相剋', 'No formation counter'), 224), X0, y, ed > 0 ? '#80ff90' : ed < 0 ? '#ff9080' : '#a8b0c8'); y += 13;
  // statuses with turns left, buffs and stances
  const sts = [];
  for (const k of Object.keys(STATUS)) if (u.st[k] && k !== 'provoke') sts.push([`${STATUS[k][L(0, 1)]}${u.st[k]}`, STATUS[k][2]]);
  if (u.st.provoke) sts.push([L(`激怒${u.st.provokeT}`, `Provoked ${u.st.provokeT}`), STATUS.provoke[2]]);
  for (const [k, z, e] of [['atk', '攻升', 'ATK up '], ['def', '防升', 'DEF up '], ['spd', '速升', 'SPD up ']]) if (u.buf[k] > 0) sts.push([`${L(z, e)}${u.buf[k]}`, '#ffe080']);
  if (u.guard) sts.push([L('防禦中', 'Defending'), '#90c0ff']);
  if (u.wall) sts.push([L('鐵壁', 'Iron Wall'), '#d0c8b8']);
  if (u.stance) sts.push([u.stance === 'ice' ? L('冰甲', 'Ice') : L('鏡', 'Mirror'), '#c0f0ff']);
  if (mirrored(u) && !u.stance) sts.push([L('反計', 'Counterploy'), '#c0f0ff']);
  if (u.berserk) sts.push([L('暴怒', 'Berserk'), '#ff6040']);
  if (veiled(u)) sts.push([L('幻術護身', 'Veiled'), '#c090ff']);
  if (u.buqu) sts.push([L('不屈未用', 'Unyielding ready'), '#ffe8a8']);
  text(L('狀態', 'Status'), X0, y, '#c8c8d8');
  let sx = X0 + L(30, 44);
  if (!sts.length) text(L('正常', 'none'), sx, y, '#a8b0c8');
  for (const [s1, c] of sts) { const tw = textW(s1); if (sx + tw > X0 + 226) { y += 13; sx = X0 + L(30, 44); } text(s1, sx, y, c); sx += tw + 6; }
  y += 15;
  // gear (enemies show what they wear; ours also what it does)
  const eq = Object.values(u.equip || {}).filter((it) => it && ITEMS[it]).map((it) => itemName(it));
  for (const ln of wrap(L('裝備：', 'Gear: ') + (eq.join(L('、', ', ')) || '—'), 226).slice(0, 2)) { text(ln, X0, y, '#e0e0e0'); y += 13; }
  const fxs2 = !foe && m ? fxText(u.fx) : '';
  if (fxs2) for (const ln of wrap(L('效果：', 'Effects: ') + fxs2, 226).slice(0, 2)) { if (y > 232) break; text(ln, X0, y, '#a8e0b0'); y += 13; }
  // the right column: traits, tactics, weak points, leader
  const CX = 246, CW = W - 14 - CX;
  y = 28;
  ctx.fillStyle = 'rgba(255,224,140,0.10)'; ctx.fillRect(CX - 4, 26, CW + 6, 84);
  text(L('雙特性', 'Traits'), CX, y, '#f8e070'); y += 14;
  for (const id of g.traits || []) {
    const T = TRAITS[id]; if (!T) continue;
    const fam = T.fam === 'legend';
    text(traitName(id), CX, y, fam ? '#ffd860' : '#ffe8a8');
    text('(' + L(['戰鬥', '兵種', '陣形', '策略', '狀態', '輔助', '傳說'][['combat', 'unit', 'form', 'tactic', 'status', 'support', 'legend'].indexOf(T.fam)], ['Combat', 'Unit', 'Formation', 'Tactics', 'Status', 'Support', 'Legendary'][['combat', 'unit', 'form', 'tactic', 'status', 'support', 'legend'].indexOf(T.fam)]) + ')', CX + textW(traitName(id)) + 6, y, fam ? '#ffd860' : '#a09878');
    y += 13;
    for (const ln of wrap(traitDesc(id), CW).slice(0, 2)) { text(ln, CX, y, '#e8e0d0'); y += 12; }
    y += 2;
  }
  if (!u.tr.size) { text(L('（召喚物沒有特性）', '(summons have no traits)'), CX, y, '#a8b0c8'); y += 14; }
  y = Math.max(y, 114);
  const tacs = (foe ? u.own : tacticsOf(u)).filter((t) => TACTICS[t]).map(tacName);
  const tl = wrap(L('策略：', 'Tactics: ') + (tacs.join(L('、', ', ')) || '—'), CW);
  if (tl.length > 2) tl[1] = fit(tl.slice(1).join(''), CW);
  for (const ln of tl.slice(0, 2)) { text(ln, CX, y, '#a0e0ff'); y += 13; }
  y += 2;
  const ei = elemInfo(u);
  if (see) {
    text(fit(L('弱點：', 'Weak: ') + (ei.weak.join(L('、', ', ')) || L('無', 'none')), CW), CX, y, '#80ff90'); y += 13;
    for (const ln of wrap(L('抗性：', 'Resists: ') + (ei.res.join(L('、', ', ')) || L('無', 'none')), CW).slice(0, 2)) { text(ln, CX, y, '#c0d8ff'); y += 13; }
  } else {
    text(L('弱點：？？？　抗性：？？？', 'Weak: ???   Resists: ???'), CX, y, '#9098b0'); y += 13;
    text(fit(L('偵察可得知弱點、抗性與下一招', 'Scout to learn weak points, resistances, next move'), CW), CX, y, '#ffd890'); y += 13;
  }
  if (ei.imm.length) { text(fit(L('不受：', 'Immune: ') + ei.imm.join(L('、', ', ')), CW), CX, y, '#e0c0ff'); y += 13; }
  y += 2;
  for (const [s1, c] of bossLines(u)) for (const ln of wrap(s1, CW).slice(0, 2)) { if (y > 230) break; text(ln, CX, y, c); y += 13; }
  // how to move about
  text(fit(L('←→ 切換　B 關閉　（觸控：點左右兩側切換，點中間關閉）', '←→ switch  B close  (touch: tap a side to switch, the middle to close)'), W - 24), W / 2, 247, '#8890b0', { align: 'center' });
}

// for tests (traittest.mjs): the inner workings, to drive each trait's code path directly
export const __test = { attack, act, castTactic, traitsAtStart, endOfRound, useItem, tryRun, rollDrop, instantMove, physDamage, tacChance, tacDamage, morale, traitStatus, cover, unitAt, openCard, closeCard, has, sideUnit };

// ---------- update and drawing ----------
export function battleUpdate() {
  // the info card holds the battle still (looking costs no time)
  if (B.card) return;
  if (!B.over && !(window.G && G.autoBattle)) { const tp = input.takeTap(); if (tp) { const u = unitAt(tp.x, tp.y); if (u) { openCard(u); return; } } }
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
    const hi = horseImg(r.horse); if (!hi) continue;
    ctx.globalAlpha = r.t < 40 ? 1 : Math.max(0, 1 - (r.t - 40) / 30);
    ctx.save(); ctx.translate(r.x, r.y); ctx.scale(r.away * GSCALE, GSCALE);
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
  // berserk: a hotter, redder look (Safari has no ctx.filter, so it gets pre-tinted copies)
  const BERSERK = 'saturate(1.6) hue-rotate(-12deg) brightness(1.1)', tint = u.berserk && !dead && !HAS_FILTER;
  const draw9 = (img, sx, sy, sw, sh, dx, dy, dw, dh) => { if (tint) ctx.drawImage(filtered(img, sx, sy, sw, sh, BERSERK), dx, dy, dw, dh); else ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh); };
  if (u.berserk && !dead && HAS_FILTER) ctx.filter = BERSERK;
  if (mounted) {
    const hi = horseImg(u.horse);
    // horse frames are 128px; facing left the walking horse stands on y 94 with its saddle at (62, 52),
    // galloping on y 87 with the saddle at (60, 50)
    const running = walking;
    const row = running ? 1 : 5, fr = running ? Math.floor(u.at / 4) % 4 : (u.anim === 'idle' ? 0 : 1);
    const feet = running ? 90 : 94, sx = running ? 60 : 62, sy = running ? 50 : 52;
    if (hi) {
      draw9(hi, fr * 128, row * 128, 128, 128, -59, 1 - feet, 128, 128);
      if (HAS_FILTER) ctx.filter = u.berserk ? BERSERK : 'none';
    }
    // the rider sits with the hips (about 44px down the 64px figure) on the saddle; legs are cut at the thigh
    const off = (F.cell - 64) / 2, cut = 50;
    const top = 1 - feet + sy - 44 + (running ? Math.floor(u.at / 4) % 2 : 0);
    draw9(F.img, F.sx, F.sy, F.cell, off + cut, -59 + sx - F.cell / 2, top - off, F.cell, off + cut);
  } else {
    draw9(F.img, F.sx, F.sy, F.cell, F.cell, -F.cell / 2, -60 - (F.cell - 64) / 2, F.cell, F.cell);
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
  for (const n of nums) {
    const k = Math.min(1, n.t / 10), y = n.y - k * 14;
    // a trait's name gets a small dark plate so it reads over anything
    if (n.trait) { const w = textW(n.s) + 6; ctx.fillStyle = 'rgba(36,18,6,0.82)'; ctx.fillRect(Math.round(n.x - w / 2), Math.round(y) - 1, w, 14); ctx.fillStyle = 'rgba(248,216,120,0.7)'; ctx.fillRect(Math.round(n.x - w / 2), Math.round(y) + 12, w, 1); }
    text(n.s, n.x, y, n.col, { align: 'center' });
  }
  // the top line: strategy points, both formations and morale, the weather
  ctx.fillStyle = 'rgba(8,6,16,0.55)'; ctx.fillRect(0, 0, W, 17);
  text(L(`策略 ${S.tp}/${tpMax()}`, `SP ${S.tp}/${tpMax()}`), 6, 3, '#a0e0ff');
  const fe = formEdge(B.form, B.foeForm);
  text(formName(B.foeForm), 106, 3, fe < 0 ? '#ff7060' : '#ffb0a0');
  text(L('士氣', 'MOR'), 164, 3, '#c8b8b0'); moraleBar(190, 7, 44, B.morale.foe, '#e07050');
  if (B.weather !== 'clear') text({ rain: L('雨', 'Rain'), wind: L('風', 'Wind') }[B.weather] || '', 240, 3, '#c0e0ff', { align: 'center' });
  text(L('士氣', 'MOR'), 256, 3, '#c8b8b0'); moraleBar(282, 7, 44, B.morale.ally, '#60d080');
  text(formName(B.form), 420, 3, fe > 0 ? '#80ff90' : '#ffe080', { align: 'right' });
  // the enemy's strategy points, under the top line on the right (clear of the sound button)
  if (B.foeTpMax) { const es = L(`敵軍策略 ${B.foeTp}/${B.foeTpMax}`, `Enemy SP ${B.foeTp}/${B.foeTpMax}`), ew = textW(es) + 10; ctx.fillStyle = 'rgba(40,10,10,0.75)'; ctx.fillRect(W - ew - 44, 19, ew, 13); text(es, W - 49, 20, '#ffb0a0', { align: 'right' }); }
  if (fe) text(fe > 0 ? '▲' : '▼', 420 - textW(formName(B.form)) - 4, 3, fe > 0 ? '#80ff90' : '#ff7060', { align: 'right' });
  // what the enemy leaders are about to do
  const its = intents().slice(0, 3);
  its.forEach((it, i) => {
    const s = fit(it.s, W - 24), w = textW(s) + 12, y = 19 + i * 14;
    ctx.fillStyle = 'rgba(16,6,8,0.72)'; ctx.fillRect(Math.round((W - w) / 2), y, w, 13);
    text(s, W / 2, y + 1, it.col, { align: 'center' });
  });
  // a trial's own line under the top bar: rounds left against the clock, the stage of a gauntlet
  const tags = [];
  if (B.cfg.tag) tags.push([B.cfg.tag, '#f0d890']);
  if (B.cfg.maxRounds) { const left = Math.max(0, B.cfg.maxRounds - B.round + (B.round ? 1 : 0)); tags.push([L(`限時：剩${left}回合`, `Rounds left: ${left}`), left <= 2 ? '#ff7060' : '#ffe080']); }
  tags.forEach(([s, col], i) => { const w = textW(s) + 10, y = 19 + i * 14; ctx.fillStyle = 'rgba(40,10,10,0.8)'; ctx.fillRect(4, y, w, 13); ctx.fillStyle = col; ctx.fillRect(4, y + 12, w, 1); text(s, 9, y + 1, col); });
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
    const r = u.troops / u.max, pv = B.preview && u.troops > 0 ? B.preview(u) : 0;
    if (B.picking && B.picking.t === u) { ctx.strokeStyle = '#ffe070'; ctx.lineWidth = 1; ctx.strokeRect(164.5, y - 1.5, 310, 14); }
    bar(300, y + 5, 84, u.troops, u.max, r > 0.5 ? '#58d070' : r > 0.25 ? '#e0c040' : '#e04040');
    if (pv > 0) { ctx.fillStyle = 'rgba(150,255,170,0.75)'; ctx.fillRect(300 + Math.round(84 * r), y + 5, Math.max(1, Math.round(84 * pv / u.max)), 3); }
    text(`${u.troops + pv}/${u.max}`, 476, y, pv > 0 ? '#90ffa8' : col, { align: 'right' });
  });
  if (B.auto) text(L('全軍突擊中（B取消）', 'Charging (B to stop)'), W / 2, 178, '#ffe070', { align: 'center' });
  else if ((B.cur || B.picking) && !B.card && !(window.G && G.autoBattle)) {
    const s1 = L('點武將或按選單鍵：情報', 'Tap a general or press Menu: info'), w = textW(s1) + 10;
    ctx.fillStyle = 'rgba(8,6,16,0.6)'; ctx.fillRect(324 - w / 2, 176, w, 14); text(s1, 324, 177, '#c8d0e8', { align: 'center' });
  }
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
