// Town services: inns, shops (weapons, armour, supplies, books, horses), taverns where free generals can be
// hired, and the talk with a prisoner who might be won over.
import { W, H, text, windowBox } from './gfx.js?v=12';
import { sfx } from './audio.js?v=12';
import { menu, say, ask, notice, panel, descBox, fit } from './ui.js?v=12';
import { L } from './i18n.js?v=12';
import { GENERALS, GEN_LIST, genName } from './generals.js?v=12';
import { ITEMS, itemName, unitName } from './data.js?v=12';
import { S, member, recruit, give, take, have, healAll, troopsMax, tpMax, stat, party, inCamp, toCamp, fromCamp, mustTravel, campCandidates, PARTY_MAX, gainExp } from './state.js?v=12';
import { expFor } from './data.js?v=12';
import { equipOne } from './equipui.js?v=12';
import { PLACES, REGIONS } from './world.js?v=12';
import { itemDesc, drawStatus } from './menu.js?v=12';
import { drawEquipPanel } from './equipui.js?v=12';
import { drawItemIcon, warmIcons } from './itemicons.js?v=12';
import { TREASURES, SRC, RARITY, ONE_HAND } from './data.js?v=12';
import { canEquip } from './state.js?v=12';
import { rumour, SHOP_KIND, treasurePrice, owned, gainTreasure } from './treasure_world.js?v=12';
import { hash } from './gfx.js?v=12';

// a Merchant (shangcai) in the army sells for 60% of the price instead of half
const sellPrice = (id) => Math.floor(ITEMS[id].price * (party().some((g) => (GENERALS[g].traits || []).includes('shangcai')) ? 0.6 : 0.5));
// what each shop sells, by how far into the story the place's region opens
const STOCK = {
  weapon: [
    ['bronzesword', 'bamboospear', 'shortbow', 'bamboostaff', 'woodaxe'],
    ['ironsword', 'ironspear', 'shortbow', 'bamboostaff', 'woodaxe', 'ironji'],
    ['steelsword', 'longspear', 'longbow', 'ironji', 'fan', 'crossbow'],
    ['steelsword', 'longspear', 'longbow', 'crossbow', 'kaishan', 'fan', 'mace'],
    ['guding', 'dianggang', 'irontaibow', 'shuangji', 'kaishan', 'craneFan', 'crossbow'],
    ['guding', 'dianggang', 'trident', 'irontaibow', 'shuangji', 'craneFan', 'mace'],
    ['qixing', 'trident', 'yanyue', 'xuanhua', 'irontaibow', 'craneFan'],
  ],
  armour: [
    ['cloth', 'leather', 'headband', 'leathercap', 'sh_wood'],
    ['cloth', 'leather', 'daopao', 'headband', 'leathercap', 'ironhelm', 'sh_wood', 'cloak'],
    ['leather', 'chain', 'daopao', 'ironhelm', 'lunjin', 'sh_iron', 'cloak'],
    ['chain', 'zhajia', 'waterarmour', 'daopao', 'ironhelm', 'kettlehelm', 'lunjin', 'sh_iron', 'cloak'],
    ['zhajia', 'waterarmour', 'rattan', 'yulin', 'kettlehelm', 'plumehelm', 'lunjin', 'sh_iron', 'warcape'],
    ['yulin', 'rattan', 'waterarmour', 'plumehelm', 'phoenixhelm', 'sh_steel', 'warcape'],
    ['yulin', 'mingguang', 'phoenixhelm', 'lionhelm', 'sh_steel', 'warcape'],
  ],
  item: [
    ['salve', 'wine', 'smoke', 'incense'],
    ['salve', 'jinchuang', 'wine', 'smoke', 'qingxin', 'incense', 'returnseal', 'tpdan'],
    ['salve', 'jinchuang', 'qingxin', 'wine', 'rations', 'smoke', 'incense', 'returnseal', 'tpdan', 'gunpowder', 'zhaohun'],
    ['jinchuang', 'qingxin', 'wine', 'rations', 'smoke', 'incense', 'returnseal', 'tpdan', 'gunpowder', 'zhaohun', 'goodwine'],
    ['jinchuang', 'qingxin', 'rations', 'incense', 'returnseal', 'tpdan', 'gunpowder', 'zhaohun', 'goodwine', 'oldbook', 'wristguard', 'scarf'],
    ['jinchuang', 'qingxin', 'rations', 'incense', 'returnseal', 'tpdan', 'tpbig', 'gunpowder', 'zhaohun', 'goodwine', 'oldbook', 'silk', 'jade', 'huxin'],
    ['jinchuang', 'qingxin', 'rations', 'incense', 'returnseal', 'tpdan', 'tpbig', 'gunpowder', 'zhaohun', 'silk', 'pearl', 'jade', 'huxin', 'bingfu'],
  ],
  book: [
    ['bk_fire'], ['bk_fire', 'bk_water'], ['bk_fire', 'bk_water', 'bk_heal'], ['bk_water', 'bk_heal', 'bk_wind'], ['bk_heal', 'bk_wind', 'bk_rock', 'bk_revive'], ['bk_rock', 'bk_revive', 'bk_thunder'], ['bk_thunder', 'bk_revive'],
  ],
  horse: [['nag'], ['nag', 'warhorse'], ['nag', 'warhorse'], ['warhorse', 'xiliang'], ['warhorse', 'xiliang'], ['xiliang', 'dawan'], ['xiliang', 'dawan']],
};
// a shop sells by its region, and old towns catch up a little as the story goes on
const tierOf = (place) => { const r = REGIONS[PLACES[place][5]]; const ch = r ? r[4] : 1; return Math.max(0, Math.min(6, Math.max(Math.floor((ch - 1) * 0.75), Math.floor((S.chapter - 1) * 0.55)))); };
const goldPanel = () => panel(() => { windowBox(W - 112, 4, 108, 22); text(L(`金 ${S.gold}`, `Gold ${S.gold}`), W - 104, 9, '#ffe080'); });

export async function shop(kind, place) {
  if (!STOCK[kind]) return;
  const close = goldPanel();
  const greet = { weapon: ['歡迎光臨！上好的兵器都在這裡。', 'Welcome! The finest weapons are here.'], armour: ['鎧甲頭盔，保命要緊。', 'Armour and helms. Your life comes first.'], item: ['傷藥、軍酒、兵糧，行軍必備。', 'Salves, wine, rations: everything for the march.'], book: ['兵書戰策，看懂了可是無價之寶。', 'Books of war. Priceless, if you can understand them.'], horse: ['好馬！日行千里！', 'Fine horses! A thousand li a day!'] }[kind];
  await say(L('店主', 'Shopkeeper'), L(greet[0], greet[1]));
  for (;;) {
    const c = await menu([L('買', 'Buy'), L('賣', 'Sell'), L('離開', 'Leave')], { x: 6, y: 4, w: 90 });
    if (c < 0 || c === 2) break;
    if (c === 0) await buy(kind, place);
    else await sell();
  }
  close();
}
const priceOf = (id) => (ITEMS[id].tr ? treasurePrice(id) : ITEMS[id].price);
const GEAR_KINDS = ['weapon', 'shield', 'armour', 'helm', 'cape', 'horse', 'treasure'];
async function buy(kind, place) {
  // a few treasures turn up as rare stock, chapter by chapter
  const rare = TREASURES.filter((id) => SRC[id] && SRC[id].t === 'shop' && SHOP_KIND[ITEMS[id].kind] === kind && ITEMS[id].ch <= S.chapter && !owned(id));
  let cur = 0, who = 0;
  for (;;) {
    const stock = [...STOCK[kind][tierOf(place)], ...rare.filter((id) => !owned(id))];
    warmIcons(stock);
    const ids = S.front.filter((x) => member(x));
    const gear = (id) => GEAR_KINDS.includes(ITEMS[id].kind);
    const tryOn = () => {
      const id = stock[cur], it = ITEMS[id], gid = ids[who % ids.length], m = member(gid);
      if (!gear(id) || !m) { descBox(itemDesc(id) + L(`（持有${have(id)}）`, ` (have ${have(id)})`)); return; }
      const e = { ...m.equip, [it.kind]: id };
      if (it.kind === 'weapon' && !ONE_HAND.has(it.cat)) e.shield = null;
      const ok = canEquip({ ...m, equip: e }, id) && (it.kind !== 'shield' || !m.equip.weapon || ONE_HAND.has(ITEMS[m.equip.weapon].cat));
      drawEquipPanel(gid, e, 214, it.kind, `${ok ? '' : L('【無法裝備】', '[cannot use] ')}${itemName(id)}${it.tr ? '【' + L(RARITY[it.rar][0], RARITY[it.rar][1]) + '】' : ''}\n${itemDesc(id)}\n${L(`持有${have(id)}　←→換人試穿`, `Have ${have(id)}  ←→ try on another`)}`);
    };
    const c = await menu(stock.map((id) => ({ label: itemName(id), right: priceOf(id), disabled: priceOf(id) > S.gold, color: ITEMS[id].tr ? RARITY[ITEMS[id].rar][2] : undefined, icon: (x, y) => drawItemIcon(id, x, y, 1, { frame: false }) })),
      { x: 4, y: 4, w: 208, maxRows: 14, start: cur, title: L('←→換人試穿', '←→ try on whom'), onMove: (i) => { cur = i; }, drawExtra: tryOn,
        keys: { left: () => { who = (who + ids.length - 1) % Math.max(1, ids.length); sfx('cursor'); return false; }, right: () => { who = (who + 1) % Math.max(1, ids.length); sfx('cursor'); return false; } } });
    if (c < 0) return;
    if (typeof c === 'object') continue;
    const id = stock[c], it = ITEMS[id];
    if (it.tr) { if (S.gold < priceOf(id)) { sfx('buzz'); continue; } S.gold -= priceOf(id); await gainTreasure(id, ['買下了', 'Bought']); continue; }
    let n = 1;
    if (it.kind === 'supply' || it.kind === 'gift') {
      const max = Math.min(99, Math.floor(S.gold / it.price));
      const opts = [1, 5, 10].filter((k) => k <= max);
      const d = await menu(opts.map((k) => ({ label: `×${k}`, right: k * it.price })), { x: 210, y: 40, w: 100 });
      if (d < 0) continue;
      n = opts[d];
    }
    if (S.gold < it.price * n) { sfx('buzz'); continue; }
    S.gold -= it.price * n; give(id, n); sfx('chest');
    if (it.kind === 'horse' && !S.horse && S.flags.canRide) { S.horse = true; }
  }
}
async function sell() {
  for (;;) {
    const ids = Object.keys(S.items).filter((k) => ITEMS[k] && ITEMS[k].kind !== 'key' && ITEMS[k].price > 0 && !ITEMS[k].tr);
    if (!ids.length) { await notice(L('沒有可以賣的東西。', 'Nothing to sell.'), 50); return; }
    const c = await menu(ids.map((k) => ({ label: itemName(k), right: `${sellPrice(k)}×${S.items[k]}` })), { x: 6, y: 4, w: 220, maxRows: 12 });
    if (c < 0) return;
    const id = ids[c];
    take(id); S.gold += sellPrice(id); sfx('chest');
  }
}
export async function inn(place) {
  const n = party().length;
  const price = Math.max(10, Math.round((5 + tierOf(place) * 6) * Math.max(1, Math.ceil(n / 3))));
  const free = S.flags.homeBase === place;
  const opts = [L('住宿', 'Stay'), L('記錄', 'Save'), L('不用了', 'No thanks')];
  // the home city's inn keeps the army's camp: the roster of generals waiting there
  if (free) opts.splice(2, 0, L('營帳名冊', 'Camp roster'));
  const c0 = await ask(L('掌櫃', 'Innkeeper'), free ? L('主公回來了！房間一直為您留著。要休息嗎？', 'My lord is back! Your rooms are always ready. Will you rest?') : L(`住一晚${price}金，全軍兵力與策略值都會恢復。要住嗎？`, `A night is ${price} gold; every general's troops and the strategy pool will recover. Stay?`), opts, { back: opts.length - 1 });
  if (free && c0 === 2) { await rosterMenu(place); return; }
  const c = free && c0 === 3 ? 2 : c0;
  if (c === 0) {
    if (!free && S.gold < price) { await say(L('掌櫃', 'Innkeeper'), L('錢不夠啊，客官。', "You haven't enough, sir.")); return; }
    if (!free) S.gold -= price;
    healAll(1); sfx('save');
    await say(null, L('全軍休養了一夜。兵力恢復了！', 'The army rests for the night. Troops restored!'));
  }
  if (c === 1) await saveHere();
}
async function saveHere() {
  const { save, slotInfo } = await import('./state.js?v=12');
  const slots = [0, 1, 2].map((i) => slotInfo(i));
  const c = await menu(slots.map((s, i) => ({ label: s ? L(`記錄${i + 1}  第${s.chapter}章  Lv${s.lv}`, `Slot ${i + 1}  Ch.${s.chapter}  Lv${s.lv}`) : L(`記錄${i + 1}  （空）`, `Slot ${i + 1}  (empty)`) })), { x: 110, y: 40, w: 220 });
  if (c < 0) return;
  if (save(c)) { sfx('save'); await notice(L('記錄完成。', 'Saved.'), 50); }
}
// ---------- taverns: generals for hire ----------
// each tavern has a few free generals sitting in it, chosen by the place's name; more come once their lords fall
export function tavernGenerals(place) {
  const seed = [...place].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const pool = GEN_LIST.filter((g) => !g.famous && (g.faction === 'free' || S.flags['beaten_' + g.faction]) && !S.roster[g.id] && !S.flags['gone_' + g.id]);
  const out = [];
  for (let i = 0; i < 3 && pool.length; i++) { const g = pool[Math.floor(hash(seed % 9973, i, S.chapter) * pool.length)]; if (!out.includes(g)) out.push(g); }
  // famous free spirits who wait in certain taverns
  const FAMOUS_AT = { kuaiji: 'wanglang', juchao: 'huatuo', xiangyang: 'pangtong' };
  if (FAMOUS_AT[place] && !S.roster[FAMOUS_AT[place]] && S.chapter >= ({ kuaiji: 1, juchao: 2, xiangyang: 5 })[place]) out.unshift(GENERALS[FAMOUS_AT[place]]);
  return out;
}
const recruitLv = (place) => { const r = REGIONS[PLACES[place][5]]; return r ? Math.round((r[5] + r[6]) / 2) : 1; };
export async function tavern(place) {
  await say(L('酒保', 'Barkeep'), L('來喝一杯？這裡常有些落魄的豪傑。', 'A drink? Down-at-heel heroes often turn up here.'));
  for (;;) {
    const gs = tavernGenerals(place);
    if (!gs.length) { await say(L('酒保', 'Barkeep'), L('今天沒什麼人。', 'Quiet today.')); const q = await ask(L('酒保', 'Barkeep'), L('要看看營帳名冊，還是打聽寶物？', 'Look at the camp roster, or ask about treasures?'), [L('營帳名冊', 'Camp roster'), L('打聽寶物', 'Treasure rumours'), L('離開', 'Leave')], { back: 2 }); if (q === 0) await rosterMenu(place); if (q === 1) await rumour(place); return; }
    let cur = 0;
    const lv = recruitLv(place);
    const fee = (g) => Math.round((lv * 60 + (g.str + g.int + g.lead) * 3) * (g.famous ? 2.5 : 1));
    const rows = [...gs.map((g) => ({ label: genName(g), right: fee(g) })), { label: L('打聽寶物', 'Treasure rumours'), color: '#ffe080' }, { label: L(`營帳名冊（${(S.camp || []).length}）`, `Camp roster (${(S.camp || []).length})`), color: '#a0e0ff' }];
    const c = await menu(rows, { x: 6, y: 4, w: 150, title: L('在座的豪傑', 'Heroes present'), onMove: (i) => { cur = i; }, drawExtra: () => { if (cur >= gs.length) return; S.met[gs[cur].id] = S.met[gs[cur].id] || 1; drawStatus(gs[cur].id, 160, 4, W - 166, 196, null, lv); } });
    if (c < 0) return;
    if (c === gs.length) { await rumour(place); continue; }
    if (c === gs.length + 1) { await rosterMenu(place); continue; }
    const g = gs[c];
    S.met[g.id] = Math.max(S.met[g.id] || 0, 1);
    const o = await ask(genName(g), g.famous ? famousLine(g.id) : L(`在下${g.zh}，${unitName(g.unit)}出身。若肯出${fee(g)}金安家，便為主公效力。`, `I am ${g.en}, a ${unitName(g.unit).toLowerCase()} officer. Give my family ${fee(g)} gold and I will serve you.`), [L(`出${fee(g)}金`, `Pay ${fee(g)}`), L('送禮', 'Give a gift'), L('算了', 'Never mind')], { back: 2 });
    if (o === 0) { if (S.gold < fee(g)) { await say(genName(g), L('……主公的誠意似乎不太夠啊。', '...My lord seems a little short.')); continue; } S.gold -= fee(g); join(g, lv); await joined(g); continue; }
    if (o === 1) {
      const gifts = Object.keys(S.items).filter((k) => ITEMS[k] && ITEMS[k].kind === 'gift');
      if (!gifts.length) { await say(null, L('沒有合適的禮物。', 'You have no fitting gift.')); continue; }
      const d = await menu(gifts.map((k) => ({ label: itemName(k), right: S.items[k] })), { x: 160, y: 60, w: 160 });
      if (d < 0) continue;
      take(gifts[d]);
      const chance = 0.35 * ITEMS[gifts[d]].gift + (stat(member('sunquan') || member(S.front[0]), 'lead') - g.lead) / 200;
      if (Math.random() < chance) { join(g, lv); await joined(g); } else await say(genName(g), L('禮物我收下了，但我還想再看看。', 'I will keep the gift, but I want to see more of you first.'));
    }
  }
}
function famousLine(id) {
  return { wanglang: L('老夫王朗。孫家小兒竟親自來請？好，便看看你能走多遠。', 'Wang Lang. The Sun boy comes himself? Very well, let us see how far you go.'), huatuo: L('我是行醫的華佗。這亂世病人太多……跟著軍隊，或許能救更多人。', 'I am Hua Tuo, a healer. So many sick in these times... with an army, perhaps I can save more.'), pangtong: L('龐統，字士元。人說我相貌醜陋——主公怎麼看？', 'Pang Tong. People say I am ugly. What does my lord think?') }[id] || L('願聞主公之志。', 'Tell me of your ambition, my lord.');
}
function join(g, lv) { recruit(g.id, lv, { reserve: S.front.length >= 5 }); S.flags['gone_' + g.id] = 1; }
async function joined(g) { sfx('level'); await say(null, L(`${genName(g)}加入了！`, `${genName(g)} joins the army!`)); await fitParty(); }

// ---------- a prisoner ----------
export async function persuade(id, lv) {
  const g = GENERALS[id];
  S.met[id] = 2;
  const c = await ask(null, L(`俘虜了${g.zh}！要招降嗎？`, `${g.en} was taken prisoner! Try to win them over?`), [L('招降', 'Persuade'), L('送禮招降', 'Persuade with a gift'), L('釋放', 'Release')]);
  if (c === 2 || c < 0) { await say(null, L(`放走了${g.zh}。`, `${g.en} goes free.`)); return; }
  let bonus = 0;
  if (c === 1) {
    const gifts = Object.keys(S.items).filter((k) => ITEMS[k] && ITEMS[k].kind === 'gift');
    if (!gifts.length) { await say(null, L('沒有禮物。', 'You have no gift.')); }
    else { const d = await menu(gifts.map((k) => ({ label: itemName(k), right: S.items[k] })), { x: 160, y: 60, w: 160 }); if (d >= 0) { take(gifts[d]); bonus = 0.18 * ITEMS[gifts[d]].gift; } }
  }
  const lead = member('sunquan') ? stat(member('sunquan'), 'lead') : 80;
  const chance = Math.max(0.1, Math.min(0.9, 0.4 + (lead - g.lead) / 160 + bonus));
  if (Math.random() < chance) {
    recruit(id, lv, { reserve: S.front.length >= 5 }); S.flags['gone_' + id] = 1;
    sfx('level');
    await say(genName(g), L('敗軍之將，承蒙不殺……願為主公效死！', 'A beaten general, and you spare me... I will serve you to the death!'));
    await say(null, L(`${g.zh}加入了！`, `${g.en} joins the army!`));
    await fitParty();
  } else {
    await say(genName(g), L('哼，要殺便殺！', 'Hmph. Kill me if you will!'));
    await say(null, L(`${g.zh}不肯投降，只好放走了。`, `${g.en} will not yield, and is let go.`));
  }
}
export { recruitLv };

// ---------- the camp (營帳): generals beyond the eight who travel ----------
// Whoever joins as the ninth sends someone to wait at the camp: the player chooses (the story's own people
// cannot be sent away while it needs them); the test bots send the lowest level.
export async function fitParty() {
  while (party().length > PARTY_MAX) {
    const cands = campCandidates();
    if (!cands.length) return;
    let id = cands[0];
    if (!(window.G && G.autoBattle)) {
      const ids = party();
      let cur = 0;
      await say(null, L('隊伍最多只能帶八名武將。請選一位回營帳（任何一間酒館，或大本營的客棧都能換人）。', 'No more than eight generals travel together. Choose one to wait at the camp (any tavern, or the home city\'s inn, can swap them back).'));
      const c = await menu(ids.map((x) => ({ label: genName(x) + (S.front.includes(x) ? '◆' : ''), right: `Lv${S.roster[x].lv}`, disabled: mustTravel(x) })), { x: 6, y: 4, w: 150, maxRows: 15, cancel: false, title: L('誰去營帳等候？', 'Who waits at camp?'), onMove: (i) => { cur = i; }, drawExtra: () => drawStatus(ids[cur], 160, 4, W - 166, 196) });
      if (c >= 0 && !mustTravel(ids[c])) id = ids[c];
    }
    toCamp(id);
    sfx('ok');
    await say(null, L(`${genName(id)}到營帳等候了。`, `${genName(id)} goes to wait at the camp.`));
  }
}
// what it costs to train a general in camp up to the party's level less two
const partyAvg = () => { const p = party(); return p.length ? Math.round(p.reduce((t, id) => t + S.roster[id].lv, 0) / p.length) : 1; };
function trainCost(m) { const to = partyAvg() - 2; let c = 0; for (let l = m.lv; l < to; l++) c += expFor(l); return { to, gold: Math.round(c * 0.04) }; }
// the roster: everyone who travels (◆ in the front line) and everyone in camp, with their page beside the list
export async function rosterMenu(place) {
  let start = 0;
  for (;;) {
    const p = party(), camp = (S.camp || []).filter((id) => S.roster[id]);
    const ids = [...p, ...camp];
    const rows = ids.map((id) => { const m = S.roster[id], c = inCamp(id); return { label: (c ? '〔營〕' : S.front.includes(id) ? '◆' : '　') + genName(id), right: `Lv${m.lv}`, color: c ? '#a0c8e8' : undefined }; });
    let cur = Math.min(start, ids.length - 1);
    const c = await menu(rows, { x: 6, y: 4, w: 156, maxRows: 15, start: cur, title: L(`隊伍 ${p.length}/${PARTY_MAX}　營帳 ${camp.length}`, `Party ${p.length}/${PARTY_MAX}  Camp ${camp.length}`), onMove: (i) => { cur = i; }, drawExtra: () => drawStatus(ids[cur], 166, 4, W - 172, 196) });
    if (c < 0) return;
    start = c;
    const id = ids[c], m = S.roster[id];
    if (!inCamp(id)) {
      const o = await menu([{ label: L('送回營帳', 'Send to camp'), disabled: mustTravel(id) || p.length <= 1 }, L('裝備', 'Equip')], { x: 172, y: 60, w: 150 });
      if (o === 0) { toCamp(id); sfx('ok'); }
      if (o === 1) await equipOne(id);
      continue;
    }
    const tc = trainCost(m);
    const o = await menu([L('編入隊伍', 'Join the party'), L('裝備', 'Equip'), { label: tc.to > m.lv ? L(`訓練到Lv${tc.to}（${tc.gold}金）`, `Train to Lv${tc.to} (${tc.gold}g)`) : L('訓練（已跟上隊伍）', 'Train (keeping up already)'), disabled: tc.to <= m.lv || S.gold < tc.gold }, L('卸下全部裝備', 'Take off all gear')], { x: 172, y: 60, w: 190 });
    if (o === 0) {
      if (p.length >= PARTY_MAX) {
        // a full party: someone swaps out
        const out = p.filter((x) => !mustTravel(x));
        const d = await menu(out.map((x) => ({ label: genName(x), right: `Lv${S.roster[x].lv}` })), { x: 172, y: 4, w: 150, maxRows: 14, title: L('與誰交換？', 'Swap with whom?') });
        if (d < 0) continue;
        toCamp(out[d]);
      }
      fromCamp(id); if (S.front.length < 5) S.front.push(id); sfx('ok');
      await say(null, L(`${genName(id)}歸隊了。`, `${genName(id)} rejoins the party.`));
    }
    if (o === 1) await equipOne(id);
    if (o === 2 && tc.to > m.lv && S.gold >= tc.gold) {
      S.gold -= tc.gold;
      let need = 0; for (let l = m.lv; l < tc.to; l++) need += expFor(l);
      gainExp(m, need - m.exp);
      m.troops = troopsMax(m); sfx('level');
      await say(null, L(`${genName(id)}在營中苦練，升到了${m.lv}級！`, `${genName(id)} drills hard in camp and reaches level ${m.lv}!`));
    }
    if (o === 3) { let n = 0; for (const [slot, it] of Object.entries(m.equip)) if (it) { give(it); m.equip[slot] = null; n++; } sfx('ok'); if (n) await say(null, L(`${genName(id)}的${n}件裝備收進了行囊。`, `${n} pieces of ${genName(id)}'s gear go into the bag.`)); }
  }
}
