// The story of 江東霸業傳: an alternate Three Kingdoms. In one night the Black Lotus sect murders Sun Jian and
// Sun Ce; young Sun Quan flees Jianye with a handful of loyal men, meets four shipwrecked travellers from
// beyond the western sea, wins back Jiangdong, and follows the sect's threads across the realm to its hidden
// master. This file holds the events, the people placed in towns, the chapters and the armies you meet.
import { ctx, W, H, text, textW, windowBox, canvas, hash } from './gfx.js?v=8';
import { sfx, playMusic, stopMusic } from './audio.js?v=8';
import { UI, menu, say, ask, notice, wait } from './ui.js?v=8';
import { L } from './i18n.js?v=8';
import { GENERALS, GEN_LIST, genName, gearFor } from './generals.js?v=8';
import { ITEMS, TACTICS, FORMS, itemName } from './data.js?v=8';
import { S, member, recruit, give, take, have, healAll, troopsMax, tpMax, learnTactics, gainExp } from './state.js?v=8';
import { PLACES, REGIONS, WW, WH, K, walkable as walkableK } from './world.js?v=8';
import { F, FH, toMap, toWorld, setBanner, tileX, tileY } from './field.js?v=8';
import * as FIELD from './field.js?v=8';
import { shop, inn, tavern, persuade as persuadeT, recruitLv } from './town.js?v=8';
import { placeName, CAVE_FLOORS } from './maps.js?v=8';
import { portrait } from './doll.js?v=8';
import { ADVICE } from './bosses.js?v=8';
import { populate as trPopulate, openTreasureChest, merchant, quest, bossReward, gainTreasure } from './treasure_world.js?v=8';
import { TREASURES, SRC } from './data.js?v=8';
import { populate as sqPopulate, sqTalk, sqGoal } from './sidequests.js?v=8';

export const STORY = {};
const G = () => window.G;
export const persuade = persuadeT;

// ---------- talking ----------
const nm = (who) => (who == null ? null : Array.isArray(who) ? L(who[0], who[1]) : GENERALS[who] ? genName(who) : who);
// a general (or anyone) says a line; generals show their face
export const T = (who, zh, en) => say(nm(who), L(zh, en), { face: GENERALS[who] ? who : null });
const N = (zh, en) => say(null, L(zh, en));
UI.face = (who, check) => {
  const g = GENERALS[who]; if (!g) return null;
  if (check) return true;
  const m = member(who);
  return portrait(g.look, m ? m.equip : g.gear || gearFor(g, 20), { shield: g.shield, quiver: g.quiver });
};
const choose = (who, zh, en, opts) => ask(nm(who), L(zh, en), opts.map(([a, b]) => L(a, b)));
async function join(id, lv, quiet = false) {
  const m = recruit(id, lv, { reserve: S.front.length >= 5 });
  S.flags['gone_' + id] = 1;
  if (!quiet) { sfx('level'); await N(`${GENERALS[id].zh}加入了！`, `${GENERALS[id].en} joins the army!`); }
  return m;
}
const has = (id) => !!S.roster[id];
const lvNow = () => { const ms = Object.values(S.roster); return ms.length ? Math.round(ms.reduce((t, m) => t + m.lv, 0) / ms.length) : 1; };
// ---------- staging ----------
const DV = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
function actor(id, x, y, dir = 'd') {
  const g = GENERALS[id], m = member(id);
  const e = { type: 'npc', id: 'act_' + id, look: g ? g.look : id, equip: m ? m.equip : g ? (g.gear || gearFor(g, 20)) : {}, opts: g ? { shield: g.shield, quiver: g.quiver } : {}, x, y, px: x * 16, py: y * 16, dir, actor: true };
  F.ents.push(e);
  return e;
}
function folk(look, x, y, dir = 'd', id = 'folkact') { const e = { type: 'npc', id, look, x, y, px: x * 16, py: y * 16, dir, actor: true }; F.ents.push(e); return e; }
async function move(e, path) {
  for (const d of path) {
    e.dir = d; const [dx, dy] = DV[d];
    for (let i = 0; i < 16; i++) { e.px += dx; e.py += dy; e.at = (e.at || 0) + 1; e.mv = null; e.walking = true; await wait(1); }
    e.walking = false;
  }
  e.x = Math.round(e.px / 16); e.y = Math.round(e.py / 16);
}
const drop = (e) => { const i = F.ents.indexOf(e); if (i >= 0) F.ents.splice(i, 1); };
const clearActors = () => { F.ents = F.ents.filter((e) => !e.actor); };
// a chapter card across the screen
let card = null;
STORY.overlay = () => {
  if (card) {
    card.t++;
    const a = Math.min(1, card.t / 20, (card.len - card.t) / 20);
    if (a <= 0) { card = null; return; }
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = 'rgba(10,4,6,0.85)'; ctx.fillRect(0, 96, W, 70);
    ctx.fillStyle = '#9a2418'; ctx.fillRect(0, 96, W, 2); ctx.fillRect(0, 164, W, 2);
    text(card.a, W / 2, 108, '#e0b858', { align: 'center' });
    const b = card.b, c = canvas(textW(b) + 4, 16); text(b, 1, 1, '#f8e8c0', { g: c.x, shadow: '#3a0a08' });
    ctx.drawImage(c, Math.round(W / 2 - c.width), 124, c.width * 2, c.height * 2);
    ctx.globalAlpha = 1;
  }
  if (STORY.dark) { ctx.fillStyle = `rgba(0,0,0,${STORY.dark})`; ctx.fillRect(0, 0, W, H); }
};
export async function chapter(n, zh, en) {
  S.chapter = n;
  card = { a: L(`第${['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][n]}章`, `Chapter ${n}`), b: L(zh, en), t: 0, len: 200 };
  sfx('toll');
  await wait(200);
}
const fade = (fn) => G().fade(fn);
const battle = (cfg) => G().battle(cfg);

// ---------- the armies you meet ----------
const FACTION_FOR = {};
export function encounterArmy(info) {
  let rk = info.region;
  let bonus = 0;
  if (info.place) { rk = PLACES[info.place][5]; bonus = 2; }
  // the hidden abyss under a cave (a trial) holds the sect's oldest and strongest
  const abyss = info.place && info.floor > (CAVE_FLOORS[info.place] || 9);
  if (abyss) bonus = 33;
  const R = REGIONS[rk]; if (!R) return null;
  const lo = R[5] + bonus, hi = R[6] + bonus;
  const fac = info.place === 'wuxia' || abyss ? 'sect' : (S.flags['beaten_' + R[7]] && R[7] !== 'sect' ? (Math.random() < 0.5 ? 'sect' : R[7]) : R[7]);
  let pool = FACTION_FOR[fac] || (FACTION_FOR[fac] = GEN_LIST.filter((g) => g.faction === fac && !g.famous));
  pool = pool.filter((g) => !S.roster[g.id]);
  if (pool.length < 4) pool = GEN_LIST.filter((g) => !g.famous && !S.roster[g.id] && (g.faction === 'sect' || g.faction === 'free'));
  // the sect's agents turn up everywhere
  const sectPool = FACTION_FOR.sect || (FACTION_FOR.sect = GEN_LIST.filter((g) => g.faction === 'sect' && !g.famous));
  const avg = (lo + hi) / 2;
  // a region's armies are fixed in strength (never scaled to the player): later lands field fuller, fiercer armies
  const ch = R[4] || 1, troopMul = 1.5 + 0.04 * ch, atkMul = 1.12 + 0.015 * ch;
  const n = avg < 4 ? 1 + (Math.random() < 0.5 ? 1 : 0) : avg < 10 ? 2 + (Math.random() < 0.5 ? 1 : 0) : avg < 22 ? 2 + Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 3);
  const foes = [], used = new Set();
  for (let i = 0; i < n; i++) {
    const src = Math.random() < 0.12 ? sectPool : pool;
    let g = src[Math.floor(Math.random() * src.length)], t = 0;
    while (used.has(g.id) && t++ < 10) g = src[Math.floor(Math.random() * src.length)];
    used.add(g.id);
    foes.push({ id: g.id, lv: lo + Math.floor(Math.random() * (hi - lo + 1)), mul: troopMul, atkMul });
  }
  // from the second chapter's lands on, an army often brings a strategist who casts ploys
  if (ch >= 2 && foes.length >= 2 && Math.random() < 0.6) {
    const clever = (src) => src.filter((g) => g.int >= 70 && !used.has(g.id));
    const c = clever(pool).length ? clever(pool) : clever(sectPool);
    if (c.length) foes[foes.length - 1].id = c[Math.floor(Math.random() * c.length)].id;
  }
  if (info.naval) for (const f of foes) f.lv = Math.max(f.lv, lo);
  return { foes, form: ['fangyuan', 'yulin', 'heyi', 'changshe', 'fengshi'][Math.floor(Math.random() * (avg > 20 ? 5 : 3))] };
}
export function regionLockText(rk) {
  const R = REGIONS[rk];
  return L(`前往${R ? R[0] : '前方'}的道路被重兵封鎖，現在還過不去。`, `The road into ${R ? R[1] : 'that land'} is held by a strong army. You cannot pass yet.`);
}

// ---------- bosses ----------
// each boss fight: who stands against you, how strong, and where
export const BOSSES = {
  tianzhu: { foes: [{ id: 'g325', lv: 23, boss: true, tr: 2 }, { id: 'g326', lv: 20, tr: 1 }, { id: 'g329', lv: 20, tr: 1 }, { id: 'g327', lv: 20, tr: 1, sage: true }], terrain: 'cave', music: 'sectboss' },
  jiuyi: { foes: [{ id: 'g328', lv: 44, boss: true, tr: 5 }, { id: 'g329', lv: 41, tr: 4 }, { id: 'g330', lv: 41, tr: 4 }, { id: 'g331', lv: 41, tr: 4, sage: true }], terrain: 'cave', music: 'sectboss' },
  pirates: { foes: [{ id: 'g400', lv: 51, boss: true, tr: 6 }, { id: 'g401', lv: 48, tr: 5 }, { id: 'g402', lv: 48, tr: 5 }, { id: 'g403', lv: 48, tr: 5, sage: true }], terrain: 'river', naval: true, music: 'boss' },
  prologue: { foes: [{ id: 'g300', lv: 4, mul: 0.9 }, { id: 'g301', lv: 4, mul: 0.9 }, { id: 'g302', lv: 3, mul: 0.9 }], terrain: 'castle', music: 'battle', canRun: false, mayLose: false },
  beach: { foes: [{ id: 'g010', lv: 2 }, { id: 'g011', lv: 2 }], terrain: 'grass', music: 'battle' },
  yanbaihu: { foes: [{ id: 'yanbaihu', lv: 16, boss: true, tr: 1 }, { id: 'g012', lv: 14, tr: 1 }, { id: 'g015', lv: 14, tr: 1 }, { id: 'g303', lv: 14, tr: 1 }], terrain: 'castle', foeForm: 'yulin' },
  zulang: { foes: [{ id: 'zulang', lv: 15, boss: true, tr: 1 }, { id: 'g013', lv: 12, tr: 1 }, { id: 'g014', lv: 12, tr: 1 }, { id: 'g016', lv: 12, tr: 1 }], terrain: 'cave', foeForm: 'yulin' },
  liuxun: { foes: [{ id: 'liuxun', lv: 21, boss: true, tr: 2 }, { id: 'g304', lv: 19, tr: 1 }, { id: 'g060', lv: 19, tr: 1 }, { id: 'g061', lv: 18, tr: 1, sage: true }], terrain: 'castle', foeForm: 'changshe' },
  qua: { foes: [{ id: 'g036', lv: 24, tr: 3 }, { id: 'g037', lv: 23, tr: 2 }, { id: 'g043', lv: 23, tr: 2 }, { id: 'g038', lv: 22, tr: 2, sage: true }], terrain: 'grass' },
  moling: { foes: [{ id: 'g039', lv: 26, tr: 3 }, { id: 'g040', lv: 24, tr: 2 }, { id: 'g041', lv: 24, tr: 2 }, { id: 'g305', lv: 24, tr: 2, sage: true }], terrain: 'castle' },
  sunhao: { foes: [{ id: 'sunhao', lv: 26, boss: true, tr: 3 }, { id: 'yanwu', lv: 27, boss: true, tr: 3 }, { id: 'g042', lv: 23, tr: 2 }, { id: 'g306', lv: 23, tr: 2, sage: true }], terrain: 'castle', foeForm: 'fengshi', music: 'boss' },
  xisai: { foes: [{ id: 'chenjiu', lv: 32, boss: true, tr: 4 }, { id: 'g070', lv: 29, tr: 3 }, { id: 'g071', lv: 29, tr: 3 }, { id: 'g072', lv: 29, tr: 3, sage: true }], terrain: 'river', naval: true, foeForm: 'changshe' },
  huangzu: { foes: [{ id: 'huangzu', lv: 41, boss: true, tr: 4 }, { id: 'g073', lv: 38, tr: 3 }, { id: 'g074', lv: 38, tr: 3 }, { id: 'g307', lv: 38, tr: 3, sage: true }], terrain: 'castle', foeForm: 'fangyuan' },
  changsha: { foes: [{ id: 'g090', lv: 38, tr: 5 }, { id: 'g091', lv: 36, tr: 4 }, { id: 'g092', lv: 36, tr: 4 }, { id: 'g093', lv: 36, tr: 4, sage: true }], terrain: 'castle' },
  caimao: { foes: [{ id: 'caimao', lv: 44, boss: true, tr: 5 }, { id: 'chaoyin', lv: 45, boss: true, tr: 5 }, { id: 'zhangyun', lv: 41, tr: 4 }, { id: 'g094', lv: 41, tr: 4, sage: true }], terrain: 'castle', foeForm: 'yulin', music: 'boss' },
  fleet1: { foes: [{ id: 'yuejin', lv: 49, tr: 6 }, { id: 'g110', lv: 46, tr: 5 }, { id: 'g111', lv: 46, tr: 5 }, { id: 'g112', lv: 46, tr: 5, sage: true }], terrain: 'river', naval: true },
  fleet2: { foes: [{ id: 'yujin', lv: 44, boss: true, tr: 6 }, { id: 'chaoyin', lv: 44, boss: true, tr: 6 }, { id: 'g113', lv: 41, tr: 5 }, { id: 'g308', lv: 41, tr: 5, sage: true }], terrain: 'river', naval: true, foeForm: 'shuijun', music: 'boss' },
  yuanshu: { foes: [{ id: 'yuanshu', lv: 53, boss: true, tr: 7 }, { id: 'jiling', lv: 53, boss: true, tr: 7 }, { id: 'g130', lv: 51, tr: 6 }, { id: 'g131', lv: 51, tr: 6, sage: true }], terrain: 'castle', foeForm: 'yulin' },
  guandu: { foes: [{ id: 'yanliang', lv: 44, boss: true, tr: 7 }, { id: 'wenchou', lv: 44, boss: true, tr: 7 }, { id: 'g132', lv: 41, tr: 6 }, { id: 'g133', lv: 41, tr: 6 }, { id: 'g134', lv: 41, tr: 6, sage: true }], terrain: 'grass', foeForm: 'tuzhen', music: 'boss' },
  yuanshao: { foes: [{ id: 'yuanshao', lv: 50, boss: true, tr: 7 }, { id: 'shuangjing', lv: 51, boss: true, tr: 7 }, { id: 'shenpei', lv: 48, tr: 6 }, { id: 'g135', lv: 48, tr: 6, sage: true }], terrain: 'castle', foeForm: 'changshe', music: 'boss' },
  hulao: { foes: [{ id: 'huaxiong', lv: 62, boss: true, tr: 8 }, { id: 'g150', lv: 60, tr: 7 }, { id: 'g151', lv: 60, tr: 7 }, { id: 'g155', lv: 60, tr: 7, sage: true }], terrain: 'castle', foeForm: 'fangyuan' },
  tongguan: { foes: [{ id: 'lijue', lv: 61, boss: true, tr: 8 }, { id: 'guosi', lv: 61, boss: true, tr: 8 }, { id: 'g154', lv: 58, tr: 7 }, { id: 'g152', lv: 58, tr: 7, sage: true }], terrain: 'mountain', foeForm: 'fengshi' },
  dongzhuo: { foes: [{ id: 'dongzhuo', lv: 67, boss: true, tr: 8 }, { id: 'liru', lv: 64, tr: 7 }, { id: 'zhangxiu', lv: 64, tr: 7 }, { id: 'g153', lv: 63, tr: 7, sage: true }], terrain: 'castle', foeForm: 'fangyuan', music: 'boss' },
  jianye2: { foes: [{ id: 'g310', lv: 75, tr: 9 }, { id: 'g311', lv: 74, tr: 8 }, { id: 'g312', lv: 74, tr: 8 }, { id: 'g313', lv: 74, tr: 8, sage: true }], terrain: 'castle' },
  jiyuan: { foes: [{ id: 'jiyuan', lv: 73, boss: true, tr: 9 }, { id: 'mingzhao', lv: 73, boss: true, tr: 9 }, { id: 'g314', lv: 70, tr: 8 }, { id: 'g315', lv: 70, tr: 8, sage: true }], terrain: 'sect', foeForm: 'fengshi', music: 'sectboss' },
  zhangren: { foes: [{ id: 'zhangren', lv: 73, boss: true, tr: 9 }, { id: 'g170', lv: 70, tr: 8 }, { id: 'g171', lv: 70, tr: 8 }, { id: 'g172', lv: 70, tr: 8, sage: true }], terrain: 'mountain', foeForm: 'yanxing' },
  yanwu: { foes: [{ id: 'yanwu', lv: 81, boss: true, tr: 9 }, { id: 'g316', lv: 78, tr: 8 }, { id: 'g317', lv: 78, tr: 8 }, { id: 'g318', lv: 78, tr: 8, sage: true }], terrain: 'sect', foeForm: 'yulin', music: 'sectboss' },
  lotus1: { foes: [{ id: 'shuangjing', lv: 68, boss: true, tr: 10 }, { id: 'g319', lv: 65, tr: 9 }, { id: 'g318', lv: 65, tr: 9 }, { id: 'g320', lv: 65, tr: 9, sage: true }], terrain: 'sect', foeForm: 'changshe', music: 'sectboss' },
  lotus2: { foes: [{ id: 'mingzhao', lv: 76, boss: true, tr: 10 }, { id: 'g321', lv: 73, tr: 9 }, { id: 'g317', lv: 73, tr: 9 }, { id: 'g322', lv: 73, tr: 9, sage: true }], terrain: 'sect', foeForm: 'fengshi', music: 'sectboss' },
  yuji1: { foes: [{ id: 'yuji', lv: 82, boss: true, tr: 10 }, { id: 'g323', lv: 77, tr: 9 }, { id: 'g316', lv: 77, tr: 9 }, { id: 'g324', lv: 77, tr: 9, sage: true }], terrain: 'sect', foeForm: 'fangyuan', music: 'finalboss', canRun: false },
  yuji2: { foes: [{ id: 'yuji', lv: 76, boss: true, tr: 10 }, { id: 'g326', lv: 71, tr: 10 }, { id: 'g327', lv: 71, tr: 10 }, { id: 'g328', lv: 70, tr: 9, sage: true }], terrain: 'sect', foeForm: 'yanyue', music: 'finalboss', canRun: false, intro: ['黑蓮聖主現出了真身！', 'The Lord of the Black Lotus shows his true form!'] },
};
// some of the generated generals are written into the story as the sect's and the rebels' officers;
// make sure the ids used above belong to the right side (they are reassigned at start)
const STORY_SIDE_UNUSED = { g300: 'sect', g301: 'sect', g302: 'sect', g303: 'sect', g304: 'sect', g305: 'sect', g306: 'sect', g307: 'sect', g308: 'sect', g310: 'sect', g311: 'sect', g312: 'sect', g313: 'sect', g314: 'sect', g315: 'sect', g316: 'sect', g317: 'sect', g318: 'sect', g319: 'sect', g320: 'sect', g321: 'sect', g322: 'sect', g323: 'sect', g324: 'sect' };
void STORY_SIDE_UNUSED;
export function bossFor(id) { return BOSSES[id]; }
// officers named gNNN in the table are stand-ins: each becomes the Nth officer of the side that fights
const SECT_FIGHTS = new Set(['prologue', 'jianye2', 'jiyuan', 'yanwu', 'lotus1', 'lotus2', 'yuji1', 'yuji2', 'tianzhu', 'jiuyi']);
const SIDE_OF = { pirates: 'pirate' };
function officers(bossId, b) {
  const main = b.foes.find((f) => !/^g\d+$/.test(f.id));
  const fac = SIDE_OF[bossId] || (SECT_FIGHTS.has(bossId) || !main ? 'sect' : GENERALS[main.id].faction);
  const pool = GEN_LIST.filter((g) => !g.famous && g.faction === fac && !S.roster[g.id]);
  const any = pool.length ? pool : GEN_LIST.filter((g) => !g.famous && g.faction === 'sect');
  const sages = any.filter((g) => g.int >= 72).sort((a, b) => b.int - a.int);
  // never the same officer twice in one army
  const used = new Set(b.foes.filter((f) => !/^g\d+$/.test(f.id)).map((f) => f.id));
  return b.foes.map((f) => {
    if (!/^g\d+$/.test(f.id)) return { ...f };
    const list = f.sage && sages.length ? sages : any, n = parseInt(f.id.slice(1), 10) % (f.sage ? Math.min(3, list.length) : list.length);
    let g = list[n]; for (let k = 1; used.has(g.id) && k < list.length; k++) g = list[(n + k) % list.length];
    used.add(g.id); return { ...f, id: g.id };
  });
}
// an adviser's hint before a leader's fight (bosses.js): formation, unit types, traits and gear to answer him with
async function advise(id) {
  const k = ADVICE[id];
  if (!k) return;
  const [who, zh, en] = k;
  const sp = who.find((w) => has(w) || (w === 'zhuzhi' && S.flags.metZhuzhi)) || (has('erin') ? 'erin' : null);
  if (sp) await T(sp, zh, en);
}
async function fight(id, extra = {}) {
  const b = BOSSES[id];
  const firstTime = !S.flags['won_' + id];
  await advise(id);
  // tests may raise a leader's army while tuning (G.bossTune: levels added)
  const tune = (window.G && window.G.bossTune) || 0;
  const cfg = { ...b, foes: officers(id, b).map((f) => ({ ...f, lv: f.lv + (typeof tune === 'object' ? tune[id] || 0 : tune) })), boss: b.foes.some((f) => f.boss), intro: b.intro ? L(b.intro[0], b.intro[1]) : undefined, capture: false, bossId: id, ...extra };
  for (const f of cfg.foes) S.met[f.id] = Math.max(S.met[f.id] || 0, 1);
  sfx('encounter');
  const r = await battle(cfg);
  if (r === 'win') S.flags['won_' + id] = 1;
  if (r === 'win' && firstTime && !extra.noReward) await bossReward(id);
  return r;
}
STORY.fight = fight;

// ---------- the opening ----------
export async function runIntro() {
  stopMusic();
  STORY.dark = 1;
  await wait(30);
  await N('建安五年，春。天下大亂，群雄並起。', 'The fifth year of Jian\'an, spring. The realm is in chaos and warlords rise everywhere.');
  await N('江東猛虎孫堅與其長子孫策，以建業為根基，威震東南。', 'Sun Jian, the Tiger of Jiangdong, and his eldest son Sun Ce rule the south-east from Jianye.');
  await N('然而這一夜，建業城中燈火通明——', 'And on this night, every lamp in Jianye is lit—');
  // the feast in the hall
  toMap('jianye/hall');
  clearActors();
  F.ents = F.ents.filter((e) => e.type !== 'npc');
  const jian = actor('sunjian', 8, 3, 'd'), ce = actor('sunce', 7, 5, 'r'), quan = actor('sunquan', 9, 5, 'l'), tai = actor('zhoutai', 3, 8, 'r'), xiang = actor('shangxiang', 12, 6, 'l'), ji = actor('jiyuan', 11, 4, 'l');
  F.px = 8 * 16; F.py = 9 * 16; F.hideLeader = true;
  STORY.dark = 0;
  playMusic('castle');
  await T('sunjian', '今日一醉方休！江東已定，明年便北上，問鼎中原！', 'Drink tonight! Jiangdong is ours. Next year we march north for the heart of the realm!');
  await T('sunce', '父親，我願為先鋒！仲謀，你也來？', 'Father, let me lead the vanguard! Zhongmou, you too?');
  await T('sunquan', '大哥……我還是留下來，幫季老整理糧冊吧。', 'Brother... I think I will stay and help Elder Ji with the grain ledgers.');
  await T('sunce', '哈哈！我這個弟弟，打仗不行，算帳倒是一把好手！', 'Ha! My little brother: no good in a fight, but give him an abacus!');
  await T('shangxiang', '二哥才不是不行！他只是……比較喜歡想。', 'Second Brother is not "no good"! He just... likes to think first.');
  await T('jiyuan', '呵呵。主公，二公子心思縝密，將來必成大器。', 'Heh heh. My lord, the second young master has a careful mind. He will be great one day.');
  await T('sunjian', '季淵啊，你教了他十年，總是誇他。……嗯？這酒味道——', 'Ji Yuan, you have tutored him ten years and you only ever praise him. ...Hm? This wine tastes—');
  sfx('hurt'); STORY.flash = 1;
  await wait(20);
  await T('sunjian', '……毒……酒中有毒！', '...Poison... the wine is poisoned!');
  playMusic('tension');
  const a1 = folk('b=m s=light h=buzz hc=black t=robe tc=black l=pants lc=black f=boots hat=hb_hood hatc=black', 2, 3, 'r', 'assassin1');
  const a2 = folk('b=m s=light h=buzz hc=black t=robe tc=black l=pants lc=black f=boots hat=hb_hood hatc=black', 14, 3, 'l', 'assassin2');
  const a3 = folk('b=m s=light h=buzz hc=black t=robe tc=black l=pants lc=black f=boots hat=hb_hood hatc=black', 8, 10, 'u', 'assassin3');
  await N('黑衣人從樑上、從屏風後湧出。他們的衣襟上，繡著一朵黑色的蓮花。', 'Men in black pour from the rafters and from behind the screens. On their collars is embroidered a black lotus.');
  await T(['刺客', 'Assassin'], '黑蓮開時，天下歸一。孫家，今夜到此為止。', 'When the black lotus blooms, the realm is made one. The house of Sun ends tonight.');
  await T('sunce', '仲謀！帶小妹走！周泰，護住他們！', 'Zhongmou! Take our sister and go! Zhou Tai, guard them!');
  await T('sunquan', '大哥！我不走——', 'Brother! I won\'t leave—');
  await T('sunce', '走！！江東……就交給你了！', 'GO!! Jiangdong... is yours now!');
  // a short fight to break out of the hall
  S.roster = {}; S.front = [];
  recruit('sunce', 6); recruit('sunquan', 3); recruit('zhoutai', 4);
  S.formation = 'fangyuan'; S.tp = tpMax();
  F.hideLeader = false;
  await fight('prologue', { mayLose: true });
  // whatever happened, the brothers part
  F.hideLeader = true;
  await T('sunce', '……我擋住他們。你們從後門的水道走，順江而下！', '...I will hold them. Go by the water gate at the back and down the river!');
  await T('zhoutai', '二公子，得罪了！', 'Forgive me, young master!');
  await N('周泰一把扛起孫權，孫尚香咬著牙跟上。身後的大殿，燃起了沖天大火。', 'Zhou Tai throws Sun Quan over his shoulder; Sun Shangxiang follows with her teeth set. Behind them the great hall bursts into flame.');
  STORY.dark = 1;
  stopMusic(1);
  await wait(40);
  clearActors(); drop(a1); drop(a2); drop(a3); void jian; void ce; void quan; void tai; void xiang; void ji;
  F.hideLeader = false;
  // a new beginning on the coast
  S.roster = {}; S.front = []; S.strategist = null;
  await join('sunquan', 2, true); await join('zhoutai', 3, true); await join('shangxiang', 2, true);
  S.strategist = 'sunquan';
  S.gold = 200; S.items = { salve: 5, wine: 1, smoke: 1 };
  healAll(1);
  await N('三日後。東海之濱，海鹽縣。', 'Three days later. Haiyan, on the shore of the Eastern Sea.');
  await N('消息傳來：孫堅、孫策，皆死於建業之夜。叛將孫暠據城自立，宣稱孫權弒父弒兄，懸賞千金。', 'The news has come: Sun Jian and Sun Ce both died that night in Jianye. Their cousin Sun Hao has seized the city and declared that Sun Quan murdered them. There is a thousand-gold price on his head.');
  S.flags.ch1 = 1;
  toMap('haiyan', 13, 12, 'd');
  STORY.dark = 0;
  await chapter(1, '血夜之後', 'After the Night of Blood');
  playMusic('village');
  await T('sunquan', '……父親，大哥。', '...Father. Brother.');
  await T('shangxiang', '二哥。別哭了……不，你要哭就哭吧。我也想哭。', 'Second Brother. Don\'t cry... no, cry if you want. I want to cry too.');
  await T('zhoutai', '二公子。末將這條命，從今以後是你的。', 'Young master. From this day my life is yours.');
  await T('sunquan', '……謝謝你，周泰。我們先打聽消息。聽說吳郡的朱治將軍還忠於孫家。', '...Thank you, Zhou Tai. First we need news. They say General Zhu Zhi in Wu is still loyal to our family.');
  await T('shangxiang', '對了，村裡的人一直在說什麼「海妖」。好像在東邊的海灘上。', 'Oh, and the villagers keep talking about "sea demons". On the beach to the east, it seems.');
  S.flags.ch1 = 1;
}

// ---------- people placed in towns ----------
// [map, general, x, y, dir, condition, talk]
const PEOPLE = [];
function person(map, id, x, y, dir, cond, talk) { PEOPLE.push({ map, id, x, y, dir, cond, talk: talk || id }); }
FH.populate = (mapId, ents) => {
  for (const p of PEOPLE) {
    if (p.map !== mapId || (p.cond && !p.cond()) || has(p.id)) continue;
    const g = GENERALS[p.id];
    ents.push({ type: 'npc', id: 'p_' + p.id, look: g.look, equip: g.gear || gearFor(g, 20), opts: { shield: g.shield, quiver: g.quiver }, x: p.x, y: p.y, dir: p.dir, talk: 'p:' + p.talk, mark: p.mark ? p.mark() : false });
  }
  // the beached ship's people
  if (mapId === 'haiyan' && S.flags.ch1 && !S.flags.westerners) {
    for (const [id, x, y] of [['jeff', 22, 16], ['erin', 23, 15], ['josh', 21, 15], ['jasper', 24, 16]]) { const g = GENERALS[id]; ents.push({ type: 'npc', id: 'p_' + id, look: g.look, equip: g.gear, opts: { shield: g.shield, quiver: g.quiver }, x, y, dir: 'l', talk: 'p:shipwreck' }); }
  }
  trPopulate(mapId, ents);
  sqPopulate(mapId, ents);
};
// chapter 1
person('wu/hall', 'zhuzhi', 8, 4, 'd', () => true, 'zhuzhi');
person('wu', 'lingcao', 12, 18, 'd', () => S.flags.metZhuzhi, 'lingcao');
person('wucheng', 'dongxi', 6, 6, 'd', () => S.flags.won_yanbaihu, 'dongxi');
// chapter 2
person('juchao', 'lusu', 12, 9, 'd', () => S.chapter >= 2, 'lusu');
person('shu/hall', 'zhouyu', 8, 4, 'd', () => S.chapter >= 2, 'zhouyu');
person('shu/hall', 'xiaoqiao', 10, 5, 'd', () => S.chapter >= 2 && has('zhouyu'), 'xiaoqiao');
person('shu', 'daqiao', 9, 14, 'd', () => S.chapter >= 2, 'daqiao');
person('shu', 'lumeng', 20, 12, 'l', () => S.chapter >= 2 && S.flags.won_liuxun, 'lumeng');
person('shu', 'jiangqin', 6, 16, 'r', () => S.chapter >= 2 && S.flags.won_liuxun, 'jiangqin');
// chapter 3
person('qua', 'chengpu', 12, 12, 'd', () => S.chapter >= 3, 'oldguard');
person('qua', 'huanggai', 14, 12, 'd', () => S.chapter >= 3, 'oldguard');
person('qua', 'handang', 16, 12, 'd', () => S.chapter >= 3, 'oldguard');
person('jianye/hall', 'zhangzhao', 6, 5, 'r', () => S.chapter >= 4 && !S.flags.betrayal, 'zhangzhao');
person('jianye/hall', 'guyong', 10, 5, 'l', () => S.chapter >= 4 && !S.flags.betrayal, 'guyong');
person('jianye/hall', 'jiyuan', 8, 6, 'u', () => S.chapter >= 4 && !S.flags.betrayal, 'jiyuan');
person('jianye', 'lingtong', 18, 22, 'd', () => S.chapter >= 4, 'lingtong');
person('jianan', 'heqi', 14, 10, 'd', () => S.chapter >= 3, 'heqi');
person('jianye', 'chenwu', 26, 20, 'l', () => S.chapter >= 4, 'chenwu');
// chapter 4
person('yuzhang', 'taishici', 20, 14, 'd', () => S.chapter >= 4, 'taishici');
person('chaisang', 'zhuhuan', 14, 18, 'd', () => S.chapter >= 4, 'joiner');
person('xisai', 'ganning', 15, 9, 'd', () => S.chapter >= 4 && S.flags.won_xisai, 'ganning');
person('xiakou', 'sufei', 12, 14, 'd', () => S.flags.won_huangzu, 'joiner');
// chapter 5
person('changsha', 'huangzhong', 20, 12, 'd', () => S.chapter >= 5, 'huangzhong');
person('changsha', 'weiyan', 22, 13, 'l', () => S.chapter >= 5 && S.flags.won_changsha, 'joiner');
person('jiangling/hall', 'liuqi', 8, 4, 'd', () => S.chapter >= 5, 'liuqi');
person('xinye', 'liubei', 15, 12, 'd', () => S.chapter >= 5 && !S.flags.alliedLiu, 'liubei');
person('longzhong', 'zhugeliang', 12, 8, 'd', () => S.chapter >= 5, 'zhugeliang');
person('xinye', 'zhaoyun', 14, 14, 'd', () => S.chapter >= 5 && S.flags.alliedLiu, 'zhaoyun');
person('xiangyang', 'wenpin', 18, 14, 'd', () => S.flags.won_caimao, 'joiner');
person('wuling', 'zhuran', 10, 10, 'd', () => S.chapter >= 5, 'joiner');
person('lingling', 'luxun', 14, 12, 'd', () => S.chapter >= 5, 'luxun');
// chapter 6
person('chaisang', 'xusheng', 18, 18, 'l', () => S.chapter >= 6, 'joiner');
person('chaisang', 'dingfeng', 20, 19, 'l', () => S.chapter >= 6, 'joiner');
// chapter 7
person('hefei/hall', 'zhangliao', 8, 4, 'd', () => S.chapter >= 7, 'zhangliao');
person('xuchang/hall', 'caocao', 8, 4, 'd', () => S.chapter >= 7, 'caocao');
person('xuchang/hall', 'guojia', 10, 5, 'l', () => S.chapter >= 7, 'guojia');
person('ye', 'tianfeng', 14, 12, 'd', () => S.flags.won_yuanshao, 'joiner');
person('ye', 'jushou', 16, 12, 'd', () => S.flags.won_yuanshao, 'joiner');
person('ye', 'zhanghe', 18, 12, 'd', () => S.flags.won_yuanshao, 'joiner');
person('nanpi', 'gaolan', 12, 12, 'd', () => S.flags.won_yuanshao, 'joiner');
person('ji', 'gongsunzan', 16, 14, 'd', () => S.chapter >= 7, 'joiner');
person('linzi', 'panzhang', 12, 12, 'd', () => S.chapter >= 7, 'joiner');
// chapter 8
person('changan', 'diaochan', 12, 12, 'd', () => S.chapter >= 8 && !S.flags.won_dongzhuo, 'diaochan');
person('meiwu', 'lubu', 15, 8, 'd', () => S.flags.won_dongzhuo, 'lubu');
person('meiwu', 'gaoshun', 13, 9, 'd', () => S.flags.won_dongzhuo, 'joiner');
person('meiwu', 'chengong', 17, 9, 'd', () => S.flags.won_dongzhuo, 'joiner');
person('tianshui', 'jiangwei', 14, 12, 'd', () => S.chapter >= 8, 'joiner');
person('wuwei', 'machao', 14, 12, 'd', () => S.chapter >= 8, 'machao');
person('wuwei', 'madai', 16, 12, 'l', () => S.chapter >= 8 && has('machao'), 'joiner');
person('huashan/shrine', 'pangde', 4, 6, 'r', () => S.chapter >= 8, 'joiner');
// chapter 9
person('chengdu/hall', 'fazheng', 6, 5, 'r', () => S.flags.won_zhangren, 'joiner');
person('chengdu', 'yanyan', 16, 14, 'd', () => S.flags.won_zhangren, 'joiner');
person('jianning', 'zhurong', 14, 12, 'd', () => S.chapter >= 9, 'joiner');
person('jianning', 'menghuo', 12, 12, 'd', () => S.chapter >= 9, 'joiner');
person('panyu/hall', 'shixie', 8, 4, 'd', () => S.chapter >= 5, 'joiner');

// ---------- talking to people ----------
const FOLK = {
  1: [['聽說孫家的二公子逃出來了。', 'They say the Sun family\'s second son got away.'], ['山越的強盜越來越囂張了。', 'The Shanyue bandits grow bolder every day.'], ['烏程的嚴白虎自稱「東吳德王」，笑死人。', 'Yan Baihu of Wucheng calls himself "Virtuous King of Wu". What a joke.'], ['海邊漂來了奇怪的大船殘骸。', 'Strange wreckage from a great ship washed up on the shore.'], ['最近夜裡常有穿黑衣的人在村外走動。', 'Lately men in black walk outside the village at night.']],
  2: [['周郎在舒縣招兵，年輕人都去了。', 'Zhou the Young Master is raising troops in Shu. All the young men have gone.'], ['皖城的劉勳搜刮得很兇。', 'Liu Xun of Wan bleeds his people dry.'], ['過江要從牛渚坐渡船。', 'To cross the river, take the ferry at Niuzhu.'], ['魯家的公子把糧倉都分給窮人了。', 'The young master of the Lu family gave his granary away to the poor.']],
  3: [['建業城裡，孫暠的兵四處抓人。', 'In Jianye, Sun Hao\'s soldiers seize people everywhere.'], ['老將軍們被孫暠軟禁在曲阿。', 'The old generals are kept under guard in Qu\'a by Sun Hao.'], ['聽說孫二公子和幾個紅頭髮的海外人在一起。', 'They say young master Sun travels with some red-haired people from over the sea.']],
  4: [['江夏的黃祖是孫家的世仇。', 'Huang Zu of Jiangxia is the Sun family\'s old enemy.'], ['甘寧那傢伙，帶鈴鐺的錦帆賊，聽說在黃祖手下很不得志。', 'Gan Ning, the bell-wearing brocade-sail pirate, is said to be unhappy under Huang Zu.'], ['豫章有個神射手，叫太史慈。', 'There is a great archer in Yuzhang called Taishi Ci.']],
  5: [['劉表大人病得很重……', 'Lord Liu Biao is gravely ill...'], ['蔡瑁把持了荊州的水軍。', 'Cai Mao holds Jing\'s navy in his fist.'], ['隆中有位臥龍先生。', 'In Longzhong lives a man they call the Sleeping Dragon.'], ['新野的劉皇叔是個好人。', 'Imperial Uncle Liu of Xinye is a good man.']],
  6: [['北方的大船隊要南下了！', 'A great fleet from the north is coming south!'], ['江上起霧的時候，連漁夫都不敢出船。', 'When the fog rises on the river, even fishermen stay ashore.']],
  7: [['曹丞相和袁本初要在官渡決戰了。', 'Chancellor Cao and Yuan Benchu will fight it out at Guandu.'], ['壽春的袁術竟然稱帝了！', 'Yuan Shu in Shouchun has declared himself emperor!']],
  8: [['董卓沒死！聽說他吃了黑蓮丹，刀槍不入。', 'Dong Zhuo isn\'t dead! They say he ate a black lotus pill and no blade can cut him.'], ['長安城裡的美人貂蟬，據說是呂布的心上人。', 'The beauty Diaochan in Chang\'an is said to be the one Lü Bu loves.']],
  9: [['建業城被黑蓮教佔了……', 'Jianye has fallen to the Black Lotus...'], ['巫峽的江上，夜裡會飄出黑色的蓮花。', 'At night, black lotus flowers drift down the river from the Wu Gorge.']],
  10: [['天下的英雄都聚到白帝城了。', 'Every hero in the realm is gathering at Baidi.'], ['這一戰之後，天下就太平了吧。', 'After this battle, surely there will be peace.']],
};
const GENERIC = [['今年收成還算不錯。', 'The harvest wasn\'t bad this year.'], ['孩子們又跑去江邊玩了。', 'The children ran off to the river again.'], ['唉，打仗打仗，什麼時候才是頭。', 'War and more war. When will it end?'], ['客棧的酒很香。', 'The inn\'s wine smells good.'], ['城東的鐵匠打的刀最快。', 'The smith on the east side makes the sharpest blades.'], ['你是外地人吧？', 'You\'re not from around here, are you?']];
export async function talkTo(e) {
  const t = e.talk || '';
  if (t.startsWith('p:')) { const k = t.slice(2); if (TALK[k]) return TALK[k](e); return T(e.id.replace('p_', ''), '……', '...'); }
  if (t.startsWith('folk:')) {
    const [, place, i] = t.split(':');
    const local = PLACE_LINES[place];
    const seed = hash(place.length * 7 + +i, S.chapter, 3);
    if (local && seed < 0.35) { const ln = local[Math.floor(hash(+i, 1, 9) * local.length)]; return say(L('百姓', 'Townsperson'), L(ln[0], ln[1])); }
    const pool = (FOLK[S.chapter] || []).concat(GENERIC);
    const ln = pool[Math.floor(seed * pool.length * 7) % pool.length];
    return say(L('百姓', 'Townsperson'), L(ln[0], ln[1]));
  }
  if (t === 'guard') return say(L('守門兵', 'Gate Guard'), L(`這裡是${PLACES[F.map.place][0]}。進城的人都要守規矩。`, `This is ${PLACES[F.map.place][1]}. Mind the law within these walls.`));
  if (t.startsWith('shop_')) {
    const k = t.slice(5), place = F.map.place;
    if (k === 'inn') return inn(place);
    if (k === 'tavern') return tavern(place);
    if (k === 'horse') { if (!S.flags.canRide) return say(L('馬販', 'Horse Trader'), L('馬匹都被軍隊徵走了，下次再來吧。', 'The army took all my horses. Come back another time.')); return shop('horse', place); }
    return shop(k, place);
  }
  if (t === 'boatman') return boatman();
  if (t === 'tr:merchant') return merchant();
  if (t.startsWith('tr:quest:')) return quest(t.slice(9));
  if (t.startsWith('sq:')) return sqTalk(t);
  if (t === 'shrine') return shrine(F.map.place);
  if (t.startsWith('home:')) { const ln = HOME[Math.floor(hash(t.length, F.map.place.length, 4) * HOME.length)]; return say(L('居民', 'Resident'), L(ln[0], ln[1])); }
  if (t.startsWith('sign_')) { const r = t.slice(5); const nmz = { inn: ['客棧', 'Inn'], weapon: ['武器', 'Weapons'], armour: ['防具', 'Armour'], item: ['道具', 'Supplies'], book: ['書肆', 'Books'], tavern: ['酒館', 'Tavern'], shrine: ['廟', 'Shrine'] }[r] || ['', '']; return N(`招牌上寫著「${nmz[0]}」。`, `The sign reads "${nmz[1]}".`); }
}
const HOME = [['請進請進，可惜家裡沒什麼好招待的。', 'Come in, come in. Sorry we have nothing much to offer.'], ['我兒子去當兵了，不知道現在怎樣。', 'My son went off to be a soldier. I wonder how he is.'], ['外面兵荒馬亂的，你們小心。', 'It is dangerous out there. Take care.'], ['那個箱子裡的東西，你們要用就拿去吧。', 'If anything in that chest is any use to you, take it.']];
const PLACE_LINES = {
  haiyan: [['海那邊有什麼？老人們說，是神仙住的地方。', 'What lies across the sea? The old folk say it\'s where immortals live.'], ['那幾個海妖，會不會吃人啊？', 'Those sea demons... do you think they eat people?']],
  wu: [['朱治將軍守著吳郡，誰也別想亂來。', 'General Zhu Zhi holds Wu. Nobody had better try anything.']],
  jianye: [['建業是江東的心臟。', 'Jianye is the heart of Jiangdong.']],
  xuchang: [['天子就在許昌。', 'The Son of Heaven is here in Xuchang.']],
  luoyang: [['洛陽燒成這樣，只剩下斷牆殘壁。', 'Luoyang was burned to this: nothing but broken walls.']],
  chengdu: [['蜀地的錦緞天下第一。', 'The brocade of Shu is the finest in the realm.']],
};
// ---------- the story's people ----------
const TALK = {};
// chapter 1: the shipwreck
TALK.shipwreck = async () => {
  if (S.flags.westerners) return;
  playMusic('tension');
  await N('四個奇裝異服的人背靠著大船殘骸，被拿著魚叉的村民和一群山賊團團圍住。', 'Four strangely dressed people stand with their backs to a wrecked hull, ringed by villagers with fish spears and a band of hill bandits.');
  await T(['山賊', 'Bandit'], '紅毛海妖！把你們的寶貝交出來！', 'Red-haired sea demons! Hand over your treasure!');
  await T('josh', '"Treasure"? We lost everything in the storm! ...Erin, what are they saying?', '"Treasure"? We lost everything in the storm! ...Erin, what are they saying?');
  await T('erin', '在、在下……乃遠方之客，船難漂流至此，並無寶物……', 'I... I am but a traveller from afar, shipwrecked here, and have no treasure...');
  await T('jasper', 'Erin, you sound like an old book.', 'Erin, you sound like an old book.');
  await T('erin', '我是從一本三百年前的商人會話集學的，好嗎！', 'I learned from a merchant\'s phrasebook three hundred years out of date, all right!');
  await T('jeff', '各位，請冷靜。我們只是需要——一點淡水，和一把扳手。', 'Everyone, please calm down. All we need is some fresh water. And a spanner.');
  await T('sunquan', '……住手！他們不是妖怪，只是遇難的人。山賊，退下！', '...Stop! They are not demons, just people in trouble. Bandits, back off!');
  await T(['山賊', 'Bandit'], '你算哪根蔥？上！', 'And who are you? Get them!');
  const r = await fight('beach', { mayLose: true });
  if (r !== 'win') healAll(1);
  playMusic('village');
  await T('josh', 'Whoa. That was... thank you. Really. I\'m Josh.', 'Whoa. That was... thank you. Really. I\'m Josh.');
  await T('erin', '多謝閣下拔刀相助。我叫艾琳，是船上的領航員。這位是傑夫，造船的；這是喬許；最小的是賈斯珀。', 'Thank you for drawing your sword for us, sir. I am Erin, the ship\'s navigator. This is Jeff, the shipwright; Josh; and our youngest, Jasper.');
  await T('jasper', '你好！我會說「你好」！還有「多少錢」！', 'Ni hao! I can say "ni hao"! And "how much"!');
  await T('shangxiang', '……二哥，這些人好奇怪。', '...Second Brother, these people are so odd.');
  await T('sunquan', '我叫孫權。我……現在什麼都不是，只是個被追殺的人。', 'My name is Sun Quan. Right now I am... nobody. Just a man being hunted.');
  await T('jeff', '被追殺？那我們很合得來。我們被大海追殺了整整三個月。', 'Hunted? Then we\'ll get along. The sea has been hunting us for three months.');
  await T('erin', '我們的船「流星號」已經毀了。在找到回家的路之前……孫權閣下，可否讓我們跟著你？我能看星辰、辨天氣、治傷。', 'Our ship, the Wandering Star, is wrecked. Until we find our way home... Lord Sun Quan, may we follow you? I can read the stars, foretell the weather and treat wounds.');
  await T('josh', '我能打。還能扛很重的東西。', 'And I can fight. And carry really heavy things.');
  await T('jasper', '我什麼都能找到。真的。我已經找到你腰上那包點心了。', 'And I can find anything. Really. I already found the snacks in your belt pouch.');
  await T('sunquan', '……！什麼時候——好吧。我正需要能信任的人。歡迎你們。', '...! When did you— All right. I need people I can trust. Welcome.');
  S.flags.westerners = 1;
  F.ents = F.ents.filter((x) => !['p_jeff', 'p_erin', 'p_josh', 'p_jasper'].includes(x.id));
  for (const id of ['jeff', 'erin', 'josh', 'jasper']) await join(id, 2, true);
  S.front = ['sunquan', 'zhoutai', 'josh', 'shangxiang', 'jasper'];
  sfx('level');
  await N('傑夫、艾琳、喬許、賈斯珀加入了！', 'Jeff, Erin, Josh and Jasper join the army!');
  await T('erin', '對了——孫權閣下，你的軍師是誰？打仗時要有人指揮策略。', 'Oh— Lord Sun Quan, who is your strategist? Someone must direct the tactics in battle.');
  await T('sunquan', '……軍師？目前大概是我自己。', '...Strategist? For now, I suppose it is me.');
  await T('jeff', '那讓我來吧。我的智力——呃，我是說，我算數還不錯。打開選單的「武將」就能任命軍師。', 'Then let me. My intellect— I mean, I\'m good with numbers. You can appoint a strategist from "Generals" in the menu.');
  S.strategist = 'jeff'; S.tp = tpMax();
  await N('提示：按C／Tab打開選單。軍師的智力決定全軍策略值的多寡與計策的威力。', 'Tip: press C or Tab for the menu. The strategist\'s INT sets the army\'s strategy points and the power of tactics.');
  await T('sunquan', '先去西北的吳郡，找朱治將軍。', 'First we go north-west to Wu, to find General Zhu Zhi.');
};
TALK.zhuzhi = async () => {
  if (S.chapter >= 2) return T('zhuzhi', '主公，吳郡有我守著，放心去吧。', 'My lord, I hold Wu. Go without worry.');
  if (!S.flags.westerners) return T('zhuzhi', '二公子！您還活著！……您身邊的人呢？先去把人馬聚齊吧。', 'Young master! You live! ...But where are your people? Gather them first.');
  if (!S.flags.metZhuzhi) {
    await T('zhuzhi', '二公子！不，主公！老臣朱治，等您很久了。', 'Young master! No— my lord! Your old servant Zhu Zhi has waited long for you.');
    await T('sunquan', '朱將軍……你也聽說了吧。孫暠說是我殺了父兄。', 'General Zhu... you have heard. Sun Hao says I killed my father and brother.');
    await T('zhuzhi', '那種鬼話，三歲小孩都不信！只是……江東的老臣們，很多人還在觀望。他們覺得您太年輕。', 'Not even a child believes that! But... many of Jiangdong\'s old officers are waiting to see. They think you are too young.');
    await T('zhuzhi', '要讓他們服氣，先拿下烏程寨的嚴白虎。那廝與穿黑衣的妖人勾結，斷了吳郡往南的路。', 'To win them, first take Yan Baihu\'s fort at Wucheng. He has joined the men in black and cut the roads south of Wu.');
    await T('zhuzhi', '凌操在城裡等您，他可以同去。軍中的錢糧，老臣也備了一些。', 'Ling Cao waits in the city to go with you. And I have set aside some silver and grain.');
    S.gold += 500; give('salve', 5); give('ironsword'); give('leather', 2);
    sfx('chest');
    await N('得到了500金、傷藥×5、鐵劍、皮甲×2！', 'Received 500 gold, Salve x5, an Iron Sword and Leather Armour x2!');
    S.flags.metZhuzhi = 1;
    S.flags.canSave = false;
    return;
  }
  if (!S.flags.won_yanbaihu) return T('zhuzhi', '烏程寨在吳郡西南。嚴白虎有黑衣人撐腰，萬萬小心。山越洞那邊，也有他的同夥。', 'Wucheng Fort lies south-west of Wu. Yan Baihu has the men in black behind him. Be careful. His friends hide in the Shanyue Caves too.');
  return T('zhuzhi', '主公凱旋了！嚴白虎一除，江東父老都在議論您呢。', 'My lord returns in triumph! With Yan Baihu gone, all Jiangdong is talking about you.');
};
TALK.lingcao = async () => { await T('lingcao', '末將凌操，奉朱將軍之命追隨主公！', 'Ling Cao, by General Zhu\'s order, at your service!'); await join('lingcao', Math.max(3, lvNow())); };
TALK.dongxi = async () => { await T('dongxi', '我是被嚴白虎關起來的董襲。主公救命之恩，董襲以命相報！', 'I am Dong Xi; Yan Baihu had me locked up. My lord saved my life; I give it to you!'); await join('dongxi', Math.max(6, lvNow())); };
// chapter 2
TALK.lusu = async () => {
  if (has('lusu')) return;
  await T('lusu', '在下魯肅，字子敬。久聞孫將軍之名。', 'I am Lu Su, styled Zijing. I have long heard of General Sun.');
  await T('sunquan', '魯先生，聽說你把家裡的糧倉都分給了百姓。', 'Master Lu, I hear you gave your family\'s granary to the people.');
  await T('lusu', '糧食放在倉裡會爛，放在人肚子裡才有用。將軍要糧，我這裡還有一倉。將軍要人——', 'Grain rots in a granary; it only does good in people\'s bellies. If you need grain, I have one store left. If you need a man—');
  await T('lusu', '魯肅願隨將軍，看一看這天下。', '—Lu Su will follow you, and see what becomes of the realm.');
  give('rations', 3); await N('得到了兵糧×3！', 'Received Rations x3!');
  await join('lusu', Math.max(8, lvNow()));
  await T('jasper', '他人真好。他的點心也很好吃。', 'He\'s so nice. His snacks are good too.');
};
TALK.daqiao = async () => {
  if (has('daqiao')) return;
  await T('daqiao', '……仲謀。', '...Zhongmou.');
  await T('sunquan', '嫂嫂……大哥他……我沒能……', 'Sister-in-law... Brother... I couldn\'t...');
  await T('daqiao', '伯符最後讓你走，是因為他相信你。不要辜負他。……讓我跟你們走吧。我會照顧傷兵。', 'Bofu sent you away at the end because he believed in you. Don\'t fail him. ...Let me come with you. I can tend the wounded.');
  await join('daqiao', Math.max(8, lvNow()));
  await T('erin', '（小聲）賈斯珀，這種時候不要偷吃。', '(quietly) Jasper, not the time to sneak snacks.');
  await T('jasper', '（小聲）我是在給她遞手帕。', '(quietly) I was passing her a handkerchief.');
};
TALK.zhouyu = async () => {
  if (has('zhouyu')) return;
  await T('zhouyu', '仲謀。……你比我想的還要瘦。', 'Zhongmou. ...You are thinner than I thought.');
  await T('sunquan', '公瑾哥哥。我需要你。江東需要你。', 'Brother Gongjin. I need you. Jiangdong needs you.');
  await T('zhouyu', '伯符和我，總角之交。他的仇，就是我的仇。……可是你，仲謀，你能帶著江東走下去嗎？', 'Bofu and I were friends since we wore our hair in tufts. His enemy is mine. ...But you, Zhongmou: can you lead Jiangdong on?');
  const c = await choose('zhouyu', '告訴我，你要的是什麼？', 'Tell me: what is it you want?', [['替父兄報仇。', 'To avenge my father and brother.'], ['讓江東的百姓活下去。', 'For the people of Jiangdong to live.'], ['我不知道……但我不會逃。', 'I don\'t know... but I won\'t run.']]);
  if (c === 0) await T('zhouyu', '仇要報。但只為了仇，走不遠。', 'Vengeance is owed. But vengeance alone won\'t carry you far.');
  if (c === 1) await T('zhouyu', '……好。伯符要的是天下，你要的是人。也許你才是對的。', '...Good. Bofu wanted the realm; you want its people. Perhaps you are the one who is right.');
  if (c === 2) await T('zhouyu', '誠實。這比一百句豪言壯語都好。', 'Honest. Better than a hundred grand speeches.');
  await T('zhouyu', '皖城的劉勳暗通黑蓮教，囤積了大量兵糧。拿下皖城，江東就有了底氣。我同你去。', 'Liu Xun of Wan secretly serves the Black Lotus, and hoards grain. Take Wan and Jiangdong has its backbone again. I go with you.');
  await join('zhouyu', Math.max(10, lvNow()));
  S.strategist = 'zhouyu'; S.tp = tpMax();
  await N('周瑜成為了軍師！', 'Zhou Yu becomes the strategist!');
  await T('jeff', '……被搶走工作了。', '...Lost my job already.');
  await T('zhouyu', '你就是那個造船的海外人？聽說你們的船能逆風而行。', 'You are the foreign shipwright? They say your ships can sail into the wind.');
  await T('jeff', '只要帆夠好，角度夠對。……要我畫給你看嗎？', 'With good sails and the right angle. ...Want me to draw it for you?');
  await T('zhouyu', '有意思。等打完仗，你畫，我彈琴。', 'Interesting. When the fighting is done, you draw and I\'ll play the zither.');
};
TALK.xiaoqiao = async () => { if (has('xiaoqiao')) return; await T('xiaoqiao', '夫君要出征，我也要去！我會看風向，還會包紮。', 'If my husband marches, so do I! I can read the wind and bind wounds.'); await join('xiaoqiao', Math.max(10, lvNow())); };
TALK.lumeng = async () => { if (has('lumeng')) return; await T('lumeng', '呂蒙！以前只會打仗，現在也在讀書了！請讓我加入！', 'Lü Meng! I used to only fight; now I read books too! Let me join!'); await join('lumeng', Math.max(11, lvNow())); };
TALK.jiangqin = async () => { if (has('jiangqin')) return; await T('jiangqin', '蔣欽，在江上討生活的。主公要水軍，我來！', 'Jiang Qin. I made my living on the river. You need a navy? Here I am!'); await join('jiangqin', Math.max(11, lvNow())); };
// chapter 3
TALK.oldguard = async () => {
  if (has('chengpu')) return;
  if (!S.flags.won_qua) {
    await T('chengpu', '……二公子。老夫程普。我們被孫暠的人看著，出不了城。', '...Young master. I am Cheng Pu. Sun Hao\'s men watch us; we cannot leave the town.');
    await T('huanggai', '說實話，我們也在想：一個從來沒上過戰場的孩子，憑什麼要我們把命交給他？', 'To be honest, we wonder too: why should we give our lives to a boy who has never been to war?');
    await T('handang', '黃公覆說話直，別介意。……城外孫暠的守兵，你若能打退他們，我們就信你。', 'Huang Gongfu speaks plainly; don\'t mind him. ...If you can drive off Sun Hao\'s guards outside the town, we will believe in you.');
    const r = await fight('qua');
    if (r !== 'win') return;
    await T('huanggai', '哈！打得好！這一仗，像極了文台公年輕時！', 'Ha! Well fought! That was Sun Jian himself in his youth!');
    await T('chengpu', '程普、黃蓋、韓當，願為主公效力！', 'Cheng Pu, Huang Gai and Han Dang will serve you, my lord!');
    for (const id of ['chengpu', 'huanggai', 'handang']) await join(id, Math.max(13, lvNow()), true);
    sfx('level'); await N('程普、黃蓋、韓當加入了！', 'Cheng Pu, Huang Gai and Han Dang join the army!');
    await T('huanggai', '主公，這匹戰馬送給您。有了馬，天下哪裡都去得了！', 'My lord, take this warhorse. With a horse, the whole realm is within reach!');
    give('warhorse'); S.flags.canRide = 1; S.horse = true;
    await N('得到了戰馬！在世界地圖上騎馬，移動加快。（為孫權裝備「坐騎」也能讓騎兵更強）', 'Received a Warhorse! You now ride on the world map, much faster. (Equip it as a mount to make a horseman stronger.)');
  }
};
TALK.zhangzhao = async () => T('zhangzhao', '主公，治國如烹小鮮。打仗的事交給周郎，錢糧的事交給老臣。', 'My lord, ruling a state is like frying a small fish. Leave war to Zhou Yu and the grain to me.');
TALK.guyong = async () => T('guyong', '……（顧雍靜靜地點了點頭。他是出了名的不喝酒、不多話。）', '...(Gu Yong nods quietly. He is famous for never drinking and seldom speaking.)');
TALK.jiyuan = async () => {
  if (S.chapter >= 8) return;
  await T('jiyuan', '仲謀，你長大了。老夫這把老骨頭，能看到今天，死也瞑目了。', 'Zhongmou, you have grown. These old bones have lived to see this day; I could die content.');
  await T('sunquan', '季老別這麼說。我還有好多事要請教您。', 'Don\'t say that, Elder Ji. I still have so much to ask you.');
  await T('jasper', '（小聲）……他的袖子裡，有黑色的花瓣。', '(quietly) ...There are black petals in his sleeve.');
  await T('erin', '（小聲）別亂說話，賈斯珀。', '(quietly) Don\'t say things like that, Jasper.');
  S.flags.petals = 1;
};
TALK.lingtong = async () => { if (has('lingtong')) return; await T('lingtong', '凌統，凌操之子！父親在哪裡，我就在哪裡！', 'Ling Tong, son of Ling Cao! Where my father goes, I go!'); await join('lingtong', Math.max(14, lvNow())); };
TALK.chenwu = async () => { if (has('chenwu')) return; await T('chenwu', '陳武。不會說話，只會砍人。', 'Chen Wu. I don\'t talk much. I hit things.'); await join('chenwu', Math.max(14, lvNow())); };
TALK.heqi = async () => { if (has('heqi')) return; await T('heqi', '賀齊。山越的事我最熟。主公若用我，建安的山賊三年內絕跡。', 'He Qi. I know the Shanyue best. Use me, and Jian\'an\'s bandits will be gone in three years.'); await join('heqi', Math.max(16, lvNow())); };
// generic joiners
const JOIN_LINES = {
  zhuhuan: ['朱桓願效犬馬之勞。', 'Zhu Huan offers his service.'], sufei: ['蘇飛。甘寧那小子，是我推薦給黃祖的……現在換我來投奔你了。', 'Su Fei. I once recommended that Gan Ning to Huang Zu... now it\'s my turn to come to you.'],
  weiyan: ['魏延！有人說我腦後有反骨。哼，主公信不信？', 'Wei Yan! Some say I have a traitor\'s bone in my skull. Hmph. Do you believe it, my lord?'], wenpin: ['文聘守荊州水軍多年，願為主公所用。', 'Wen Pin, long guardian of Jing\'s navy, at your command.'],
  zhuran: ['朱然，奉命前來。', 'Zhu Ran, reporting as ordered.'], xusheng: ['徐盛。主公要打水仗，少不了我。', 'Xu Sheng. If you fight on the water, you need me.'], dingfeng: ['丁奉，年輕力壯，請收下我！', 'Ding Feng. Young and strong, take me!'],
  tianfeng: ['田豐。我勸過袁紹，不要信那些黑衣人……他把我關了起來。', 'Tian Feng. I warned Yuan Shao not to trust the men in black... he locked me up.'], jushou: ['沮授。願以殘年，助將軍除妖。', 'Ju Shou. What years I have left, I give to rooting out the sect.'],
  zhanghe: ['張郃，願降。', 'Zhang He. I yield to you.'], gaolan: ['高覽，隨張郃將軍來投！', 'Gao Lan, following General Zhang He!'], gongsunzan: ['公孫瓚。白馬義從，聽候差遣！', 'Gongsun Zan. My White Horse Volunteers await your orders!'],
  panzhang: ['潘璋。哪裡有錢賺，哪裡就有我。主公給得起吧？', 'Pan Zhang. Wherever there\'s money, there I am. You can pay, my lord?'], gaoshun: ['高順。陷陣營，願聽將令。', 'Gao Shun. The Formation Breakers await your command.'], chengong: ['陳宮。這一次，我想跟對人。', 'Chen Gong. This time, I want to follow the right man.'],
  jiangwei: ['姜維，字伯約。久仰江東之名。', 'Jiang Wei, styled Boyue. I have long admired Jiangdong.'], madai: ['馬岱，隨兄長一起！', 'Ma Dai, with my cousin!'], pangde: ['龐德。在華山修行，等的就是這一天。', 'Pang De. I trained on Mount Hua for this very day.'],
  fazheng: ['法正。益州終於清醒了。', 'Fa Zheng. Yi has finally woken up.'], yanyan: ['嚴顏。斷頭將軍，沒有投降將軍——但我願意跟著你。', 'Yan Yan. I am a general who can lose his head but never yields... yet I will follow you.'],
  zhurong: ['祝融！南中的女兒，比男人更能打！', 'Zhurong! A daughter of Nanzhong fights harder than any man!'], menghuo: ['孟獲！你們打敗了黑蓮教的妖人？那你們是朋友！', 'Meng Huo! You beat the sect\'s sorcerers? Then you\'re friends!'], shixie: ['士燮。交州雖遠，也願為天下盡一份心力。', 'Shi Xie. Jiao is far away, but it too will do its part for the realm.'],
};
TALK.joiner = async (e) => {
  const id = e.id.replace('p_', '');
  const ln = JOIN_LINES[id] || ['願為將軍效力。', 'I will serve you.'];
  await T(id, ln[0], ln[1]);
  const lv = Math.max(recruitLv(F.map.place), lvNow() - 2);
  await join(id, lv);
  F.ents = F.ents.filter((x) => x !== e);
};
// chapter 4
TALK.taishici = async (e) => {
  if (has('taishici')) return;
  await T('taishici', '我是太史慈。聽說孫家二公子手下有個海外來的大個子，力氣很大？', 'I am Taishi Ci. They say the second Sun boy has a big foreigner who is very strong?');
  await T('josh', '……我？', '...Me?');
  await T('taishici', '跟我比一場！你贏了，我就跟你們走！', 'Fight me! If you win, I go with you!');
  await T('josh', '好吧。但我不打臉。', 'Okay. But no hitting in the face.');
  const r = await battle({ foes: [{ id: 'taishici', lv: 20, mul: 1.4 }], terrain: 'grass', capture: false, canRun: false, mayLose: true, intro: L('太史慈挺槍出馬！', 'Taishi Ci rides out!') });
  if (r === 'win') { await T('taishici', '哈哈哈！痛快！我太史慈說話算話！', 'Ha ha ha! What a fight! Taishi Ci keeps his word!'); await join('taishici', Math.max(20, lvNow())); F.ents = F.ents.filter((x) => x !== e); }
  else await T('taishici', '再練練吧！我在這裡等你們。', 'Train some more! I\'ll wait for you here.');
};
TALK.ganning = async (e) => {
  if (has('ganning')) return;
  await T('ganning', '叮鈴、叮鈴——聽到這鈴聲，江上的人都知道是我甘興霸來了。', 'Ting-a-ling— when they hear these bells, everyone on the river knows Gan Xingba is here.');
  await T('ganning', '黃祖那老頭，把我當賊看。我在他手下三年，連個像樣的官都沒有。孫仲謀，你敢用一個賊嗎？', 'That old man Huang Zu treats me like a thief. Three years under him and not one decent post. Sun Zhongmou, do you dare to use a thief?');
  const c = await choose('sunquan', '……', '...', [['我用的是人，不問出身。', 'I use people. I do not ask where they came from.'], ['你先把鈴鐺拿下來。', 'Take those bells off first.']]);
  if (c === 1) await T('ganning', '哈！不拿！這是我的招牌！……不過我喜歡你。', 'Ha! Never! They\'re my trademark! ...But I like you.');
  await T('ganning', '夏口的城門，我知道哪一扇最好開。', 'I know which gate of Xiakou opens easiest.');
  await join('ganning', Math.max(21, lvNow()));
  F.ents = F.ents.filter((x) => x !== e);
};
// chapter 5
TALK.huangzhong = async (e) => {
  if (has('huangzhong')) return;
  if (!S.flags.won_changsha) {
    await T('huangzhong', '老夫黃忠。蔡瑁派兵來搶長沙的糧倉，說是要「借」。你們若能打退他們，老夫謝你。', 'I am Huang Zhong. Cai Mao sent troops to "borrow" Changsha\'s granary. Drive them off and I will thank you.');
    const r = await fight('changsha');
    if (r !== 'win') return;
    await T('huangzhong', '好！年輕人有本事！老夫雖然六十了，拉弓還拉得開。帶上我！', 'Well done, young ones! I may be sixty, but I can still draw a bow. Take me with you!');
    await join('huangzhong', Math.max(24, lvNow()));
    F.ents = F.ents.filter((x) => x !== e);
  }
};
TALK.liuqi = async () => {
  if (S.flags.metLiuqi) return T('liuqi', '襄陽在北邊。蔡瑁就在那裡。', 'Xiangyang is to the north. Cai Mao is there.');
  await T('liuqi', '孫將軍……父親他……走了。大夫說是病，可是他死前，嘴唇是黑色的。', 'General Sun... my father... has passed. The physicians said illness, but at the end his lips were black.');
  await T('erin', '是毒。和建業那一夜一樣的毒。', 'Poison. The same poison as that night in Jianye.');
  await T('liuqi', '蔡瑁把襄陽封了，說要立我弟弟。新野的劉皇叔也被他排擠……求將軍幫我！', 'Cai Mao has sealed Xiangyang and means to put my brother up. Imperial Uncle Liu of Xinye was pushed out too... help me, General!');
  S.flags.metLiuqi = 1;
};
TALK.liubei = async () => {
  if (S.flags.alliedLiu) return;
  await T('liubei', '在下劉備，字玄德。……孫將軍，你我素未謀面，你卻千里來救荊州。', 'I am Liu Bei, styled Xuande. ...General Sun, we have never met, yet you come a thousand li to save Jing.');
  await T('sunquan', '黑蓮教殺了我的父兄，也毒死了劉表大人。這不是一家一姓的事。', 'The Black Lotus killed my father and brother, and poisoned Lord Liu Biao. This is no one family\'s quarrel.');
  await T('liubei', '說得好。劉備兵微將寡，但願與將軍結盟，共討妖邪！', 'Well said. My army is small, but I would ally with you, General, to strike down this evil!');
  S.flags.alliedLiu = 1;
  await N('與劉備結成了同盟！', 'An alliance is sworn with Liu Bei!');
  await T('liubei', '子龍，你去幫孫將軍。他那裡，比我這裡更需要你。', 'Zilong, go and help General Sun. He needs you more than I do.');
};
TALK.zhaoyun = async (e) => { if (has('zhaoyun')) return; await T('zhaoyun', '常山趙子龍，奉主公之命，助將軍一臂之力！', 'Zhao Zilong of Changshan, by my lord\'s command, lends you his arm!'); await join('zhaoyun', Math.max(26, lvNow())); F.ents = F.ents.filter((x) => x !== e); };
TALK.zhugeliang = async () => {
  if (S.flags.metZhuge) return T('zhugeliang', '羽扇綸巾，談笑之間——呵呵，這句話我還沒想好下半句。', 'Feather fan and silk kerchief, laughing all the while— heh, I haven\'t worked out the rest of that line.');
  await T('zhugeliang', '臥龍崗的草廬，難得有客。請坐。……這位戴著奇怪眼鏡的先生，是工匠吧？', 'My hut on Sleeping Dragon Ridge seldom sees guests. Please sit. ...The gentleman with the strange spectacles is an artisan, I think?');
  await T('jeff', '造船的。你這架木頭機關是……連弩？天哪，這個扳機的設計——', 'Shipwright. And this wooden contraption is... a repeating crossbow? Good lord, this trigger design—');
  await T('zhugeliang', '你看得懂？那這張圖給你。我畫的火船，一直沒找到人能造。', 'You understand it? Then take this. I drew these fire rafts but never found anyone who could build them.');
  give('blueprint'); S.flags.blueprint = 1; learnTactics(member('jeff'));
  sfx('chest'); await N('得到了「火龍船圖」！傑夫學會了「火龍船」！', 'Received the Fire-Dragon Raft Plans! Jeff learned Fire-Dragon Rafts!');
  give('liannu'); await N('諸葛亮還送了一把「諸葛連弩」。', 'Zhuge Liang also gives you a Repeating Crossbow.');
  await T('zhugeliang', '黑蓮教的根，不在荊州，不在中原。它在西邊的群山裡。……將軍，終有一日你要去那裡。', 'The Black Lotus has its roots neither in Jing nor in the Central Plains, but in the mountains of the west. ...One day, General, you must go there.');
  if (!S.forms.includes('bagua')) { S.forms.push('bagua'); sfx('level'); await N('諸葛亮傳授了「八卦陣」！（需要智力95以上的軍師）', 'Zhuge Liang teaches the Eight Trigrams formation! (It needs a strategist with INT 95+)'); }
  S.flags.metZhuge = 1;
};
TALK.luxun = async (e) => { if (has('luxun')) return; await T('luxun', '陸遜，字伯言。……我一直在等一個值得追隨的人。', 'Lu Xun, styled Boyan. ...I have been waiting for someone worth following.'); await join('luxun', Math.max(24, lvNow())); F.ents = F.ents.filter((x) => x !== e); };
// chapter 7
TALK.zhangliao = async () => {
  if (S.flags.metZhangliao) return T('zhangliao', '合肥有我守著，袁術的兵過不來。', 'I hold Hefei. Yuan Shu\'s men will not pass.');
  await T('zhangliao', '張遼，奉曹丞相之命鎮守合肥。……你就是逼退于禁水軍的孫仲謀？', 'Zhang Liao, holding Hefei by the Chancellor\'s order. ...You are the Sun Zhongmou who drove back Yu Jin\'s fleet?');
  await T('zhangliao', '丞相說了，你我兩家暫且聯手。壽春的袁術勾結黑蓮教稱帝，請你先去收拾他。', 'The Chancellor says our two houses stand together for now. Yuan Shu in Shouchun has declared himself emperor with the sect\'s help. Deal with him first.');
  S.flags.metZhangliao = 1;
};
TALK.caocao = async () => {
  if (S.flags.metCao) return T('caocao', '袁本初在鄴城。打敗他，北方就清淨了。', 'Yuan Benchu is in Ye. Beat him and the north is clean.');
  await T('caocao', '孫仲謀。生子當如孫仲謀啊。……不必這樣看我，我是在誇你。', 'Sun Zhongmou. If one must have a son, let him be like Sun Zhongmou. ...Don\'t look at me like that; it\'s a compliment.');
  await T('caocao', '那些偽造的書信，我都看了。竟有人模仿你的筆跡罵我「閹宦之後」——寫得還真有幾分像。', 'I read those forged letters. Someone copied your hand to call me "the spawn of eunuchs"— a fair likeness, too.');
  await T('sunquan', '寫信的人，我想我知道是誰了。', 'I think I know who wrote them.');
  await T('caocao', '那就去找他。不過在那之前，先幫我把官渡的顏良、文醜收拾掉。', 'Then find him. But first, help me clear Yan Liang and Wen Chou from Guandu.');
  await T('guojia', '咳咳……丞相，袁紹身邊有個白衣人，從不露臉。小心。', 'Cough, cough... Chancellor, at Yuan Shao\'s side is a man in white who never shows his face. Be careful.');
  S.flags.metCao = 1;
};
TALK.guojia = async () => T('guojia', '我身體不好，只能出點主意。……主公帶著你們這些海外人，倒是很有趣。', 'My health is poor, so I only offer ideas. ...Your lord travelling with foreigners is rather interesting.');
// chapter 8
TALK.diaochan = async () => {
  if (S.flags.metDiao) return T('diaochan', '郿塢裡見。', 'We meet again at Mei.');
  await T('diaochan', '孫小姐。……我知道你們要對付董卓。', 'Lady Sun. ...I know you mean to face Dong Zhuo.');
  await T('shangxiang', '你是貂蟬？聽說你是呂布的——', 'You\'re Diaochan? They say you\'re Lü Bu\'s—');
  await T('diaochan', '奉先他不是壞人。他只是……一直被人當刀用。董卓吃了黑蓮丹，已經不是人了。到了郿塢，我會讓奉先看清楚。', 'Fengxian is not a bad man. He has only ever been used as a blade. Dong Zhuo ate a black lotus pill; he is not human any more. At Mei, I will make Fengxian see the truth.');
  S.flags.metDiao = 1;
};
TALK.lubu = async (e) => {
  if (has('lubu')) return;
  await T('lubu', '……人中呂布。我殺了董卓那怪物。貂蟬說，跟著你，我就不再是誰的刀。', '...Lü Bu, first among men. I killed that monster Dong Zhuo. Diaochan says if I follow you, I will be nobody\'s blade.');
  await T('josh', '你很強。但在這裡，我們是朋友，不是刀。', 'You\'re strong. But here we\'re friends, not blades.');
  await T('lubu', '……朋友。哼。好奇怪的詞。', '...Friends. Hmph. Strange word.');
  await join('lubu', Math.max(48, lvNow())); await join('diaochan', Math.max(46, lvNow()));
  F.ents = F.ents.filter((x) => x !== e);
};
TALK.machao = async (e) => { if (has('machao')) return; await T('machao', '西涼馬超！黑蓮教害了我的族人，我要報仇！', 'Ma Chao of Xiliang! The sect harmed my people. I want revenge!'); await join('machao', Math.max(46, lvNow())); F.ents = F.ents.filter((x) => x !== e); };

// ---------- entering places ----------
export async function onEnterPlace(id) {
  const P = PLACES[id];
  // forts and gates hold battles
  if (id === 'wucheng' && !S.flags.won_yanbaihu) {
    if (!S.flags.metZhuzhi) { await N('寨門緊閉，寨牆上的山賊在放箭。先去吳郡打聽打聽吧。', 'The fort gates are shut and bandits shoot from the walls. Better ask around in Wu first.'); return 'stay'; }
    await T('yanbaihu', '孫家的小兒！黑蓮使者答應我，拿你的人頭換江東王的印綬！', 'Little Sun brat! The Lotus envoy promised me Jiangdong\'s seal in exchange for your head!');
    await T('sunquan', '嚴白虎。你殺了多少百姓，今天一起算。', 'Yan Baihu. Every villager you killed is counted today.');
    const r = await fight('yanbaihu');
    if (r !== 'win') return 'stay';
    await N('在嚴白虎的營帳裡，找到了一枚黑蓮令牌和一封密信。', 'In Yan Baihu\'s tent you find a black lotus token and a secret letter.');
    give('lotus'); give('letter');
    await T('jeff', '信上寫：「建業左使已安排妥當……下一步，周瑜。」左使是誰？', 'The letter says: "The Left Envoy in Jianye has arranged everything... next, Zhou Yu." Who is the Left Envoy?');
    await T('sunquan', '……他們要對公瑾下手。我們得趕在他們前面！', '...They mean to strike at Gongjin. We have to get there first!');
    await T('erin', '周瑜在江北的舒縣。過江，要從西邊的牛渚坐渡船。', 'Zhou Yu is in Shu, north of the river. To cross, take the ferry at Niuzhu in the west.');
    S.flags.beaten_shanyue = 1;
    await chapter(2, '周郎', 'The Young Master Zhou');
    return;
  }
  if (id === 'wan' && S.chapter === 2 && !S.flags.won_liuxun) {
    if (!has('zhouyu')) { await N('皖城戒備森嚴。先去舒縣找周瑜吧。', 'Wan is heavily guarded. Go to Shu and find Zhou Yu first.'); return 'stay'; }
    await T('liuxun', '周瑜！孫權！來得好，省得黑蓮使者再派人去找你們！', 'Zhou Yu! Sun Quan! Good, it saves the Lotus envoy the trouble of hunting you!');
    const r = await fight('liuxun');
    if (r !== 'win') return 'stay';
    await T('zhouyu', '劉勳的帳冊……他把糧食都運去了建業。孫暠和黑蓮教的「赤蓮使」，就在建業城裡。', 'Liu Xun\'s ledgers... he shipped all his grain to Jianye. Sun Hao and the sect\'s "Red Lotus Envoy" are in that city.');
    await T('sunquan', '那就回建業。把江東拿回來。', 'Then back to Jianye. We take Jiangdong back.');
    give('mn_heyi'); S.forms.push('heyi'); give('mn_heyi', -1);
    await N('在皖城的書庫裡找到了「鶴翼陣圖」，習得了鶴翼陣！', 'In Wan\'s library you find the Crane Wing Manual and learn the Crane Wing formation!');
    S.flags.beaten_liu_xun = 1;
    await chapter(3, '還我江東', 'Jiangdong Reclaimed');
    await T('erin', '老將們被軟禁在建業東邊的曲阿。要拿下建業，最好先得到他們的支持。', 'The old generals are held at Qu\'a, east of Jianye. Before Jianye, we should win their support.');
    return;
  }
  if (id === 'moling' && S.chapter === 3 && !S.flags.won_moling) {
    if (!has('chengpu')) { await N('秣陵關的守軍太多了。先去曲阿見見老將軍們吧。', 'Too many guards at Moling Gate. Go and see the old generals in Qu\'a first.'); return 'stay'; }
    await N('秣陵關前，孫暠的大軍列陣以待。', 'Before Moling Gate, Sun Hao\'s army stands in battle order.');
    const r = await fight('moling');
    if (r !== 'win') return 'stay';
    await N('秣陵關被攻破了！通往建業的路打開了。', 'Moling Gate falls! The road to Jianye lies open.');
    return 'stay';
  }
  if (id === 'jianye' && S.chapter === 3 && !S.flags.won_sunhao) {
    if (!S.flags.won_moling) { await N('建業城門緊閉。秣陵關還在孫暠手裡。', 'Jianye\'s gates are shut. Moling Gate is still in Sun Hao\'s hands.'); return 'stay'; }
    playMusic('tension');
    await T('sunhao', '仲謀……你真的回來了。', 'Zhongmou... so you really came back.');
    await T('yanwu', '孫暠，別廢話。黑蓮聖主要的是孫家斷子絕孫。', 'Sun Hao, enough talk. The Lord of the Lotus wants the house of Sun to end.');
    await T('sunquan', '堂兄，你明知道是誰殺了我父兄。', 'Cousin, you know perfectly well who killed my father and brother.');
    await T('sunhao', '……我只是想要一座城。我沒想到……事情會變成這樣。', '...I only wanted a city. I never thought... it would come to this.');
    const r = await fight('sunhao');
    if (r !== 'win') return 'stay';
    await T('yanwu', '哼……今天就到這裡。孫權，黑蓮遍地開，你殺不完的！', 'Hmph... enough for today. Sun Quan, the black lotus blooms everywhere; you can\'t kill it all!');
    await N('赤蓮使焰無在火光中消失了。孫暠跪在地上。', 'Yan Wu, the Red Lotus Envoy, vanishes in a burst of fire. Sun Hao kneels on the ground.');
    const c = await choose('sunquan', '……', '...', [['你走吧。離開江東，永遠別回來。', 'Go. Leave Jiangdong and never come back.'], ['把他關起來。', 'Lock him up.']]);
    await T('sunhao', c === 0 ? '……仲謀，你比伯符更像個主公。' : '……是我自作自受。', c === 0 ? '...Zhongmou, you are more of a lord than Bofu ever was.' : '...I brought this on myself.');
    S.flags.won_sunhao = 1; S.flags.beaten_sun_hao = 1; S.flags.homeBase = 'jianye';
    if (!S.forms.includes('fengshi')) { S.forms.push('fengshi'); sfx('level'); await N('孫暠留下了「鋒矢陣圖」，習得了鋒矢陣！（需要武力80以上的主將）', 'Sun Hao leaves behind the Arrowhead Manual: you learn the Arrowhead formation! (It needs a leader with STR 80+)'); }
    await fade(() => toMap('jianye/hall'));
    playMusic('hymn');
    await N('建業城頭，重新升起了孫字大旗。', 'Over the walls of Jianye, the Sun banner flies once more.');
    await T('zhangzhao', '主公。老臣張昭，率江東文武，拜見主公！', 'My lord. Your old servant Zhang Zhao leads the officers of Jiangdong to greet you!');
    await T('jiyuan', '仲謀……不，主公。老夫就知道，你一定會回來。', 'Zhongmou... no, my lord. I always knew you would come back.');
    await T('josh', '（小聲）我們成功了？我們真的成功了？', '(quietly) We did it? We really did it?');
    await T('jasper', '（小聲）宮殿裡的點心是不是不用錢？', '(quietly) Are the snacks in the palace free?');
    await join('zhangzhao', Math.max(15, lvNow()), true); await join('guyong', Math.max(15, lvNow()), true);
    await N('張昭、顧雍加入了！建業成為了大本營：在這裡的客棧休息不用錢。', 'Zhang Zhao and Gu Yong join! Jianye is now your home base: resting at its inn is free.');
    await T('zhouyu', '主公，江夏的黃祖殺了老主公文台……雖然那是舊仇，但探子回報，黃祖的糧草也來自黑蓮教。', 'My lord, Huang Zu of Jiangxia killed your father in the old days... and our scouts report his supplies also come from the Black Lotus.');
    await chapter(4, '錦帆', 'Brocade Sails');
    return 'stay';
  }
  if (id === 'xisai' && S.chapter === 4 && !S.flags.won_xisai) {
    await N('西塞山下，江面上排滿了黃祖的戰船。', 'Beneath Xisai Hill, Huang Zu\'s warships crowd the river.');
    const r = await fight('xisai');
    if (r !== 'win') return 'stay';
    await N('黃祖的前哨水寨被攻破了！寨中有一個帶著鈴鐺的人在等你們。', 'Huang Zu\'s forward river camp falls! Inside, a man wearing bells is waiting for you.');
    return;
  }
  if (id === 'xiakou' && S.chapter === 4 && !S.flags.won_huangzu) {
    if (!S.flags.won_xisai) { await N('夏口的水軍太強了。先拿下下游的西塞山水寨。', 'Xiakou\'s navy is too strong. Take the river camp at Xisai Hill downstream first.'); return 'stay'; }
    await T('huangzu', '孫堅的兒子？當年我射死你老子，今天也一樣！', 'Sun Jian\'s son? I shot your father dead back then, and I\'ll do the same to you!');
    if (has('ganning')) await T('ganning', '黃祖！你的東城門，我已經替你打開了！', 'Huang Zu! I\'ve already opened your east gate for you!');
    const r = await fight('huangzu');
    if (r !== 'win') return 'stay';
    await N('夏口陷落。黃祖的書房裡，堆著荊州蔡瑁的來信——還有黑蓮的印記。', 'Xiakou falls. In Huang Zu\'s study are piles of letters from Cai Mao of Jing— marked with the black lotus.');
    await T('zhouyu', '蔡瑁。荊州水軍都督……黑蓮教的手，已經伸進荊州了。', 'Cai Mao. Grand Admiral of Jing\'s navy... the sect\'s hand has reached into Jing.');
    give('mn_yanxing'); S.forms.push('yanxing'); give('mn_yanxing', -1);
    await N('得到了「雁行陣圖」，習得了雁行陣！', 'You obtain the Wild Geese Manual and learn the Wild Geese formation!');
    S.flags.beaten_huang_zu = 1;
    await chapter(5, '荊襄風雲', 'Storm over Jing and Xiang');
    await T('erin', '荊州的江陵城裡，劉表的長子劉琦好像在求援。', 'In Jiangling, Liu Biao\'s eldest son Liu Qi seems to be calling for help.');
    return;
  }
  if (id === 'xiangyang' && S.chapter === 5 && !S.flags.won_caimao) {
    if (!S.flags.metLiuqi || !S.flags.alliedLiu) { await N('襄陽城防堅固。先去江陵見劉琦、去新野見劉備吧。', 'Xiangyang is strongly held. First see Liu Qi in Jiangling and Liu Bei in Xinye.'); return 'stay'; }
    await T('caimao', '劉琦小兒、劉備老賊、孫權黃口……都到齊了！', 'The brat Liu Qi, the old rogue Liu Bei, the babe Sun Quan... all here at once!');
    await T('chaoyin', '蔡瑁，退下。這些人，交給我「蒼蓮使」潮音。', 'Cai Mao, stand aside. Leave these to me, Chao Yin, the Blue Lotus Envoy.');
    const r = await fight('caimao');
    if (r !== 'win') return 'stay';
    await T('chaoyin', '……北方的大船隊已經出發了。孫權，你會在長江上被淹死。', '...The great fleet of the north has already set out. Sun Quan, you will drown in the Changjiang.');
    await N('蒼蓮使潮音化作一團水霧消失了。蔡瑁被荊州軍拿下。', 'Chao Yin, the Blue Lotus Envoy, dissolves into mist. Cai Mao is seized by Jing\'s own soldiers.');
    S.flags.beaten_cai_mao = 1;
    give('mn_shuijun'); S.forms.push('shuijun'); give('mn_shuijun', -1);
    await N('在蔡瑁的水軍大營中得到了「水軍陣圖」，習得了水軍陣！', 'In Cai Mao\'s naval camp you find the Naval Manual and learn the Naval Line formation!');
    await chapter(6, '長江怒濤', 'Fury on the Changjiang');
    await T('zhouyu', '探子回報：曹操的大將于禁率北方水軍沿漢水南下，打著「討伐孫權」的旗號。', 'Scouts report: Cao Cao\'s general Yu Jin is bringing the northern fleet down the Han under a banner that reads "Punish Sun Quan".');
    await T('sunquan', '曹操為什麼要打我？我們從沒交過手。', 'Why would Cao Cao attack me? We have never fought.');
    await T('jeff', '我猜，有人替你給他寫了很多「信」。……決戰地點？', 'I\'d guess someone has been writing him a lot of "letters" in your name. ...Where do we fight?');
    await T('zhouyu', '西塞山。我們的水寨就在那裡。傑夫，你的火船，造得出來嗎？', 'Xisai Hill. Our river camp is there. Jeff, can you build your fire rafts?');
    await T('jeff', '給我三天，和一百桶油。', 'Give me three days and a hundred barrels of oil.');
    await T('erin', '我會盯著天空。這個季節的江上，清晨總會起大霧。', 'I\'ll watch the sky. On this river, this time of year, a thick fog rises every dawn.');
    return;
  }
  if (id === 'xisai' && S.chapter === 6 && !S.flags.won_fleet2) {
    await naval();
    return 'stay';
  }
  if (id === 'shouchun' && S.chapter === 7 && !S.flags.won_yuanshu) {
    if (!S.flags.metZhangliao) { await N('壽春的城牆上掛滿了「仲」字黃旗。先去合肥見見曹軍的人。', 'Yellow banners marked "Zhong" hang all over Shouchun\'s walls. First go to Hefei and meet Cao\'s people.'); return 'stay'; }
    await T('yuanshu', '朕乃仲家皇帝！黑蓮聖主說了，天命在朕！', 'We are the Emperor of Zhong! The Lord of the Lotus says Heaven\'s mandate is Ours!');
    await T('jasper', '他頭上的帽子好像是偷來的。', 'That crown looks stolen.');
    const r = await fight('yuanshu');
    if (r !== 'win') return 'stay';
    await N('袁術的「仲家」覆滅了。', 'Yuan Shu\'s "Zhong dynasty" is no more.');
    if (!S.forms.includes('changshe')) { S.forms.push('changshe'); sfx('level'); await N('在袁術的宮中找到了「長蛇陣圖」，習得了長蛇陣！', 'In Yuan Shu\'s palace you find the Long Snake Manual and learn the Long Snake formation!'); }
    S.flags.won_yuanshu = 1;
    return;
  }
  if (id === 'guandu' && S.chapter === 7 && !S.flags.won_guandu) {
    if (!S.flags.metCao) { await N('官渡兩軍對峙。先去許昌見曹操吧。', 'At Guandu two armies face each other. Go to Xuchang and see Cao Cao first.'); return 'stay'; }
    await T('yanliang', '河北四庭柱顏良在此！', 'Yan Liang, pillar of Hebei, is here!');
    await T('wenchou', '還有文醜！', 'And Wen Chou!');
    const r = await fight('guandu');
    if (r !== 'win') return 'stay';
    await N('顏良、文醜敗走！袁紹的大軍退回了鄴城。', 'Yan Liang and Wen Chou are routed! Yuan Shao\'s great army falls back to Ye.');
    return 'stay';
  }
  if (id === 'ye' && S.chapter === 7 && !S.flags.won_yuanshao) {
    if (!S.flags.won_guandu || !S.flags.won_yuanshu) { await N('鄴城固若金湯。先拿下壽春與官渡吧。', 'Ye is impregnable. First take Shouchun and Guandu.'); return 'stay'; }
    await T('yuanshao', '我袁家四世三公！你們這些……這些……', 'Four generations of the Yuan have served as the Three Excellencies! You... you...');
    await T('shuangjing', '本初公累了。白蓮使霜鏡，代為迎客。', 'Lord Benchu is tired. I, Shuang Jing the White Lotus Envoy, will receive our guests.');
    const r = await fight('yuanshao');
    if (r !== 'win') return 'stay';
    await T('shuangjing', '……有趣。下次見面，在黑蓮宮。', '...Interesting. Next time we meet, it will be in the Black Lotus Palace.');
    await N('袁紹兵敗，河北平定了。牢中被囚禁的田豐、沮授等人重見天日。', 'Yuan Shao is beaten and Hebei is at peace. Tian Feng, Ju Shou and others are freed from his dungeons.');
    S.flags.beaten_yuan = 1;
    await chapter(8, '長安迷霧', 'Mist over Chang\'an');
    await T('caocao', '仲謀，西邊出事了。董卓——那個早就該死的董卓，在長安活過來了。', 'Zhongmou, there\'s trouble in the west. Dong Zhuo— the Dong Zhuo who should be long dead— has risen again in Chang\'an.');
    await T('caocao', '我們一起去。先到洛陽。', 'We go together. First, to Luoyang.');
    return;
  }
  if (id === 'luoyang' && S.chapter === 8 && !S.flags.seal) {
    await fade(() => {});
    await N('洛陽的廢墟中，宮中的一口古井泛著五色的光。', 'In the ruins of Luoyang, an old well in the palace glows with five colours.');
    await T('jasper', '下面有東西！我去撈！', 'There\'s something down there! I\'ll fish it out!');
    give('seal'); S.flags.seal = 1; sfx('chest');
    await N('賈斯珀撈起了「傳國玉璽」！', 'Jasper fishes up the Imperial Seal!');
    await T('sunquan', '……受命於天，既壽永昌。這不是我們該拿的東西。等天下太平，還給天下吧。', '...Having received the mandate from Heaven, may the reign be long and prosperous. This is not ours to keep. When peace comes, we give it back to the realm.');
    return;
  }
  if (id === 'hulao' && S.chapter === 8 && !S.flags.won_hulao) { const r = await fight('hulao'); if (r !== 'win') return 'stay'; await N('虎牢關被攻破了！', 'Hulao Gate falls!'); return 'stay'; }
  if (id === 'tongguan' && S.chapter === 8 && !S.flags.won_tongguan) { if (!S.flags.won_hulao) { await N('先打通東邊的虎牢關。', 'First break through Hulao Gate in the east.'); return 'stay'; } const r = await fight('tongguan'); if (r !== 'win') return 'stay'; await N('潼關被攻破了！長安就在眼前。', 'Tong Gate falls! Chang\'an lies ahead.'); return 'stay'; }
  if (id === 'meiwu' && S.chapter === 8 && !S.flags.won_dongzhuo) {
    if (!S.flags.won_tongguan || !S.flags.metDiao) { await N('郿塢的城牆高得嚇人。先去長安打聽消息。', 'Mei Fortress has terrifyingly high walls. Go to Chang\'an for news first.'); return 'stay'; }
    playMusic('tension');
    await T('dongzhuo', '哈哈哈！吃了黑蓮丹，我董卓長生不死！奉先，給我殺了他們！', 'Ha ha ha! With the black lotus pill, I, Dong Zhuo, live forever! Fengxian, kill them!');
    await T('diaochan', '奉先！看看他的眼睛！那不是人的眼睛！', 'Fengxian! Look at his eyes! Those aren\'t human eyes!');
    await T('lubu', '…………義父。你……真的是我的義父嗎？', '............Father. Are you... really my father?');
    await N('呂布調轉了畫戟。', 'Lü Bu turns his halberd around.');
    const r = await fight('dongzhuo');
    if (r !== 'win') return 'stay';
    await N('董卓的身體化成了黑色的花瓣，散落一地。', 'Dong Zhuo\'s body crumbles into black petals that scatter over the floor.');
    S.flags.beaten_dong = 1;
    // the twist: a messenger from home
    await T(['傳令兵', 'Messenger'], '主公！主公！建業……建業出事了！', 'My lord! My lord! Jianye... something has happened in Jianye!');
    await T(['傳令兵', 'Messenger'], '季淵大人他……他打開城門，迎入了黑蓮教的大軍！張昭大人被關進了大牢！', 'Elder Ji Yuan... he opened the gates to the Black Lotus army! Lord Zhang Zhao is in prison!');
    await T('sunquan', '……季老？', '...Elder Ji?');
    await T('jasper', '……我說過的。黑色的花瓣。', '...I told you. The black petals.');
    await T('erin', '賈斯珀……', 'Jasper...');
    await T('sunquan', '……不，賈斯珀說得對。是我不願意相信。……回建業。', '...No, Jasper was right. I didn\'t want to believe it. ...Back to Jianye.');
    S.flags.betrayal = 1;
    if (S.roster.zhangzhao) { S.front = S.front.filter((x) => x !== 'zhangzhao' && x !== 'guyong'); }
    await chapter(9, '歸鄉', 'Homecoming');
    return;
  }
  if (id === 'moling' && S.chapter === 9 && !S.flags.won_jianye2) { const r = await fight('jianye2'); if (r !== 'win') return 'stay'; await N('秣陵關的黑蓮教守軍被擊潰了！', 'The sect\'s guards at Moling Gate are crushed!'); return 'stay'; }
  if (id === 'jianye' && S.chapter === 9 && !S.flags.won_jiyuan) {
    if (!S.flags.won_jianye2) { await N('建業城外滿是黑蓮教的兵。先拿下秣陵關。', 'Sect soldiers swarm outside Jianye. Take Moling Gate first.'); return 'stay'; }
    await fade(() => toMap('jianye/hall'));
    playMusic('dark');
    await T('jiyuan', '主公。……不，仲謀。你回來得比我想的還快。', 'My lord. ...No, Zhongmou. You came back sooner than I thought.');
    await T('sunquan', '為什麼？你教了我十年。你看著我長大。', 'Why? You taught me for ten years. You watched me grow up.');
    await T('jiyuan', '正因為看著你長大，我才知道：孫家的人，只會打仗，打仗，再打仗。這天下需要的不是英雄，是一個永遠不死的聖主。', 'Because I watched you grow, I know: the house of Sun only makes war, and war, and more war. The realm needs no hero. It needs a holy lord who never dies.');
    await T('jiyuan', '于吉大人當年被孫策所殺，卻從黑蓮中重生。他會終結這個亂世——用他的方式。', 'Master Yu Ji was slain by Sun Ce, but rose again from the black lotus. He will end this age of chaos— his way.');
    await T('josh', '用毒酒的方式？用殺人全家的方式？……那不叫終結。', 'With poisoned wine? By killing whole families? ...That isn\'t ending anything.');
    await T('mingzhao', '左使大人，跟他們廢話什麼。紫蓮使冥照，奉命清理門戶。', 'Left Envoy, why waste words on them? I, Ming Zhao the Purple Lotus Envoy, have orders to clean house.');
    const r = await fight('jiyuan');
    if (r !== 'win') return 'stay';
    await T('jiyuan', '……仲謀……你……的確長大了……', '...Zhongmou... you... really have grown...');
    await N('季淵倒下了。紫蓮使冥照化作紫煙，逃向西方。', 'Ji Yuan falls. Ming Zhao the Purple Lotus Envoy turns to purple smoke and flees west.');
    await T('jiyuan', '于吉大人……在巫峽……黑蓮宮……要去，就帶上……所有的人……', 'Master Yu Ji... is in the Wu Gorge... the Black Lotus Palace... if you go, take... everyone...');
    S.flags.won_jiyuan = 1; S.flags.betrayal = 0;
    await N('張昭被救了出來。建業重新回到了孫權手中。', 'Zhang Zhao is freed. Jianye is in Sun Quan\'s hands once more.');
    await T('erin', '主公……今晚，要不要一起看星星？我想跟你說說我的家鄉。', 'My lord... tonight, shall we look at the stars together? I want to tell you about my home.');
    await T('sunquan', '……好。我也想聽。', '...Yes. I would like to hear it.');
    await N('那一夜，艾琳指著西方的天空，講述大海另一邊的城市、港口和燈塔。孫權第一次知道，天下比他想像的還要大。', 'That night Erin points to the western sky and tells of cities, harbours and lighthouses beyond the sea. For the first time, Sun Quan learns the world is larger than he ever imagined.');
    await T('zhouyu', '要去巫峽，得先經過益州。劍閣的張任聽命於被黑蓮控制的劉璋，漢中則是黑蓮教的老巢之一。', 'To reach the Wu Gorge we must pass through Yi. Zhang Ren at Jiange obeys Liu Zhang, whom the sect controls, and Hanzhong is one of the sect\'s dens.');
    return 'stay';
  }
  if (id === 'jiange' && S.chapter === 9 && !S.flags.won_zhangren) {
    if (!S.flags.won_jiyuan) { await N('劍閣天險。現在不是時候，先回建業。', 'Jiange is a natural fortress. Not now; return to Jianye first.'); return 'stay'; }
    await T('zhangren', '劍閣一夫當關。孫權，你過不去的。', 'At Jiange one man can hold the pass. Sun Quan, you shall not pass.');
    const r = await fight('zhangren');
    if (r !== 'win') return 'stay';
    await N('張任敗了。被黑蓮控制的劉璋也清醒過來。', 'Zhang Ren is beaten, and Liu Zhang, freed from the sect\'s hold, comes to his senses.');
    S.flags.beaten_liu_zhang = 1;
    return 'stay';
  }
  if (id === 'hanzhong' && S.chapter === 9 && !S.flags.won_yanwu) {
    if (!S.flags.won_jiyuan) { await N('漢中被黑霧籠罩……現在還不能進去。', 'Hanzhong is wrapped in black fog... you cannot enter yet.'); return 'stay'; }
    await T('yanwu', '孫權！建業一別，我等這一天很久了！', 'Sun Quan! Since Jianye, I have waited long for this day!');
    const r = await fight('yanwu');
    if (r !== 'win') return 'stay';
    await T('yanwu', '……聖主……焰無……盡力了……', '...My lord... Yan Wu... did all he could...');
    await N('赤蓮使焰無化成了灰燼。', 'Yan Wu, the Red Lotus Envoy, turns to ash.');
    if (S.flags.won_zhangren) {
      await chapter(10, '黑蓮', 'The Black Lotus');
      await T('sunquan', '去白帝城。所有的人，都在那裡等我們。', 'To Baidi. Everyone is waiting for us there.');
    }
    return;
  }
  if (id === 'baidi' && S.chapter >= 9 && S.flags.won_zhangren && S.flags.won_yanwu && S.chapter < 10) { await chapter(10, '黑蓮', 'The Black Lotus'); }
  if (id === 'baidi' && S.chapter === 10 && !S.flags.gathered) {
    await fade(() => toMap('baidi/hall'));
    playMusic('hymn');
    await T('liubei', '孫將軍。劉備率荊州兵馬，前來助陣。', 'General Sun. Liu Bei brings the army of Jing to join you.');
    await T('caocao', '曹某也來了。……別誤會，我只是不想讓別人搶了這份功勞。', 'I am here too. ...Don\'t misunderstand; I simply won\'t let anyone else take the credit.');
    await T('zhugeliang', '黑蓮宮有四層。每一層都有蓮使守護。最深處，就是于吉。', 'The Black Lotus Palace has four levels, each guarded by a Lotus Envoy. At the very bottom is Yu Ji.');
    await T('sunquan', '……父親，大哥。我回來了，帶著很多很多的朋友。', '...Father. Brother. I have come back, with many, many friends.');
    await T('josh', '走吧。打完這一仗，我請大家吃包子。', 'Let\'s go. When this fight is over, buns are on me.');
    await T('jasper', '我記住了喔！', 'I\'m holding you to that!');
    S.flags.gathered = 1;
    healAll(1);
    give('tpbig', 3); give('jinchuang', 5); give('zhaohun', 3);
    await N('得到了神機丹×3、金創藥×5、招魂幡×3！全軍恢復了。', 'Received Sage Pill x3, Wound Balm x5, Rallying Banner x3! The whole army is restored.');
    return 'stay';
  }
  if (id === 'yizhouisle' && !S.flags.won_pirates) {
    await N('夷洲的海灘上，海盜的船隊正在搶掠村莊！', 'On the beaches of Yizhou, a pirate fleet is plundering the village!');
    await T('erin', '他們的船是從東邊的海上來的……主公，救人要緊！', 'Their ships came out of the eastern sea... my lord, the villagers first!');
    const r = await fight('pirates');
    if (r !== 'win') return 'stay';
    await N('海盜被趕走了。村長獻上了一顆南海明珠，還有一架海盜船上搶來的奇怪儀器。', 'The pirates are driven off. The village head offers a South Sea Pearl, and a strange instrument taken from the pirate ship.');
    give('pearl'); give('sextant'); sfx('chest');
    await T('erin', '這是……星盤！我們家鄉的航海儀器！它怎麼會在這裡？', 'This is... an astrolabe! A navigator\'s instrument from my home! How did it get here?');
    await T('jasper', '說不定很久以前，也有人從我們那邊漂流過來。', 'Maybe long ago someone else drifted here from our side of the sea.');
    return;
  }
  if (id === 'wuxia' && S.chapter < 10) { await N('巫峽的江面上飄著黑色的蓮花。濃霧深處，什麼也看不見。', 'Black lotus flowers drift on the river of the Wu Gorge. Deep in the fog, nothing can be seen.'); return 'stay'; }
  if (id === 'wuxia' && !S.flags.gathered) { await N('先去白帝城，和大家會合吧。', 'Go to Baidi first and join the others.'); return 'stay'; }
  if (id === 'wuxia') { await fade(() => toMap('wuxia/f1')); playMusic('sect'); return 'stay'; }
  return undefined;
}

// the great battle on the river
async function naval() {
  playMusic('naval');
  await N('黎明。濃霧籠罩長江。', 'Dawn. Thick fog lies over the Changjiang.');
  await T('erin', '霧會在辰時散開。風向……東南。主公，就是現在！', 'The fog will lift at the hour of the dragon. The wind... south-east. My lord, now!');
  await T('jeff', '火龍船準備好了。點火的時候，記得離遠一點。', 'The fire rafts are ready. When we light them, stand well back.');
  if (!S.flags.won_fleet1) {
    await N('于禁的先鋒——樂進的船隊，從霧中衝了出來！', 'Yu Jin\'s vanguard— Yue Jin\'s squadron— bursts out of the fog!');
    const r = await fight('fleet1');
    if (r !== 'win') return;
    S.flags.won_fleet1 = 1;
    healAll(0.5);
    await N('先鋒被擊退了！全軍兵力恢復了一部分。主力艦隊正在逼近！', 'The vanguard is driven back! The army recovers some of its troops. The main fleet is closing in!');
  }
  await T('yujin', '孫權！你寫信辱罵丞相，今日就讓你葬身魚腹！', 'Sun Quan! You insulted the Chancellor in your letters; today the fish will have you!');
  await T('sunquan', '于將軍！那些信不是我寫的！黑蓮教在利用你們！', 'General Yu! I never wrote those letters! The Black Lotus is using you!');
  await T('chaoyin', '于禁，別聽他的。殺。', 'Yu Jin, don\'t listen. Kill.');
  const r = await fight('fleet2');
  if (r !== 'win') return;
  playMusic('hymn');
  await N('火龍船衝進了北方的艦隊。江面上一片火海。', 'The fire rafts plunge into the northern fleet. The river becomes a sea of flame.');
  await T('yujin', '……我輸了。孫權，那些信……你說不是你寫的？', '...I am beaten. Sun Quan, those letters... you say you never wrote them?');
  await T('jeff', '我比對過了。信上的墨，和嚴白虎營帳裡那封密信，是同一種墨。上面還有黑蓮的暗紋。', 'I compared them. The ink in those letters is the same as in the secret letter from Yan Baihu\'s tent. It carries the black lotus watermark too.');
  await T('yujin', '……我會把這些帶回去給丞相。', '...I will take these back to the Chancellor.');
  await T('chaoyin', '我……潮音……怎麼會輸給……海外的……', 'I... Chao Yin... how could I lose to... foreigners...');
  await N('蒼蓮使潮音沉入了江底。', 'Chao Yin, the Blue Lotus Envoy, sinks beneath the river.');
  S.flags.won_fleet2 = 1;
  await T('jeff', '對了，主公。從北方艦隊那裡繳了一艘大樓船，我改了改帆——現在它能逆風走了。', 'Oh, my lord. We captured a big tower ship from the northern fleet and I re-rigged the sails. Now she can sail into the wind.');
  await T('erin', '有了船，長江、大海，哪裡都去得了。……東邊海上還有一座大島，叫夷洲。', 'With a ship, the river and the sea are ours. ...Out in the eastern sea there\'s a big island called Yizhou.');
  S.flags.ship = 1;
  // the ship waits at the river by Xisai
  S.ship = findWater(PLACES.xisai[2], PLACES.xisai[3]);
  await N('得到了戰船！在港口或岸邊走向船隻即可登船，在江河與海上航行。', 'You have a warship! Walk onto it at the shore to board, and sail the rivers and seas.');
  await chapter(7, '中原', 'The Central Plains');
  await T('zhouyu', '曹操派人送信來了：于禁回去以後，丞相願意結盟。他請主公到合肥一敘。', 'A letter from Cao Cao: after Yu Jin\'s return, the Chancellor wishes an alliance. He invites you to talk at Hefei.');
}
function findWater(x, y) {
  const WD = FIELD.WD;
  for (let r = 1; r < 10; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const X = x + dx, Y = y + dy, k = WD.t[Y * WW + X];
    if (k === K.RIVER || k === K.SHOAL || k === K.LAKE) return { x: X, y: Y };
  }
  return { x, y: y + 1 };
}
STORY.onMap = async (mapId) => {
  // nothing yet; hooks for rooms
};
// ---------- triggers: governors' seats, cave goals ----------
const CAVE_REWARD = { shanyue: ['mn_yulin', 'zulang'], tianzhu: ['bk_heal', 'tianzhu'], jiuyi: ['mn_yanyue', 'jiuyi'] };
export async function onTrigger(e) {
  if (e.type === 'cavegoal' && e.sq) return sqGoal(e);
  if (e.type === 'cavegoal') {
    const id = e.place;
    if (id === 'wuxia') return finalDungeon(F.map.floor);
    if (S.flags['cave_' + id]) return N('這裡已經什麼都沒有了。', 'There is nothing more here.');
    const [item, boss] = CAVE_REWARD[id] || ['tpdan', null];
    if (boss && !S.flags['won_' + boss]) {
      if (GENERALS[boss]) await T(boss, '誰敢闖我的洞！', 'Who dares enter my caves!');
      else await N('洞窟深處，黑蓮教的祭司正在祭壇前念咒！', 'Deep in the cave, Black Lotus priests chant before an altar!');
      const r = await fight(boss);
      if (r !== 'win') return;
      if (boss === 'zulang') { await T('zulang', '……你比嚴白虎強。我祖郎，服你！', '...You\'re stronger than Yan Baihu. I, Zu Lang, submit!'); await join('zulang', Math.max(8, lvNow())); }
    }
    S.flags['cave_' + id] = 1;
    if (ITEMS[item].form) { S.forms.push(ITEMS[item].form); sfx('level'); await N(`找到了「${ITEMS[item].zh}」，習得了${FORMS[ITEMS[item].form].zh}！`, `Found the ${ITEMS[item].en} and learned the ${FORMS[ITEMS[item].form].en} formation!`); }
    else if (ITEMS[item].tr) await gainTreasure(item);
    else { give(item); sfx('chest'); await N(`找到了「${ITEMS[item].zh}」！`, `Found ${ITEMS[item].en}!`); }
    return;
  }
  if (e.type === 'lordseat') return N('空著的主座。', 'An empty lord\'s seat.');
}
async function finalDungeon(floor) {
  const steps = { 1: 'lotus1', 2: 'lotus2', 3: null, 4: 'yuji1' };
  if (floor < 4) {
    const b = steps[floor];
    if (b && !S.flags['won_' + b]) {
      if (b === 'lotus1') await T('shuangjing', '又見面了。白蓮之下，萬物皆冰。', 'We meet again. Beneath the white lotus, all things freeze.');
      if (b === 'lotus2') await T('mingzhao', '紫蓮使冥照。這一次，沒有退路了。', 'Ming Zhao, Purple Lotus Envoy. This time there is no retreat.');
      const r = await fight(b);
      if (r !== 'win') return;
      await N('蓮使倒下了。通往下一層的封印解開了。', 'The envoy falls. The seal on the way down is broken.');
      const [x, y, d] = [FIELD.tileX(), FIELD.tileY(), F.dir]; toMap(F.mapId, x, y, d);
    }
    return N('祭壇上的黑蓮已經枯萎了。', 'The black lotus on the altar has withered.');
  }
  // the bottom: Yu Ji
  playMusic('dark');
  await T('yuji', '孫家的小兒。你的兄長殺了我一次。你以為，你能殺我第二次嗎？', 'Little son of Sun. Your brother killed me once. Do you think you can kill me a second time?');
  await T('sunquan', '我不是來報仇的。我是來結束這一切的。', 'I did not come for vengeance. I came to end all this.');
  await T('yuji', '結束？亂世四百年，只有永生的聖主能結束它！我讓群雄互相殘殺，讓天下流盡最後一滴血——然後，在空無一人的天下，建立永恆的黑蓮淨土！', 'End it? Four hundred years of chaos, and only an undying holy lord can end it! I set the warlords against each other until the realm bleeds its last drop— then on an empty earth I raise the eternal Pure Land of the Black Lotus!');
  await T('jasper', '……空無一人？那你要跟誰說話？', '...An empty earth? Then who would you even talk to?');
  await T('yuji', '…………放肆！', '............Insolence!');
  let r = 'win';
  if (!S.flags.won_yuji1) r = await fight('yuji1');
  if (r !== 'win') return;
  playMusic('finalboss');
  await T('yuji', '呵呵呵……肉身而已。黑蓮——開！', 'Heh heh heh... only flesh. Black lotus— BLOOM!');
  healAll(0.6);
  await N('全軍振作精神！兵力恢復了一部分！', 'The army steels itself! Troops partly restored!');
  r = await fight('yuji2');
  if (r !== 'win') return;
  await ending();
}

// ---------- chests ----------
const CHEST_ITEMS = [['salve', 'salve', 'wine', 'gold', 'smoke', 'incense'], ['jinchuang', 'wine', 'tpdan', 'gold', 'goodwine', 'zhaohun', 'gunpowder'], ['jinchuang', 'rations', 'tpdan', 'gold', 'oldbook', 'zhaohun', 'huxin', 'wristguard'], ['rations', 'tpbig', 'gold', 'silk', 'jade', 'bingfu', 'warcape', 'pearl']];
const SPECIAL_CHEST = { tianzhu_f2_1: 'yitian', jiuyi_f3_3: 'longdan', jiuyi_f2_1: 'bk_rock', shanyue_f2_3: 'compass', wuxia_f2_1: 'qinggang', wuxia_f3_3: 'dragoncape', wuxia_f1_3: 'bk_inferno', tianzhu_f1_3: 'bk_stun' };
export async function openChest(e) {
  if (S.chests[e.id]) return N('箱子是空的。', 'The chest is empty.');
  if (e.tr) return openTreasureChest(e);
  S.chests[e.id] = 1;
  sfx('chest');
  let item = e.item || SPECIAL_CHEST[e.id];
  if (!item) {
    const P = PLACES[F.map.place], ch = REGIONS[P[5]] ? REGIONS[P[5]][4] : 1, tier = Math.min(3, Math.floor(ch / 3) + (F.map.kind === 'cave' ? 1 : 0));
    const pool = CHEST_ITEMS[tier];
    item = pool[Math.floor(hash(e.id.length, e.id.charCodeAt(e.id.length - 1), 7) * pool.length)];
    if (item === 'gold') { const g = 60 + ch * 80 + Math.floor(hash(e.id.length, 3, 3) * 100); S.gold += g; return N(`得到了${g}金！`, `Found ${g} gold!`); }
  }
  if (ITEMS[item].tr) return gainTreasure(item, ['寶箱裡是', 'In the chest:']);
  give(item);
  return N(`得到了「${ITEMS[item].zh}」！`, `Found ${ITEMS[item].en}!`);
}

// ---------- the boatman and shrines ----------
async function boatman() {
  if (!S.flags.ship) return say(L('船夫', 'Boatman'), L('過江就走渡口的渡船吧，路上的渡口都有船。要出海？那得有自己的大船才行。', 'To cross the river, use the ferries where the roads meet the water. Going to sea? You\'ll need a big ship of your own.'));
  const c = await ask(L('船夫', 'Boatman'), L('主公的戰船停在別處。要我派人把船開到這個港口來嗎？', 'Your warship is moored elsewhere, my lord. Shall I have it brought round to this port?'), [L('好', 'Yes'), L('不用', 'No')], { back: 1 });
  if (c === 0) { const P = PLACES[F.map.place]; S.ship = findWater(P[2], P[3]); S.vehicle = S.horse ? 'horse' : 'foot'; sfx('door'); await say(L('船夫', 'Boatman'), L('船已經在港外等著了。', 'The ship is waiting outside the port.')); }
}
const SHRINE_GIFT = { huangshan: 'mn_changshe', lushan: 'bk_water', huashan: 'mn_fengshi' };
async function shrine(place) {
  const gift = SHRINE_GIFT[place];
  if (gift && !S.flags['shrine_' + place]) {
    S.flags['shrine_' + place] = 1;
    await say(L('老僧', 'Old Monk'), L('施主一路辛苦。這卷書在貧僧這裡放了三十年，今日終於等到有緣人。', 'You have travelled far. This scroll has waited with me thirty years for the right person. Today it has found you.'));
    const it = ITEMS[gift];
    if (it.form) { if (!S.forms.includes(it.form)) S.forms.push(it.form); sfx('level'); return N(`習得了「${FORMS[it.form].zh}」！`, `Learned the ${FORMS[it.form].en} formation!`); }
    give(gift); sfx('chest'); return N(`得到了「${it.zh}」！`, `Received ${it.en}!`);
  }
  const c = await ask(L('老僧', 'Old Monk'), L('要在佛前祈福嗎？全軍會恢復一些精神。（免費）', 'Will you pray before the Buddha? Your army will recover a little. (Free)'), [L('祈福', 'Pray'), L('不用了', 'No thanks')], { back: 1 });
  if (c === 0) { healAll(0.15); sfx('heal'); await N('一股暖意流過全軍。', 'A warmth flows through the army.'); }
}
export async function warpHome() {
  const id = S.lastTown || 'haiyan';
  await fade(() => toMap(id));
  playMusic((F.map && F.map.music) || 'town');
}
export async function exitCave() {
  const P = PLACES[F.map.place];
  await fade(() => toWorld(P[2], P[3] + 1, 'd'));
  playMusic(G().worldSong());
}

// ---------- the ending ----------
async function ending() {
  stopMusic(1);
  STORY.dark = 0.6;
  await N('黑蓮宮崩塌了。巫峽的江面上，黑色的蓮花一朵一朵地沉入水中。', 'The Black Lotus Palace collapses. On the river in the Wu Gorge, the black lotus flowers sink one by one.');
  STORY.dark = 1;
  await wait(40);
  toMap('luoyang/hall');
  F.ents = F.ents.filter((e) => e.type !== 'npc');
  actor('sunquan', 8, 4, 'd'); actor('caocao', 6, 6, 'r'); actor('liubei', 10, 6, 'l'); actor('zhouyu', 6, 8, 'r'); actor('zhugeliang', 10, 8, 'l');
  actor('jeff', 5, 10, 'u'); actor('erin', 7, 10, 'u'); actor('josh', 9, 10, 'u'); actor('jasper', 11, 10, 'u');
  F.px = 8 * 16; F.py = 11 * 16; F.hideLeader = true;
  STORY.dark = 0;
  playMusic('hymn');
  await N('數月之後。重建中的洛陽。', 'Some months later. Luoyang, rising from its ruins.');
  await T('caocao', '天下英雄，都在這裡了。仲謀，玉璽在你手上。你想當皇帝嗎？', 'Every hero in the realm is here. Zhongmou, the Seal is in your hands. Do you want to be emperor?');
  await T('sunquan', '不想。', 'No.');
  await T('liubei', '……那你想要什麼？', '...Then what do you want?');
  await T('sunquan', '我想要一個不需要聖主的天下。北方由曹公治理，荊益由劉公守護，江東交給我。誰再挑起戰火，其他兩家共擊之。玉璽……就放在洛陽，放在百姓都看得到的地方。', 'A realm that needs no holy lord. Lord Cao governs the north, Lord Liu guards Jing and Yi, and Jiangdong is mine. Whoever starts a war again, the other two strike together. And the Seal... stays in Luoyang, where the people can see it.');
  await T('caocao', '……哈哈哈！好一個孫仲謀！曹某，同意了。', '...Ha ha ha! What a Sun Zhongmou! I agree.');
  await T('liubei', '劉備，同意。', 'Liu Bei agrees.');
  await N('史稱「洛陽之盟」。孫權被推為盟主，天下三分而共治，歸於太平。', 'History calls it the Covenant of Luoyang. Sun Quan was chosen as its head, and the realm, shared among three, came at last to peace.');
  await T('erin', '主公。……我找到回家的航線了。星星告訴我的。', 'My lord. ...I have found the course home. The stars told me.');
  await T('sunquan', '……要走了嗎？', '...You are leaving?');
  await T('jeff', '船我已經造好了。比「流星號」還結實。', 'I\'ve already built the ship. Sturdier than the Wandering Star.');
  await T('josh', '包子我已經請過了。……大家吃得很開心。', 'I already bought everyone buns. ...Everyone enjoyed them.');
  await T('jasper', '我不走。我還沒找到洛陽所有的點心店。', 'I\'m not going. I haven\'t found every snack shop in Luoyang yet.');
  await T('erin', '賈斯珀！', 'Jasper!');
  await T('sunquan', '……那就這樣吧。艾琳、傑夫、喬許，你們回家去，把這邊的事告訴你們的家人。然後——再回來。這裡也是你們的家。', '...Then let it be so. Erin, Jeff, Josh: go home and tell your families what happened here. And then— come back. This is your home too.');
  await T('erin', '……一定。我們一定回來。', '...We will. We will come back.');
  STORY.dark = 0.5;
  await N('江東霸業傳　完', 'Saga of Jiangdong — The End');
  await N(`遊戲時間 ${Math.floor(S.time / 3600)}小時${Math.floor((S.time % 3600) / 60)}分　戰鬥 ${S.battles || S.wins}場　武將 ${Object.keys(S.roster).length}名`, `Play time ${Math.floor(S.time / 3600)}h ${Math.floor((S.time % 3600) / 60)}m   Battles won ${S.wins}   Generals ${Object.keys(S.roster).length}`);
  await N('感謝遊玩。製作中使用的開放素材，請見CREDITS。', 'Thank you for playing. The open assets used are listed in CREDITS.');
  S.flags.ended = 1;
  STORY.dark = 0;
  F.hideLeader = false;
}
// the order of the main story, for the test bot: [chapter, place to go, what to do there]
STORY.path = [
  [1, 'haiyan', 'talk:shipwreck'], [1, 'wu/hall', 'talk:zhuzhi'], [1, 'wucheng', 'enter'],
  [2, 'juchao', 'talk:lusu'], [2, 'shu/hall', 'talk:zhouyu'], [2, 'wan', 'enter'],
  [3, 'qua', 'talk:oldguard'], [3, 'moling', 'enter'], [3, 'jianye', 'enter'],
  [4, 'xisai', 'enter'], [4, 'xisai', 'talk:ganning'], [4, 'xiakou', 'enter'],
  [5, 'jiangling/hall', 'talk:liuqi'], [5, 'xinye', 'talk:liubei'], [5, 'longzhong', 'talk:zhugeliang'], [5, 'xiangyang', 'enter'],
  [6, 'xisai', 'enter'],
  [7, 'hefei/hall', 'talk:zhangliao'], [7, 'shouchun', 'enter'], [7, 'xuchang/hall', 'talk:caocao'], [7, 'guandu', 'enter'], [7, 'ye', 'enter'],
  [8, 'luoyang', 'enter'], [8, 'hulao', 'enter'], [8, 'tongguan', 'enter'], [8, 'changan', 'talk:diaochan'], [8, 'meiwu', 'enter'],
  [9, 'moling', 'enter'], [9, 'jianye', 'enter'], [9, 'jiange', 'enter'], [9, 'hanzhong', 'enter'],
  [10, 'baidi', 'enter'], [10, 'wuxia/f1', 'goal'], [10, 'wuxia/f2', 'goal'], [10, 'wuxia/f4', 'goal'],
];
// what each story step must achieve (for the test bot)
const EXPECT = { 'wucheng|enter': 'won_yanbaihu', 'wan|enter': 'won_liuxun', 'qua|talk:oldguard': 'won_qua', 'moling|enter': ['won_moling', 'won_jianye2'], 'jianye|enter': ['won_sunhao', 'won_jiyuan'],
  'xisai|enter': ['won_xisai', 'won_fleet2'], 'xiakou|enter': 'won_huangzu', 'changsha|talk:huangzhong': 'won_changsha', 'xiangyang|enter': 'won_caimao', 'shouchun|enter': 'won_yuanshu', 'guandu|enter': 'won_guandu', 'ye|enter': 'won_yuanshao',
  'hulao|enter': 'won_hulao', 'tongguan|enter': 'won_tongguan', 'meiwu|enter': 'won_dongzhuo', 'jiange|enter': 'won_zhangren', 'hanzhong|enter': 'won_yanwu', 'wuxia/f1|goal': 'won_lotus1', 'wuxia/f2|goal': 'won_lotus2', 'wuxia/f4|goal': 'ended' };
STORY.need = (map, act) => { let e = EXPECT[map + '|' + act]; if (!e) return false; if (Array.isArray(e)) e = S.chapter >= 6 && map !== 'jianye' && map !== 'moling' ? e[1] : (S.chapter >= 9 ? e[1] : e[0]); if (map === 'xisai' && act === 'enter') e = S.flags.won_xisai && S.chapter >= 6 ? 'won_fleet2' : 'won_xisai'; return !S.flags[e]; };

// ---------- Jasper's secrets: things hidden on the world map that only sharp young eyes see ----------
export const SECRETS = [
  [233, 110, 'goodwine'], [217, 97, 'huxin'], [196, 96, 'bk_fire'], [186, 122, 'scarf'], [211, 140, 'pearl'], [170, 108, 'irontaibow'], [151, 128, 'oldbook'],
  [136, 96, 'mn_tuzhen'], [129, 150, 'silk'], [205, 72, 'bingfu'], [181, 44, 'dawan'], [150, 30, 'jueying'], [118, 74, 'sunzi'], [72, 70, 'yangyouji'],
  [60, 120, 'qingnang'], [240, 152, 'sextant'], [96, 112, 'goldarmour'], [140, 60, 'zijinguan'], [62, 40, 'chitu'],
];
// the treasures buried in the wilds join Jasper's secrets
for (const id of TREASURES) { const sc = SRC[id]; if (sc && sc.t === 'secret' && !SECRETS.some((x) => x[2] === id)) SECRETS.push([sc.x, sc.y, id]); }
const jasperHere = () => S.front.includes('jasper');
let secretsFixed = false;
function fixSecrets() {
  if (secretsFixed || !FIELD.WD) return; secretsFixed = true;
  const ok = (x, y) => { const k = FIELD.WD.t[y * WW + x]; return k !== undefined && walkableK(k) && k !== K.PLACE && k !== K.ROAD; };
  const taken = new Set();
  const free = (x, y) => ok(x, y) && !taken.has(x * 1000 + y) && (!limit || (REGIONS[FIELD.regionAt(x, y)] || [0, 0, 0, 0, 99])[4] <= limit);
  let limit = 0;
  for (const sc of SECRETS) {
    // a treasure must lie in a land that is open by its chapter
    limit = ITEMS[sc[2]] && ITEMS[sc[2]].tr ? ITEMS[sc[2]].ch : 0;
    if (!free(sc[0], sc[1])) { outer: for (let r = 1; r < 10; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (free(sc[0] + dx, sc[1] + dy)) { sc[0] += dx; sc[1] += dy; break outer; } }
    taken.add(sc[0] * 1000 + sc[1]);
    const src = SRC[sc[2]]; if (src && src.t === 'secret') { src.x = sc[0]; src.y = sc[1]; }
  }
}
STORY.fixSecrets = fixSecrets;
FH.secrets = () => { fixSecrets(); return SECRETS.filter((sc) => !S.flags['secret_' + sc[0] + '_' + sc[1]]); };
STORY.secretAt = (x, y) => { fixSecrets(); return SECRETS.find((s) => s[0] === x && s[1] === y && !S.flags['secret_' + x + '_' + y]); };
STORY.onStep = (x, y) => {
  const s = STORY.secretAt(x, y);
  if (!s || !jasperHere()) return false;
  G().run(async () => {
    S.flags['secret_' + x + '_' + y] = 1;
    await T('jasper', '等等！這裡的草被壓過……地下埋著東西！', 'Wait! The grass here has been trampled... something is buried!');
    const it = ITEMS[s[2]];
    if (it.form) { if (!S.forms.includes(it.form)) S.forms.push(it.form); sfx('level'); await N(`挖出了「${it.zh}」，習得了${FORMS[it.form].zh}！`, `Dug up the ${it.en} and learned the ${FORMS[it.form].en} formation!`); return; }
    if (it.tr) { await gainTreasure(s[2], ['挖出了', 'Dug up']); return; }
    give(s[2]); sfx('chest');
    await N(`挖出了「${it.zh}」！`, `Dug up ${it.en}!`);
  });
  return true;
};
