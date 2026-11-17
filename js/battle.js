// Army battles, seen from the side: your generals on the right, the enemy on the left, each general with a
// little crowd of soldiers that thins out as their troops (兵力, their life) fall. Each round you give every
// general in the front line an order — attack, a tactic from the shared strategy pool, an item, defend — or
// order the whole army to charge, or retreat; then everyone acts in order of speed.
import { ctx, W, H, canvas, text, textW, windowBox, bar, HAND } from './gfx.js?v=1';
import { input } from './input.js?v=1';
import { sfx, playMusic, currentSong } from './audio.js?v=1';
import { UI, menu, say, wait as uiWait, descBox, fit } from './ui.js?v=1';
import { L } from './i18n.js?v=1';
import { IMG, FX, tileset } from './assets.js?v=1';
import { GENERALS, gearFor, genName, parseLook } from './generals.js?v=1';
import { ITEMS, TACTICS, FORMS, unitEdge, maxTroops, itemName, tacName, TAC_DESC, unitName, SWING, formName } from './data.js?v=1';
import { S, member, stat, atkOf, defOf, troopsMax, usableTactics, tpMax, gainExp, give, take, have, hasSkill, formOk, recruit } from './state.js?v=1';
import { battleSheet, fieldSheet } from './doll.js?v=1';

export const B = { active: false };
const waits = [];
const tick = (n) => new Promise((res) => waits.push({ n, res }));
let fast = false;
const nums = [], fxs = [], shots = [];
let msg = '', msgT = 0;
const say1 = (s) => { msg = s; msgT = 0; };

// ---------- units ----------
const ROW_Y = [86, 130, 174];
function slotXY(side, slot, form) {
  const [col, row] = (FORMS[form] || FORMS.fangyuan).pos[slot] || [slot, 1];
  const x = side === 'ally' ? 286 + col * 36 + (row === 1 ? 8 : 0) : 194 - col * 36 - (row === 1 ? 8 : 0);
  return [x, ROW_Y[row]];
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
function makeUnit(side, spec, slot, form) {
  const g = GENERALS[spec.id], m = side === 'ally' ? member(spec.id) : null;
  const lv = m ? m.lv : spec.lv;
  const equip = m ? m.equip : gearFor(g, lv);
  const lead = m ? stat(m, 'lead') : g.lead;
  const sum = (k) => Object.values(equip).reduce((t, s) => t + ((s && ITEMS[s] && ITEMS[s][k]) || 0), 0);
  const max = m ? troopsMax(m) : Math.round(maxTroops(lv, lead, g.skills.includes('haoling')) * (spec.mul || 1));
  const u = {
    side, id: spec.id, g, m, lv, slot, equip, unit: g.unit, boss: !!spec.boss, faction: m ? 'sun' : g.faction,
    max, troops: m ? Math.min(m.troops, max) : Math.round(max * (spec.hp || 1)),
    str: m ? stat(m, 'str') : g.str, int: m ? stat(m, 'int') : g.int + sum('int'), spd: (m ? stat(m, 'spd') : g.spd + sum('spd')),
    atk: m ? atkOf(m) : g.str + sum('atk'), def: m ? defOf(m) : Math.round(g.lead * 0.55 + sum('def')),
    tactics: m ? usableTactics(m) : enemyTactics(g, lv), st: {}, buf: {}, buqu: g.skills.includes('buqu'),
    sheet: null, x: 0, y: 0, dx: 0, anim: 'idle', at: 0, flash: 0, alpha: 1, horse: equip.horse && ITEMS[equip.horse] ? ITEMS[equip.horse].horse : null,
    weakFire: !!(equip.armour && ITEMS[equip.armour] && ITEMS[equip.armour].weakFire), opts: { shield: g.shield || null, quiver: !!g.quiver },
  };
  if (spec.boss) { u.atk = Math.round(u.atk * (spec.atkMul || 1.25)); u.def = Math.round(u.def * (spec.defMul || 1.12)); }
  [u.x, u.y] = slotXY(side, slot, form);
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

// ---------- numbers ----------
const formOf = (side) => FORMS[side === 'ally' ? B.form : B.foeForm] || FORMS.fangyuan;
const buffK = (u, k) => (u.buf[k] > 0 ? 1.25 : 1);
const scaleLv = (lv) => maxTroops(lv, 70) / 4;
const rnd = (a, b) => a + Math.random() * (b - a);
function skillOnSide(side, s) { return alive(side).some((u) => u.g.skills.includes(s)); }
function physDamage(a, d, mul = 1) {
  const fa = formOf(a.side), fd = formOf(d.side);
  let A = a.atk * buffK(a, 'atk') * fa.atk * (a.st.provoke ? 1.2 : 1);
  if (a.g.skills.includes('yongmeng')) A *= 1.1;
  if (skillOnSide(d.side, 'weifeng')) A *= 0.92;
  let D = d.def * buffK(d, 'def') * fd.def * (d.guard ? 1.6 : 1) * (d.st.provoke ? 0.6 : 1);
  if (d.g.skills.includes('tiebi')) D *= 1.2;
  if (d.g.skills.includes('dunqiang')) D *= 1.3;
  if (a.g.skills.includes('shenshe')) D *= 0.75;
  let dmg = (A * A) / (A + D) / 52 * scaleLv(a.lv);
  dmg *= 0.55 + 0.45 * (a.troops / a.max);
  dmg *= unitEdge(a.unit, d.unit, B.naval);
  if (B.naval) { if (a.g.skills.includes('shuizhan')) dmg *= 1.25; if (d.g.skills.includes('shuizhan')) dmg /= 1.2; if (fa.naval) dmg *= fa.naval; if (fd.naval) dmg /= fd.naval; }
  if (B.round === 1) { if (a.g.skills.includes('tuji')) dmg *= 1.3; if (a.g.skills.includes('yexi')) dmg *= 1.15; if (fa.charge) dmg *= fa.charge; }
  if ((a.unit === 'arc') && fa.bow) dmg *= fa.bow;
  if (a.unit === 'arc' && B.weather === 'wind') dmg *= 1.15;
  if (a.g.skills.includes('danqi')) dmg *= 1 + 0.6 * (1 - a.troops / a.max);
  // Jeff's siege engines: an engineer in the army hits walls harder
  if (B.terrain === 'castle' && a.side === 'ally' && skillOnSide('ally', 'gongjiang')) dmg *= 1.12;
  if (B.lvgap && a.side === 'foe') dmg *= B.lvgap;
  let crit = 0.05 + (a.g.skills.includes('shenshe') ? 0.15 : 0) + (B.scouted && a.side === 'ally' ? 0.08 : 0);
  const isCrit = Math.random() < crit;
  if (isCrit) dmg *= 1.5;
  dmg *= mul * rnd(0.88, 1.12);
  if (fd.evade && Math.random() < fd.evade) return { dmg: 0, miss: true };
  return { dmg: Math.max(1, Math.round(dmg)), crit: isCrit };
}
function tacPower(a) {
  let int = a.int;
  if (a.side === 'ally' && S.strategist && member(S.strategist) && member(S.strategist).troops > 0) int = Math.max(int, stat(member(S.strategist), 'int') * 0.92);
  return int;
}
function tacDamage(a, d, t) {
  const int = tacPower(a), dint = d.int;
  // a clever caster against a dull target does more, but never wildly more
  let dmg = (t.pow || 1) * ((int + 40) / (dint * 0.6 + 70)) * 0.75 * scaleLv(a.lv);
  const f = formOf(a.side); dmg *= f.tac;
  if (a.g.skills.includes('guimou') || (a.side === 'ally' && S.strategist && GENERALS[S.strategist].skills.includes('guimou'))) dmg *= 1.15;
  if (t.el === 'fire') { if (B.weather === 'rain') dmg *= 0.6; if (B.weather === 'wind') dmg *= 1.3; if (B.terrain === 'forest') dmg *= 1.2; if (d.weakFire) dmg *= 2; if (a.g.skills.includes('gongjiang')) dmg *= 1.25; }
  if (t.el === 'water') { if (B.weather === 'rain') dmg *= 1.3; if (B.naval || B.terrain === 'river') dmg *= 1.2; }
  if (t.el === 'thunder' && B.weather === 'rain') dmg *= 1.4;
  if (t.el === 'rock' && (B.terrain === 'mountain' || B.terrain === 'hill')) dmg *= 1.3;
  if (t.naval && B.naval) dmg *= t.naval;
  if (B.lvgap && a.side === 'foe') dmg *= B.lvgap;
  return Math.max(1, Math.round(dmg * rnd(0.9, 1.1)));
}
function hurt(u, dmg, src) {
  if (dmg <= 0) return;
  u.troops -= dmg;
  if (u.troops <= 0 && u.buqu) { u.troops = 1; u.buqu = false; pop(u, L('不屈！', 'Unyielding!'), '#ffe080'); }
  if (u.troops <= 0) { u.troops = 0; u.anim = 'hurt'; u.at = 0; u.dead = true; }
  else { u.anim = 'hurt'; u.at = 0; }
  u.flash = 10;
  void src;
}
function pop(u, s, col = '#ffffff') { nums.push({ x: u.x + u.dx, y: u.y - 58, s: String(s), col, t: 0 }); }

// ---------- the battle ----------
// cfg: { foes: [{ id, lv, mul, boss }], boss, naval, terrain, canRun, music, foeForm, capture, intro }
export function startBattle(cfg) {
  return new Promise((resolve) => {
    Object.assign(B, { active: true, cfg, resolve, units: [], round: 0, weather: cfg.weather || 'clear', naval: !!cfg.naval, terrain: cfg.terrain || 'grass', form: formOk(S.formation) ? S.formation : 'fangyuan',
      foeForm: cfg.foeForm || ['fangyuan', 'yulin', 'heyi', 'changshe'][Math.floor(Math.random() * 4)], scouted: false, auto: false, over: false, fade: 30, prevSong: currentSong, ambush: {}, lvgap: cfg.lvgap || 0 });
    nums.length = 0; fxs.length = 0; shots.length = 0; msg = '';
    S.front.filter((id) => member(id)).forEach((id, i) => B.units.push(makeUnit('ally', { id }, i, B.form)));
    cfg.foes.forEach((f, i) => B.units.push(makeUnit('foe', f, i, B.foeForm)));
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
  const names = foes.slice(0, 3).map((u) => genName(u.g)).join(L('、', ', '));
  say1(B.cfg.intro || L(`${names}${foes.length > 3 ? '等' : ''}的軍隊出現了！`, `The army of ${names}${foes.length > 3 ? ' and others' : ''} appears!`));
  await tick(50);
  // skills at the start
  for (const u of alive('ally').concat(alive('foe'))) if (u.g.skills.includes('jili')) { for (const v of alive(u.side)) v.buf.atk = 2; say1(L(`${genName(u.g)}激勵全軍！`, `${genName(u.g)} inspires the army!`)); sfx('buff'); await tick(30); }
  // a surprise attack: the enemy sometimes strikes first (scouts and surprise skills prevent it)
  let first = null;
  if (!B.cfg.boss && Math.random() < 0.08 && !skillOnSide('ally', 'qixi')) first = 'foe';
  else if (!B.cfg.boss && Math.random() < (skillOnSide('ally', 'yexi') ? 0.18 : 0.07)) first = 'ally';
  if (first) { say1(first === 'foe' ? L('敵軍突襲！', 'An enemy ambush!') : L('我軍搶得先機！', 'We strike first!')); await tick(40); }
  for (;;) {
    B.round++;
    const orders = new Map();
    if (first !== 'foe') { const r = await giveOrders(orders); if (r === 'run') { if (await tryRun()) return; orders.clear(); } }
    if (first === 'ally') { for (const u of alive('foe')) orders.set(u, { skip: true }); }
    first = null;
    // the enemy decides
    for (const u of alive('foe')) if (!orders.has(u)) orders.set(u, enemyOrder(u));
    const order = [...orders.keys()].filter((u) => u.troops > 0).sort((a, b) => speedOf(b) - speedOf(a));
    for (const u of order) {
      if (u.troops <= 0) continue;
      const o = orders.get(u);
      if (o.skip) continue;
      await act(u, o);
      if (B.over) return;
      if (await checkEnd()) return;
    }
    await endOfRound();
    if (await checkEnd()) return;
    // a battle cannot go on for ever: after forty rounds the supplies run out
    if (B.round >= 40) {
      say1(L('雙方兵糧耗盡，各自退兵了。', 'Both armies run out of supplies and fall back.')); await tick(60);
      finish(B.cfg.boss ? 'lose' : 'run'); return;
    }
  }
}
const speedOf = (u) => u.spd * buffK(u, 'spd') * formOf(u.side).spd * (u.g.skills.includes('jisu') ? 1.2 : 1) * (B.naval && u.g.skills.includes('guanxing') ? 1.2 : 1) * rnd(0.85, 1.15) + (u.guard ? 1000 : 0);

// ---------- your orders ----------
async function giveOrders(orders) {
  const fr = alive('ally');
  for (const u of fr) u.guard = false;
  if (window.G && G.autoBattle) { for (const u of fr) orders.set(u, u.st.stun ? { skip: true } : u.st.confuse ? { confused: true } : smartOrder(u)); return; }
  if (B.auto) {
    if (input.held('b')) { B.auto = false; say1(L('停止全軍突擊。', 'The charge is called off.')); await tick(20); }
    else { for (const u of fr) orders.set(u, autoOrder(u)); return; }
  }
  let i = 0;
  while (i < fr.length) {
    const u = fr[i];
    if (u.st.stun) { orders.set(u, { skip: true, why: 'stun' }); i++; continue; }
    if (u.st.confuse) { orders.set(u, { confused: true }); i++; continue; }
    B.cur = u;
    const cmds = [L('攻擊', 'Attack'), L('策略', 'Tactic'), L('道具', 'Item'), L('防禦', 'Defend'), L('全軍突擊', 'Charge!'), L('撤退', 'Retreat')];
    const dis = [false, !u.tactics.length, !Object.keys(S.items).some((k) => ITEMS[k] && ITEMS[k].kind === 'supply' && !ITEMS[k].fieldOnly), false, false, !B.cfg.canRun && B.cfg.canRun !== undefined];
    const c = await menu(cmds.map((s, k) => ({ label: s, disabled: dis[k] })), { x: 4, y: 192, w: 156, cols: 2, rowH: 14, cancel: true, title: genName(u.g) });
    if (c === -1) { if (i > 0) { i--; while (i > 0 && (fr[i].st.stun || fr[i].st.confuse)) i--; orders.delete(fr[i]); } continue; }
    if (c === 0) { const t = await pickTarget('foe', u); if (!t) continue; orders.set(u, { kind: 'attack', target: t }); i++; continue; }
    if (c === 1) { const o = await pickTactic(u); if (!o) continue; orders.set(u, o); i++; continue; }
    if (c === 2) { const o = await pickItem(u); if (!o) continue; orders.set(u, o); i++; continue; }
    if (c === 3) { orders.set(u, { kind: 'guard' }); u.guard = true; i++; continue; }
    if (c === 4) { B.auto = true; say1(L('全軍突擊！（按住B取消）', 'All-out charge! (hold B to stop)')); for (let k = i; k < fr.length; k++) orders.set(fr[k], autoOrder(fr[k])); B.cur = null; return; }
    if (c === 5) { B.cur = null; return 'run'; }
  }
  B.cur = null;
}
// the test bot's general: heal when friends are low, burn crowds with tactics, otherwise hit the weakest
function smartOrder(u) {
  const foes = alive('foe'), friends = alive('ally');
  const cost = (t) => Math.max(1, Math.round(TACTICS[t].cost * (hasShensuan() ? 0.75 : 1)));
  const can = (f) => u.tactics.filter((t) => TACTICS[t] && f(TACTICS[t]) && cost(t) <= S.tp);
  const low = friends.filter((v) => v.troops < v.max * 0.4);
  const down = B.units.filter((v) => v.side === 'ally' && v.troops <= 0);
  const rev = can((t) => t.revive); if (down.length && rev.length) return { kind: 'tactic', tac: rev[0], target: down[0], cost: cost(rev[0]) };
  const hall = can((t) => t.heal && t.t === 'aall'); if (low.length >= 2 && hall.length) { const t = hall[hall.length - 1]; return { kind: 'tactic', tac: t, cost: cost(t) }; }
  const h1 = can((t) => t.heal && t.t === 'a1'); if (low.length && h1.length) return { kind: 'tactic', tac: h1[0], target: low[0], cost: cost(h1[0]) };
  if (low.length && have('jinchuang') && u.int < 70) return { kind: 'item', item: 'jinchuang', target: low[0] };
  if (low.length && have('salve') && u.int < 70) return { kind: 'item', item: 'salve', target: low[0] };
  const big = can((t) => t.pow && t.t === 'eall'); if (foes.length >= 2 && big.length && u.int >= 70 && S.tp > tpMax() * 0.25) { const t = big[big.length - 1]; return { kind: 'tactic', tac: t, cost: cost(t) }; }
  const one = can((t) => t.pow && t.t === 'e1'); if (one.length && u.int > u.str + 10 && S.tp > tpMax() * 0.3) { const t = one[one.length - 1]; return { kind: 'tactic', tac: t, target: foes.reduce((a, b) => (b.troops < a.troops ? b : a), foes[0]), cost: cost(t) }; }
  return autoOrder(u);
}
function autoOrder(u) {
  const foes = alive('foe');
  const t = foes.reduce((a, b) => (b.troops < a.troops ? b : a), foes[0]);
  return { kind: 'attack', target: t };
}
async function pickTarget(side, u, { all = false, down = false } = {}) {
  let list = down ? B.units.filter((x) => x.side === side && x.troops <= 0) : alive(side);
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
        if (input.pressed('a')) { sfx('ok'); UIpop(w); res(list[i]); }
        if (input.pressed('b')) { sfx('cancel'); UIpop(w); res(null); }
      },
      draw() {
        const t = list[i], f = (performance.now() / 120) | 0;
        ctx.drawImage(HAND, t.x + t.dx - 6 + (f % 2), t.y - 72);
        drawInfo(t);
      },
    };
    UIpush(w);
  });
}
import { pushRaw as UIpush, removeRaw as UIpop } from './ui.js?v=1';
function drawInfo(t) {
  const name = genName(t.g), s = `${name}  Lv${t.lv}  ${unitName(t.unit)}`;
  windowBox(140, 4, 200, B.scouted || t.side === 'ally' ? 30 : 18);
  text(fit(s, 186), 148, 8, t.side === 'foe' ? '#ffb0a0' : '#c0e0ff');
  if (B.scouted || t.side === 'ally') text(`${L('兵', 'T')} ${t.troops}/${t.max}  ${L('武', 'S')}${t.str} ${L('智', 'I')}${t.int}`, 148, 20, '#e0e0e0');
}
async function pickTactic(u) {
  const list = u.tactics.filter((t) => TACTICS[t]);
  const cost = (t) => Math.max(1, Math.round(TACTICS[t].cost * (hasShensuan() ? 0.75 : 1)));
  const items = list.map((t) => ({ label: tacName(t), right: cost(t), disabled: cost(t) > S.tp || (TACTICS[t].escape && B.cfg.boss) || (TACTICS[t].t === 'down' && !B.units.some((x) => x.side === 'ally' && x.troops <= 0)) }));
  let cur = 0;
  const c = await menu(items, { x: 6, y: 60, w: 168, title: L(`策略值 ${S.tp}/${tpMax()}`, `Strategy ${S.tp}/${tpMax()}`), maxRows: 8, onMove: (i) => { cur = i; }, drawExtra: () => { const d = TAC_DESC[list[cur]]; if (d) descBox(L(d[0], d[1]), 196); } });
  if (c < 0) return null;
  const t = TACTICS[list[c]];
  let target = null;
  if (t.t === 'e1') { target = await pickTarget('foe', u); if (!target) return null; }
  else if (t.t === 'a1') { target = await pickTarget('ally', u); if (!target) return null; }
  else if (t.t === 'down') { target = await pickTarget('ally', u, { down: true }); if (!target) return null; }
  return { kind: 'tactic', tac: t.id, target, cost: cost(t.id) };
}
const hasShensuan = () => S.strategist && GENERALS[S.strategist].skills.includes('shensuan');
async function pickItem(u) {
  const ids = Object.keys(S.items).filter((k) => ITEMS[k] && ITEMS[k].kind === 'supply' && !ITEMS[k].fieldOnly);
  const c = await menu(ids.map((k) => ({ label: itemName(k), right: S.items[k] })), { x: 6, y: 80, w: 160, title: L('道具', 'Items'), maxRows: 7 });
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
// ---------- the enemy's choices ----------
function enemyOrder(u) {
  if (u.st.stun) return { skip: true, why: 'stun' };
  if (u.st.confuse) return { confused: true };
  const allies = alive('ally');
  if (u.tactics.length && Math.random() < Math.min(0.6, u.int / 150 + (u.boss ? 0.1 : 0))) {
    const hurtFriend = alive('foe').find((v) => v.troops < v.max * 0.4);
    const opts = u.tactics.map((t) => TACTICS[t]).filter((t) => t && !t.escape && !t.scout);
    const heal = opts.find((t) => t.heal && t.t === 'aall') || opts.find((t) => t.heal);
    if (hurtFriend && heal) return { kind: 'tactic', tac: heal.id, target: hurtFriend, free: true };
    const atk = opts.filter((t) => t.pow || t.st);
    if (atk.length) {
      const t = atk[Math.floor(Math.random() * atk.length)];
      if (t.t === 'self' || t.t === 'aall') return { kind: 'tactic', tac: t.id, target: u, free: true };
      return { kind: 'tactic', tac: t.id, target: pickWeighted(allies, 'ally'), free: true };
    }
  }
  if (u.st.provoke && u.st.provoke.troops > 0) return { kind: 'attack', target: u.st.provoke };
  return { kind: 'attack', target: pickWeighted(allies, 'ally') };
}
function pickWeighted(list, side) {
  const f = formOf(side);
  const wts = list.map((u) => (f.hit[u.slot] || 1) * (u.st.provoke ? 1 : 1));
  let r = Math.random() * wts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) { r -= wts[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}

// ---------- doing things ----------
async function act(u, o) {
  if (o.confused) {
    const all = B.units.filter((x) => x.troops > 0 && x !== u);
    const t = all[Math.floor(Math.random() * all.length)];
    say1(L(`${genName(u.g)}陷入混亂，胡亂攻擊！`, `${genName(u.g)} is confused and lashes out!`)); await tick(20);
    if (t) await attack(u, t, true);
    return;
  }
  if (o.kind === 'guard') { say1(L(`${genName(u.g)}嚴陣以待。`, `${genName(u.g)} stands on guard.`)); await tick(18); return; }
  if (o.kind === 'attack') {
    let t = o.target;
    if (!t || t.troops <= 0) { const l = alive(u.side === 'ally' ? 'foe' : 'ally'); if (!l.length) return; t = u.side === 'foe' ? pickWeighted(l, 'ally') : l[0]; }
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
// who takes the blow: a guardian may step in front
function cover(t, a) {
  if (t.side !== 'ally' && t.side !== 'foe') return t;
  for (const v of alive(t.side)) {
    if (v === t) continue;
    if (v.g.skills.includes('dunqiang') && Math.random() < 0.4) return v;
    if (v.g.skills.includes('huwei') && t.troops < t.max * 0.3 && Math.random() < 0.35) return v;
  }
  return t;
}
async function moveTo(u, tx, frames) { const x0 = u.dx; u.anim = 'walk'; for (let f = 1; f <= frames; f++) { u.dx = x0 + ((tx - x0) * f) / frames; u.at++; await tick(1); } }
async function attack(u, t0, confused = false, mul = 1) {
  const t = confused ? t0 : cover(t0, u);
  if (t !== t0) { say1(L(`${genName(t.g)}挺身而出！`, `${genName(t.g)} steps in the way!`)); await tick(14); }
  if (!confused) say1(L(`${genName(u.g)}的攻擊！`, `${genName(u.g)} attacks!`));
  const sw = (u.sheet && u.sheet.swing) || 'slash';
  const wcat = u.equip.weapon && ITEMS[u.equip.weapon] ? ITEMS[u.equip.weapon].cat : 'sword';
  const ranged = wcat === 'bow' || wcat === 'xbow';
  const dir = u.side === 'ally' ? -1 : 1;
  const reach = ranged ? 0 : Math.max(0, Math.abs((t.x + t.dx) - u.x) - 46) * dir;
  if (!ranged) { sfx('step'); await moveTo(u, reach, Math.max(8, Math.round(Math.abs(reach) / 6))); }
  u.anim = sw === 'cast' ? 'cast' : sw; u.at = 0;
  const n = sw === 'shoot' ? 13 : sw === 'thrust' ? 8 : sw === 'cast' ? 7 : 6, hitAt = Math.floor(n * (ranged ? 0.7 : 0.55));
  for (let f = 0; f < n * 3; f++) {
    u.at = f;
    if (f === hitAt * 3) {
      if (ranged) { sfx('slash'); shots.push({ x: u.x + u.dx - 20 * -dir, y: u.y - 34, tx: t.x + t.dx, ty: t.y - 30, t: 0, n: 12 }); await tick(12); }
      const r = physDamage(u, t, mul);
      if (r.miss) { pop(t, L('閃避', 'Miss'), '#c0c0ff'); sfx('miss'); }
      else {
        hurt(t, r.dmg, u); pop(t, r.dmg, r.crit ? '#ffe040' : '#ffffff'); if (r.crit) pop(t, L('會心！', 'Critical!'), '#ffe040');
        sfx(r.crit ? 'crit' : 'hit'); B.shake = r.crit ? 6 : 3;
        fxs.push({ k: 'cutx', x: t.x + t.dx, y: t.y - 30, t: 0 });
        // an ambush laid by the target's side springs
        if (B.ambush[t.side] && u.side !== t.side) { const am = B.ambush[t.side]; B.ambush[t.side] = null; await tick(10); say1(L('伏兵殺出！', 'The ambush springs!')); fxs.push({ k: 'leaf', x: u.x + u.dx, y: u.y - 30, t: 0 }); const d2 = Math.round(am * 1.2); hurt(u, d2); pop(u, d2, '#ffb060'); sfx('hit'); }
        // light fingers
        if (u.side === 'ally' && u.g.skills.includes('miaoshou') && Math.random() < 0.2) { const gold = 10 + t.lv * 12; S.gold += gold; pop(u, `+${gold}${L('金', 'g')}`, '#ffe080'); }
      }
    }
    await tick(1);
  }
  if (!ranged) await moveTo(u, 0, Math.max(6, Math.round(Math.abs(reach) / 8)));
  u.anim = 'idle'; u.dx = 0;
  await tick(6);
}
async function attackAll(u) {
  say1(L(`${genName(u.g)}橫掃千軍！`, `${genName(u.g)} sweeps through the ranks!`));
  const sw = (u.sheet && u.sheet.swing) || 'slash';
  const dir = u.side === 'ally' ? -1 : 1;
  await moveTo(u, 40 * dir, 10);
  u.anim = sw === 'shoot' ? 'shoot' : sw; u.at = 0;
  for (let f = 0; f < 24; f++) { u.at = f; await tick(1); }
  for (const t of alive(u.side === 'ally' ? 'foe' : 'ally')) {
    const r = physDamage(u, t, u.g.skills.includes('guishen') ? 0.72 : 0.6);
    if (!r.miss) { hurt(t, r.dmg, u); pop(t, r.dmg, r.crit ? '#ffe040' : '#ffffff'); fxs.push({ k: 'cutx', x: t.x + t.dx, y: t.y - 30, t: 0 }); }
  }
  sfx('crit'); B.shake = 7;
  await tick(16);
  await moveTo(u, 0, 10); u.anim = 'idle'; u.dx = 0; await tick(6);
}
async function castTactic(u, t, o) {
  if (!o.free) { if (S.tp < o.cost) { say1(L('策略值不足！', 'Not enough strategy points!')); await tick(30); return; } S.tp -= o.cost; }
  say1(L(`${genName(u.g)}使出「${t.zh}」！`, `${genName(u.g)} uses ${t.en}!`));
  u.anim = 'cast'; u.at = 0;
  sfx('special');
  for (let f = 0; f < 21; f++) { u.at = f; await tick(1); }
  u.anim = 'idle';
  const foeSide = u.side === 'ally' ? 'foe' : 'ally';
  if (t.escape) { if (B.cfg.boss || B.cfg.canRun === false) { say1(L('無法撤退！', 'There is no retreat!')); await tick(30); return; } say1(L('全軍迅速撤離。', 'The army slips away.')); await tick(30); finish('run'); return; }
  if (t.scout) { B.scouted = true; say1(L('看清了敵軍的虛實！', 'The enemy lies open to us!')); await tick(30); return; }
  if (t.weather) { B.weather = t.weather; say1({ rain: L('天降大雨。', 'Rain pours down.'), wind: L('東風大作。', 'A strong wind rises.'), clear: L('雲開見日。', 'The clouds part.') }[t.weather]); if (t.buff2) for (const v of alive(u.side)) v.buf.spd = 3; sfx('buff'); await tick(36); return; }
  let targets;
  if (t.t === 'eall') targets = alive(foeSide);
  else if (t.t === 'aall') targets = alive(u.side);
  else if (t.t === 'self') targets = [u];
  else if (t.t === 'down') targets = o.target && o.target.troops <= 0 ? [o.target] : B.units.filter((x) => x.side === u.side && x.troops <= 0).slice(0, 1);
  else { let x = o.target; if (!x || (x.troops <= 0)) { const l = t.t === 'a1' ? alive(u.side) : alive(foeSide); x = l[0]; } targets = x ? [x] : []; }
  for (const x of targets) fxs.push({ k: t.fx || 'spark', x: x.x + x.dx, y: x.y - 24, t: 0, big: t.t === 'eall' });
  sfx(t.el === 'fire' ? 'fire' : t.el === 'water' ? 'bubble' : t.el === 'thunder' ? 'bolt' : t.el === 'rock' ? 'quake' : t.heal || t.revive ? 'heal' : t.buff ? 'buff' : 'spore');
  await tick(18);
  if (t.st === 'ambush') { B.ambush[u.side] = tacDamage(u, alive(foeSide)[0] || u, { pow: 1.2 }); say1(L('伏兵已就位。', 'The ambush is set.')); await tick(30); return; }
  for (const x of targets) {
    if (t.pow) {
      if (isEnemyOf(u, x) && x.g.skills.includes('fanji') && Math.random() < 0.35) { pop(x, L('識破！', 'Seen through!'), '#a0d0ff'); continue; }
      if (isEnemyOf(u, x) && x.side === 'ally' && formOf('ally').resist && Math.random() < formOf('ally').resist) { pop(x, L('八卦護陣！', 'The Trigrams hold!'), '#a0d0ff'); continue; }
      const d = tacDamage(u, x, t); hurt(x, d, u); pop(x, d, '#ffd0a0');
    }
    if (t.st && t.st !== 'ambush') {
      if (x.g.skills.includes('kanpo') && ['confuse', 'stun', 'provoke'].includes(t.st)) { pop(x, L('看破！', 'Clear mind!'), '#a0d0ff'); continue; }
      const ok = Math.random() < Math.max(0.15, Math.min(0.9, 0.55 + (tacPower(u) - x.int) / 100)) && !(x.boss && t.st === 'stun' && Math.random() < 0.5);
      if (ok) { x.st[t.st] = t.st === 'provoke' ? u : t.st === 'poison' ? 3 : t.st === 'stun' ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2); if (t.st === 'provoke') x.st.provokeT = 3; pop(x, { poison: L('中毒', 'Poisoned'), confuse: L('混亂', 'Confused'), stun: L('受困', 'Trapped'), provoke: L('被激怒', 'Provoked') }[t.st], '#e0a0ff'); }
      else pop(x, L('無效', 'No effect'), '#c0c0c0');
    }
    if (t.buff) { x.buf[t.buff] = 3; pop(x, { atk: L('攻↑', 'ATK↑'), def: L('防↑', 'DEF↑'), spd: L('速↑', 'SPD↑') }[t.buff], '#ffe080'); }
    if (t.heal) { const k = (u.g.skills.includes('guanxing') ? 1.2 : 1) * (0.6 + tacPower(u) / 250); const h = Math.round(x.max * t.heal * k); x.troops = Math.min(x.max, x.troops + h); pop(x, '+' + h, '#80ff a0'.replace(' ', '')); }
    if (t.revive) { x.troops = Math.round(x.max * t.revive); x.dead = false; x.anim = 'idle'; x.st = {}; pop(x, L('重整旗鼓！', 'Rallied!'), '#80ffa0'); }
  }
  await tick(30);
}
async function useItem(u, o) {
  const it = ITEMS[o.item];
  if (!take(o.item)) return;
  say1(L(`${genName(u.g)}使用了${it.zh}。`, `${genName(u.g)} uses ${it.en}.`));
  await tick(16);
  if (it.escape) { if (B.cfg.boss || B.cfg.canRun === false) { say1(L('無法撤退！', 'There is no retreat!')); await tick(30); return; } sfx('run'); finish('run'); return; }
  if (it.fire) { for (const x of alive(u.side === 'ally' ? 'foe' : 'ally')) { const d = Math.round(scaleLv(Math.max(u.lv, 5)) * 0.9 * rnd(0.9, 1.1)); hurt(x, d); pop(x, d, '#ffd0a0'); fxs.push({ k: 'explosion', x: x.x + x.dx, y: x.y - 26, t: 0 }); } sfx('boom'); await tick(30); return; }
  if (it.tp) { const n = Math.min(tpMax() - S.tp, it.tp); S.tp += n; pop(u, `+${n} ${L('策', 'SP')}`, '#a0e0ff'); sfx('heal'); await tick(24); return; }
  const targets = it.target === 'all' ? alive(u.side) : [o.target || u];
  for (const x of targets) {
    if (it.revive) { if (x.troops > 0) continue; x.troops = Math.round(x.max * it.revive); x.dead = false; x.anim = 'idle'; pop(x, L('重整旗鼓！', 'Rallied!'), '#80ffa0'); continue; }
    if (x.troops <= 0) continue;
    const h = Math.round(x.max * it.heal); x.troops = Math.min(x.max, x.troops + h); pop(x, '+' + h, '#80ffa0');
    fxs.push({ k: 'boost', x: x.x + x.dx, y: x.y - 30, t: 0 });
  }
  sfx('heal'); await tick(24);
}
async function endOfRound() {
  for (const u of B.units.filter((x) => x.troops > 0)) {
    if (u.st.poison) { const d = Math.max(1, Math.round(u.max * 0.06)); hurt(u, d); pop(u, d, '#c080ff'); u.st.poison--; if (!u.st.poison) delete u.st.poison; }
    for (const k of ['confuse', 'stun']) if (u.st[k]) { u.st[k]--; if (!u.st[k]) delete u.st[k]; }
    if (u.st.provoke) { u.st.provokeT--; if (u.st.provokeT <= 0) { delete u.st.provoke; delete u.st.provokeT; } }
    for (const k of Object.keys(u.buf)) { u.buf[k]--; if (u.buf[k] <= 0) delete u.buf[k]; }
    if (u.g.skills.includes('yinjiang') && u.troops > 0) { const h = Math.round(u.max * 0.05); u.troops = Math.min(u.max, u.troops + h); pop(u, '+' + h, '#c080ff'); }
    u.guard = false;
  }
  for (const side of ['ally', 'foe']) if (skillOnSide(side, 'yishu')) for (const u of alive(side)) { const h = Math.round(u.max * 0.04); u.troops = Math.min(u.max, u.troops + h); }
  if (B.units.some((u) => u.st.poison !== undefined)) await tick(20);
}
async function checkEnd() {
  if (!alive('foe').length) { await victory(); return true; }
  if (!alive('ally').length) { await defeat(); return true; }
  return false;
}
// ---------- the end ----------
async function victory() {
  await tick(30);
  playMusic('victory');
  const foes = B.units.filter((u) => u.side === 'foe');
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
    // little is learned from much weaker enemies
    const avg = foes.reduce((t, f) => t + f.lv, 0) / foes.length;
    // little is learned from much weaker enemies, more from stronger ones
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
    for (const u of B.units) { u.at++; if (u.flash) u.flash--; if (u.anim === 'hurt' && !u.dead && u.at > 14) u.anim = 'idle'; }
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
function frameOf(u) {
  const s = u.sheet; if (!s) return null;
  const m = s.meta;
  let a = u.anim, f = 0, row = 0;
  if (u.troops <= 0) { a = 'hurt'; f = 5; }
  else if (a === 'walk') { f = 1 + (Math.floor(u.at / 4) % 8); row = 1; }
  else if (a === 'idle') { f = Math.floor(u.at / 30) % 2; }
  else if (a === 'hurt') { f = Math.min(2, Math.floor(u.at / 4)); }
  else if (m[a]) { f = Math.min(m[a].n - 1, Math.floor(u.at / 3)); }
  if (!m[a]) { a = 'idle'; f = 0; row = 0; }
  const b = m[a];
  return { img: s.img, sx: f * b.cell, sy: b.y + row * b.cell, cell: b.cell };
}
function drawUnit(u) {
  const x = Math.round(u.x + u.dx), y = u.y, flip = u.side === 'foe';
  const F = frameOf(u);
  // soldiers behind the general
  const ss = fieldSheet(u.soldier.look, u.soldier.equip);
  const nSold = u.troops <= 0 ? 0 : Math.ceil(6 * (u.troops / u.max));
  const OFF = [[16, -10], [28, -4], [16, 6], [40, -10], [30, 10], [42, 4]];
  if (ss) {
    for (let i = 0; i < nSold; i++) {
      const [ox, oy] = OFF[i], sx = x + (flip ? -ox : ox), sy = y + oy;
      const walking = u.anim === 'walk';
      const fr = walking ? 1 + ((Math.floor(u.at / 4) + i) % 8) : 0;
      drawShadow(sx, sy, 12);
      ctx.drawImage(ss, fr * 32, (flip ? 3 : 1) * 32, 32, 32, sx - 16, sy - 30, 32, 32);
    }
  }
  if (!F) return;
  drawShadow(x, y, u.horse ? 40 : 22);
  if (u.flash && (u.flash % 4) < 2 && u.troops > 0) ctx.globalAlpha = 0.5;
  if (u.troops <= 0) ctx.globalAlpha = 0.55;
  ctx.save();
  ctx.translate(x, 0);
  if (flip) ctx.scale(-1, 1);
  if (u.horse && u.troops > 0) {
    const hi = IMG['h:' + (u.horse === 'red' ? 'brown' : u.horse)];
    // horse frames are 128px; facing left the walking horse stands on y 94 with its saddle at (62, 52),
    // galloping on y 87 with the saddle at (60, 50)
    const running = u.anim === 'walk';
    const row = running ? 1 : 5, fr = running ? Math.floor(u.at / 4) % 4 : (u.anim === 'idle' ? 0 : 1);
    const feet = running ? 90 : 94, sx = running ? 60 : 62, sy = running ? 50 : 52;
    if (hi) {
      if (u.horse === 'red') ctx.filter = 'hue-rotate(-18deg) saturate(1.8)';
      ctx.drawImage(hi, fr * 128, row * 128, 128, 128, -59, y + 1 - feet, 128, 128);
      ctx.filter = 'none';
    }
    // the rider sits with the hips (about 44px down the 64px figure) on the saddle; legs are cut at the thigh
    const off = (F.cell - 64) / 2, cut = 50;
    const top = y + 1 - feet + sy - 44 + (running ? Math.floor(u.at / 4) % 2 : 0);
    ctx.drawImage(F.img, F.sx, F.sy, F.cell, off + cut, -59 + sx - F.cell / 2, top - off, F.cell, off + cut);
  } else {
    ctx.drawImage(F.img, F.sx, F.sy, F.cell, F.cell, -F.cell / 2, y - 60 - (F.cell - 64) / 2, F.cell, F.cell);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  if (u.flash && u.troops > 0 && u.flash > 6) { ctx.fillStyle = 'rgba(255,255,255,0.0)'; }
  // troop bar under the feet
  const bw = 30;
  ctx.fillStyle = '#101018'; ctx.fillRect(x - bw / 2 - 1, y + 3, bw + 2, 4);
  const f = u.troops / u.max;
  ctx.fillStyle = f > 0.5 ? (u.side === 'ally' ? '#58d070' : '#e06050') : f > 0.25 ? '#e0c040' : '#e04040';
  ctx.fillRect(x - bw / 2, y + 4, Math.round(bw * f), 2);
  if (u.st.confuse || u.st.stun || u.st.poison || u.st.provoke) { const t = u.st.stun ? '困' : u.st.confuse ? '亂' : u.st.provoke ? '怒' : '毒'; text(L(t, { 困: 'TRP', 亂: 'CNF', 怒: 'PRV', 毒: 'PSN' }[t]), x - 6, y - 70, '#e0a0ff'); }
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
export function battleDraw() {
  const sh = B.shake ? (B.shake % 2 ? 2 : -2) : 0;
  ctx.drawImage(backdrop(), sh, 0);
  if (B.weather === 'rain') { ctx.fillStyle = 'rgba(180,200,255,0.5)'; const t = performance.now() / 16; for (let i = 0; i < 70; i++) { const x = (i * 97 + t * 3) % W, y = (i * 53 + t * 9) % 190; ctx.fillRect(x, y, 1, 6); } }
  const order = [...B.units].sort((a, b) => a.y - b.y || (a.side === 'ally' ? 1 : -1));
  for (const u of order) drawUnit(u);
  drawFx();
  for (const n of nums) { const k = Math.min(1, n.t / 10); text(n.s, n.x, n.y - k * 14, n.col, { align: 'center' }); }
  // the panel at the bottom
  windowBox(0, 190, 160, 80);
  if (msg && !UI.active) { const lines = wrapShort(msg, 144); lines.slice(0, 4).forEach((l, i) => text(l, 8, 198 + i * 16)); }
  windowBox(160, 190, 320, 80);
  const allies = B.units.filter((u) => u.side === 'ally');
  allies.forEach((u, i) => {
    const y = 197 + i * 14;
    const col = u.troops <= 0 ? '#8a8a98' : B.cur === u ? '#ffe070' : '#f0f0f0';
    text(fit(genName(u.g), 66), 168, y, col);
    text(unitName(u.unit), 238, y, '#b8c8e0');
    bar(272, y + 5, 112, u.troops, u.max, u.troops / u.max > 0.25 ? '#58d070' : '#e04040');
    text(String(u.troops), 470, y, col, { align: 'right' });
  });
  text(L(`策略 ${S.tp}/${tpMax()}`, `SP ${S.tp}/${tpMax()}`), 6, 4, '#a0e0ff');
  text(formName(B.form), 474, 4, '#ffe080', { align: 'right' });
  text(formName(B.foeForm), 140, 4, '#ffb0a0');
  if (B.weather !== 'clear') text({ rain: L('雨', 'Rain'), wind: L('風', 'Wind') }[B.weather] || '', 240, 4, '#c0e0ff', { align: 'center' });
  if (B.auto) text(L('全軍突擊中（B取消）', 'Charging (B to stop)'), W / 2, 178, '#ffe070', { align: 'center' });
  if (B.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${B.fade / 30})`; ctx.fillRect(0, 0, W, H); }
}
function wrapShort(s, w) {
  const out = []; let line = '';
  for (const ch of String(s).match(/[A-Za-z0-9'".,!?:;()\-]+ ?|./gu) || []) { if (textW(line + ch) > w && line) { out.push(line.trimEnd()); line = ch.trimStart(); } else line += ch; }
  out.push(line); return out;
}
export { tick as battleTick, uiWait, say };
