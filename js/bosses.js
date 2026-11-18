// What the advisers say before each leader's fight. Leaders are strong by the general rules only: they are
// generals like ours, at a higher level, with their two traits, the gear and treasures they wear, a sensible
// formation, a strategist with a strategy pool, the commander's edge (any army's leader: +15% attack and
// defence) and a sharp eye for formations if they have the wits. There are no boss-only powers; the hints
// below point at the general counters: formation, the unit triangle, traits, statuses and healing.
//
// id: [speakers (the first one in the army speaks), zh, en]
export const ADVICE = {
  yanbaihu: [['zhuzhi', 'erin', 'sunquan'], '嚴白虎是步兵，勇猛又貪財，帶著步卒擺魚鱗陣。騎兵克步兵；長蛇陣被魚鱗陣克，別用。先偵察看他的裝備。', 'Yan Baihu leads foot soldiers, fierce and greedy, in a Fish Scale. Horse beats foot; don\'t use the Long Snake, the Scales cut it apart. Scout first to see his gear.'],
  zulang: [['erin', 'jeff'], '祖郎力大無窮，山地洞窟裡更強（山戰）。他頭腦簡單：混亂、迷魂很容易得手。用騎兵打他的步兵。', 'Zu Lang is enormously strong, and stronger still in caves and hills (Mountaineer). He is no thinker: confusion and sleep land easily. Hit his foot with our horse.'],
  liuxun: [['zhouyu', 'lusu'], '劉勳擺長蛇陣，魚鱗陣克它。他的軍師會替他療傷，先封住軍師的策略，或者先打倒他。', 'Liu Xun fights in the Long Snake; Fish Scale beats it. His strategist heals him: seal the strategist\'s ploys or bring him down first.'],
  tianzhu: [['zhouyu', 'lusu'], '天柱山的祭司會施計，先封住他們的軍師。', 'The priests of Tianzhu cast ploys: seal their strategist first.'],
  qua: [['zhouyu', 'lusu'], '曲阿的守軍不多，但守將不弱。偵察看清他們的兵種，用相剋的兵打。', 'The Qu\'a garrison is small but its captain is no fool. Scout their troops and send the kind that beats them.'],
  moling: [['zhouyu', 'lusu'], '秣陵關的守將整齊。偵察看清陣形，再用克制的陣形。', 'The Moling garrison is well drilled. Scout their formation, then answer it.'],
  sunhao: [['zhouyu', 'lusu'], '孫暠擺鋒矢陣直衝，我們用鶴翼包圍。焰無是火的使者（火神）：用水計對付他，讓會反計的人頂在前面。', 'Sun Hao drives in with the Arrowhead; we wrap him in the Crane Wing. Yan Wu is a fire envoy (Fire Lord): answer with water, and put a Counterploy general in front.'],
  xisai: [['ganning', 'jiangqin', 'zhouyu'], '陳就是水軍，水戰中水軍佔優：帶水軍，擺水軍陣。他愛放火（火神），下雨就沒那麼可怕。', 'Chen Jiu is a navy man, and on the water the navy rules: bring sailors and the Naval Line. He loves fire (Fire Lord); rain takes the sting out of it.'],
  huangzu: [['ganning', 'zhouyu'], '黃祖是神射手，又是水師。他守方圓陣，鋒矢陣克制。讓會盾牆、護衛的武將站前面。', 'Huang Zu is a sharpshooter and an admiral. He holds the Square: the Arrowhead beats it. Put Shield Wall and Guardian generals in front.'],
  changsha: [['huangzhong', 'zhouyu'], '長沙守軍整齊，先偵察他們的陣形，再用克制的陣形。', 'The Changsha garrison is well drilled: scout their formation first, then answer it.'],
  caimao: [['zhouyu', 'lusu', 'huangzhong'], '蔡瑁擺魚鱗陣，雁行陣的箭雨克制它。潮音是水的術士（水攻）：封住她的策略，讓會反計的人頂住。', 'Cai Mao uses the Fish Scale; the arrows of Wild Geese beat it. Chao Yin is a water sorceress (Water Master): seal her ploys and put a Counterploy general in front.'],
  jiuyi: [['erin', 'jeff'], '九嶷山的祭司都是黑蓮教徒，會下毒、施妖術。帶不受狀態的武將，清心丹備好。', 'The priests of Jiuyi are Black Lotus men: poison and sorcery. Bring generals who shrug off statuses, and Clear-Mind Pills.'],
  fleet1: [['zhouyu', 'ganning'], '樂進的船隊打先鋒。水戰帶水軍，擺水軍陣。', 'Yue Jin\'s ships lead the way. On the water bring sailors and the Naval Line.'],
  fleet2: [['jeff', 'zhouyu', 'erin'], '于禁擺水軍陣，他是陣法家，陣形加成更大。潮音會用水攻：封住她。火攻、雷擊都好用。', 'Yu Jin holds the Naval Line, and as a Formation Master he gets more from it. Chao Yin uses water: seal her. Fire and thunder both serve.'],
  pirates: [['ganning', 'zhouyu'], '海盜在海上最強。帶水軍，擺水軍陣，偵察看他們的裝備。', 'Pirates are strongest at sea. Bring sailors, take the Naval Line, and scout their gear.'],
  yuanshu: [['zhangliao', 'zhouyu', 'lusu'], '袁術擺魚鱗陣，雁行陣克它。紀靈會替他擋刀（護主）：先打倒紀靈，或用策略越過他直接打袁術。', 'Yuan Shu uses the Fish Scale; Wild Geese beats it. Ji Ling takes blows for him (Loyal Guard): beat Ji Ling first, or reach Yuan Shu with ploys.'],
  guandu: [['guojia', 'zhangliao', 'zhouyu'], '顏良、文醜都是騎兵猛將，擺突騎陣。弓兵克騎兵，八卦陣克突騎陣。顏良專殺大將（斬將），別讓主將落單。', 'Yan Liang and Wen Chou are fierce horsemen in the Cavalry Charge. Bow beats horse; the Eight Trigrams beat the Charge. Yan Liang hunts generals (Duelist): don\'t leave our leader alone.'],
  yuanshao: [['guojia', 'zhouyu', 'lusu'], '袁紹擺長蛇陣，魚鱗陣克它；他會鼓吹士氣。霜鏡是冷靜的術士：用火，用刀兵。審配很難纏，先打倒軍師。', 'Yuan Shao uses the Long Snake; Fish Scale beats it, and he drums up morale. Shuang Jing is a cool-headed sorcerer: fire and blades. Shen Pei is stubborn: bring the strategist down first.'],
  hulao: [['caocao', 'zhouyu', 'josh'], '華雄是騎兵猛將，專挑大將下手，追殺殘兵（猛追）。他守方圓陣，鋒矢陣克制。讓會盾牆的武將站前面，兵力少的人往後排。', 'Hua Xiong is a horseman who hunts generals and runs down the wounded (Pursuer). He holds the Square: the Arrowhead beats it. Put a Shield Wall general in front and the wounded at the back.'],
  tongguan: [['jeff', 'zhouyu'], '李傕、郭汜都是西涼騎兵，擺鋒矢陣。鶴翼陣克它，弓兵克騎兵。關隘山道上落石很好用。', 'Li Jue and Guo Si are Xiliang horsemen in the Arrowhead. The Crane Wing beats it, and bow beats horse. Rockfall serves well in the pass.'],
  dongzhuo: [['diaochan', 'jeff', 'zhouyu'], '董卓穿著重甲，又有鐵壁：刀槍很難傷他，用策略、破甲。他的威壓會讓我軍士氣下降。李儒會下毒放火：先封住李儒。', 'Dong Zhuo wears heavy armour and holds an Iron Wall: blades barely hurt him, so use ploys and Armour Break. His Overawe lowers our morale. Li Ru poisons and burns: seal Li Ru first.'],
  jianye2: [['zhouyu', 'lusu'], '佔據建業的黑蓮軍。偵察看清他們的陣形與兵種，再克制。', 'The sect army holding Jianye. Scout their formation and troops, then answer them.'],
  jiyuan: [['erin', 'jeff', 'zhouyu'], '季老智力極高，會反計、妖術。別跟他比策略：用刀兵，帶看破、冷靜的武將。冥照會引雷：封住他。', 'Elder Ji is brilliant: Counterploy and Sorcery. Don\'t match ploys with him: use blades, and bring Clear Mind and Calm generals. Ming Zhao calls thunder: seal him.'],
  zhangren: [['huangzhong', 'fazheng', 'zhouyu'], '張任身法極快，刀槍常落空；他是神射手，擺雁行陣。長蛇陣克雁行陣，用策略與弓箭對付他。', 'Zhang Ren is so nimble that blades often miss; he is a sharpshooter in the Wild Geese. The Long Snake beats it; answer him with ploys and arrows.'],
  yanwu: [['zhouyu', 'erin', 'lusu'], '千萬別對焰無放火，他是火神。用水，讓天下雨。他用黑蓮邪術每回合回兵：集中火力速戰速決。', 'Never use fire on Yan Wu: he is a Fire Lord. Use water, or bring rain. His Black Lotus rite restores troops every round: focus him down fast.'],
  lotus1: [['erin', 'zhouyu', 'jeff'], '霜鏡冷靜，不受混亂與恐懼，擺長蛇陣：魚鱗陣克它。他怕火。', 'Shuang Jing is calm, beyond confusion and fear, and uses the Long Snake: the Fish Scale beats it.'],
  lotus2: [['erin', 'jeff', 'zhouyu'], '冥照是雷公，雨天更強：別讓天下雨。他擺鋒矢陣，鶴翼陣克制。封住他的策略。', 'Ming Zhao is a Thunder Caller, stronger in rain: don\'t bring rain. He uses the Arrowhead; the Crane Wing beats it. Seal his ploys.'],
  yuji1: [['zhugeliang', 'erin', 'zhouyu'], '于吉是黑蓮的大術士，雷與暗的策略、妖術。封住他，帶不受狀態的武將；他守方圓陣，鋒矢陣克制。', 'Yu Ji is the Black Lotus\'s great sorcerer: thunder, darkness and witchcraft. Seal him and bring generals who resist statuses; he holds the Square, and the Arrowhead beats it.'],
  yuji2: [['erin', 'zhugeliang', 'zhouyu'], '于吉現出真身，擺偃月陣：突騎陣克制它。清心丹與觀星留給他的妖術。', 'Yu Ji shows his true form in the Crescent: the Cavalry Charge breaks it. Keep Clear-Mind Pills and Read the Stars for his witchcraft.'],
};
