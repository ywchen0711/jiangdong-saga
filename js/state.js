// The game state: the army (generals, their levels, troops and gear), gold, items, flags, where you are,
// and saving and loading. A general's numbers are worked out here from their base stats and gear.
import { GENERALS, gearFor, genName } from './generals.js?v=12';
import { ITEMS, TACTICS, FORMS, maxTroops, maxTP, expFor, MAXLV, CAN_USE, ONE_HAND, SLOTS, gearFx } from './data.js?v=12';
import { L } from './i18n.js?v=12';

export const S = {};
export function newGame() {
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, {
    v: 1, chapter: 0, flags: {}, gold: 300, items: { salve: 6, wine: 2, smoke: 2 },
    roster: {}, front: [], strategist: null, formation: 'fangyuan', forms: ['fangyuan'], tp: 0,
    pos: { map: 'world', x: 466, y: 195, dir: 'd' }, wv: 2, vehicle: 'foot', ship: null, horse: false,
    met: {}, lastTown: 'haiyan', steps: 0, repel: 0, time: 0, battles: 0, wins: 0, captured: 0, chests: {}, visited: {},
    found: {}, rumours: {}, quests: {}, codex: {}, dropPity: {}, sq: {}, camp: [],
  });
}
newGame();

// ---------- generals in the army ----------
// At most eight generals travel with the army (the front line of five and three in reserve, the strategist among
// them). The rest wait in the camp (營帳): any tavern, and the home city's inn, opens the roster where they can be
// swapped in, looked at, re-equipped or trained. S.camp lists who is waiting there.
export const PARTY_MAX = 8;
export function member(id) { return S.roster[id] || null; }
export const inCamp = (id) => !!(S.camp && S.camp.includes(id));
export const party = () => Object.keys(S.roster).filter((id) => !inCamp(id));
// who the story needs at the army's side: Sun Quan always; Jeff's family in the first chapter and once
// everyone has gathered for the last march
export function mustTravel(id) {
  if (id === 'sunquan') return true;
  if (['jeff', 'erin', 'josh', 'jasper'].includes(id)) return S.chapter <= 1 || !!S.flags.gathered;
  return false;
}
export function toCamp(id) {
  if (!S.roster[id] || inCamp(id) || mustTravel(id)) return false;
  if (!S.camp) S.camp = [];
  S.camp.push(id); S.front = S.front.filter((x) => x !== id);
  if (S.strategist === id) S.strategist = bestStrategist();
  if (!S.front.length) { const p = party(); if (p.length) S.front.push(p[0]); }
  return true;
}
export function fromCamp(id) { if (!inCamp(id)) return false; S.camp = S.camp.filter((x) => x !== id); return true; }
// the generals the army would send to camp first: the lowest level, never one the story needs
export function campCandidates() { return party().filter((id) => !mustTravel(id)).sort((a, b) => S.roster[a].lv - S.roster[b].lv); }
export function recruit(id, lv, o = {}) {
  const g = GENERALS[id];
  if (!g || S.roster[id]) return S.roster[id];
  lv = Math.max(1, Math.min(MAXLV, lv || 1));
  const m = { id, lv, exp: 0, troops: 0, equip: fullEquip(gearFor(g, lv)), tactics: [...(g.tac || [])], loyalty: o.loyalty || 80, plus: {} };
  for (const k of Object.keys(m.equip)) if (m.equip[k] && !ITEMS[m.equip[k]]) m.equip[k] = null;
  // treasures a general brings along count as found
  for (const it of Object.values(m.equip)) if (it && ITEMS[it] && ITEMS[it].tr) markFound(it);
  S.roster[id] = m;
  learnTactics(m);
  m.troops = troopsMax(m);
  S.met[id] = 2;
  if (S.front.length < 5 && !o.reserve) S.front.push(id);
  if (!S.strategist || (g.int > GENERALS[S.strategist].int && o.makeStrategist)) S.strategist = id;
  return m;
}
export function dismiss(id) { delete S.roster[id]; S.front = S.front.filter((x) => x !== id); if (S.strategist === id) S.strategist = bestStrategist(); }
export function bestStrategist() { let b = null; for (const id of party()) if (!b || GENERALS[id].int > GENERALS[b].int) b = id; return b; }
// every slot present, empty ones as null (older gear lists had five)
export function fullEquip(e) { const o = {}; for (const s of SLOTS) o[s] = (e && e[s]) || null; return o; }
export function markFound(id) { if (!S.found) S.found = {}; if (ITEMS[id] && ITEMS[id].tr && !S.found[id]) { S.found[id] = 1; return true; } return false; }
const gearSum = (m, k) => { let t = 0; for (const s of Object.values(m.equip || {})) if (s && ITEMS[s] && ITEMS[s][k]) t += ITEMS[s][k]; return t; };
export function stat(m, k) {
  const g = GENERALS[m.id];
  const pl = (m.plus && m.plus[k]) || 0;
  if (k === 'str') return Math.min(120, g.str + pl + Math.floor(gearSum(m, 'atk') / 4));
  if (k === 'int') return Math.min(120, g.int + pl + gearSum(m, 'int'));
  if (k === 'lead') return Math.min(120, g.lead + pl + gearSum(m, 'lead'));
  if (k === 'spd') return Math.min(130, g.spd + pl + gearSum(m, 'spd'));
  return 0;
}
export const atkOf = (m) => GENERALS[m.id].str + ((m.plus && m.plus.str) || 0) + gearSum(m, 'atk');
export const defOf = (m) => Math.round(GENERALS[m.id].lead * 0.55 + gearSum(m, 'def'));
export const hasSkill = (m, s) => GENERALS[m.id].skills.includes(s);
export function troopsMax(m) { return maxTroops(m.lv, stat(m, 'lead'), hasSkill(m, 'haoling')); }
// the army's strategy pool
// treasures that add strategy points count for everyone in the front line (at most +20)
export function tpMax() {
  const s = S.strategist && S.roster[S.strategist];
  let extra = 0; for (const id of S.front || []) { const m = S.roster[id]; if (m) extra += gearFx(m.equip).sp || 0; }
  return (s ? maxTP(stat(s, 'int'), s.lv) : 10) + Math.min(20, extra);
}
// tactics a general knows: learned by level and INT, from books, or their own
export function learnTactics(m) {
  const g = GENERALS[m.id], int = stat(m, 'int'), got = [];
  for (const t of Object.values(TACTICS)) {
    if (t.enemyOnly || t.unique) continue;
    if (t.int && int >= t.int && m.lv >= t.lv && !m.tactics.includes(t.id)) { m.tactics.push(t.id); got.push(t.id); }
  }
  if (g.id === 'jeff' && S.flags.blueprint && !m.tactics.includes('huolong')) { m.tactics.push('huolong'); got.push('huolong'); }
  if (g.id === 'erin' && m.lv >= 12 && !m.tactics.includes('guanxing')) { m.tactics.push('guanxing'); got.push('guanxing'); }
  return got;
}
// tactics usable by a general in battle: their own and the strategist's
export function usableTactics(m) {
  const set = new Set(m.tactics);
  const s = S.strategist && S.roster[S.strategist];
  if (s && s.troops > 0) for (const t of s.tactics) set.add(t);
  return [...set].filter((t) => TACTICS[t] && !TACTICS[t].enemyOnly).sort((a, b) => Object.keys(TACTICS).indexOf(a) - Object.keys(TACTICS).indexOf(b));
}
export function canEquip(m, id) {
  const it = ITEMS[id]; if (!it) return false;
  if (it.kind === 'weapon') return CAN_USE[GENERALS[m.id].unit].includes(it.cat) || (it.cat === 'staff');
  if (it.kind === 'shield') { const w = m.equip && ITEMS[m.equip.weapon]; return !w || ONE_HAND.has(w.cat); }
  return ['armour', 'helm', 'cape', 'horse', 'treasure'].includes(it.kind);
}
// a weapon that needs both hands puts the shield back in the bag; returns the shield taken off
export function fitShield(m) {
  const w = m.equip && ITEMS[m.equip.weapon];
  if (m.equip.shield && w && !ONE_HAND.has(w.cat)) { const s = m.equip.shield; m.equip.shield = null; give(s); return s; }
  return null;
}
export function gainExp(m, n) {
  const ups = [];
  m.exp += n;
  while (m.lv < MAXLV && m.exp >= expFor(m.lv)) {
    m.exp -= expFor(m.lv); const before = troopsMax(m); m.lv++;
    const add = troopsMax(m) - before; m.troops = Math.min(troopsMax(m), m.troops + add);
    ups.push({ lv: m.lv, learned: learnTactics(m) });
  }
  return ups;
}
// ---------- items ----------
export const have = (id) => S.items[id] || 0;
export function give(id, n = 1) { S.items[id] = (S.items[id] || 0) + n; if (S.items[id] <= 0) delete S.items[id]; if (n > 0) markFound(id); }
export function take(id, n = 1) { if (!have(id)) return false; give(id, -n); return true; }
export function healAll(frac = 1) { for (const m of Object.values(S.roster)) m.troops = Math.min(troopsMax(m), Math.max(m.troops, 0) + Math.round(troopsMax(m) * frac)); S.tp = tpMax(); }
// ---------- formations ----------
export function formOk(id) {
  const f = FORMS[id]; if (!f.cond) return true;
  const fr = S.front.map((x) => S.roster[x]).filter(Boolean);
  const lead = fr[0];
  switch (f.cond) {
    case 'lead_str80': return !!lead && stat(lead, 'str') >= 80;
    case 'lead_lead85': return !!lead && stat(lead, 'lead') >= 85;
    case 'str_int95': { const s = S.strategist && S.roster[S.strategist]; return !!s && stat(s, 'int') >= 95; }
    case 'arc2': return fr.filter((m) => GENERALS[m.id].unit === 'arc').length >= 2;
    case 'nav3': return fr.filter((m) => GENERALS[m.id].unit === 'nav').length >= 3;
    case 'cav3': return fr.length >= 3 && fr.slice(0, 3).every((m) => GENERALS[m.id].unit === 'cav');
  }
  return true;
}
export const condText = (id) => ({ lead_str80: L('主將武力80以上', 'Leader STR 80+'), lead_lead85: L('主將統率85以上', 'Leader LEAD 85+'), str_int95: L('軍師智力95以上', 'Strategist INT 95+'), arc2: L('弓兵兩隊以上', '2+ archers'), nav3: L('水軍三隊以上', '3+ navy'), cav3: L('前三位皆騎兵', 'First three cavalry') }[FORMS[id].cond] || '');
// ---------- saving ----------
const KEY = 'jiangdong-save-';
export function save(slot) {
  try { localStorage.setItem(KEY + slot, JSON.stringify({ ...S, savedAt: Date.now() })); return true; } catch (e) { return false; }
}
export function load(slot) {
  try {
    const d = JSON.parse(localStorage.getItem(KEY + slot) || 'null');
    if (!d || !d.roster) return false;
    newGame(); Object.assign(S, d); S.wv = d.wv || 0; if (!d.camp) S.camp = [];
    migrate();
    return true;
  } catch (e) { return false; }
}
// saves from before the seven slots: capes worn as treasures move to the cape slot, Josh takes up his shield,
// and every treasure already owned counts as found
export function migrate() {
  for (const k of ['found', 'rumours', 'quests', 'codex', 'dropPity', 'sq']) if (!S[k] || typeof S[k] !== 'object') S[k] = {};
  // saves from the 256 x 192 world: everything on the world map moves to the doubled map
  if (!S.wv) {
    S.wv = 2;
    if (S.pos && S.pos.map === 'world') { S.pos.x *= 2; S.pos.y *= 2; }
    if (S.ship) { S.ship.x *= 2; S.ship.y *= 2; }
    for (const k of Object.keys(S.flags || {})) { const mm = /^secret_(\d+)_(\d+)$/.exec(k); if (mm) { delete S.flags[k]; S.flags[`secret_${mm[1] * 2}_${mm[2] * 2}`] = 1; } }
  }
  for (const m of Object.values(S.roster || {})) {
    const old = m.equip || {};
    m.equip = fullEquip(old);
    if (!m.plus) m.plus = {};
    const t = m.equip.treasure && ITEMS[m.equip.treasure];
    if (t && t.kind === 'cape') { if (!m.equip.cape) m.equip.cape = m.equip.treasure; else give(m.equip.treasure); m.equip.treasure = null; }
    if (m.id === 'josh' && old.shield === undefined) m.equip.shield = 'voyager';
    for (const it of Object.values(m.equip)) if (it) markFound(it);
  }
  for (const id of Object.keys(S.items || {})) markFound(id);
  // saves from before the camp: the eight best by level travel (front line first), the rest wait at the tavern
  if (!Array.isArray(S.camp)) S.camp = [];
  S.camp = S.camp.filter((id) => S.roster[id]);
  const p = party();
  if (p.length > PARTY_MAX) {
    const order = [...S.front.filter((id) => S.roster[id]), ...p.filter((id) => !S.front.includes(id)).sort((a, b) => S.roster[b].lv - S.roster[a].lv)];
    const keep = new Set(order.filter((id) => mustTravel(id)));
    for (const id of order) { if (keep.size >= PARTY_MAX) break; keep.add(id); }
    const sent = p.filter((id) => !keep.has(id));
    for (const id of sent) { S.camp.push(id); S.front = S.front.filter((x) => x !== id); }
    if (S.strategist && inCamp(S.strategist)) S.strategist = bestStrategist();
    S.flags.campNote = sent.length;
  }
}
export function slotInfo(slot) {
  try {
    const d = JSON.parse(localStorage.getItem(KEY + slot) || 'null');
    if (!d || !d.roster) return null;
    const lead = d.front && d.front[0] && d.roster[d.front[0]];
    return { chapter: d.chapter, lv: lead ? lead.lv : 1, n: Object.keys(d.roster).length, gold: d.gold, time: d.time || 0, at: d.savedAt || 0 };
  } catch (e) { return null; }
}
export const nameOf = (id) => genName(id);
