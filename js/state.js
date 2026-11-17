// The game state: the army (generals, their levels, troops and gear), gold, items, flags, where you are,
// and saving and loading. A general's numbers are worked out here from their base stats and gear.
import { GENERALS, gearFor, genName } from './generals.js?v=1';
import { ITEMS, TACTICS, FORMS, maxTroops, maxTP, expFor, MAXLV, CAN_USE } from './data.js?v=1';
import { L } from './i18n.js?v=1';

export const S = {};
export function newGame() {
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, {
    v: 1, chapter: 0, flags: {}, gold: 300, items: { salve: 6, wine: 2, smoke: 2 },
    roster: {}, front: [], strategist: null, formation: 'fangyuan', forms: ['fangyuan'], tp: 0,
    pos: { map: 'world', x: 238, y: 99, dir: 'd' }, vehicle: 'foot', ship: null, horse: false,
    met: {}, lastTown: 'haiyan', steps: 0, repel: 0, time: 0, battles: 0, wins: 0, captured: 0, chests: {}, visited: {},
  });
}
newGame();

// ---------- generals in the army ----------
export function member(id) { return S.roster[id] || null; }
export function recruit(id, lv, o = {}) {
  const g = GENERALS[id];
  if (!g || S.roster[id]) return S.roster[id];
  lv = Math.max(1, Math.min(MAXLV, lv || 1));
  const m = { id, lv, exp: 0, troops: 0, equip: gearFor(g, lv), tactics: [...(g.tac || [])], loyalty: o.loyalty || 80 };
  for (const k of Object.keys(m.equip)) if (m.equip[k] && !ITEMS[m.equip[k]]) m.equip[k] = null;
  S.roster[id] = m;
  learnTactics(m);
  m.troops = troopsMax(m);
  S.met[id] = 2;
  if (S.front.length < 5 && !o.reserve) S.front.push(id);
  if (!S.strategist || (g.int > GENERALS[S.strategist].int && o.makeStrategist)) S.strategist = id;
  return m;
}
export function dismiss(id) { delete S.roster[id]; S.front = S.front.filter((x) => x !== id); if (S.strategist === id) S.strategist = bestStrategist(); }
export function bestStrategist() { let b = null; for (const id of Object.keys(S.roster)) if (!b || GENERALS[id].int > GENERALS[b].int) b = id; return b; }
const gearSum = (m, k) => { let t = 0; for (const s of Object.values(m.equip || {})) if (s && ITEMS[s] && ITEMS[s][k]) t += ITEMS[s][k]; return t; };
export function stat(m, k) {
  const g = GENERALS[m.id];
  if (k === 'str') return Math.min(120, g.str + Math.floor(gearSum(m, 'atk') / 4));
  if (k === 'int') return Math.min(120, g.int + gearSum(m, 'int'));
  if (k === 'lead') return Math.min(120, g.lead + gearSum(m, 'lead'));
  if (k === 'spd') return Math.min(130, g.spd + gearSum(m, 'spd'));
  return 0;
}
export const atkOf = (m) => GENERALS[m.id].str + gearSum(m, 'atk');
export const defOf = (m) => Math.round(GENERALS[m.id].lead * 0.55 + gearSum(m, 'def'));
export const hasSkill = (m, s) => GENERALS[m.id].skills.includes(s);
export function troopsMax(m) { return maxTroops(m.lv, stat(m, 'lead'), hasSkill(m, 'haoling')); }
// the army's strategy pool
export function tpMax() { const s = S.strategist && S.roster[S.strategist]; return s ? maxTP(stat(s, 'int'), s.lv) : 10; }
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
  return ['armour', 'helm', 'horse', 'treasure'].includes(it.kind);
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
export function give(id, n = 1) { S.items[id] = (S.items[id] || 0) + n; if (S.items[id] <= 0) delete S.items[id]; }
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
    newGame(); Object.assign(S, d);
    return true;
  } catch (e) { return false; }
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
