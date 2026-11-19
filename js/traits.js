// 雙特性: every one of the 500 generals has exactly two passive traits, and no two generals share the same
// pair. The famous get pairs picked by hand (a few legendary traits belong to one person only); the generated
// generals get seeded pairs weighted by their stats, unit type and side, so the same id always gives the same
// pair and old saves need nothing stored. battle.js runs the effects (each trait id has its own code path)
// and shows the trait's name over the general whenever it triggers.
import { L } from './i18n.js?v=11';

// families, in the order the glossary shows them
export const FAMILY = {
  combat: ['戰鬥', 'Combat'], unit: ['兵種', 'Unit type'], form: ['陣形', 'Formation'], tactic: ['策略', 'Tactics'],
  status: ['狀態', 'Status'], support: ['輔助', 'Support'], legend: ['傳說', 'Legendary'],
};
// id: [中文, English, 效果, effect, family, weights for generated generals]
// weights: war sage lead bal (random archetypes), inf cav arc nav (unit), str int ldr spd (a stat of 75+),
// or a faction name; a trait with no weights is never handed out at random (famous only)
const T = {
  // ---- combat ----
  yongmeng: ['勇猛', 'Valour', '攻擊+10%。', 'ATK +10%.', 'combat', { war: 3, str: 2, bal: 1 }],
  lianji: ['連擊', 'Double Strike', '三成機率追加一擊（六成威力）。', '30%: a second blow at 60%.', 'combat', { war: 3, spd: 2 }],
  tuji: ['突擊', 'Charge', '第一回合傷害+30%。', 'First round: +30% damage.', 'combat', { cav: 4, war: 1 }],
  tiebi: ['鐵壁', 'Iron Wall', '防禦+20%；防禦時傷害只剩35%。', 'DEF +20%; defending takes only 35%.', 'combat', { inf: 2, ldr: 2, lead: 2 }],
  shenshe: ['神射', 'Sharpshooter', '會心+15%，無視兩成五防禦。', 'Crit +15%, ignores 25% DEF.', 'combat', { arc: 4 }],
  buqu: ['不屈', 'Unyielding', '每場一次，致命一擊後以殘兵堅持。', 'Once a battle, survives a killing blow.', 'combat', { war: 2, inf: 1, bal: 1 }],
  danqi: ['背水', 'Last Stand', '兵力越少攻擊越強（最多+60%）。', 'Fewer troops, harder blows (up to +60%).', 'combat', { war: 2, str: 1 }],
  yiqi: ['一騎當千', 'Worth a Thousand', '兩成五機率橫掃全部敵軍。', '25%: the blow sweeps every foe.', 'combat', { war: 1, str: 1 }],
  huixin: ['會心', 'Keen Eye', '會心+10%，會心傷害×1.8。', 'Crit +10%; crits do x1.8.', 'combat', { war: 2, arc: 2, spd: 1 }],
  fanshou: ['反擊', 'Riposte', '三成機率反擊近戰攻擊者。', '30%: strikes back at melee attackers.', 'combat', { war: 2, inf: 2 }],
  xiandeng: ['先登', 'First Up', '首回合必定先動，首擊+25%。', 'Acts first in round 1; first blow +25%.', 'combat', { spd: 3, war: 1 }],
  mengzhui: ['猛追', 'Pursuer', '對兵力三成以下的敵人+40%。', '+40% on foes under 30% troops.', 'combat', { war: 2, cav: 2 }],
  zhanjiang: ['斬將', 'Duelist', '對首領與名將傷害+20%。', '+20% on leaders and famous generals.', 'combat', { war: 2, str: 2 }],
  mengjin: ['猛進', 'Reckless', '攻擊+20%，但防禦−15%。', 'ATK +20% but DEF -15%.', 'combat', { war: 3 }],
  pojun: ['破軍', 'Armour Breaker', '兩成五機率擊破敵甲（破甲兩回合）。', '25%: breaks armour (2 turns).', 'combat', { war: 2, inf: 1 }],
  xuezhan: ['血戰', 'Bloodlust', '擊倒敵將時回兵12%並攻擊上升。', 'A kill restores 12% troops and ATK up.', 'combat', { war: 2, str: 1 }],
  shenfa: ['身法', 'Nimble', '一成二機率閃避刀箭。', 'Dodges 12% of blades and arrows.', 'combat', { spd: 3, bal: 1 }],
  tiaoxin: ['挑釁', 'Taunt', '開戰時激怒最強的敵人；敵人常攻擊他。', 'Provokes the strongest foe at the start; draws attacks.', 'combat', { inf: 2, ldr: 1, war: 1 }],
  huzhu: ['護主', 'Loyal Guard', '常替主將與軍師擋下攻擊。', 'Often takes blows meant for the leader or strategist.', 'combat', { inf: 2, lead: 1, war: 1 }],
  huwei: ['護衛', 'Guardian', '常替兵力低的同伴擋下攻擊。', 'Often covers a badly hurt friend.', 'combat', { inf: 2, war: 1, bal: 1 }],
  weiya: ['威壓', 'Overawe', '開戰敵軍士氣−8，每次命中再−2。', 'Foe morale -8 at the start, -2 per hit.', 'combat', { str: 2, ldr: 2 }],
  weifeng: ['威風', 'Awe', '敵軍攻擊−8%。', 'Enemy attacks -8%.', 'combat', { lead: 2, ldr: 2 }],
  // ---- unit type ----
  shuizhan: ['水戰', 'River Warrior', '水戰時傷害+25%，受傷減少。', 'At sea: +25% damage, takes less.', 'unit', { nav: 5 }],
  qishe: ['騎射', 'Horse Archer', '刀槍打後排不減傷。', 'Melee reaches the back row at full strength.', 'unit', { cav: 4 }],
  qiangzhen: ['槍陣', 'Spear Wall', '對騎兵+25%；受騎兵傷害−20%。', '+25% on cavalry; -20% from cavalry.', 'unit', { inf: 4 }],
  gongshen: ['弓神', 'Bow Saint', '開戰先射一輪冷箭。', 'Opens the battle with a free volley.', 'unit', { arc: 4 }],
  shuishi: ['水師', 'Admiral', '水戰時全軍傷害+10%。', 'At sea: the whole army +10% damage.', 'unit', { nav: 3, ldr: 1 }],
  tieqi: ['鐵騎', 'Iron Riders', '騎馬時對步兵+20%。', 'Mounted: +20% on foot.', 'unit', { cav: 4 }],
  shanzhan: ['山戰', 'Mountaineer', '山地、林地、洞窟中傷害+20%、防禦+10%。', 'Hills, woods, caves: +20% damage, DEF +10%.', 'unit', { inf: 2, shanyue: 4, nanman: 4 }],
  dangjian: ['擋箭', 'Arrow Ward', '受弓弩傷害−30%。', '-30% damage from bows and crossbows.', 'unit', { inf: 2, cav: 1 }],
  // ---- formation ----
  zhenfa: ['陣法家', 'Formation Master', '出戰時陣形加成×1.5（每項最多再+8%）。', 'While he fights, formation bonuses x1.5 (at most +8% more each).', 'form', { lead: 2, int: 2, ldr: 1 }],
  heyizhi: ['鶴翼之才', 'Wing Commander', '鶴翼、雁行陣時傷害與計策+20%。', 'In Crane Wing or Wild Geese: +20% blows and ploys.', 'form', { lead: 2, arc: 1 }],
  xianfeng: ['先鋒', 'Vanguard', '站在最前列時攻擊+15%、防禦+10%。', 'In the front column: ATK +15%, DEF +10%.', 'form', { war: 2, ldr: 1 }],
  yingbian: ['應變', 'Adaptable', '下令變陣時全軍攻擊上升、士氣+8。', 'Ordering a new formation: army ATK up, morale +8.', 'form', { lead: 3, bal: 1 }],
  pozhen: ['破陣', 'Formation Breaker', '無視敵陣防禦與被克制；克制時再+10%。', 'Ignores foe formation DEF and counters; +10% when ours wins.', 'form', { lead: 2, war: 1 }],
  // ---- tactics ----
  guimou: ['鬼謀', 'Cunning', '計策威力+15%（任軍師時全軍）。', 'Ploys +15% (all of us, as strategist).', 'tactic', { sage: 3, int: 2 }],
  shensuan: ['神算', 'Foresight', '任軍師時策略消耗−25%。', 'As strategist, ploys cost -25%.', 'tactic', { sage: 3 }],
  fanji: ['反計', 'Counterploy', '敵計對他的成功率−20%。', 'Enemy ploys on him: -20% chance.', 'tactic', { sage: 2, int: 2, lead: 1 }],
  huoshen: ['火神', 'Fire Lord', '火計+25%，燒傷機率六成。', 'Fire ploys +25%, 60% burn.', 'tactic', { sage: 2, int: 1 }],
  shuigong: ['水攻', 'Water Master', '水計+25%，成功率+10%。', 'Water ploys +25%, +10% chance.', 'tactic', { sage: 2, nav: 2 }],
  leigong: ['雷公', 'Thunder Caller', '雷擊+25%，雨天再+15%。', 'Thunder +25%, +15% more in rain.', 'tactic', { sage: 2, int: 1 }],
  jushi: ['巨石', 'Rock Roller', '落石類計策+30%。', 'Rock ploys +30%.', 'tactic', { sage: 2, shanyue: 2 }],
  fanjian: ['反間', 'Turnabout', '兩成機率把敵計反彈回去。', '20%: an enemy ploy bounces back.', 'tactic', { sage: 2, int: 1 }],
  dunjia: ['遁甲', 'Dunjia Arts', '兩成機率完全躲開敵計。', '20%: slips an enemy ploy entirely.', 'tactic', { sage: 2, spd: 1, sect: 2 }],
  yizhe: ['醫者', 'Physician', '他施的治療策略+30%。', 'His healing ploys +30%.', 'tactic', { sage: 2 }],
  jieyue: ['節約', 'Thrifty', '他自己施計消耗−30%。', 'His own ploys cost -30%.', 'tactic', { sage: 2, bal: 1 }],
  lianhuan: ['連環', 'Chain Plot', '單體計策三成五機率波及另一敵人。', '35%: a one-foe ploy also hits another.', 'tactic', { sage: 2, int: 1 }],
  yaoshu: ['妖術', 'Sorcery', '狀態計成功率+15%，多一回合。', 'Status ploys +15% chance, +1 turn.', 'tactic', { sage: 2, sect: 3 }],
  // ---- status ----
  kanpo: ['看破', 'Clear Mind', '不受混亂、受困、昏睡、激怒。', 'Immune to confusion, traps, sleep, provoke.', 'status', { sage: 1, int: 1 }],
  lengjing: ['冷靜', 'Calm', '不受混亂與恐懼。', 'Immune to confusion and fear.', 'status', { lead: 2, bal: 1 }],
  bumian: ['不眠', 'Sleepless', '不受昏睡與封策。', 'Immune to sleep and sealed ploys.', 'status', { sage: 1, spd: 1, bal: 1 }],
  shipo: ['識破', 'Insight', '識破伏兵；幻影、幻術對他無效。', 'Sees through ambushes and illusions.', 'status', { sage: 1, int: 1, lead: 1 }],
  baidu: ['百毒不侵', 'Iron Gut', '不受中毒與燒傷。', 'Immune to poison and burns.', 'status', { war: 1, nanman: 4, shanyue: 2 }],
  quxie: ['驅邪', 'Exorcist', '不受詛咒；對黑蓮教+20%。', 'Immune to curses; +20% on the Black Lotus.', 'status', { sage: 1, free: 2 }],
  duji: ['毒計', 'Poisoner', '攻擊與計策兩成五機率使敵中毒。', '25%: blows and ploys poison.', 'status', { sage: 1, sect: 3, nanman: 2 }],
  jianren: ['堅韌', 'Tenacious', '異常狀態加倍快消退。', 'Bad statuses wear off twice as fast.', 'status', { ldr: 1, bal: 2 }],
  // ---- support ----
  jili: ['激勵', 'Inspire', '開戰時全軍攻擊上升、士氣+5。', 'At the start: army ATK up, morale +5.', 'support', { lead: 3 }],
  yishu: ['醫術', 'Medicine', '每回合全軍回兵4%。', 'The army regains 4% troops each round.', 'support', { sage: 2 }],
  haoling: ['號令', 'Command', '兵力上限+15%。', 'Max troops +15%.', 'support', { lead: 3, ldr: 1 }],
  jisu: ['疾速', 'Swift', '速度+20%。', 'SPD +20%.', 'support', { spd: 3, cav: 1 }],
  yexi: ['夜襲', 'Night Raid', '較易先發制人，首回合+15%。', 'Strikes first more; round 1 +15%.', 'support', { spd: 1, lead: 1, bal: 1 }],
  qixi: ['奇襲', 'Surprise', '不會被偷襲，較易搶得先機。', 'Never ambushed; strikes first more often.', 'support', { lead: 1, spd: 1, pirate: 2 }],
  tuntian: ['屯田', 'Farming Garrison', '地圖上回兵；戰鬥中每回合回兵2%。', 'Troops back on the map; 2% each round.', 'support', { lead: 2, sage: 1 }],
  chihou: ['斥候', 'Scouts', '少遇敵；開戰探明敵首領的虛實。', 'Fewer battles; reveals the enemy leader.', 'support', { spd: 2, arc: 1 }],
  lueduo: ['掠奪', 'Plunder', '戰後金錢+30%。', '+30% gold after battle.', 'support', { pirate: 3, shanyue: 2, war: 1 }],
  gushi: ['鼓吹', 'War Drums', '每回合我軍士氣+3（最多到70）。', 'Our morale +3 each round (up to 70).', 'support', { lead: 2, bal: 1 }],
  liangguan: ['糧官', 'Quartermaster', '他使用的道具效果+40%。', 'Items he uses work 40% better.', 'support', { lead: 1, bal: 2 }],
  shantui: ['善退', 'Escape Artist', '野戰撤退必定成功。', 'Retreat from field battles always works.', 'support', { spd: 1, bal: 1 }],
  shouxiang: ['收降', 'Persuader', '戰後俘虜敵將的機會+25%。', '+25% chance to take a prisoner.', 'support', { lead: 1, sage: 1 }],
  shangcai: ['商才', 'Merchant', '戰後金錢+15%，賣東西多賣兩成。', '+15% gold; things sell for 20% more.', 'support', { bal: 1, free: 2 }],
  shibao: ['識寶', 'Treasure Eye', '敵軍更容易掉落寶物。', 'Treasure drops come more often.', 'support', { bal: 1, free: 2, pirate: 1 }],
  // ---- legendary: one person each ----
  wolong: ['臥龍', 'Sleeping Dragon', '出戰時全軍計策+15%、成功率+10%。', 'While he fights: our ploys +15%, +10% chance.', 'legend'],
  fengchu: ['鳳雛', 'Fledgling Phoenix', '全體計策威力+30%。', 'All-foe ploys +30%.', 'legend'],
  jdhu: ['江東之虎', 'Tiger of Jiangdong', '傷害+15%；他在時我軍士氣不低於40。', '+15% damage; our morale never below 40 while he stands.', 'legend'],
  xiaobawang: ['小霸王', 'Little Conqueror', '擊倒敵將後立刻再攻擊一次。', 'After a kill he strikes again at once.', 'legend'],
  guishen: ['飛將', 'Flying General', '每次攻擊都波及全部敵軍。', 'Every attack strikes all foes.', 'legend'],
  meizhoulang: ['美周郎', 'Handsome Zhou', '陣形克制時+25%；開戰士氣+10。', 'Winning formation +25%; start morale +10.', 'legend'],
  wusheng: ['武聖', 'Saint of War', '對首領與名將+25%，會心+10%。', '+25% on leaders and the famous; crit +10%.', 'legend'],
  yanren: ['燕人', 'Roar of Yan', '開戰一聲大喝，敵將各半數機率恐懼。', 'A roar at the start: each foe 50% afraid.', 'legend'],
  changshan: ['常山之龍', 'Dragon of Changshan', '必定掩護兵力三成五以下的同伴，受傷−25%。', 'Always covers friends under 35%; takes 25% less.', 'legend'],
  jianxiong: ['奸雄', 'Hero of Chaos', '同伴倒下時士氣不降，全軍攻擊上升。', 'A friend falls: no morale lost, army ATK up.', 'legend'],
  guicai: ['鬼才', 'Ghost Talent', '開戰即看清敵軍虛實（如同偵察）。', 'The enemy starts scouted.', 'legend'],
  langgu: ['狼顧', 'Wolf\'s Glance', '他的計策不會被反彈；敵計對他−25%。', 'His ploys never bounce; foe ploys on him -25%.', 'legend'],
  biyan: ['碧眼兒', 'Green-Eyed Lord', '出戰時全軍防禦+8%，士氣不低於35。', 'While he fights: army DEF +8%, morale never below 35.', 'legend'],
  dunqiang: ['盾牆', 'Shield Wall', '常替同伴擋下攻擊，自身防禦大增。', 'Steps in front of friends, with much more DEF.', 'legend'],
  gongjiang: ['工匠', 'Engineer', '火計+25%；攻城時全軍+12%。', 'Fire ploys +25%; sieges: army +12%.', 'legend'],
  guanxing: ['觀星', 'Stargazer', '治療+20%；水戰時速度+20%。', 'Healing +20%; faster at sea.', 'legend'],
  miaoshou: ['眼尖', 'Sharp Eyes', '攻擊時常撿到敵軍掉落的錢；能發現地圖上的秘密。', 'Often picks up coins the enemy drops; spots secrets.', 'legend'],
  yinjiang: ['陰將', 'Black Lotus Rite', '黑蓮邪術：每回合回兵5%。', 'A Black Lotus rite: 5% troops back each round.', 'legend'],
};
export const TRAITS = {};
for (const [id, [zh, en, dz, de, fam, w]] of Object.entries(T)) TRAITS[id] = { id, zh, en, dz, de, fam, w: w || null, uniq: !w };
export const traitName = (id) => (TRAITS[id] ? L(TRAITS[id].zh, TRAITS[id].en) : id);
export const traitDesc = (id) => (TRAITS[id] ? L(TRAITS[id].dz, TRAITS[id].de) : '');
export const TRAIT_IDS = Object.keys(TRAITS);

// ---------- the famous, by hand ----------
export const FAMOUS_PAIRS = {
  sunquan: 'jili biyan', sunjian: 'jdhu yongmeng', sunce: 'xiaobawang tuji', shangxiang: 'shenshe jisu', zhouyu: 'huoshen meizhoulang',
  lusu: 'shensuan yingbian', lumeng: 'shuizhan qixi', luxun: 'huoshen lianhuan', ganning: 'shuishi qixi', taishici: 'shenshe lianji',
  zhoutai: 'buqu huzhu', chengpu: 'tiebi weifeng', huanggai: 'huoshen buqu', handang: 'qishe tiebi', jiangqin: 'shuizhan yongmeng',
  lingtong: 'lianji jisu', lingcao: 'shuizhan xiandeng', dongxi: 'shuizhan mengjin', chenwu: 'yongmeng mengzhui', xusheng: 'shuishi tiebi',
  dingfeng: 'yexi shuizhan', zhuhuan: 'yongmeng zhanjiang', zhuran: 'tiebi shenshe', panzhang: 'lueduo mengzhui', zhangzhao: 'fanji shensuan',
  guyong: 'fanji tuntian', zhugejin: 'shensuan shouxiang', yufan: 'yizhe fanji', kanze: 'fanjian guimou', buzhi: 'fanji jieyue',
  zhuzhi: 'tiebi jianren', lufan: 'lueduo shangcai', heqi: 'weifeng shanzhan', daqiao: 'yishu jieyue', xiaoqiao: 'yishu lengjing',
  jeff: 'gongjiang guimou', erin: 'guanxing yizhe', josh: 'dunqiang tiaoxin', jasper: 'chihou miaoshou',
  sunhao: 'weifeng jianren', yanbaihu: 'yongmeng lueduo', zulang: 'yongmeng shanzhan', wanglang: 'fanji shouxiang', liuxun: 'lueduo tuntian',
  huangzu: 'shenshe shuishi', sufei: 'shuizhan huwei', chenjiu: 'shuizhan huoshen', liubiao: 'tuntian jieyue', caimao: 'shuishi guimou',
  zhangyun: 'shuizhan jianren', wenpin: 'tiebi shuizhan', kuaiyue: 'guimou yingbian', liuqi: 'haoling shantui', huangzhong: 'gongshen danqi',
  weiyan: 'mengjin xiandeng', liubei: 'jili haoling', guanyu: 'wusheng weiya', zhangfei: 'yanren mengjin', zhugeliang: 'wolong zhenfa',
  zhaoyun: 'changshan lianji', machao: 'tieqi tuji', pangtong: 'fengchu lianhuan', xushu: 'pozhen fanji', guanping: 'huzhu lianji',
  zhoucang: 'huwei buqu', caocao: 'jianxiong weifeng', xiahoudun: 'buqu yongmeng', xiahouyuan: 'jisu gongshen', caoren: 'zhenfa tiebi',
  zhangliao: 'weiya tuji', xuchu: 'huzhu yongmeng', dianwei: 'huzhu danqi', xuhuang: 'pozhen tiebi', zhanghe: 'jisu yingbian',
  yujin: 'zhenfa jianren', yuejin: 'xiandeng yongmeng', guojia: 'guicai guimou', xunyu: 'shensuan tuntian', jiaxu: 'fanjian duji',
  simayi: 'langgu guimou', chengyu: 'guimou tuntian', caohong: 'huzhu shangcai', pangde: 'buqu mengjin', yuanshao: 'haoling gushi',
  yanliang: 'zhanjiang xiandeng', wenchou: 'lianji tieqi', shenpei: 'tiebi lengjing', tianfeng: 'fanji guimou', jushou: 'zhenfa fanji',
  gaolan: 'yongmeng tiebi', yuanshu: 'haoling lueduo', jiling: 'huzhu qiangzhen', dongzhuo: 'tiebi weiya', lubu: 'guishen mengjin',
  diaochan: 'fanjian yaoshu', liru: 'duji huoshen', huaxiong: 'zhanjiang mengzhui', lijue: 'lueduo tieqi', guosi: 'lueduo qishe',
  zhangxiu: 'tuji qixi', gaoshun: 'xianfeng pozhen', chengong: 'guimou lianhuan', liuzhang: 'tuntian haoling', zhangren: 'shenfa shenshe',
  yanyan: 'buqu jianren', fazheng: 'guimou qixi', jiangwei: 'lianji guimou', mateng: 'tieqi weifeng', madai: 'jisu mengzhui',
  hansui: 'tuji yingbian', gongsunzan: 'qishe jisu', shixie: 'tuntian shangcai', menghuo: 'buqu shanzhan', zhurong: 'huoshen jisu',
  wutugu: 'dangjian baidu', huatuo: 'yizhe yishu', jiyuan: 'fanji yaoshu', yanwu: 'yinjiang huoshen', chaoyin: 'yinjiang shuigong',
  shuangjing: 'yinjiang lengjing', mingzhao: 'yinjiang leigong', yuji: 'yinjiang yaoshu',
};

// ---------- the generated: seeded, weighted pairs ----------
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const seedOf = (id) => { let h = 2166136261; for (const c of 'trait:' + id) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function tagsOf(g) {
  const t = new Set([g.arch || 'bal', g.unit, g.faction]);
  if (g.str >= 75) t.add('str'); if (g.int >= 75) t.add('int'); if (g.lead >= 75) t.add('ldr'); if (g.spd >= 75) t.add('spd');
  return t;
}
export function traitWeight(g, id) {
  const tr = TRAITS[id]; if (!tr || !tr.w) return 0;
  const tags = tagsOf(g);
  let w = 0.4;
  for (const [k, v] of Object.entries(tr.w)) if (tags.has(k)) w += v;
  // a trait for a kind of troops is wasted on others
  if ((id === 'qishe' || id === 'tieqi' || id === 'tuji') && g.unit !== 'cav') w = id === 'tuji' ? w * 0.4 : 0;
  if ((id === 'shuizhan' || id === 'shuishi') && g.unit !== 'nav') w *= 0.15;
  if ((id === 'shenshe' || id === 'gongshen') && g.unit !== 'arc') w = 0;
  if (['guimou', 'shensuan', 'huoshen', 'shuigong', 'leigong', 'jushi', 'lianhuan', 'yaoshu', 'yizhe', 'jieyue', 'duji'].includes(id) && g.int < 60) w = id === 'duji' ? w * 0.3 : 0;
  if (['mengjin', 'yiqi', 'danqi', 'zhanjiang', 'xuezhan'].includes(id) && g.str < 60) w = 0;
  return w;
}
function pickW(r, g, exclude) {
  const ids = TRAIT_IDS.filter((id) => !exclude.has(id));
  const ws = ids.map((id) => traitWeight(g, id));
  let x = r() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ids.length; i++) { x -= ws[i]; if (x <= 0 && ws[i] > 0) return ids[i]; }
  return ids.find((id, i) => ws[i] > 0);
}
const key = (a, b) => [a, b].sort().join('|');
// gives every general g.traits (two ids) and keeps g.skills as the same list for the battle code
export function assignTraits(list) {
  const used = new Set(), count = {};
  const take = (g, pair) => { g.traits = pair; g.skills = g.traits; used.add(key(...pair)); for (const t of pair) count[t] = (count[t] || 0) + 1; };
  for (const g of list) if (g.famous) take(g, (FAMOUS_PAIRS[g.id] || 'yongmeng tiebi').split(' '));
  for (const g of list) {
    if (g.famous) continue;
    const r = rng(seedOf(g.id));
    let pair = null;
    for (let tries = 0; tries < 60 && !pair; tries++) {
      const a = pickW(r, g, new Set()), b = pickW(r, g, new Set([a]));
      if (a && b && !used.has(key(a, b))) pair = [a, b];
    }
    if (!pair) for (const a of TRAIT_IDS) { for (const b of TRAIT_IDS) if (a !== b && traitWeight(g, a) && traitWeight(g, b) && !used.has(key(a, b))) { pair = [a, b]; break; } if (pair) break; }
    take(g, pair);
  }
  // every trait meant for the generated is held by someone: hand an unused one to the general it suits best
  for (const id of TRAIT_IDS) {
    if (count[id] || TRAITS[id].uniq) continue;
    const cands = list.filter((g) => !g.famous && count[g.traits[1]] > 2 && traitWeight(g, id) > 0.4).sort((a, b) => traitWeight(b, id) - traitWeight(a, id) || (a.id < b.id ? -1 : 1));
    for (const g of cands) {
      const nk = key(g.traits[0], id);
      if (g.traits[0] === id || used.has(nk)) continue;
      used.delete(key(...g.traits)); count[g.traits[1]]--;
      g.traits = [g.traits[0], id]; g.skills = g.traits; used.add(nk); count[id] = 1;
      break;
    }
  }
}
