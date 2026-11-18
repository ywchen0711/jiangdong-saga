// Game data: unit types, items (weapons, armour, helmets, horses, treasures, supplies, books, gifts),
// tactics (策略), formations (陣形) and skills (技能). Every name is given in Chinese and English.
import { L } from './i18n.js?v=8';
import { addTreasures, bindItem, SETS, parseFx } from './treasures.js?v=8';

// ---------- unit types ----------
export const UNITS = {
  inf: { zh: '步兵', en: 'Foot' },
  cav: { zh: '騎兵', en: 'Horse' },
  arc: { zh: '弓兵', en: 'Bow' },
  nav: { zh: '水軍', en: 'Navy' },
};
// attacker type vs defender type: horse beat foot, foot beat bow, bow beat horse (x1.3 one way, x0.8 the
// other); navy is strong on the water and clumsy on land
export function unitEdge(a, d, naval) {
  if (naval) { if (a === 'nav' && d !== 'nav') return 1.3; if (d === 'nav' && a !== 'nav') return a === 'arc' ? 1 : 0.8; return a === 'cav' ? 0.85 : 1; }
  if (a === 'nav') return 0.85;
  if (d === 'nav') return 1.1;
  if ((a === 'cav' && d === 'inf') || (a === 'inf' && d === 'arc') || (a === 'arc' && d === 'cav')) return 1.3;
  if ((d === 'cav' && a === 'inf') || (d === 'inf' && a === 'arc') || (d === 'arc' && a === 'cav')) return 0.8;
  return 1;
}
export const unitName = (u) => L(UNITS[u].zh, UNITS[u].en);

// ---------- items ----------
// kind: weapon / armour / helm / horse / treasure / supply / book / gift / key
// a weapon's cat decides how it is swung: sword, axe -> slash; spear, halberd, crossbow, staff -> thrust; bow -> shoot
// look: what it changes on the paper doll
const I = {};
function item(id, zh, en, kind, price, o = {}) { I[id] = { id, zh, en, kind, price, ...o }; }
// weapons
item('bronzesword', '青銅劍', 'Bronze Sword', 'weapon', 60, { cat: 'sword', atk: 5, look: { weapon: 'w_sword', wmetal: 'bronze' } });
item('ironsword', '鐵劍', 'Iron Sword', 'weapon', 180, { cat: 'sword', atk: 9, look: { weapon: 'w_sword', wmetal: 'iron' } });
item('steelsword', '鋼劍', 'Steel Sword', 'weapon', 520, { cat: 'sword', atk: 15, look: { weapon: 'w_sword', wmetal: 'steel' } });
item('guding', '古錠刀', 'Guding Sabre', 'weapon', 1600, { cat: 'sword', atk: 23, look: { weapon: 'w_saber', wmetal: 'steel' } });
item('qixing', '七星寶刀', 'Seven-Star Blade', 'weapon', 4200, { cat: 'sword', atk: 34, look: { weapon: 'w_scimitar', wmetal: 'silver' } });
item('yitian', '倚天劍', 'Heaven-Leaning Sword', 'weapon', 0, { cat: 'sword', atk: 44, look: { weapon: 'w_longsword', wmetal: 'silver' }, rare: true });
item('qinggang', '青釭劍', 'Qinggang Sword', 'weapon', 0, { cat: 'sword', atk: 50, look: { weapon: 'w_glowsword_b' }, rare: true });
item('bamboospear', '竹槍', 'Bamboo Spear', 'weapon', 40, { cat: 'spear', atk: 4, look: { weapon: 'w_spear', wmetal: 'bronze', wwood: 'maple' } });
item('ironspear', '鐵槍', 'Iron Spear', 'weapon', 200, { cat: 'spear', atk: 10, look: { weapon: 'w_spear', wmetal: 'iron' } });
item('longspear', '長槍', 'Long Spear', 'weapon', 560, { cat: 'spear', atk: 16, look: { weapon: 'w_longspear', wmetal: 'steel' } });
item('dianggang', '點鋼槍', 'Steel-Tipped Spear', 'weapon', 1700, { cat: 'spear', atk: 25, look: { weapon: 'w_longspear', wmetal: 'silver', wwood: 'mahogany' } });
item('trident', '三尖刀', 'Three-Point Blade', 'weapon', 2600, { cat: 'spear', atk: 30, look: { weapon: 'w_trident', wmetal: 'steel' } });
item('longdan', '龍膽槍', 'Dragon-Heart Spear', 'weapon', 0, { cat: 'spear', atk: 46, look: { weapon: 'w_dragonspear', wmetal: 'silver' }, rare: true });
item('hutou', '虎頭湛金槍', 'Tiger-Head Gold Spear', 'weapon', 0, { cat: 'spear', atk: 48, look: { weapon: 'w_dragonspear', wmetal: 'gold' }, rare: true });
item('ironji', '鐵戟', 'Iron Halberd', 'weapon', 380, { cat: 'halberd', atk: 13, look: { weapon: 'w_halberd', wmetal: 'iron' } });
item('shuangji', '雙鐵戟', 'Twin Halberds', 'weapon', 2100, { cat: 'halberd', atk: 27, look: { weapon: 'w_halberd', wmetal: 'steel', wwood: 'walnut' } });
item('yanyue', '偃月刀', 'Crescent Glaive', 'weapon', 3800, { cat: 'halberd', atk: 36, look: { weapon: 'w_scythe', wmetal: 'steel', wwood: 'mahogany' } });
item('qinglong', '青龍偃月刀', 'Green Dragon Glaive', 'weapon', 0, { cat: 'halberd', atk: 54, look: { weapon: 'w_scythe', wmetal: 'ceramic', wwood: 'mahogany' }, rare: true });
item('fangtian', '方天畫戟', 'Sky Piercer', 'weapon', 0, { cat: 'halberd', atk: 58, look: { weapon: 'w_halberd', wmetal: 'gold', wwood: 'mahogany' }, rare: true });
item('woodaxe', '柴斧', 'Woodsman Axe', 'weapon', 90, { cat: 'axe', atk: 7, look: { weapon: 'w_waraxe', wmetal: 'iron', wwood: 'maple' } });
item('kaishan', '開山斧', 'Mountain-Splitter', 'weapon', 900, { cat: 'axe', atk: 20, look: { weapon: 'w_waraxe', wmetal: 'steel' } });
item('xuanhua', '宣花大斧', 'Flowered Great Axe', 'weapon', 3400, { cat: 'axe', atk: 37, look: { weapon: 'w_waraxe', wmetal: 'gold' } });
item('mace', '鐵鞭', 'Iron Whip-Mace', 'weapon', 1200, { cat: 'axe', atk: 22, look: { weapon: 'w_mace', wmetal: 'iron' } });
item('shortbow', '短弓', 'Short Bow', 'weapon', 80, { cat: 'bow', atk: 6, look: { weapon: 'w_bow', wwood: 'maple' } });
item('longbow', '長弓', 'Long Bow', 'weapon', 480, { cat: 'bow', atk: 14, look: { weapon: 'w_recurve', wwood: 'oak' } });
item('irontaibow', '鐵胎弓', 'Iron-Core Bow', 'weapon', 1900, { cat: 'bow', atk: 26, look: { weapon: 'w_greatbow', wwood: 'walnut' } });
item('yangyouji', '養由基弓', "Archer King's Bow", 'weapon', 0, { cat: 'bow', atk: 45, look: { weapon: 'w_greatbow', wwood: 'mahogany' }, rare: true });
item('crossbow', '弩', 'Crossbow', 'weapon', 700, { cat: 'xbow', atk: 18, look: { weapon: 'w_crossbow', wmetal: 'iron' } });
item('liannu', '諸葛連弩', 'Repeating Crossbow', 'weapon', 0, { cat: 'xbow', atk: 40, look: { weapon: 'w_crossbow', wmetal: 'brass', wwood: 'mahogany' }, rare: true, multi: true });
item('bamboostaff', '竹杖', 'Bamboo Staff', 'weapon', 50, { cat: 'staff', atk: 3, int: 2, look: { weapon: 'w_staff', wwood: 'maple' } });
item('fan', '羽扇', 'Feather Fan', 'weapon', 600, { cat: 'staff', atk: 8, int: 6, look: { weapon: 'w_fan' } });
item('craneFan', '鶴羽扇', 'Crane-Feather Fan', 'weapon', 2400, { cat: 'staff', atk: 14, int: 12, look: { weapon: 'w_cranefan' } });
item('starstaff', '星辰杖', 'Star Staff', 'weapon', 0, { cat: 'staff', atk: 20, int: 18, look: { weapon: 'w_crystal' }, rare: true });
item('wrench', '機關鉗', 'Engineer\'s Spanner', 'weapon', 0, { cat: 'axe', atk: 10, int: 4, look: { weapon: 'w_mace', wmetal: 'brass' } });
// armour
item('cloth', '布衣', 'Cloth Robe', 'armour', 20, { def: 2, look: {} });
item('daopao', '道袍', 'Scholar\'s Robe', 'armour', 300, { def: 6, int: 4, look: { robe: true } });
item('leather', '皮甲', 'Leather Armour', 'armour', 150, { def: 6, look: { armour: 'a_leather', ametal: 'iron' } });
item('rattan', '藤甲', 'Rattan Armour', 'armour', 900, { def: 24, weakFire: true, look: { armour: 'a_leather', acloth: 'tan', ametal: 'brass' } });
item('chain', '鎖子甲', 'Chain Mail', 'armour', 480, { def: 12, look: { armour: 'a_chain', ametal: 'iron' } });
item('zhajia', '札甲', 'Lamellar', 'armour', 1100, { def: 18, look: { armour: 'a_legion', ametal: 'iron', legs2: 'l_legion' } });
item('waterarmour', '水靠', 'Sailor\'s Harness', 'armour', 1300, { def: 15, naval: true, look: { armour: 'a_leather', acloth: 'navy', ametal: 'steel' } });
item('yulin', '魚鱗甲', 'Fish-Scale Armour', 'armour', 2400, { def: 26, look: { armour: 'a_legion', ametal: 'steel', shoulders: 'sh_legion', legs2: 'l_legion' } });
item('mingguang', '明光鎧', 'Bright Plate', 'armour', 4800, { def: 34, look: { armour: 'a_plate', ametal: 'silver', shoulders: 'sh_pauldrons', arms: 'arm_armour' } });
item('goldarmour', '黃金甲', 'Golden Armour', 'armour', 0, { def: 44, look: { armour: 'a_plate', ametal: 'gold', shoulders: 'sh_pauldrons', arms: 'arm_armour' }, rare: true });
item('beastarmour', '獸面吞頭鎧', 'Beast-Face Armour', 'armour', 0, { def: 52, look: { armour: 'a_plate', ametal: 'bronze', shoulders: 'sh_legion', arms: 'arm_armour', legs2: 'l_armour' }, rare: true });
// helmets
item('headband', '頭巾', 'Headband', 'helm', 30, { def: 1, look: { helm: 'hb_tied', hcloth: 'yellow' } });
item('lunjin', '綸巾', 'Scholar\'s Kerchief', 'helm', 400, { def: 2, int: 4, look: { helm: 'hb_thick', hcloth: 'navy' } });
item('leathercap', '皮盔', 'Leather Cap', 'helm', 120, { def: 3, look: { helm: 'hm_barbarian', hmetal: 'bronze' } });
item('ironhelm', '鐵盔', 'Iron Helm', 'helm', 380, { def: 6, look: { helm: 'hm_spangen', hmetal: 'steel' } });
item('kettlehelm', '笠盔', 'Brimmed Helm', 'helm', 700, { def: 9, look: { helm: 'hm_morion', hmetal: 'steel' } });
item('plumehelm', '纓盔', 'Plumed Helm', 'helm', 1400, { def: 13, look: { helm: 'hm_spangen', hmetal: 'silver', plume: 'hx_plume' } });
item('phoenixhelm', '鳳翅盔', 'Phoenix-Wing Helm', 'helm', 2600, { def: 18, look: { helm: 'hm_legion', hmetal: 'gold', plume: 'hx_wings' } });
item('lionhelm', '獅子盔', 'Lion Helm', 'helm', 3600, { def: 22, look: { helm: 'hm_maximus', hmetal: 'bronze' } });
item('zijinguan', '紫金冠', 'Purple-Gold Crown', 'helm', 0, { def: 26, spd: 4, look: { helm: 'hb_crown', hmetal: 'gold', plume: 'hx_plume' }, rare: true });
// horses
item('nag', '駑馬', 'Nag', 'horse', 300, { spd: 3, atk: 2, horse: 'gray' });
item('warhorse', '戰馬', 'Warhorse', 'horse', 1200, { spd: 6, atk: 5, horse: 'brown' });
item('xiliang', '西涼馬', 'Xiliang Horse', 'horse', 3200, { spd: 10, atk: 8, horse: 'black' });
item('dawan', '大宛馬', 'Ferghana Horse', 'horse', 6000, { spd: 13, atk: 10, horse: 'golden' });
item('dilu', '的盧', 'Dilu', 'horse', 0, { spd: 15, atk: 10, horse: 'white', rare: true });
item('jueying', '絕影', 'Shadowless', 'horse', 0, { spd: 17, atk: 12, horse: 'black', rare: true });
item('chitu', '赤兔', 'Red Hare', 'horse', 0, { spd: 22, atk: 16, horse: 'red', rare: true });
// treasures (one each)
item('sunzi', '孫子兵法', 'The Art of War', 'treasure', 0, { int: 10, lead: 5, rare: true });
item('bingfu', '兵符', 'Tiger Tally', 'treasure', 2000, { lead: 8 });
item('huxin', '護心鏡', 'Heart Mirror', 'treasure', 1500, { def: 8 });
item('qingnang', '青囊書', 'Green Satchel Book', 'treasure', 0, { int: 6, regen: 0.05, rare: true });
item('jade', '玉珮', 'Jade Pendant', 'treasure', 800, { lead: 3, int: 3 });
item('wristguard', '護腕', 'Wrist Guards', 'treasure', 600, { atk: 4, look: { bracers: true } });
item('scarf', '絲巾', 'Silk Scarf', 'treasure', 300, { spd: 3, look: { scarf: true } });
item('compass', '司南', 'South-Pointer', 'treasure', 0, { spd: 6, int: 4, rare: true });
item('sextant', '星盤', 'Star Astrolabe', 'treasure', 0, { int: 8, naval: true, rare: true });
item('warcape', '戰袍', 'War Cape', 'cape', 1200, { def: 4, lead: 4, look: { cape: 'c_trim', capeCol: 'red' } });
item('cloak', '布披風', 'Travelling Cloak', 'cape', 260, { def: 2, lead: 1, look: { cape: 'c_solid', capeCol: 'gray' } });
// shields (one-handed weapons only)
item('sh_wood', '木牌', 'Wooden Buckler', 'shield', 90, { def: 3, look: { shield: 's_round', smetal: 'iron', swood: 'walnut' } });
item('sh_iron', '鐵牌', 'Iron Shield', 'shield', 600, { def: 7, look: { shield: 's_heater', smetal: 'iron', swood: 'oak' } });
item('sh_steel', '鋼牌', 'Steel Kite Shield', 'shield', 1800, { def: 11, look: { shield: 's_kite', smetal: 'steel' } });
item('dragoncape', '龍紋披風', 'Dragon Cape', 'cape', 0, { def: 10, lead: 8, look: { cape: 'c_trim', capeCol: 'gold' }, rare: true });
// supplies
item('salve', '傷藥', 'Salve', 'supply', 30, { heal: 0.3, target: 'one' });
item('jinchuang', '金創藥', 'Wound Balm', 'supply', 160, { heal: 1, target: 'one' });
item('wine', '軍酒', 'Army Wine', 'supply', 120, { heal: 0.25, target: 'all' });
item('rations', '兵糧', 'Rations', 'supply', 400, { heal: 1, target: 'all' });
item('zhaohun', '招魂幡', 'Rallying Banner', 'supply', 600, { revive: 0.4, target: 'down' });
item('tpdan', '策略丹', 'Strategy Pill', 'supply', 300, { tp: 30 });
item('tpbig', '神機丹', 'Sage Pill', 'supply', 1200, { tp: 999 });
item('gunpowder', '火藥', 'Gunpowder', 'supply', 250, { fire: 1, target: 'enemies', battleOnly: true });
item('smoke', '煙球', 'Smoke Ball', 'supply', 80, { escape: true, battleOnly: true });
item('qingxin', '清心丹', 'Clear-Mind Pill', 'supply', 120, { cure: true, target: 'one', battleOnly: true });
item('incense', '隱蹤香', 'Hiding Incense', 'supply', 150, { repel: 250, fieldOnly: true });
item('returnseal', '歸城符', 'Homing Charm', 'supply', 200, { warp: true, fieldOnly: true });
// gifts for winning a general over
item('goodwine', '杜康酒', 'Dukang Wine', 'gift', 500, { gift: 1 });
item('oldbook', '古籍', 'Old Classic', 'gift', 800, { gift: 1.2 });
item('silk', '蜀錦', 'Shu Brocade', 'gift', 1200, { gift: 1.5 });
item('pearl', '南海明珠', 'South Sea Pearl', 'gift', 3000, { gift: 2.2 });
// tactic books (learned by the one who reads it) and formation manuals (learned by the army)
item('bk_fire', '火攻篇', 'On Fire Attacks', 'book', 900, { teach: 'dahuo' });
item('bk_water', '水攻篇', 'On Floods', 'book', 900, { teach: 'dashui' });
item('bk_rock', '山崩篇', 'On Landslides', 'book', 2200, { teach: 'shanbeng' });
item('bk_thunder', '天雷篇', 'On Thunder', 'book', 4000, { teach: 'tianlei' });
item('bk_heal', '青囊殘卷', 'Healer\'s Fragment', 'book', 1400, { teach: 'huifu' });
item('bk_revive', '還魂術', 'Rite of Rallying', 'book', 3000, { teach: 'fuhuo' });
item('bk_stun', '奇門遁甲', 'Qimen Dunjia', 'book', 0, { teach: 'qimen', rare: true });
item('bk_bagua', '八門金鎖', 'Eight Gates Lock', 'book', 0, { teach: 'jinsuo', rare: true });
item('bk_inferno', '業火篇', 'On Hellfire', 'book', 0, { teach: 'yehuo', rare: true });
item('bk_leiting', '雷霆萬鈞訣', 'Rite of the Thunderclap', 'book', 0, { teach: 'leiting', rare: true });
item('bk_wind', '呼風術', 'Calling the Wind', 'book', 1800, { teach: 'hufeng' });
item('mn_yulin', '魚鱗陣圖', 'Fish-Scale Manual', 'book', 0, { form: 'yulin' });
item('mn_heyi', '鶴翼陣圖', 'Crane-Wing Manual', 'book', 0, { form: 'heyi' });
item('mn_fengshi', '鋒矢陣圖', 'Arrowhead Manual', 'book', 0, { form: 'fengshi' });
item('mn_changshe', '長蛇陣圖', 'Long Snake Manual', 'book', 0, { form: 'changshe' });
item('mn_yanxing', '雁行陣圖', 'Wild Geese Manual', 'book', 0, { form: 'yanxing' });
item('mn_yanyue', '偃月陣圖', 'Crescent Manual', 'book', 0, { form: 'yanyue' });
item('mn_bagua', '八卦陣圖', 'Eight Trigrams Manual', 'book', 0, { form: 'bagua' });
item('mn_shuijun', '水軍陣圖', 'Naval Manual', 'book', 0, { form: 'shuijun' });
item('mn_tuzhen', '突騎陣圖', 'Cavalry Charge Manual', 'book', 0, { form: 'tuzhen' });
// key items
item('seal', '傳國玉璽', 'Imperial Seal', 'key', 0, {});
item('letter', '密信', 'Secret Letter', 'key', 0, {});
item('lotus', '黑蓮令', 'Black Lotus Token', 'key', 0, {});
item('shipwright', '船圖', 'Ship Plans', 'key', 0, {});
item('blueprint', '火龍船圖', 'Fire-Dragon Raft Plans', 'key', 0, {});
item('lotuskey', '四蓮鑰', 'Four Lotus Keys', 'key', 0, {});
item('q_heirloom', '傳家玉珮', 'Jade Heirloom', 'key', 0, {});
item('q_seal', '彭城官印', 'Seal of Pengcheng', 'key', 0, {});
bindItem(item);
addTreasures(item, I);
export const ITEMS = I;
export const itemName = (id) => (I[id] ? L(I[id].zh, I[id].en) : id);
// what a general's gear does in battle: every piece's effects, plus set bonuses for 2-4 pieces of one set worn
// together, kept under caps so that no treasure (or pile of them) makes a leader's fight trivial
const FX_CAP = { vs: 0.25, as: 0.15, el: 0.3, res: 0.6, resel: 0.4, form: 0.15, tac: 0.25, cost: 0.25, refl: 0.2, ctr: 0.25, nav: 0.25, regen: 0.04, crit: 0.12, eva: 0.1, heal: 0.3, first: 0.25, guard: 0.35, steal: 0.3, mor: 15, sp: 15, kill: 10, scout: 2 };
function addFx(t, fx) {
  for (const [k, v] of Object.entries(fx || {})) {
    if (typeof v === 'object') { const o = t[k] || (t[k] = {}); for (const [a, b] of Object.entries(v)) o[a] = (o[a] || 0) + b; }
    else t[k] = (t[k] || 0) + v;
  }
}
export function setCount(equip) {
  const n = {};
  for (const id of Object.values(equip || {})) { const it = id && I[id]; if (it && it.set) n[it.set] = (n[it.set] || 0) + 1; }
  return n;
}
const fxCache = new Map();
export function gearFx(equip) {
  const key = JSON.stringify(equip || {});
  const got = fxCache.get(key); if (got) return got;
  const t = {};
  for (const id of Object.values(equip || {})) { const it = id && I[id]; if (it && it.fx) addFx(t, it.fx); }
  for (const [set, n] of Object.entries(setCount(equip))) { const st = SETS[set]; if (!st) continue; for (const [k, code] of Object.entries(st.b)) if (n >= +k) addFx(t, parseFx(code)); }
  // 'all' spreads to every member of a group
  if (t.vs && t.vs.all) { for (const u of ['inf', 'cav', 'arc', 'nav']) t.vs[u] = (t.vs[u] || 0) + t.vs.all; delete t.vs.all; }
  if (t.res && t.res.all) { for (const s of ['confuse', 'sleep', 'stun', 'fear', 'curse', 'poison', 'silence', 'provoke', 'defdown']) t.res[s] = (t.res[s] || 0) + t.res.all; delete t.res.all; }
  if (t.resel && t.resel.all) { for (const e of ['fire', 'water', 'rock', 'thunder', 'dark']) t.resel[e] = (t.resel[e] || 0) + t.resel.all; delete t.resel.all; }
  for (const [k, cap] of Object.entries(FX_CAP)) {
    if (t[k] === undefined) continue;
    if (typeof t[k] === 'object') for (const a of Object.keys(t[k])) t[k][a] = Math.min(cap, t[k][a]);
    else t[k] = Math.min(cap, t[k]);
  }
  if (fxCache.size > 400) fxCache.clear();
  fxCache.set(key, t);
  return t;
}
// a line describing effects, for menus
const ELN = { fire: ['火', 'fire'], water: ['水', 'water'], rock: ['石', 'rock'], thunder: ['雷', 'thunder'], dark: ['暗', 'dark'], all: ['全屬性', 'all elements'] };
const STN = { confuse: ['混亂', 'confusion'], sleep: ['昏睡', 'sleep'], stun: ['受困', 'traps'], fear: ['恐懼', 'fear'], curse: ['詛咒', 'curses'], poison: ['中毒', 'poison'], silence: ['封策', 'seals'], provoke: ['激怒', 'provoking'], defdown: ['破甲', 'armour break'], all: ['異常', 'all statuses'] };
const UNN = { inf: ['步兵', 'foot'], cav: ['騎兵', 'horse'], arc: ['弓兵', 'bows'], nav: ['水軍', 'navy'], all: ['全兵種', 'all units'] };
const FXN = { tac: ['策略威力+', 'tactic power +'], cost: ['策略消耗−', 'tactic cost −'], refl: ['反彈策略', 'reflect ploys '], ctr: ['反擊', 'counter '], nav: ['水戰傷害+', 'naval damage +'], regen: ['每回合回兵', 'troops back each turn '], crit: ['會心+', 'critical +'], eva: ['閃避+', 'evasion +'], heal: ['治療+', 'healing +'], first: ['先制+', 'first strike +'], guard: ['護衛同伴', 'guard friends '], steal: ['偷竊+', 'steal +'] };
export function fxText(fx, short = false) {
  const p = [], pc = (v) => Math.round(v * 100);
  for (const [k, v] of Object.entries(fx || {})) {
    if (k === 'vs') { const e = Object.entries(v); if (e.length === 4 && e.every(([, x]) => x === e[0][1])) p.push(L(`對全兵種+${pc(e[0][1])}%`, `+${pc(e[0][1])}% vs all`)); else for (const [u, x] of e) p.push(L(`對${UNN[u][0]}+${pc(x)}%`, `+${pc(x)}% vs ${UNN[u][1]}`)); }
    else if (k === 'as') for (const [u, x] of Object.entries(v)) p.push(L(`為${UNN[u][0]}時攻擊+${pc(x)}%`, `+${pc(x)}% when ${UNN[u][1]}`));
    else if (k === 'el') for (const [e, x] of Object.entries(v)) p.push(L(`${ELN[e][0]}計+${pc(x)}%`, `${ELN[e][1]} ploys +${pc(x)}%`));
    else if (k === 'res') { const e = Object.entries(v); if (e.length >= 9) p.push(L(`抗異常${pc(Math.min(...e.map(([, x]) => x)))}%`, `${pc(Math.min(...e.map(([, x]) => x)))}% resist statuses`)); else for (const [s, x] of e) p.push(L(`抗${STN[s] ? STN[s][0] : s}${pc(x)}%`, `${pc(x)}% resist ${STN[s] ? STN[s][1] : s}`)); }
    else if (k === 'resel') { const e = Object.entries(v); if (e.length >= 5) p.push(L(`屬性傷害−${pc(Math.min(...e.map(([, x]) => x)))}%`, `element damage −${pc(Math.min(...e.map(([, x]) => x)))}%`)); else for (const [el, x] of e) p.push(L(`${ELN[el][0]}傷−${pc(x)}%`, `${ELN[el][1]} damage −${pc(x)}%`)); }
    else if (k === 'form') for (const [f, x] of Object.entries(v)) p.push(L(`${FORMS[f] ? FORMS[f].zh : f}時攻防+${pc(x)}%`, `+${pc(x)}% in ${FORMS[f] ? FORMS[f].en : f}`));
    else if (k === 'mor') p.push(L(`開戰士氣+${v}`, `start morale +${v}`));
    else if (k === 'sp') p.push(L(`策略值上限+${v}`, `max SP +${v}`));
    else if (k === 'kill') p.push(L(`擊倒時士氣+${v}`, `morale +${v} per kill`));
    else if (k === 'scout') p.push(L('少遇敵、易得寶', 'fewer battles, more finds'));
    else if (FXN[k]) p.push(L(`${FXN[k][0]}${pc(v)}%`, `${FXN[k][1]}${pc(v)}%`));
  }
  void short;
  return p.join(L('，', ', '));
}
export { SETS, RARITY, TREASURES, TREASURE_KIND, RELIC_FX, SRC, QUESTS, MERCHANTS, BANDIT_NAME, BOSS_BY_CH } from './treasures.js?v=8';
// the paper doll's slots; the accessory slot keeps its old save name 'treasure'
export const SLOTS = ['weapon', 'shield', 'armour', 'helm', 'cape', 'horse', 'treasure'];
export const SLOT_NAME = { weapon: ['武器', 'Weapon'], shield: ['盾牌', 'Shield'], armour: ['鎧甲', 'Armour'], helm: ['頭盔', 'Helm'], cape: ['披風', 'Cape'], horse: ['坐騎', 'Mount'], treasure: ['飾品', 'Accessory'] };
// weapons that leave a hand free for a shield
export const ONE_HAND = new Set(['sword', 'spear', 'axe', 'mace', 'staff']);
// which weapons each unit type may use (strategists of any type may use staffs)
export const CAN_USE = { inf: ['sword', 'twin', 'spear', 'halberd', 'axe', 'mace', 'staff'], cav: ['sword', 'twin', 'spear', 'halberd', 'axe', 'mace', 'staff'], arc: ['bow', 'xbow', 'sword', 'twin', 'staff'], nav: ['sword', 'twin', 'spear', 'halberd', 'axe', 'mace', 'bow', 'xbow', 'staff'] };
export const SWING = { sword: 'slash', twin: 'slash', axe: 'slash', mace: 'slash', spear: 'thrust', halberd: 'thrust', bow: 'shoot', xbow: 'thrust', staff: 'thrust' };

// ---------- tactics ----------
// t: e1 one foe, eall all foes, a1 one friend, aall all friends, down a fallen friend, field (escape etc.)
// el: fire water rock thunder; pow: strength; int: INT needed to learn by levelling; lv: level needed
const TAC = {};
function tac(id, zh, en, cost, t, o = {}) { TAC[id] = { id, zh, en, cost, t, ...o }; }
tac('huoji', '火計', 'Fire Ploy', 4, 'e1', { el: 'fire', pow: 1.0, int: 40, lv: 1, fx: 'flame' });
tac('dahuo', '大火計', 'Great Fire', 12, 'eall', { el: 'fire', pow: 0.45, int: 70, lv: 14, fx: 'flame' });
tac('liehuo', '烈火計', 'Blazing Fire', 20, 'eall', { el: 'fire', pow: 0.7, int: 85, lv: 28, fx: 'explosion' });
tac('yehuo', '業火', 'Hellfire', 30, 'eall', { el: 'fire', pow: 1.0, int: 0, lv: 99, fx: 'explosion' });
tac('shuiji', '水計', 'Water Ploy', 4, 'e1', { el: 'water', pow: 1.0, int: 45, lv: 3, fx: 'pillar' });
tac('dashui', '大水計', 'Great Flood', 14, 'eall', { el: 'water', pow: 0.48, int: 72, lv: 18, fx: 'pillar' });
tac('hongshui', '洪水', 'Deluge', 24, 'eall', { el: 'water', pow: 0.8, int: 88, lv: 34, fx: 'pillar' });
tac('luoshi', '落石', 'Rockfall', 5, 'e1', { el: 'rock', pow: 1.15, int: 50, lv: 6, fx: 'rock' });
tac('shanbeng', '山崩', 'Landslide', 22, 'eall', { el: 'rock', pow: 0.75, int: 0, lv: 99, fx: 'spike' });
tac('leiji', '雷擊', 'Thunderbolt', 7, 'e1', { el: 'thunder', pow: 1.3, int: 75, lv: 12, fx: 'thunder' });
tac('tianlei', '天雷', 'Wrath of Heaven', 28, 'eall', { el: 'thunder', pow: 0.9, int: 0, lv: 99, fx: 'thunder' });
// taught only by the scroll from the Jiuyi abyss (a trial)
tac('leiting', '雷霆萬鈞', 'Thunderclap of Heaven', 32, 'eall', { el: 'thunder', pow: 1.15, int: 0, lv: 99, fx: 'thunder' });
tac('duyan', '毒煙', 'Poison Smoke', 8, 'eall', { st: 'poison', int: 60, lv: 10, fx: 'smoke' });
tac('hunluan', '混亂', 'Confusion', 5, 'e1', { st: 'confuse', int: 55, lv: 5, fx: 'spirit' });
tac('tiaobo', '挑撥', 'Provoke', 4, 'e1', { st: 'provoke', int: 50, lv: 4, fx: 'spark' });
tac('maifu', '埋伏', 'Ambush', 8, 'self', { st: 'ambush', int: 62, lv: 9, fx: 'leaf' });
tac('weihe', '威嚇', 'Intimidate', 4, 'e1', { st: 'fear', int: 44, lv: 7, fx: 'spark' });
tac('pojia', '破甲', 'Armour Break', 5, 'e1', { st: 'defdown', int: 52, lv: 8, fx: 'cutx' });
tac('fengce', '封策', 'Seal Ploys', 5, 'e1', { st: 'silence', int: 58, lv: 9, fx: 'circle' });
tac('mihun', '迷魂', 'Sleep Mist', 6, 'e1', { st: 'sleep', int: 62, lv: 12, fx: 'smoke' });
tac('qimen', '奇門', 'Qimen Trap', 10, 'e1', { st: 'stun', int: 0, lv: 99, fx: 'circle' });
tac('jinsuo', '八門金鎖', 'Eight Gates Lock', 24, 'eall', { st: 'stun', int: 0, lv: 99, fx: 'circle' });
tac('guwu', '鼓舞', 'Rally', 6, 'aall', { buff: 'atk', int: 48, lv: 4, fx: 'boost' });
tac('jianshou', '堅守', 'Hold Fast', 6, 'aall', { buff: 'def', int: 46, lv: 6, fx: 'shield' });
tac('jifeng', '疾風', 'Swift Wind', 6, 'aall', { buff: 'spd', int: 58, lv: 11, fx: 'leaf' });
tac('zhiliao', '治療', 'Mend', 5, 'a1', { heal: 0.35, int: 40, lv: 2, fx: 'boost' });
tac('huifu', '回復', 'Restore', 12, 'aall', { heal: 0.3, int: 70, lv: 20, fx: 'boost' });
tac('dahui', '大回復', 'Great Restore', 22, 'aall', { heal: 0.65, int: 88, lv: 36, fx: 'boost' });
tac('fuhuo', '復活', 'Rally the Fallen', 16, 'down', { revive: 0.35, int: 80, lv: 26, fx: 'spirit' });
tac('dunzou', '遁走', 'Withdraw', 3, 'field', { escape: true, int: 35, lv: 1, fx: 'smoke' });
tac('zhencha', '偵察', 'Scout', 2, 'field', { scout: true, int: 30, lv: 1, fx: 'circle' });
tac('tianbian', '天變', 'Change of Sky', 6, 'field', { weather: 'rain', int: 74, lv: 16, fx: 'pillar' });
tac('hufeng', '呼風', 'Call the Wind', 6, 'field', { weather: 'wind', int: 0, lv: 99, fx: 'leaf' });
tac('huolong', '火龍船', 'Fire-Dragon Rafts', 24, 'eall', { el: 'fire', pow: 0.75, naval: 1.5, int: 0, lv: 99, fx: 'explosion', unique: 'jeff' });
tac('guanxing', '觀星', 'Read the Stars', 8, 'field', { weather: 'clear', buff2: 'spd', int: 0, lv: 99, fx: 'spirit', unique: 'erin' });
tac('heilian', '黑蓮咒', 'Black Lotus Curse', 10, 'eall', { el: 'dark', pow: 0.6, st: 'confuse', int: 0, lv: 99, fx: 'spirit', enemyOnly: true });
export const TACTICS = TAC;
export const tacName = (id) => (TAC[id] ? L(TAC[id].zh, TAC[id].en) : id);
export const TAC_DESC = {
  huoji: ['放火燒一支敵軍，可能使其燒傷。', 'Sets one enemy unit on fire; it may keep burning.'], dahuo: ['火燒全部敵軍。', 'Fire on every enemy unit.'], liehuo: ['猛烈的火焰吞沒全部敵軍。', 'A roaring blaze over all enemies.'],
  yehuo: ['業火焚盡一切。', 'Fire that leaves nothing.'], shuiji: ['決水淹一支敵軍。', 'Floods one enemy unit.'], dashui: ['大水沖向全部敵軍。', 'A flood over all enemies.'],
  hongshui: ['滔天洪水。', 'A towering deluge.'], luoshi: ['推落巨石砸向一支敵軍。', 'Boulders onto one enemy.'], shanbeng: ['整面山坡崩落。', 'A whole hillside comes down.'],
  leiji: ['引雷劈向一支敵軍。雨天更強。', 'Lightning on one enemy. Stronger in rain.'], tianlei: ['天雷轟擊全部敵軍。', 'Thunder on all enemies.'], duyan: ['毒煙使敵軍每回合損兵。', 'Smoke that bleeds the enemy each turn.'],
  hunluan: ['使一支敵軍陷入混亂，亂打一通。能打斷蓄力。', 'Throws one enemy into confusion. Breaks off a charge.'], tiaobo: ['激怒敵將：攻擊上升但防禦大降，只會攻擊施計者。', 'Goads a foe: more attack, far less defence, and it only attacks the caster.'],
  maifu: ['設下伏兵，下一個攻擊我軍的敵人會中伏。', 'Hidden troops strike the next enemy who attacks.'], qimen: ['以奇門之陣困住一支敵軍，使其無法行動。能打斷蓄力。', 'Traps one enemy so it cannot act. Breaks off a charge.'],
  jinsuo: ['八門金鎖困住全部敵軍。', 'Locks every enemy in place.'], leiting: ['引九天之雷轟擊全部敵軍，比天雷更猛烈。', 'Calls the thunder of the nine heavens down on every enemy, fiercer than the Wrath of Heaven.'], guwu: ['全軍攻擊力上升。', 'Raises the attack of the whole army.'], jianshou: ['全軍防禦力上升。', 'Raises the defence of the whole army.'],
  jifeng: ['全軍速度上升。', 'Raises the speed of the whole army.'], zhiliao: ['恢復一支部隊的兵力。', 'Restores troops to one unit.'], huifu: ['恢復全軍兵力。', 'Restores troops to the whole army.'],
  dahui: ['大幅恢復全軍兵力。', 'Restores many troops to the whole army.'], fuhuo: ['讓敗走的武將重整旗鼓。', 'A routed general returns to the field.'], dunzou: ['全軍撤離戰場（首領戰無效）。地圖上使用可返回上一座城。', 'The army leaves the battle (not against leaders). On the map: back to the last city.'],
  zhencha: ['看清敵軍的弱點、抗性與首領的下一招（情報卡上的？？？），全軍會心率上升。', 'Reveals enemy weak points, resistances and the leader\'s next move (the ??? on the info card); more critical hits.'], tianbian: ['使天降大雨：水計、雷擊增強，火計減弱，能澆熄火船與業火。', 'Brings rain: water and thunder grow, fire weakens; it douses fire ships and hellfire.'],
  hufeng: ['喚來東風：火計與弓箭增強，吹散江霧，火船也會被吹回敵陣。', 'Calls a wind: fire and arrows grow stronger, fog blows away, and fire ships turn back on the enemy.'], huolong: ['傑夫的火龍船，水戰中威力倍增。', "Jeff's burning rafts; far stronger on water."],
  guanxing: ['艾琳觀星：天氣轉晴、霧散，全軍速度上升，並解除詛咒、混亂、恐懼與昏睡。', 'Erin reads the stars: clear sky, no fog, a faster army, and curses, confusion, fear and sleep are lifted.'],
  weihe: ['威嚇一支敵軍使其恐懼：攻擊下降三回合。', 'Frightens one enemy: weaker attacks for three turns.'], pojia: ['破壞一支敵軍的甲冑：防禦下降三回合。', 'Breaks one enemy\'s armour: less defence for three turns.'],
  fengce: ['封住一名敵將的計策三回合，也能打斷正在施法的敵人。', 'Seals one foe\'s ploys for three turns; also breaks off a spell being cast.'], mihun: ['使一支敵軍昏睡，受到攻擊才會醒。能打斷蓄力。', 'Puts one enemy to sleep until it is hit. Breaks off a charge.'], heilian: ['黑蓮教的邪咒。', 'The Black Lotus curse.'],
};

// ---------- formations ----------
// pos: five slots on a 5 x 3 grid (col 0 = front); hit: how likely each slot is to be attacked
export const FORMS = {
  fangyuan: { zh: '方圓陣', en: 'Square', pos: [[1, 1], [0, 0], [0, 2], [2, 0], [2, 2]], hit: [1, 1, 1, 1, 1], atk: 1, def: 1.1, spd: 1, tac: 1, desc: ['四面守備的基本陣形。防禦小幅上升。', 'The basic all-round formation. A little more defence.'] },
  yulin: { zh: '魚鱗陣', en: 'Fish Scale', pos: [[0, 1], [1, 0], [1, 2], [2, 1], [3, 1]], hit: [2.2, 1.2, 1.2, 0.6, 0.4], atk: 1.15, def: 0.95, spd: 1, tac: 1, desc: ['層層推進，攻擊上升；前鋒最常受攻擊。', 'Layered advance: more attack; the vanguard takes most blows.'] },
  heyi: { zh: '鶴翼陣', en: 'Crane Wing', pos: [[2, 1], [0, 0], [0, 2], [1, 0], [1, 2]], hit: [0.4, 1.4, 1.4, 1, 1], atk: 1.05, def: 1.05, spd: 1, tac: 1.12, desc: ['兩翼包圍，主將居中少受攻擊，計策威力上升。', 'Wings wrap the foe; the leader sits safe; tactics grow stronger.'] },
  fengshi: { zh: '鋒矢陣', en: 'Arrowhead', pos: [[0, 1], [1, 0], [1, 2], [2, 0], [2, 2]], hit: [1.8, 1, 1, 0.8, 0.8], atk: 1.25, def: 0.85, spd: 1.1, tac: 1, cond: 'lead_str80', desc: ['以猛將為箭頭直衝敵陣。條件：主將武力80以上。', 'A fierce leader at the tip. Needs a leader with STR 80+.'] },
  changshe: { zh: '長蛇陣', en: 'Long Snake', pos: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]], hit: [1, 1, 1, 1, 1], atk: 1, def: 1, spd: 1.2, tac: 1, evade: 0.12, desc: ['首尾相應，速度上升，較易閃避。', 'Head and tail help each other: faster, harder to hit.'] },
  yanxing: { zh: '雁行陣', en: 'Wild Geese', pos: [[0, 0], [1, 1], [2, 2], [1, 0], [2, 1]], hit: [1.2, 1, 0.9, 1, 0.9], atk: 1, def: 1, spd: 1.05, tac: 1, bow: 1.25, cond: 'arc2', desc: ['斜列展開，弓兵攻擊大增。條件：弓兵兩隊以上。', 'A slanting line: archers hit much harder. Needs 2+ archers.'] },
  yanyue: { zh: '偃月陣', en: 'Crescent', pos: [[0, 1], [1, 0], [1, 2], [2, 0], [2, 2]], hit: [1.4, 1, 1, 0.8, 0.8], atk: 1.15, def: 1.1, spd: 1, tac: 1, cond: 'lead_lead85', desc: ['主將親臨陣前，攻守俱佳。條件：主將統率85以上。', 'The leader at the front: strong in attack and defence. Needs LEAD 85+.'] },
  bagua: { zh: '八卦陣', en: 'Eight Trigrams', pos: [[1, 1], [0, 1], [1, 0], [1, 2], [2, 1]], hit: [0.6, 1.2, 1.1, 1.1, 1], atk: 1, def: 1.25, spd: 0.95, tac: 1.15, resist: 0.3, cond: 'str_int95', desc: ['變化無窮：防禦大增，計策更強，敵計易失。條件：軍師智力95以上。', 'Endless change: much defence, stronger tactics, enemy ploys fail more. Needs a strategist with INT 95+.'] },
  shuijun: { zh: '水軍陣', en: 'Naval Line', pos: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]], hit: [1, 1, 1, 1, 1], atk: 1, def: 1, spd: 1, tac: 1, naval: 1.25, cond: 'nav3', desc: ['戰船列陣，水戰時攻守大增。條件：水軍三隊以上。', 'Ships in line: far stronger in naval battles. Needs 3+ navy units.'] },
  // the Three Talents (a trial's reward): heaven, earth and man in step; it neither beats nor is beaten by any
  sancai: { zh: '三才陣', en: 'Three Talents', pos: [[1, 1], [0, 1], [1, 0], [1, 2], [2, 1]], hit: [0.8, 1.2, 1.05, 1.05, 0.9], atk: 1.1, def: 1.1, spd: 1.05, tac: 1.08, desc: ['天、地、人三才相應：攻、守、速度與計策俱升。不克制任何陣形，也不被任何陣形克制。', 'Heaven, earth and man in step: attack, defence, speed and ploys all rise. It beats no formation and none beats it.'] },
  tuzhen: { zh: '突騎陣', en: 'Cavalry Charge', pos: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 2]], hit: [1.2, 1.2, 1.2, 0.7, 0.7], atk: 1.1, def: 0.95, spd: 1.25, tac: 1, charge: 1.4, cond: 'cav3', desc: ['騎兵一齊衝鋒，首回合攻擊大增。條件：前三位皆為騎兵。', 'All horse charge together: huge first-turn attack. Needs the first three to be cavalry.'] },
};
export const formName = (id) => L(FORMS[id].zh, FORMS[id].en);
// each formation beats one other and is beaten by another: the side whose formation wins does 15% more damage
// and starts with more morale; the Naval Line stands outside the circle
export const BEATS = { fengshi: 'fangyuan', fangyuan: 'heyi', heyi: 'fengshi', yulin: 'changshe', changshe: 'yanxing', yanxing: 'yulin', tuzhen: 'yanyue', yanyue: 'bagua', bagua: 'tuzhen' };
export const BEAT_WHY = {
  fengshi: ['箭頭直刺方圓陣的正面', 'the arrowhead pierces the Square'], fangyuan: ['四面皆守，鶴翼包不住', 'no flank for the Crane\'s wings'], heyi: ['兩翼合圍衝來的箭頭', 'the wings close round the Arrowhead'],
  yulin: ['層層魚鱗切斷長蛇', 'the scales cut the Snake apart'], changshe: ['長蛇繞過斜列的雁行', 'the Snake coils round the Geese'], yanxing: ['箭雨落進密集的魚鱗', 'arrows rain into the packed Scales'],
  tuzhen: ['鐵騎衝破偃月的兩角', 'the horse break the Crescent\'s horns'], yanyue: ['主將當先直搗八卦中樞', 'the leader drives into the Trigrams\' heart'], bagua: ['八門困住衝鋒的騎兵', 'the gates trap the charging horse'],
};
export const formEdge = (a, d) => (BEATS[a] === d ? 1 : BEATS[d] === a ? -1 : 0);
export const beatenBy = (f) => Object.keys(BEATS).find((k) => BEATS[k] === f) || null;
// back rows: a general standing in column 2 or deeper of the formation grid
export const rowOf = (form, slot) => { const p = (FORMS[form] || FORMS.fangyuan).pos[slot]; return p && p[0] >= 2 ? 'back' : 'front'; };

// ---------- statuses ----------
// name, colour, what it does (shown in the help page)
export const STATUS = {
  confuse: ['混亂', 'Confused', '#e080ff', '胡亂攻擊敵我。', 'Strikes at friend and foe alike.'],
  stun: ['受困', 'Trapped', '#ffe060', '無法行動。', 'Cannot act.'],
  sleep: ['昏睡', 'Asleep', '#80b0ff', '無法行動，受到攻擊才醒。', 'Cannot act until hit.'],
  fear: ['恐懼', 'Afraid', '#c0c0c0', '攻擊下降三成。', 'Attacks 30% weaker.'],
  burn: ['燒傷', 'Burning', '#ff9040', '每回合損失兵力。', 'Loses troops each turn.'],
  poison: ['中毒', 'Poisoned', '#a0e060', '每回合損失兵力。', 'Loses troops each turn.'],
  silence: ['封策', 'Sealed', '#60e0d0', '無法使用策略。', 'Cannot use tactics.'],
  curse: ['詛咒', 'Cursed', '#c040c0', '無法恢復，每回合損兵，攻擊下降。', 'Cannot be healed, loses troops each turn, attacks weaker.'],
  provoke: ['激怒', 'Provoked', '#ff6050', '只攻擊挑撥者，攻擊上升、防禦大降。', 'Only attacks the provoker; more attack, far less defence.'],
  defdown: ['破甲', 'Armour broken', '#ff9070', '防禦下降。', 'Less defence.'],
};

// ---------- skills ----------
// the old passive skills; every general's passives are now their two traits (traits.js), which reuse these ids
export const SKILLS = {
  lianji: ['連擊', 'Double Strike', '有機會連續攻擊兩次。', 'May strike twice.'],
  tuji: ['突擊', 'Charge', '首回合攻擊大增。', 'Much stronger on the first turn.'],
  tiebi: ['鐵壁', 'Iron Wall', '防禦上升。', 'More defence.'],
  shenshe: ['神射', 'Sharpshooter', '會心率上升，無視部分防禦。', 'More critical hits; ignores some defence.'],
  shuizhan: ['水戰', 'River Warrior', '水戰時攻守上升。', 'Stronger in naval battles.'],
  yexi: ['夜襲', 'Night Raid', '容易先發制人。', 'More often strikes first.'],
  jili: ['激勵', 'Inspire', '開戰時全軍攻擊上升。', 'The army attacks harder from the start.'],
  yishu: ['醫術', 'Medicine', '每回合為全軍恢復少許兵力。', 'Restores a few troops to all each turn.'],
  fanji: ['反計', 'Counterploy', '常能識破敵計。', 'Often sees through enemy ploys.'],
  kanpo: ['看破', 'Clear Mind', '不受混亂與困陣。', 'Immune to confusion and traps.'],
  weifeng: ['威風', 'Awe', '敵軍攻擊下降。', 'Enemies attack weaker.'],
  guimou: ['鬼謀', 'Cunning', '計策威力上升。', 'Stronger tactics.'],
  shensuan: ['神算', 'Foresight', '策略值消耗減少。', 'Tactics cost less.'],
  huwei: ['護衛', 'Guardian', '常替受傷的同伴擋下攻擊。', 'Often covers a hurt friend.'],
  lueduo: ['掠奪', 'Plunder', '戰後得到更多金錢。', 'More gold after battle.'],
  yongmeng: ['勇猛', 'Valour', '攻擊上升。', 'More attack.'],
  buqu: ['不屈', 'Unyielding', '每場戰鬥一次，致命一擊後以殘兵堅持。', 'Once a battle, survives a killing blow.'],
  jisu: ['疾速', 'Swift', '速度上升。', 'More speed.'],
  haoling: ['號令', 'Command', '兵力上限上升。', 'More maximum troops.'],
  qixi: ['奇襲', 'Surprise', '不易被敵軍偷襲。', 'Enemies rarely ambush the army.'],
  yiqi: ['一騎當千', 'Worth a Thousand', '有機會攻擊全部敵軍。', 'May strike every enemy at once.'],
  guishen: ['鬼神', 'War God', '攻擊總是波及全部敵軍。', 'Every attack strikes all enemies.'],
  danqi: ['單騎', 'Lone Rider', '兵力越少，攻擊越強。', 'The fewer troops, the harder it hits.'],
  tuntian: ['屯田', 'Farming Garrison', '在地圖上行走時慢慢恢復兵力。', 'Troops recover while walking the map.'],
  chihou: ['斥候', 'Scouts', '在地圖上較少遇敵。', 'Fewer battles on the map.'],
  dunqiang: ['盾牆', 'Shield Wall', '挺身而出，替同伴承受攻擊，自身防禦大增。', 'Steps in front of friends and takes the blows, with much more defence.'],
  gongjiang: ['工匠', 'Engineer', '火計與攻城計策威力大增。', 'Fire and siege ploys much stronger.'],
  guanxing: ['觀星', 'Stargazer', '回復與天候計策更強，水戰時速度上升。', 'Better healing and weather ploys; faster on water.'],
  miaoshou: ['妙手', 'Light Fingers', '攻擊時有機會偷得金錢或道具；能發現地圖上的秘密。', 'May steal gold or items when attacking; finds secrets on the map.'],
  yinjiang: ['陰將', 'Black Lotus Rite', '黑蓮教的邪術：每回合恢復兵力。', 'A Black Lotus rite: recovers troops every turn.'],
};
export const skillName = (id) => (SKILLS[id] ? L(SKILLS[id][0], SKILLS[id][1]) : id);
export const skillDesc = (id) => (SKILLS[id] ? L(SKILLS[id][2], SKILLS[id][3]) : '');

// ---------- levels ----------
export const MAXLV = 70;
export const expFor = (lv) => Math.round(18 * lv * lv + 12 * lv); // total exp to reach lv+1 from lv
// soldiers a general can lead
export function maxTroops(lv, lead, haoling) {
  const base = (80 + lead * 2) * (1 + 0.3 * (lv - 1)) * (1 + 0.018 * Math.pow(lv - 1, 1.45));
  return Math.round(base * (haoling ? 1.15 : 1) / 10) * 10;
}
// the strategy pool from the army's strategist
export const maxTP = (int, lv) => Math.round(int * 0.3 + lv * 1.6 + 8);
