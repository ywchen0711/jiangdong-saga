// Boss mechanics. Every main boss has something to work out: a big move announced one turn ahead (蓄力, with
// a fair answer: defend, break it off with a status ploy, the right element or weather), bodyguards, mirrors,
// iron walls, healers, phases at 60% / 30% troops... and a weak point that scouting (偵察) or an adviser's
// hint before the fight gives away. The battle code (battle.js) runs these; this file only describes them.
//
// who: index of the foe in the boss table (story.js BOSSES) that owns the move
// kind: single (one marked general), aoe (everyone, by strength), tac (everyone, by a tactic element),
//   reflect (mirror stance, instant), fog (instant), fireships, heal (heals his side), decree (buffs his side),
//   divide (confuses our two strongest), freeze (traps our two strongest), wall (rebuilds an iron wall),
//   shadows (summons adds that blow up), illusion (copies of our generals), curse (instant, all of us)
// every / first: the round it is first started and how often it comes back
// cancel: what breaks off the charge: stun sleep confuse silence, el:<element> (hit by it), rain / wind (weather)
// adv: [speaker, zh, en] — said before the fight (the first speaker in the army is used)
export const KITS = {
  yanbaihu: {
    guards: [1, 2], weak: { el: 'fire' },
    moves: [{ who: 0, kind: 'single', every: 3, first: 2, mul: 2.8, name: ['猛虎撲', 'Tiger Pounce'], cancel: ['stun', 'sleep', 'confuse'] }],
    phases: [{ at: 0.5, who: 0, act: 'berserk' }],
    info: ['親兵會替嚴白虎擋下攻擊：先打倒親兵，或挑撥、混亂他們；策略可直接打到他。木寨怕火。猛虎撲：被盯上的人防禦。', 'His bodyguards take blows meant for him: beat them first or provoke or confuse them; tactics reach him directly. The wooden fort fears fire. Tiger Pounce: the marked general should defend.'],
    adv: [['zhuzhi', 'erin', 'sunquan'], '嚴白虎總躲在親兵後面。先解決親兵，或用挑撥把他們引開。他撲過來之前會先蓄力，被盯上的人記得防禦！', 'Yan Baihu always hides behind his bodyguards. Deal with them first or provoke them away. He winds up before he pounces: whoever he marks, defend!'],
  },
  zulang: {
    weak: { st: 'confuse' },
    moves: [{ who: 0, kind: 'aoe', every: 3, first: 2, mul: 1.25, name: ['蠻牛衝撞', 'Bull Rush'], cancel: ['stun', 'sleep', 'confuse'] }],
    phases: [{ at: 0.5, who: 0, act: 'berserk' }],
    info: ['祖郎頭腦簡單，混亂與迷魂很容易得手，還能打斷他的蠻牛衝撞。來不及就全軍防禦。', 'Zu Lang is simple-minded: confusion and sleep land easily and break off his Bull Rush. Otherwise, everyone defend.'],
    adv: [['erin', 'jeff'], '祖郎力大無窮，可是腦袋不太靈光。他一開始蓄力，就讓他陷入混亂！', 'Zu Lang is enormously strong but not very bright. When he starts to wind up, confuse him!'],
  },
  liuxun: {
    weak: { el: 'fire' },
    moves: [
      { who: 0, kind: 'heal', every: 4, first: 2, heal: 0.35, name: ['開倉放糧', 'Open the Granary'], cancel: ['stun', 'sleep', 'confuse', 'silence', 'el:fire'] },
      { who: 0, kind: 'aoe', every: 4, first: 4, mul: 1.1, name: ['亂箭齊發', 'Volley'], cancel: ['stun', 'sleep', 'confuse'] },
    ],
    phases: [{ at: 0.6, who: 0, act: 'reinforce', foes: [{ id: 'g305', lv: 11 }], say: ['劉勳：來人！增援！', 'Liu Xun: Guards! Reinforcements!'] }],
    info: ['劉勳開倉放糧會讓全軍恢復：在他準備時放火燒倉（任何火計），或用混亂、封策打斷。', 'Opening the granary heals his whole army: burn it while he prepares (any fire ploy), or break it off with confusion or Seal Ploys.'],
    adv: [['zhouyu', 'lusu'], '劉勳最寶貝他的糧倉。他要開倉的時候，一把火燒過去就是了。他擺長蛇陣；若在山越的洞窟拿到魚鱗陣，就能切斷它。', 'Liu Xun treasures his granary. When he goes to open it, set it on fire. He fights in the Long Snake; if you found the Fish Scale manual in the Shanyue caves, it cuts the snake apart.'],
  },
  sunhao: {
    weak: { el: 'water', who: 1 }, immuneEl: { 1: 'fire' },
    moves: [
      { who: 0, kind: 'reflect', every: 4, first: 1, turns: 2, name: ['反計', 'Counterploy'] },
      { who: 1, kind: 'tac', el: 'fire', pow: 0.85, every: 3, first: 2, name: ['赤蓮火', 'Red Lotus Fire'], cancel: ['stun', 'sleep', 'confuse', 'silence', 'el:water', 'rain'] },
    ],
    phases: [{ at: 0.4, who: 0, act: 'berserk' }],
    info: ['孫暠擺出反計之陣時（鏡子圖示），對他施計會反彈到施計者身上，改用攻擊。焰無不怕火，怕水；他聚火時用水計、天變或封策打斷。', 'While Sun Hao holds his Counterploy stance (mirror icon), ploys at him bounce back: attack instead. Yan Wu shrugs off fire but fears water; break off his fire with water, rain or Seal Ploys.'],
    adv: [['zhouyu', 'lusu'], '孫暠學過一點反計。他擺出那個架勢時，別對他用策略，拿刀砍。焰無是火的使者，用水對付他。敵人擺鋒矢陣，我們以鶴翼包圍。', 'Sun Hao knows a little counterploy. When he takes that stance, no ploys at him: use blades. Yan Wu is a fire envoy; answer him with water. They will use Arrowhead; we wrap it with Crane Wing.'],
  },
  xisai: {
    weak: { el: 'water' },
    moves: [{ who: 0, kind: 'fireships', el: 'fire', pow: 1.5, every: 3, first: 1, name: ['火船', 'Fire Ships'], cancel: ['el:water', 'stun', 'sleep'] }],
    phases: [{ at: 0.5, who: 0, act: 'reinforce', foes: [{ id: 'g075', lv: 20 }, { id: 'g076', lv: 20 }], say: ['陳就：後隊的船，上來！', 'Chen Jiu: Rear ships, forward!'] }],
    info: ['陳就準備火船時，用水計打他可以鑿沉火船；下雨火船威力大減；颳起東風，火船會被吹回敵陣。水戰中水軍克制其他兵種。', 'While Chen Jiu readies his fire ships, a water ploy on him sinks them; rain weakens them; a wind blows them back onto his own fleet. On the water navy beats every other kind of troops.'],
    adv: [['ganning', 'jiangqin', 'zhouyu'], '陳就最愛放火船。看見他點火，就用水計鑿沉，或者乾脆讓老天下雨。上船打仗，帶水軍去。', 'Chen Jiu loves fire ships. When he lights them, sink them with a water ploy, or just make it rain. On the water, bring the navy.'],
  },
  huangzu: {
    weak: { unit: 'cav' },
    moves: [
      { who: 0, kind: 'single', snipe: true, every: 3, first: 1, mul: 3.2, name: ['冷箭', 'Sniper Shot'], cancel: ['stun', 'sleep', 'confuse'] },
      { who: 0, kind: 'aoe', every: 3, first: 2, mul: 1.0, name: ['箭雨', 'Arrow Rain'], cancel: ['stun', 'sleep', 'confuse'] },
    ],
    phases: [{ at: 0.5, who: 0, act: 'reinforce', foes: [{ id: 'g308', lv: 21 }], say: ['黃祖：弓手上城！', 'Huang Zu: Archers to the walls!'] }],
    info: ['黃祖會瞄準一人放冷箭（準星圖示），冷箭不分前後排：讓被瞄準的人防禦，或讓會盾牆、護衛的武將防禦替他擋。黃祖擺方圓陣，鋒矢陣克制。', 'Huang Zu marks one general for a sniper shot (crosshair icon) that reaches the back rows: the marked general defends, or a Shield Wall / Guardian general defends and takes it. He holds a Square: Arrowhead beats it.'],
    adv: [['ganning', 'zhouyu'], '黃祖射死了老主公……他放冷箭前會先瞄準。被瞄準的人防禦，喬許也可以替他擋。他守方圓陣，我們用鋒矢陣直刺！', 'Huang Zu shot the old lord... he takes aim before he looses. Whoever he aims at, defend; Josh can take it for them. He holds a Square; we drive through with Arrowhead!'],
  },
  caimao: {
    weak: { el: 'thunder', who: 1 },
    moves: [
      { who: 1, kind: 'tac', el: 'water', pow: 0.95, every: 3, first: 1, name: ['引江水', 'Call the River'], cancel: ['stun', 'sleep', 'confuse', 'silence'] },
      { who: 0, kind: 'decree', every: 4, first: 3, instant: true, name: ['水軍督戰', 'Drive the Fleet'] },
    ],
    phases: [{ at: 0.5, who: 0, act: 'form' }],
    info: ['潮音引江水會淹沒全軍：用封策、混亂或迷魂打斷她。她怕雷擊。蔡瑁擺魚鱗陣，雁行陣克制；半數兵力時他會變陣。', 'Chao Yin\'s river floods our whole army: break it off with Seal Ploys, confusion or sleep. She fears thunder. Cai Mao uses Fish Scale (Wild Geese beats it) and changes formation at half strength.'],
    adv: [['zhouyu', 'lusu', 'huangzhong'], '潮音一念咒，江水就會倒灌。封住她的策略！她怕雷。蔡瑁的魚鱗陣，用雁行陣的箭雨對付。', 'When Chao Yin chants, the river pours in. Seal her ploys! She fears thunder. Against Cai Mao\'s Fish Scale, use the arrows of Wild Geese.'],
  },
  fleet2: {
    weak: { el: 'fire' }, chained: true,
    moves: [
      { who: 1, kind: 'fog', every: 5, first: 1, instant: true, name: ['江霧', 'River Fog'] },
      { who: 0, kind: 'aoe', every: 3, first: 3, mul: 1.15, name: ['樓船衝撞', 'Ram'], cancel: ['stun', 'sleep', 'confuse'] },
    ],
    info: ['北方艦隊以鐵鍊相連：刀兵難傷（七成五），火攻大增。潮音的江霧讓我軍攻擊常常落空，觀星或呼風可驅散。', 'The northern fleet is chained together: blades do less (75%), fire does much more. Chao Yin\'s fog makes our blows miss; Read the Stars or Call the Wind clears it.'],
    adv: [['jeff', 'zhouyu', 'erin'], '他們把船用鐵鍊連在一起……那就用火。霧起來的時候，交給艾琳。', 'They\'ve chained their ships together... so, fire. When the fog rises, leave it to Erin.'],
  },
  yuanshu: {
    guards: [1], fragile: 1,
    moves: [
      { who: 0, kind: 'decree', every: 3, first: 2, name: ['偽詔', 'False Decree'], cancel: ['stun', 'sleep', 'confuse', 'silence'] },
      { who: 1, kind: 'single', every: 3, first: 1, mul: 3.2, name: ['三尖刀', 'Trident Strike'], cancel: ['stun', 'sleep', 'confuse'] },
      { who: 0, kind: 'tac', el: 'dark', pow: 1.2, every: 3, first: 3, name: ['天子之怒', 'Wrath of the False Emperor'], cancel: ['stun', 'sleep', 'confuse', 'silence'] },
    ],
    phases: [
      { at: 0.75, who: 0, act: 'reinforce', foes: [{ id: 'g138', lv: 37 }, { id: 'g139', lv: 37 }], say: ['袁術：重賞之下必有勇夫！給朕上！', 'Yuan Shu: Gold for every head! Forward, for Us!'] },
      { at: 0.4, who: 0, act: 'reinforce', foes: [{ id: 'g140', lv: 37 }, { id: 'g141', lv: 37 }], say: ['袁術：再加賞金！', 'Yuan Shu: Double the reward!'] },
    ],
    info: ['紀靈會替袁術擋下攻擊；紀靈一倒，袁軍士氣大跌。袁術的偽詔與天子之怒都能用混亂、封策打斷；他會花錢不斷增援。', 'Ji Ling takes blows meant for Yuan Shu; when Ji Ling falls, Yuan morale collapses. The False Decree and the Wrath can both be broken off with confusion or Seal Ploys; he keeps buying reinforcements.'],
    adv: [['zhangliao', 'zhouyu', 'lusu'], '袁術的兵只是為錢打仗。紀靈一倒，軍心就散了。他要頒什麼詔書，就讓他說不出話。', 'Yuan Shu\'s men fight for pay. Once Ji Ling falls, they lose heart. Whatever decree he tries to read, seal his mouth.'],
  },
  guandu: {
    weak: { unit: 'arc' }, avenge: true,
    moves: [
      { who: 0, kind: 'single', every: 3, first: 1, mul: 2.8, name: ['斬將', 'Beheading Blow'], cancel: ['stun', 'sleep', 'confuse'] },
      { who: 1, kind: 'aoe', every: 3, first: 3, mul: 1.15, name: ['鐵騎衝鋒', 'Iron Cavalry'], cancel: ['stun', 'sleep', 'confuse'] },
    ],
    info: ['顏良斬將前會盯住一人；文醜會率騎兵衝鋒。弓兵克騎兵；八卦陣克突騎陣。一人倒下，另一人會暴怒。', 'Yan Liang marks one general before his Beheading Blow; Wen Chou leads a cavalry charge. Bows beat horse; Eight Trigrams beats Cavalry Charge. When one falls, the other goes berserk.'],
    adv: [['guojia', 'zhangliao', 'zhouyu'], '顏良的大刀必先蓄勢，文醜的騎兵衝鋒最猛。弓兵、八卦陣能擋騎兵。記住：兩人一起削弱，別只打一個。', 'Yan Liang always gathers himself before the blow, and Wen Chou\'s charge is fierce. Bows and the Eight Trigrams stop horse. Wear them down together, not one at a time.'],
  },
  yuanshao: {
    weak: { el: 'fire', who: 1 }, healer: { who: 1, of: [0, 1], heal: 0.22, cd: 3 },
    moves: [{ who: 1, kind: 'freeze', every: 4, first: 2, name: ['霜封', 'Frost Seal'], cancel: ['stun', 'sleep', 'confuse', 'silence'] }],
    phases: [{ at: 0.5, who: 0, act: 'reinforce', foes: [{ id: 'g136', lv: 41 }, { id: 'g137', lv: 41 }], say: ['袁紹：四世三公的兵馬，給我上！', 'Yuan Shao: Soldiers of four generations of Excellencies, forward!'] }, { at: 0.5, who: 0, act: 'form' }],
    info: ['霜鏡會替袁紹療傷：先用封策封住她，或集中先打倒她。霜鏡怕火。袁紹半數兵力時會增援並變陣。', 'Shuang Jing heals Yuan Shao: seal her ploys first, or bring her down first. She fears fire. At half strength Yuan Shao calls reinforcements and changes formation.'],
    adv: [['guojia', 'zhouyu', 'lusu'], '那個白衣人會替袁紹療傷。先封住他的策略，否則永遠打不完。他怕火。', 'That man in white heals Yuan Shao. Seal his ploys first or this never ends. He fears fire.'],
  },
  hulao: {
    moves: [
      { who: 0, kind: 'single', every: 3, first: 1, mul: 3.6, name: ['斬', 'Cleave'], cancel: ['stun', 'sleep', 'confuse'] },
      { who: 0, kind: 'aoe', every: 3, first: 2, mul: 1.1, name: ['關上箭雨', 'Arrows from the Gate'], cancel: ['stun', 'sleep', 'confuse'] },
    ],
    phases: [{ at: 0.3, who: 0, act: 'berserk' }],
    info: ['華雄舉刀時會盯住一人：讓那人防禦，或讓會盾牆的武將防禦替他擋下；挑撥能把刀引到坦克身上。華雄擺方圓陣，鋒矢陣克制。', 'When Hua Xiong raises his blade he marks one general: that general defends, or a Shield Wall general defends and takes it; Provoke draws the blade onto a tank. He holds a Square: Arrowhead beats it.'],
    adv: [['caocao', 'zhouyu', 'josh'], '華雄的刀，一刀就能斬下一員大將。他舉刀時，被盯上的人一定要防禦。', 'Hua Xiong\'s blade can take a general\'s head in one stroke. When he raises it, the one he marks must defend.'],
  },
  tongguan: {
    weak: { el: 'rock' }, pincer: [0, 1],
    moves: [{ who: 0, kind: 'aoe', every: 3, first: 1, mul: 1.15, name: ['西涼鐵騎', 'Xiliang Riders'], cancel: ['stun', 'sleep', 'confuse'] }],
    phases: [{ at: 0.5, who: 1, act: 'reinforce', foes: [{ id: 'g154', lv: 44 }], say: ['郭汜：西涼兵，來！', 'Guo Si: Xiliang men, to me!'] }],
    info: ['李傕、郭汜同在時互相夾擊，攻擊大增：先集中打倒一人。關隘山道，落石、山崩威力大增。', 'While Li Jue and Guo Si both stand they pincer us and hit much harder: bring one down first. In the mountain pass, Rockfall and Landslide are far stronger.'],
    adv: [['jeff', 'zhouyu'], '潼關兩邊都是山。推石頭下去，比什麼都管用。還有，先打倒其中一個，他們就沒法夾擊了。', 'Tong Gate has mountains on both sides. Rolling rocks down beats anything. And bring one of them down first so they cannot pincer us.'],
  },
  dongzhuo: {
    weak: { el: 'rock' }, wall: 0,
    moves: [
      { who: 0, kind: 'wall', every: 99, first: 99, name: ['重整鐵壁', 'Rebuild the Wall'], cancel: ['stun', 'sleep'] },
      { who: 0, kind: 'aoe', every: 3, first: 2, mul: 1.2, name: ['暴虐', 'Tyrant\'s Rampage'], cancel: ['stun', 'sleep'] },
    ],
    phases: [{ at: 0.3, who: 0, act: 'pill', say: ['董卓吞下了一顆黑蓮丹！', 'Dong Zhuo swallows a black lotus pill!'] }],
    info: ['董卓的鐵壁使他受到的傷害只剩兩成五：落石、山崩、破甲，或以鋒矢陣衝鋒才能擊破，三回合後他會重整鐵壁（可用迷魂、困陣打斷）。李儒會放毒，可以封策。', 'Dong Zhuo\'s Iron Wall cuts damage to a quarter: Rockfall, Landslide, Armour Break or a blow struck in Arrowhead breaks it; three turns later he rebuilds it (sleep or a trap stops him). Li Ru spreads poison: seal his ploys.'],
    adv: [['diaochan', 'jeff', 'zhouyu'], '董卓穿著獸面吞頭鎧，刀槍不入……除非用巨石砸，或用鋒矢陣直衝。鐵壁一破，就全力進攻！', 'Dong Zhuo wears the Beast-Face Armour; blades cannot pierce it... unless you drop boulders on him or drive through in Arrowhead. Once the wall breaks, attack with everything!'],
  },
  jiyuan: {
    weak: { phys: true }, resistAll: { 0: 0.6 },
    moves: [
      { who: 0, kind: 'divide', every: 3, first: 2, name: ['離間', 'Sow Discord'], cancel: ['stun', 'sleep', 'confuse', 'silence'] },
      { who: 1, kind: 'tac', el: 'thunder', pow: 1.1, every: 3, first: 1, name: ['紫雷', 'Purple Thunder'], cancel: ['stun', 'sleep', 'confuse', 'silence'] },
    ],
    info: ['季淵離間時會讓我軍最強的兩人陷入混亂：用封策、迷魂打斷他，或事後用清心丹、觀星解除。季淵智力極高，計策傷害減少，用刀兵。', 'Ji Yuan\'s Sow Discord confuses our two strongest: break it off with Seal Ploys or sleep, or cure it with a Clear-Mind Pill or Read the Stars. His mind is sharp, so ploys do less: use blades.'],
    adv: [['erin', 'jeff', 'zhouyu'], '季老最懂人心。他若開始念那些我們熟悉的話，打斷他。萬一有人被迷惑，清心丹或觀星能讓他醒過來。', 'Elder Ji knows hearts better than anyone. If he starts to murmur those familiar words, break him off. If someone falls under his spell, a Clear-Mind Pill or Read the Stars wakes them.'],
  },
  zhangren: {
    weak: { unit: 'arc', el: 'rock' }, evade: 0.55,
    moves: [
      { who: 0, kind: 'ambush', every: 3, first: 1, instant: true, name: ['落鳳伏兵', 'Fallen Phoenix Ambush'] },
      { who: 0, kind: 'single', snipe: true, every: 4, first: 3, mul: 2.4, name: ['連珠箭', 'Arrow Volley'], cancel: ['stun', 'sleep', 'confuse'] },
    ],
    info: ['張任身法極快，近戰攻擊大多落空，弓箭卻躲不掉。他會在山上埋伏，偵察可以識破伏兵。山道上落石威力大增。', 'Zhang Ren is so quick that most melee blows miss, but arrows find him. He lays ambushes on the slopes; Scout reveals them. On the mountain path Rockfall is far stronger.'],
    adv: [['huangzhong', 'fazheng', 'zhouyu'], '張任快得像風，刀槍碰不到他。用弓！他愛在山上埋伏，先偵察。', 'Zhang Ren is quick as the wind; blades cannot touch him. Use bows! He loves to lay ambushes on the slopes, so scout first.'],
  },
  yanwu: {
    weak: { el: 'water' }, immuneEl: { 0: 'fire' },
    moves: [
      { who: 0, kind: 'tac', el: 'fire', pow: 1.4, every: 3, first: 1, name: ['業火', 'Hellfire'], cancel: ['rain', 'el:water', 'stun', 'sleep', 'silence'] },
      { who: 0, kind: 'single', every: 3, first: 2, mul: 3.0, name: ['焚身', 'Burning Grasp'], cancel: ['stun', 'sleep'] },
    ],
    phases: [{ at: 0.5, who: 0, act: 'reinforce', foes: [{ id: 'g319', lv: 54 }, { id: 'g320', lv: 54 }], say: ['焰無：赤蓮之兵，燃起來！', 'Yan Wu: Soldiers of the Red Lotus, burn!'] }, { at: 0.25, who: 0, act: 'berserk' }],
    info: ['焰無吸收火焰（火計反而替他療傷），怕水。業火能被天變的大雨、水計或封策打斷。', 'Yan Wu drinks fire (fire ploys heal him) and fears water. Hellfire is broken off by rain, a water ploy or Seal Ploys.'],
    adv: [['zhouyu', 'erin', 'lusu'], '千萬別對焰無放火，那只會讓他更強。用水，或者讓天下雨。', 'Never use fire on Yan Wu; it only makes him stronger. Use water, or bring rain.'],
  },
  lotus1: {
    weak: { el: 'fire' }, stance: true,
    moves: [
      { who: 0, kind: 'freeze', every: 4, first: 3, name: ['霜封', 'Frost Seal'], cancel: ['stun', 'sleep', 'confuse', 'silence'] },
      { who: 0, kind: 'single', every: 3, first: 2, mul: 3.0, name: ['寒槍', 'Frost Spear'], cancel: ['stun', 'sleep', 'confuse'] },
    ],
    info: ['霜鏡輪流擺出兩種架勢：「鏡」時策略會反彈，請用攻擊；「冰」時刀兵只剩三成，請用策略（他怕火）。', 'Shuang Jing alternates two stances: in Mirror, ploys bounce back, so attack; in Ice, blades do only 30%, so use ploys (he fears fire).'],
    adv: [['erin', 'zhouyu', 'jeff'], '霜鏡會換架勢。鏡子的時候拿刀，冰甲的時候用火。看清楚他頭上的圖示！', 'Shuang Jing changes stance. Blades against the mirror, fire against the ice. Watch the icon over him!'],
  },
  lotus2: {
    moves: [
      { who: 0, kind: 'shadows', every: 3, first: 1, instant: true, name: ['影兵', 'Shadow Soldiers'] },
      { who: 0, kind: 'tac', el: 'thunder', pow: 0.9, every: 4, first: 3, name: ['冥雷', 'Dark Thunder'], cancel: ['stun', 'sleep', 'confuse', 'silence'] },
    ],
    phases: [{ at: 0.5, who: 0, act: 'form' }],
    info: ['冥照召喚的影兵會在下一回合自爆：用全體策略或集中攻擊在爆炸前清掉。冥雷可以封策打斷。', 'Ming Zhao\'s Shadow Soldiers blow up on their next turn: clear them first with tactics on all foes or focused blows. Seal Ploys breaks off his Dark Thunder.'],
    adv: [['erin', 'jeff', 'zhouyu'], '冥照的影子會爆炸。一出現就用大範圍的策略燒掉它們！', 'Ming Zhao\'s shadows explode. Burn them away with a wide ploy the moment they appear!'],
  },
  yuji1: {
    immune: ['confuse'],
    moves: [
      { who: 0, kind: 'illusion', every: 4, first: 1, instant: true, name: ['幻術', 'Illusions'] },
      { who: 0, kind: 'tac', el: 'thunder', pow: 0.85, every: 3, first: 1, name: ['天雷', 'Heaven\'s Thunder'], cancel: ['stun', 'sleep', 'silence'] },
    ],
    info: ['于吉會變出我軍武將的幻影；幻影受策略傷害加倍。幻影還在時，于吉有幻術護身（傷害減半）。天雷可以封策、迷魂打斷。', 'Yu Ji conjures copies of our generals; copies take double damage from ploys. While copies remain, he is veiled (half damage). Seal Ploys or sleep breaks off his thunder.'],
    adv: [['zhugeliang', 'erin', 'zhouyu'], '于吉擅長幻術。看到另一個自己，別猶豫，用策略打散它。', 'Yu Ji is a master of illusion. If you see a second you, don\'t hesitate: break it with a ploy.'],
  },
  yuji2: {
    immune: ['confuse', 'sleep', 'stun'], weak: { st: 'silence' },
    moves: [
      { who: 0, kind: 'curse', every: 4, first: 1, instant: true, name: ['黑蓮咒', 'Black Lotus Curse'] },
      { who: 0, kind: 'tac', el: 'dark', pow: 1.4, every: 3, first: 1, name: ['黑蓮綻放', 'Black Lotus Bloom'], cancel: ['silence'] },
    ],
    phases: [
      { at: 0.6, who: 0, act: 'petals', say: ['于吉：黑蓮，護我！', 'Yu Ji: Black lotus, guard me!'] },
      { at: 0.3, who: 0, act: 'frenzy', say: ['于吉的力量失控了！他一回合行動兩次！', 'Yu Ji\'s power runs wild! He acts twice a round!'] },
    ],
    info: ['詛咒讓我軍無法恢復並每回合損兵：艾琳的觀星或清心丹能解除。黑蓮綻放只能以封策打斷，否則全軍防禦。黑蓮花瓣每回合為于吉療傷，先摘掉。', 'The curse stops healing and bleeds troops every turn: Erin\'s Read the Stars or a Clear-Mind Pill lifts it. Black Lotus Bloom can only be broken off with Seal Ploys; otherwise everyone defends. Lotus petals heal Yu Ji every turn: pluck them first.'],
    adv: [['erin', 'zhugeliang', 'zhouyu'], '他的詛咒交給我。黑蓮綻放的時候，封住他，封不住就全軍防禦！', 'Leave his curse to me. When the black lotus blooms, seal him; if you can\'t, everyone defend!'],
  },
  // the smaller set pieces: one announced move each
  moling: { moves: [{ who: 0, kind: 'aoe', every: 3, first: 2, mul: 1.0, name: ['萬箭齊發', 'Arrow Storm'], cancel: ['stun', 'sleep', 'confuse'] }], info: ['守將會下令萬箭齊發：防禦，或用混亂打斷。', 'The commander orders an arrow storm: defend, or break it off with confusion.'] },
  qua: { moves: [{ who: 0, kind: 'single', every: 3, first: 2, mul: 2.0, name: ['重擊', 'Heavy Blow'], cancel: ['stun', 'sleep', 'confuse'] }], info: ['重擊前會盯住一人：防禦。', 'He marks one general before a heavy blow: defend.'] },
  changsha: { moves: [{ who: 0, kind: 'aoe', every: 3, first: 2, mul: 1.0, name: ['強攻', 'Assault'], cancel: ['stun', 'sleep', 'confuse'] }], info: ['強攻前會蓄力：防禦，或打斷。', 'He gathers before an assault: defend or break it off.'] },
  fleet1: { weak: { el: 'fire' }, moves: [{ who: 0, kind: 'aoe', every: 3, first: 2, mul: 1.0, name: ['衝撞', 'Ram'], cancel: ['stun', 'sleep', 'confuse'] }], info: ['樂進的船會衝撞：防禦，或打斷。怕火。', 'Yue Jin\'s ships ram: defend or break it off. Weak to fire.'] },
  jianye2: { guards: [1], moves: [{ who: 0, kind: 'tac', el: 'dark', pow: 0.8, every: 3, first: 2, name: ['黑蓮咒', 'Black Lotus Curse'], cancel: ['stun', 'sleep', 'confuse', 'silence'] }], info: ['護衛會替首領擋刀；首領的咒術可以封策打斷。', 'A guard covers the leader; Seal Ploys breaks off the leader\'s curse.'] },
  tianzhu: { moves: [{ who: 0, kind: 'tac', el: 'dark', pow: 0.8, every: 3, first: 2, name: ['邪咒', 'Dark Chant'], cancel: ['stun', 'sleep', 'confuse', 'silence'] }], info: ['祭司的邪咒可以封策、混亂打斷。', 'The priest\'s chant is broken off by Seal Ploys or confusion.'] },
  jiuyi: { moves: [{ who: 0, kind: 'tac', el: 'dark', pow: 0.85, every: 3, first: 2, name: ['邪咒', 'Dark Chant'], cancel: ['stun', 'sleep', 'confuse', 'silence'] }], phases: [{ at: 0.5, who: 0, act: 'berserk' }], info: ['祭司的邪咒可以封策、混亂打斷。', 'The priest\'s chant is broken off by Seal Ploys or confusion.'] },
  pirates: { weak: { el: 'fire' }, moves: [{ who: 0, kind: 'fireships', el: 'fire', pow: 0.85, every: 3, first: 2, name: ['火船', 'Fire Ships'], cancel: ['el:water', 'stun', 'sleep'] }], info: ['海盜放火船：水計鑿沉、下雨減弱、東風吹回。', 'Pirate fire ships: sink them with water, weaken them with rain, blow them back with wind.'] },
};
export const kitFor = (id) => KITS[id] || null;
