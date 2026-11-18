// The treasures out in the world: chests holding them in halls, shrines, caves and streets, the treasure merchant's
// stall, the townsfolk with a favour to ask, tavern rumours, leaders' rewards and the codex rewards for finding
// many. The table of where each one is lives in treasures.js (SRC); this file puts it into the game.
import { say, ask, menu, notice, descBox, panel } from './ui.js?v=8';
import { W, text, windowBox } from './gfx.js?v=8';
import { sfx } from './audio.js?v=8';
import { L } from './i18n.js?v=8';
import { ITEMS, TREASURES, SRC, QUESTS, MERCHANTS, BANDIT_NAME, RARITY, SETS, TREASURE_KIND } from './data.js?v=8';
import { S, give, take, have, markFound } from './state.js?v=8';
import { PLACES, REGIONS } from './world.js?v=8';
import { F } from './field.js?v=8';
import { GENERALS, GEN_LIST, genName } from './generals.js?v=8';
import { placeName, folkLook } from './maps.js?v=8';
import { hash } from './gfx.js?v=8';
import { drawItemIcon } from './itemicons.js?v=8';
const GEAR = ['weapon', 'shield', 'armour', 'helm', 'cape', 'horse', 'treasure'];
let tryOnPanel = null;
export const setTryOn = (f) => { tryOnPanel = f; };

const N = (zh, en) => say(null, L(zh, en));
const tname = (id) => L(ITEMS[id].zh, ITEMS[id].en);
const rcol = (id) => RARITY[ITEMS[id].rar][2];
export const owned = (id) => !!(S.found && S.found[id]);
// ---------- hints ----------
const ROOM = { hall: ['太守府', 'governor\'s hall'], shrine: ['廟堂', 'shrine'] };
export function hintText(id) {
  const s = SRC[id]; if (!s) return '';
  const it = ITEMS[id];
  if (s.t === 'chest') {
    const [p, sub] = s.map.split('/');
    const pn = placeName(p);
    if (!sub) return L(`藏在${pn}城裡的寶箱中。`, `In a chest somewhere in ${pn}.`);
    if (sub[0] === 'f') return L(`藏在${pn}第${sub.slice(1)}層的寶箱中。`, `In a chest on floor ${sub.slice(1)} of ${pn}.`);
    return L(`藏在${pn}${ROOM[sub] ? ROOM[sub][0] : ''}的寶箱中。`, `In a chest in the ${ROOM[sub] ? ROOM[sub][1] : 'rooms'} of ${pn}.`);
  }
  if (s.t === 'secret') { const r = nearRegion(s.x, s.y); return L(`埋在${r ? REGIONS[r][0] : ''}一帶的野地裡。只有眼尖的賈斯珀看得出來。`, `Buried in the wilds of ${r ? REGIONS[r][1] : 'the land'}. Only sharp-eyed Jasper will spot it.`); }
  if (s.t === 'boss') { const b = BOSS_NAME[s.id]; return L(`擊敗${b ? b[0] : '強敵'}之後得到。`, `Won by defeating ${b ? b[1] : 'a strong foe'}.`); }
  if (s.t === 'drop') return L(`${REGIONS[s.region][0]}的敵軍偶爾會帶著它。`, `Armies in ${REGIONS[s.region][1]} sometimes carry it.`);
  if (s.t === 'quest') { const q = QUESTS[s.q]; return L(`${placeName(q.place)}的${q.who[0]}有事相求，事成之後的謝禮。`, `A reward from the ${q.who[1].toLowerCase()} of ${placeName(q.place)}, who needs a favour.`); }
  if (s.t === 'shop') return L(`第${it.ch}章起，各地的${SHOP_OF[it.kind] ? SHOP_OF[it.kind][0] : '店'}偶爾進貨。`, `From chapter ${it.ch}, ${SHOP_OF[it.kind] ? SHOP_OF[it.kind][1] : 'shops'} sometimes stock it.`);
  if (s.t === 'merchant') return L(`第${it.ch}章起，雲遊的寶物商人有貨。`, `From chapter ${it.ch}, the wandering treasure merchant has it.`);
  if (s.t === 'gen') return L(`${genName(s.id)}隨身帶著。`, `${genName(s.id)} carries it.`);
  if (s.t === 'story') return L(s.zh + '。', s.en.charAt(0).toUpperCase() + s.en.slice(1) + '.');
  if (s.t === 'sq') { const Q = window.G && G.SQ && G.SQ.SQ[s.q]; return Q ? L(`完成試煉「${Q.name[0]}」的謝禮（${placeName(Q.giver.place)}的${Q.giver.who[0]}）。`, `The reward for the trial "${Q.name[1]}" (the ${Q.giver.who[1].toLowerCase()} in ${placeName(Q.giver.place)}).`) : ''; }
  return '';
}
const SHOP_OF = { weapon: ['武器店', 'weapon shops'], armour: ['防具店', 'armour shops'], helm: ['防具店', 'armour shops'], shield: ['防具店', 'armour shops'], cape: ['防具店', 'armour shops'], horse: ['馬市', 'horse fairs'], treasure: ['道具店', 'supply shops'], relic: ['道具店', 'supply shops'], book: ['書肆', 'bookshops'] };
export const SHOP_KIND = { weapon: 'weapon', armour: 'armour', helm: 'armour', shield: 'armour', cape: 'armour', horse: 'horse', treasure: 'item', relic: 'item', book: 'book' };
const BOSS_NAME = { yanbaihu: ['嚴白虎', 'Yan Baihu'], zulang: ['祖郎', 'Zu Lang'], liuxun: ['劉勳', 'Liu Xun'], tianzhu: ['天柱山的黑蓮祭司', 'the priests of Mount Tianzhu'], qua: ['曲阿的守軍', 'the Qu\'a garrison'], moling: ['秣陵關的守軍', 'the Moling garrison'], sunhao: ['孫暠', 'Sun Hao'],
  xisai: ['陳就', 'Chen Jiu'], huangzu: ['黃祖', 'Huang Zu'], changsha: ['長沙的守軍', 'the Changsha garrison'], caimao: ['蔡瑁', 'Cai Mao'], jiuyi: ['九嶷山的黑蓮祭司', 'the priests of Mount Jiuyi'], fleet1: ['北方的先鋒艦隊', 'the northern vanguard fleet'], fleet2: ['于禁的艦隊', 'Yu Jin\'s fleet'],
  pirates: ['夷洲的海盜', 'the Yizhou pirates'], yuanshu: ['袁術', 'Yuan Shu'], guandu: ['顏良與文醜', 'Yan Liang and Wen Chou'], yuanshao: ['袁紹', 'Yuan Shao'], hulao: ['華雄', 'Hua Xiong'], tongguan: ['李傕與郭汜', 'Li Jue and Guo Si'], dongzhuo: ['董卓', 'Dong Zhuo'],
  jianye2: ['佔據建業的黑蓮軍', 'the sect army in Jianye'], jiyuan: ['季淵', 'Ji Yuan'], zhangren: ['張任', 'Zhang Ren'], yanwu: ['焰無', 'Yan Wu'], lotus1: ['霜鏡', 'Shuang Jing'], lotus2: ['冥照', 'Ming Zhao'], yuji1: ['于吉', 'Yu Ji'] };
function nearRegion(x, y) { let best = null, bd = 1e9; for (const [k, r] of Object.entries(REGIONS)) { const d = (r[2] - x) ** 2 + (r[3] - y) ** 2; if (d < bd) { bd = d; best = k; } } return best; }
export const chapterOf = (id) => ITEMS[id].ch;

// ---------- finding things ----------
// a treasure goes into the bag, counts as found, and the codex rewards are checked
export async function gainTreasure(id, how) {
  give(id);
  sfx('chest');
  const it = ITEMS[id];
  await say(null, L(`${how ? how[0] : '得到了'}【${RARITY[it.rar][0]}】「${it.zh}」！`, `${how ? how[1] : 'Found'} [${RARITY[it.rar][1]}] ${it.en}!`));
  await codexRewards();
}
// rewards for finding many, and for each full set
// the last one is every treasure there is (311 with the trials' rewards)
const MILESTONES = [[50, 'tpbig', 3, 3000], [100, 'pearl', 2, 6000], [150, 'tpbig', 5, 9000], [200, 'zhaohun', 5, 15000], [250, 'tpbig', 8, 20000], [300, 'pearl', 5, 50000], [TREASURES.length, 'tpbig', 10, 80000]];
export async function codexRewards() {
  const n = TREASURES.filter((id) => owned(id)).length;
  for (const [k, item, cnt, gold] of MILESTONES) {
    if (n >= k && !S.codex['m' + k]) {
      S.codex['m' + k] = 1; give(item, cnt); S.gold += gold; sfx('level');
      await say(L('寶物錄', 'Treasure Codex'), L(`寶物錄收集了${k}件！獲得${ITEMS[item].zh}×${cnt}與${gold}金。`, `${k} treasures in the codex! You receive ${ITEMS[item].en} x${cnt} and ${gold} gold.`));
    }
  }
  for (const [set, st] of Object.entries(SETS)) {
    const ids = TREASURES.filter((id) => ITEMS[id].set === set);
    if (ids.length && !S.codex['s_' + set] && ids.every(owned)) {
      S.codex['s_' + set] = 1; const g = 1500 * ids.length; S.gold += g; give('tpbig', 1); sfx('level');
      await say(L('寶物錄', 'Treasure Codex'), L(`集齊了「${st.zh}」套裝！獲得${g}金與神機丹。`, `The ${st.en} set is complete! You receive ${g} gold and a Sage Pill.`));
    }
  }
}
// leaders' rewards, the first time each is beaten
export async function bossReward(bossId) {
  for (const id of TREASURES) { const s = SRC[id]; if (s && s.t === 'boss' && s.id === bossId && !owned(id)) await gainTreasure(id, ['戰利品中找到了', 'Among the spoils:']); }
}

// ---------- chests ----------
export function populate(mapId, ents) {
  if (!F.map) return;
  const m = F.map;
  const list = TREASURES.filter((id) => { const s = SRC[id]; return s && s.t === 'chest' && s.map === mapId && s.chest === 'tr_' + id; });
  list.forEach((id, k) => { const [x, y] = spotFor(m, mapId, k); ents.push({ type: 'chest', id: 'tr_' + id, item: id, tr: true, x, y }); });
  // things the side quests send you to find
  for (const [q, Q] of Object.entries(QUESTS)) if (Q.type === 'find' && Q.at === mapId && S.quests[q] === 1 && !have(Q.item)) { const [x, y] = spotFor(m, mapId, list.length + 1); ents.push({ type: 'chest', id: 'qc_' + q, item: Q.item, tr: true, x, y }); }
  // the treasure merchant and the people who ask favours stand in the street
  const [place, sub] = mapId.split('/');
  if (!sub && MERCHANTS[place] && S.chapter >= MERCHANTS[place]) ents.push({ type: 'npc', id: 'merchant_' + place, look: 'b=m s=amber hd=plump h=topknot hc=black bd=m_walrus t=robe tc=purple l=wide lc=black f=shoes hat=hb_tied hatc=yellow belt=sash bc=gold', x: Math.floor(m.w / 2) + 3, y: m.h - 7, dir: 'd', talk: 'tr:merchant', mark: true });
  if (!sub) for (const [q, Q] of Object.entries(QUESTS)) if (Q.place === place && S.chapter >= Q.ch && S.quests[q] !== 2) ents.push({ type: 'npc', id: 'quest_' + q, look: folkLook(q.length * 37 + Q.ch, q === 'q_fisher' ? 'elder' : 'folk'), x: Math.floor(m.w / 2) - 4, y: m.h - 8, dir: 'd', talk: 'tr:quest:' + q, mark: !S.quests[q] });
}
// a starting spot for the k-th chest on a map (toMap moves it to the nearest free tile)
function spotFor(m, mapId, k) {
  const [, sub] = mapId.split('/');
  if (sub && sub[0] === 'f') {
    // a cave: some floor tile well away from the way in
    const floor = []; for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) { const t = m.kindAt(x, y); if (t === 'cavefloor' || t === 'blackstone') floor.push([x, y]); }
    const [ex, ey] = m.entry;
    const far = floor.filter(([x, y]) => Math.abs(x - ex) + Math.abs(y - ey) > 10);
    const pool = far.length ? far : floor;
    return pool[Math.floor(hash(mapId.length * 13 + k, 7, 11) * pool.length)] || [ex, ey];
  }
  if (sub) return [[2, m.h - 3], [m.w - 3, m.h - 3], [2, 3], [m.w - 3, 3]][k % 4];
  const cx = Math.floor(m.w / 2);
  const mid = Math.floor(m.h * 0.55) + 1;
  return [[cx - 8 - (k >> 1) * 3, mid], [cx + 7 + (k >> 1) * 3, mid]][k % 2];
}
export async function openTreasureChest(e) {
  S.chests[e.id] = 1;
  if (ITEMS[e.item] && ITEMS[e.item].kind === 'key') { give(e.item); sfx('chest'); return N(`找到了「${ITEMS[e.item].zh}」！`, `Found ${ITEMS[e.item].en}!`); }
  if (owned(e.item)) { S.gold += 500; sfx('chest'); return N('箱子裡只剩一些金子。得到了500金。', 'Only some gold is left in the chest. 500 gold.'); }
  return gainTreasure(e.item, ['寶箱裡是', 'In the chest:']);
}

// ---------- the treasure merchant ----------
const PRICE = [900, 2200, 4800, 9000, 16000];
export const treasurePrice = (id) => Math.round(PRICE[ITEMS[id].rar] * (1 + ITEMS[id].ch * 0.12) / 10) * 10;
export async function merchant() {
  const close = panel(() => { windowBox(W - 112, 4, 108, 22); text(L(`金 ${S.gold}`, `Gold ${S.gold}`), W - 104, 9, '#ffe080'); });
  await say(L('寶物商人', 'Treasure Merchant'), L('嘿嘿，客官識貨！天下的奇珍異寶，小人這裡都有。拿兩件寶物來換，也行。', 'Heh heh, a connoisseur! Every rare treasure under heaven passes through my hands. I take two of yours in trade, too.'));
  for (;;) {
    const c = await menu([L('買', 'Buy'), L('以物易物', 'Trade'), L('賣', 'Sell'), L('離開', 'Leave')], { x: 6, y: 4, w: 110 });
    if (c < 0 || c === 3) break;
    const stock = TREASURES.filter((id) => SRC[id] && SRC[id].t === 'merchant' && ITEMS[id].ch <= S.chapter && !owned(id));
    if (c === 0 || c === 1) {
      if (!stock.length) { await say(L('寶物商人', 'Treasure Merchant'), L('今天的貨都被您買光啦。下一章再來看看？', 'You have bought me out. Come back later in your travels?')); continue; }
      let cur = 0, who = 0;
      const ids = S.front.filter((x) => S.roster[x]);
      const show = () => {
        const id = stock[cur], it = ITEMS[id], gid = ids[who % Math.max(1, ids.length)];
        if (tryOnPanel && gid && GEAR.includes(it.kind)) { const e = { ...S.roster[gid].equip, [it.kind]: id }; tryOnPanel(gid, e, 226, it.kind, `${treasureDesc(id)}
${L('←→換人試穿', '←→ try on another')}`); }
        else descBox(treasureDesc(id));
      };
      const d = await menu(stock.map((id) => ({ label: tname(id), color: rcol(id), right: c === 0 ? treasurePrice(id) : '', disabled: c === 0 && treasurePrice(id) > S.gold, icon: (x, y) => drawItemIcon(id, x, y, 1, { frame: false }) })), { x: 4, y: 4, w: 218, maxRows: 14, onMove: (i) => { cur = i; }, drawExtra: show,
        keys: { left: () => { who = (who + Math.max(1, ids.length) - 1) % Math.max(1, ids.length); return false; }, right: () => { who = (who + 1) % Math.max(1, ids.length); return false; } } });
      if (typeof d === 'object') continue;
      if (d < 0) continue;
      const id = stock[d];
      if (c === 0) { if (S.gold < treasurePrice(id)) { sfx('buzz'); continue; } S.gold -= treasurePrice(id); await gainTreasure(id, ['買下了', 'Bought']); continue; }
      // a trade: two treasures from the bag (not worn) for one of his
      const mine = Object.keys(S.items).filter((k) => ITEMS[k] && ITEMS[k].tr && ITEMS[k].kind !== 'book');
      if (mine.length < 2) { await say(L('寶物商人', 'Treasure Merchant'), L('要換的話，請拿兩件沒穿在身上的寶物來。', 'For a trade, bring me two treasures you are not wearing.')); continue; }
      const pick = [];
      for (let n = 0; n < 2; n++) {
        const left = mine.filter((k) => !pick.includes(k));
        const e = await menu(left.map((k) => ({ label: tname(k), color: rcol(k), icon: (x, y) => drawItemIcon(k, x, y, 1, { frame: false }) })), { x: 230, y: 4, w: 220, maxRows: 12, title: L(`交出第${n + 1}件`, `Give piece ${n + 1}`) });
        if (e < 0) break;
        pick.push(left[e]);
      }
      if (pick.length < 2) continue;
      if (ITEMS[pick[0]].rar + ITEMS[pick[1]].rar + 1 < ITEMS[id].rar * 2) { await say(L('寶物商人', 'Treasure Merchant'), L('這兩件……不夠換這麼好的東西啊。', 'These two... are not worth so fine a piece.')); continue; }
      take(pick[0]); take(pick[1]);
      await gainTreasure(id, ['換到了', 'Traded for']);
    } else {
      const mine = Object.keys(S.items).filter((k) => ITEMS[k] && ITEMS[k].tr);
      if (!mine.length) { await notice(L('沒有可以賣的寶物。', 'No treasures to sell.'), 50); continue; }
      const e = await menu(mine.map((k) => ({ label: tname(k), color: rcol(k), right: Math.round(treasurePrice(k) / 3), icon: (x, y) => drawItemIcon(k, x, y, 1, { frame: false }) })), { x: 6, y: 4, w: 240, maxRows: 12 });
      if (e < 0) continue;
      const ok = await ask(null, L(`把「${ITEMS[mine[e]].zh}」賣掉嗎？（寶物錄的記錄會保留）`, `Sell the ${ITEMS[mine[e]].en}? (The codex keeps its entry.)`), [L('賣', 'Sell'), L('不賣', 'Keep')], { back: 1 });
      if (ok === 0) { take(mine[e]); S.gold += Math.round(treasurePrice(mine[e]) / 3); sfx('chest'); }
    }
  }
  close();
}
export function treasureDesc(id) {
  const it = ITEMS[id];
  return `【${L(RARITY[it.rar][0], RARITY[it.rar][1])}】` + (window.G && G.itemDesc ? G.itemDesc(id) : '');
}

// ---------- favours ----------
export async function quest(q) {
  const Q = QUESTS[q], who = L(Q.who[0], Q.who[1]);
  const reward = TREASURES.find((id) => SRC[id] && SRC[id].t === 'quest' && SRC[id].q === q);
  const pay = async () => {
    await say(who, L(Q.thanks[0], Q.thanks[1]));
    S.quests[q] = 2;
    if (reward && !owned(reward)) await gainTreasure(reward, ['收下了', 'Received']); else { S.gold += 1000; sfx('chest'); await N('得到了1000金。', 'Received 1000 gold.'); }
  };
  if (!S.quests[q]) {
    const c = await ask(who, L(Q.ask[0], Q.ask[1]), [L('交給我吧', 'Leave it to me'), L('抱歉', 'Sorry')], { back: 1 });
    if (c !== 0) return;
    S.quests[q] = 1;
    if (Q.type === 'deliver') return say(who, L(`需要的是：${needText(Q.need)}。`, `What I need: ${needText(Q.need)}.`));
    if (Q.type === 'find') return say(who, L('拜託您了！', 'Thank you so much!'));
    return say(who, L(`${BANDIT_NAME[q][0]}常在${REGIONS[Q.region][0]}的野外出沒。`, `${BANDIT_NAME[q][1]} roams the open country of ${REGIONS[Q.region][1]}.`));
  }
  if (Q.type === 'deliver') {
    if (Object.entries(Q.need).every(([k, n]) => have(k) >= n)) { for (const [k, n] of Object.entries(Q.need)) take(k, n); return pay(); }
    return say(who, L(`還需要：${needText(Q.need)}。`, `I still need: ${needText(Q.need)}.`));
  }
  if (Q.type === 'find') { if (have(Q.item)) { take(Q.item); return pay(); } return say(who, L(`就在${placeName(Q.at.split('/')[0])}，拜託了。`, `It is in ${placeName(Q.at.split('/')[0])}. Please.`)); }
  if (S.quests[q] === 3) return pay();
  return say(who, L(`${BANDIT_NAME[q][0]}還在${REGIONS[Q.region][0]}作亂……`, `${BANDIT_NAME[q][1]} still terrorises ${REGIONS[Q.region][1]}...`));
}
const needText = (need) => Object.entries(need).map(([k, n]) => L(`${ITEMS[k].zh}×${n}`, `${ITEMS[k].en} x${n}`)).join(L('、', ', '));
// a named bandit general waiting in a region: met as a random encounter once his favour is accepted
export function banditFor(region) {
  for (const [q, Q] of Object.entries(QUESTS)) {
    if (Q.type !== 'defeat' || Q.region !== region || S.quests[q] !== 1) continue;
    if (Math.random() > 0.4) return null;
    const R = REGIONS[region], pool = GEN_LIST.filter((g) => !g.famous && g.faction === R[7] && !S.roster[g.id]);
    const boss = pool[parseInt(Q.foe.slice(1), 10) % Math.max(1, pool.length)] || pool[0];
    const mates = pool.filter((g) => g !== boss).slice(0, 2);
    return { q, foes: [{ id: boss.id, lv: R[6] + 2, mul: 2.6, atkMul: 1.25 }, ...mates.map((g) => ({ id: g.id, lv: R[6], mul: 1.5 }))], intro: L(`山賊頭目「${BANDIT_NAME[q][0]}」${boss.zh}攔住了去路！`, `The bandit chief "${BANDIT_NAME[q][1]}", ${boss.en}, blocks the way!`) };
  }
  return null;
}
export function banditBeaten(q) { if (S.quests[q] === 1) S.quests[q] = 3; }

// ---------- rumours in taverns ----------
export async function rumour(place) {
  const fee = 30 + S.chapter * 30;
  const c = await ask(L('酒保', 'Barkeep'), L(`想打聽寶物的消息？${fee}金，我把聽來的都告訴你。`, `Want word of treasures? ${fee} gold and I'll tell you what I've heard.`), [L(`付${fee}金`, `Pay ${fee}`), L('算了', 'No')], { back: 1 });
  if (c !== 0) return;
  if (S.gold < fee) { await say(L('酒保', 'Barkeep'), L('錢不夠喔。', 'Not enough coin.')); return; }
  const cand = TREASURES.filter((id) => !owned(id) && !S.rumours[id] && ITEMS[id].ch <= S.chapter && SRC[id] && SRC[id].t !== 'gen');
  if (!cand.length) { await say(L('酒保', 'Barkeep'), L('最近沒聽到什麼新鮮事。', 'Nothing new lately.')); return; }
  S.gold -= fee;
  // the barkeep knows his own country best
  const reg = PLACES[place] ? PLACES[place][5] : null;
  const near = cand.filter((id) => { const s = SRC[id]; return (s.map && PLACES[s.map.split('/')[0]] && PLACES[s.map.split('/')[0]][5] === reg) || s.region === reg; });
  const pool = near.length ? near : cand.filter((id) => ITEMS[id].ch === S.chapter).length ? cand.filter((id) => ITEMS[id].ch === S.chapter) : cand;
  const id = pool[Math.floor(Math.random() * pool.length)];
  S.rumours[id] = 1;
  await say(L('酒保', 'Barkeep'), L(`聽說有一件叫「${ITEMS[id].zh}」的寶物……${hintText(id)}`, `They say there is a treasure called the ${ITEMS[id].en}... ${hintText(id)}`));
  await N('（寶物錄裡記下了這條消息。）', '(The rumour is noted in the Treasure Codex.)');
}
export { TREASURE_KIND, markFound };
