// 試煉 (Trials): ten optional, very hard side quests spread over the chapters and the map. Each is given by
// someone with a story, kept in the quest log (menu: 任務), and fought against a fixed army: the enemy never
// grows with you, so each trial shows a recommended level well above the main story's. Each has a fair answer
// that scouting (偵察) or the info card reveals. The rewards are things found nowhere else: legendary
// treasures, famous generals who join when beaten, the Three Talents formation and the Thunderclap of Heaven.
//
// steps: a trial has one or more steps (a chain quest has several, in different towns). S.sq[id] holds
// 0 (not taken), 1..n (on step n) or 99 (done). Each step names the map where its challenge waits, the person
// who stands there, and the battles fought one after another (a gauntlet: no rest between them).
// Foes: a general's id, or '#faction:n' for the n-th ordinary officer of that side.
import { say, ask, menu, panel, descBox, wrap } from './ui.js?v=10';
import { ctx, W, H, text, textW, windowBox } from './gfx.js?v=10';
import { sfx } from './audio.js?v=10';
import { L } from './i18n.js?v=10';
import { GENERALS, GEN_LIST, gearFor, genName } from './generals.js?v=10';
import { ITEMS, FORMS, RARITY, QUESTS, TREASURES, SRC } from './data.js?v=10';
import { S, recruit, give, have, healAll } from './state.js?v=10';
import { PLACES, REGIONS } from './world.js?v=10';
import { F } from './field.js?v=10';
import { placeName, folkLook } from './maps.js?v=10';
import { gainTreasure, owned } from './treasure_world.js?v=10';

const DONE = 99;
// who gives each trial, where, the story, the steps and the reward
export const SQ = {
  tiger: {
    ch: 3, rec: 26, name: ['白虎寨的鐵面虎', 'The Iron-Mask Tiger'],
    giver: { place: 'qiantang', who: ['錢唐的老里正', 'Old Headman of Qiantang'], kind: 'elder' },
    ask: ['嚴白虎死後，他的結義兄弟「鐵面虎」在烏程寨後山另立白虎寨，比嚴白虎更狠。官軍去了三次，一個也沒回來……', 'After Yan Baihu fell, his sworn brother the Iron-Mask Tiger raised a new White Tiger stockade behind Wucheng Fort, crueller than Yan Baihu ever was. The garrison went three times; nobody came back...'],
    goal: ['到烏程寨，攻下後山的白虎寨。', 'Go to Wucheng Fort and storm the White Tiger stockade behind it.'],
    thanks: ['白虎寨倒了！這口刀是寨主的，老朽留著也沒用，將軍收下吧。', 'The stockade has fallen! This blade was the chief\'s; an old man has no use for it. Take it, general.'],
    reward: { tr: ['baihudao'], gold: 4000 },
    steps: [{
      at: 'wucheng', npc: { who: ['白虎寨的嘍囉', 'White Tiger Lookout'], kind: 'folk' },
      before: ['想上白虎寨？寨主的親兵會用身體替他擋刀，寨牆上的弓手箭如雨下……你們是來送死的吧？', 'Up to the stockade? The chief\'s guards take every blow meant for him and the archers on the palisade loose like rain... you\'ve come to die, then?'],
      fights: [{ foes: [{ id: '#shanyue:7:yongmeng', lv: 38, boss: true, tr: 4 }, { id: '#shanyue:0:huzhu', lv: 36, tr: 3 }, { id: '#shanyue:0:unit=arc', lv: 36, tr: 3 }, { id: '#shanyue:1:unit=inf', lv: 36, tr: 3 }, { id: '#shanyue:0:sage', lv: 36, tr: 3 }],
        terrain: 'castle', foeForm: 'fangyuan', intro: ['白虎寨寨主「鐵面虎」{0}率親兵殺出寨門！', 'The Iron-Mask Tiger, {0}, storms out of the gate with his bodyguards!'] }],
    }],
  },
  arena: {
    ch: 4, rec: 35, name: ['柴桑九連擂', 'The Chaisang Gauntlet'],
    giver: { place: 'chaisang', who: ['擂台的老管事', 'Old Steward of the Ring'], kind: 'merchant' },
    ask: ['柴桑擂台的規矩：四場連戰，中間不准休息，不准回城治傷。撐到最後，擂主親自下場。百年來只有一人站到最後。', 'The rule of the Chaisang ring: four battles back to back, no rest, no healing in town between them. Last one standing faces the Champion himself. In a hundred years only one man made it to the end.'],
    goal: ['在柴桑的擂台連勝四場（中途不得休整）。', 'Win four battles in a row at the Chaisang ring, with no rest between.'],
    thanks: ['四場全勝！這條金腰帶是擂主的信物，從今以後，它是你的了。', 'Four wins! This golden belt is the Champion\'s token. From today it is yours.'],
    reward: { tr: ['leizhuyao'], gold: 6000 },
    steps: [{
      at: 'chaisang', npc: { who: ['擂台的守門人', 'Ring Keeper'], kind: 'guard' },
      before: ['四陣連戰，兵力與策略都不會恢復，道具可以用。量力而為，輸了就下台。', 'Four battles in a row. Troops and strategy points do not come back between them; items you may use. Know your strength: lose and you are out.'],
      gauntlet: true,
      fights: [
        { foes: [{ id: '#free:0:unit=inf', lv: 41, tr: 4 }, { id: '#free:1:unit=inf', lv: 41, tr: 4 }, { id: '#free:2:unit=inf', lv: 41, tr: 4 }, { id: '#free:3:unit=inf', lv: 40, tr: 4 }], terrain: 'castle', foeForm: 'yulin', intro: ['第一陣：槍兵四人組！', 'First bout: four spearmen!'] },
        { foes: [{ id: '#free:0:unit=arc', lv: 42, tr: 4 }, { id: '#free:1:unit=arc', lv: 42, tr: 4 }, { id: '#free:2:unit=arc', lv: 41, tr: 4 }, { id: '#free:0:sage', lv: 41, tr: 4 }], terrain: 'castle', foeForm: 'yanxing', intro: ['第二陣：神射手！', 'Second bout: the sharpshooters!'] },
        { foes: [{ id: '#free:0:unit=cav', lv: 43, boss: true, tr: 5 }, { id: '#free:1:unit=cav', lv: 42, tr: 4 }, { id: '#free:2:unit=cav', lv: 42, tr: 4 }], terrain: 'grass', foeForm: 'tuzhen', intro: ['第三陣：鐵騎雙雄！', 'Third bout: the iron riders!'] },
        { foes: [{ id: '#free:0:yongmeng', lv: 44, boss: true, tr: 5 }, { id: '#free:0:huzhu', lv: 42, tr: 4 }, { id: '#free:1:sage', lv: 42, tr: 4 }], terrain: 'castle', foeForm: 'yanyue', intro: ['擂主{0}親自下場！', 'The Champion, {0}, steps into the ring!'] },
      ],
    }],
  },
  rescue: {
    ch: 5, rec: 36, name: ['武陵救人', 'Hostages of Wuling'],
    giver: { place: 'wuling', who: ['哭泣的婦人', 'Weeping Woman'], kind: 'woman' },
    ask: ['蔡家的逃兵擄走了村裡的孩子，要押到江邊賣給人販子！他們說天一亮就開船……求求你們！', 'Cai deserters took the village children to sell at the river! They sail at first light... please!'],
    goal: ['在五回合內擊潰武陵江邊的逃兵，救回孩子。', 'Rout the deserters at the Wuling riverside within five rounds and bring the children back.'],
    thanks: ['孩子們都回來了！這匹白馬是逃兵頭子的，就送給救命恩人吧。', 'The children are home! This white horse belonged to the deserters\' captain; let it go to the ones who saved them.'],
    reward: { tr: ['tayun'], gold: 6000 },
    steps: [{
      at: 'wuling', npc: { who: ['逃出來的孩子', 'An Escaped Child'], kind: 'folk' },
      before: ['船、船快開了！他們說……第五個時辰一到就開船！（限時五回合：打不完，孩子就被帶走了）', 'The boat, the boat\'s about to sail! They said... at the fifth hour they cast off! (Five rounds: if they are not routed by then, the children are gone.)'],
      fights: [{ foes: [{ id: '#cai_mao:6', lv: 51, boss: true, tr: 6 }, { id: '#cai_mao:0:huwei', lv: 49, tr: 5 }, { id: '#cai_mao:7', lv: 49, tr: 5 }, { id: '#cai_mao:0:sage', lv: 49, tr: 5 }],
        terrain: 'river', foeForm: 'fangyuan', maxRounds: 5, timeout: ['船開走了……孩子們被帶走了。', 'The boat pulls away... the children are gone.'], intro: ['逃兵頭子{0}擋在船前！', 'The deserter captain {0} stands before the boat!'] }],
    }],
  },
  sea: {
    ch: 6, rec: 42, name: ['怒海狂濤', 'The Raging Sea'],
    giver: { place: 'dongye', who: ['斷了一條腿的老船長', 'One-Legged Old Captain'], kind: 'sailor' },
    ask: ['海盜王的樓船艦隊又出海了。他的火船燒光了我整支船隊。你們有船？那就替我們這些死去的水手討個公道。', 'The Pirate King\'s fleet of tower ships is out again. His fire ships burned my whole fleet. You have a ship? Then settle the account for my drowned men.'],
    goal: ['在東冶外海擊敗海盜王的艦隊（水戰）。', 'Defeat the Pirate King\'s fleet off Dongye (a naval battle).'],
    thanks: ['海盜王沉了！這甲是他身上剝下來的，這旗是他的帥旗。拿去吧，水手們會記得你。', 'The Pirate King has sunk! This armour came off his back and this banner flew over his flagship. Take them; the sailors will remember you.'],
    reward: { tr: ['haiwangjia', 'cangbo'], gold: 8000 },
    steps: [{
      at: 'dongye', npc: { who: ['老船長的水手', 'The Captain\'s Bosun'], kind: 'sailor' },
      before: ['海盜王的人個個是水戰好手，擺水軍陣。帶水軍，擺水軍陣，偵察看他們的裝備。（水戰）', 'Every one of the Pirate King\'s men is a river warrior, and they hold the Naval Line. Bring sailors, take the Naval Line, and scout their gear. (Naval battle.)'],
      fights: [{ foes: [{ id: '#pirate:3', lv: 61, boss: true, tr: 7 }, { id: '#pirate:0:shuizhan', lv: 59, tr: 6 }, { id: '#pirate:1:shuizhan', lv: 59, tr: 6 }, { id: '#pirate:0:sage', lv: 59, tr: 6 }],
        terrain: 'river', naval: true, foeForm: 'shuijun', intro: ['海盜王{0}的樓船艦隊壓了過來！', 'The tower ships of the Pirate King, {0}, bear down!'] }],
    }],
  },
  bridge: {
    ch: 7, rec: 47, name: ['長坂橋頭', 'The Man on the Bridge'],
    giver: { place: 'xinye', who: ['新野的獵戶', 'Hunter of Xinye'], kind: 'folk' },
    ask: ['北邊的斷橋上站著一個黑臉大漢，一聲大吼能把馬嚇倒。說是在等「值得追隨的人」，誰打得贏他，他就跟誰走。', 'A black-bearded giant stands on the broken bridge to the north. One roar of his throws horses to the ground. He says he waits for someone worth following: whoever beats him, he will ride with.'],
    goal: ['在新野北的斷橋擊敗張飛。', 'Defeat Zhang Fei on the broken bridge north of Xinye.'],
    thanks: ['張將軍真的跟你們走了？這頂盔是他留在橋頭的，說送給打贏他的人。', 'General Zhang really went with you? He left this helm on the bridge, for whoever beat him.'],
    reward: { gen: ['zhangfei', 46], tr: ['yanyunkui'], gold: 3000 },
    steps: [{
      at: 'xinye', npc: { gen: 'zhangfei' },
      before: ['燕人張翼德在此！誰敢與我決一死戰！（他開戰便一聲大喝：冷靜、看破的武將不會被嚇住）', 'I am Zhang Yide of Yan! Who dares fight me to the death? (He roars as battle begins: Calm or Clear Mind generals do not flinch.)'],
      fights: [{ foes: [{ id: 'zhangfei', lv: 57, boss: true, tr: 8 }, { id: '#liu:0:unit=cav', lv: 54, tr: 7 }, { id: '#liu:1:unit=cav', lv: 54, tr: 7 }, { id: '#liu:0:sage', lv: 54, tr: 7 }],
        terrain: 'river', foeForm: 'fengshi', intro: ['張飛橫矛立馬，一聲大喝震動長橋！', 'Zhang Fei levels his spear and roars; the bridge shakes!'] }],
      win: ['zhangfei', '痛快！好久沒打得這麼痛快了！俺老張就跟你們走一趟！', 'Ha! I haven\'t had a fight like that in years! Old Zhang will ride with you!'],
    }],
  },
  gates: {
    ch: 7, rec: 48, name: ['八門金鎖', 'The Eight Gates Lock'],
    giver: { place: 'wancheng', who: ['落第的老書生', 'Failed Old Scholar'], kind: 'elder' },
    ask: ['曹子孝在宛城外擺了八門金鎖陣，說天下無人能破。老朽研究了一輩子……只帶三員大將，十回合內，從生門殺入，或許能破！', 'Cao Zixiao has laid the Eight Gates Lock outside Wancheng and says no one under heaven can break it. I have studied it all my life... with only three generals, inside ten rounds, through the Gate of Life, it might be done!'],
    goal: ['只帶前列三員武將，十回合內破曹仁的八門金鎖陣。', 'With only the first three of your front line, break Cao Ren\'s Eight Gates Lock within ten rounds.'],
    thanks: ['破了！真的破了！這是老朽一生的心血：三才陣圖。還有這面曹仁的盾。', 'Broken! It truly broke! Here is my life\'s work, the Three Talents chart. And Cao Ren\'s own shield.'],
    reward: { form: 'sancai', tr: ['bamendun'], gold: 5000 },
    steps: [{
      at: 'wancheng', npc: { gen: 'caoren' },
      before: ['想破我的金鎖陣？只准三人入陣，十回合為限。（只有前列的前三位出戰：先在陣形選單排好順序。他的槍兵專擋騎兵，軍師會替他療傷；偃月陣克八卦陣，而曹仁看得穿陣形）', 'You would break my Lock? Three may enter, ten rounds at most. (Only the first three of your front line fight: set the order in the Formation menu first. His spearmen are a wall against horse and his strategist heals him; the Crescent beats the Eight Trigrams, and Cao Ren reads formations.)'],
      fights: [{ foes: [{ id: 'caoren', lv: 55, boss: true, tr: 8 }, { id: '#cao:0:qiangzhen', lv: 51, tr: 7 }, { id: '#cao:1:qiangzhen', lv: 51, tr: 7 }, { id: '#cao:0:sage', lv: 51, tr: 7 }],
        terrain: 'grass', foeForm: 'bagua', onlyFront: 3, maxRounds: 10, timeout: ['八門重新合攏，三人被困陣外……', 'The eight gates swing shut again; the three are locked out...'], intro: ['曹仁坐鎮八門金鎖陣中央！', 'Cao Ren holds the heart of the Eight Gates Lock!'] }],
      win: ['caoren', '……八門竟被三人破了。我曹子孝服了。', '...Three men broke the Eight Gates. Cao Zixiao concedes.'],
    }],
  },
  guanyu: {
    ch: 8, rec: 54, name: ['千里走單騎', 'A Thousand Li Alone'],
    giver: { place: 'xuchang', who: ['許昌的老店家', 'Old Innkeeper of Xuchang'], kind: 'elder' },
    ask: ['那位紅臉長鬚的將軍在小店住了半年，前些日子掛印封金，一個人往西去了，說要找失散的兄長。洛陽的守將奉命攔他……', 'The red-faced, long-bearded general lodged here half a year. Days ago he hung up his seal, sealed the gold he was given, and rode west alone to find his lost sworn brother. The Luoyang garrison has orders to stop him...'],
    goal: ['追上關羽：先擊敗洛陽攔路的守軍，再到華山與他一戰。', 'Catch Guan Yu: beat the garrison barring the road at Luoyang, then face him at Mount Hua.'],
    thanks: ['關將軍跟你們走了？好，好。這部書是他夜夜挑燈讀的，他說留給後來的人。', 'General Guan went with you? Good, good. He read this book by lamplight every night, and said to leave it for whoever came after.'],
    reward: { gen: ['guanyu', 52], tr: ['chunqiu'], gold: 10000 },
    steps: [
      {
        at: 'luoyang', npc: { who: ['洛陽守將', 'Luoyang Commander'], kind: 'guard' },
        before: ['紅臉的關某？丞相有令，誰也不准放他過去，也不准你們過去！', 'The red-faced Guan? The Chancellor\'s order: he does not pass, and neither do you!'],
        fights: [{ foes: [{ id: '#cao:20', lv: 65, boss: true, tr: 8 }, { id: '#cao:0:huzhu', lv: 63, tr: 8 }, { id: '#cao:21', lv: 63, tr: 8 }, { id: '#cao:2:sage', lv: 63, tr: 8 }],
          terrain: 'castle', foeForm: 'fangyuan', intro: ['洛陽守將{0}率兵攔住去路！', 'The Luoyang commander {0} bars the road!'] }],
        win: [null, '守軍潰散了。逃兵說，紅臉將軍往華山去了。', 'The garrison breaks. A straggler says the red-faced general rode on toward Mount Hua.'],
      },
      {
        at: 'huashan', npc: { gen: 'guanyu' },
        before: ['關某只為尋兄而來。閣下若要關某相隨，便以手中兵刃說話。（武聖：對首領與名將傷害更高；周倉、關平會替他擋刀。他擺偃月陣，突騎陣克制）', 'Guan seeks only his brother. If you would have Guan ride with you, let your weapons speak. (Saint of War: he hits leaders and the famous harder; Zhou Cang and Guan Ping take blows for him. He holds the Crescent; the Cavalry Charge beats it.)'],
        fights: [{ foes: [{ id: 'guanyu', lv: 70, boss: true, tr: 9 }, { id: 'zhoucang', lv: 67, tr: 8 }, { id: 'guanping', lv: 67, tr: 8 }, { id: '#liu:3:sage', lv: 66, tr: 8 }],
          terrain: 'mountain', foeForm: 'yanyue', intro: ['關羽提青龍偃月刀，立馬華山道上！', 'Guan Yu sits his horse on the Mount Hua road, the Green Dragon blade in hand!'] }],
        win: ['guanyu', '閣下之義，關某領教了。在尋得兄長之前，關某願為閣下效力。', 'Guan has seen your righteousness. Until I find my brother, my blade is yours.'],
      },
    ],
  },
  tigers: {
    ch: 9, rec: 58, name: ['虎癡與惡來', 'The Tiger Fool and the Evil-Bringer'],
    giver: { place: 'guandu', who: ['官渡的老卒', 'Old Soldier of Guandu'], kind: 'guard' },
    ask: ['曹營最猛的兩個人，許褚和典韋，被貶到官渡看守糧倉，閒得發慌。他們放話：誰能同時打倒他們兩個，典韋就跟誰走。', 'The two fiercest men in Cao\'s camp, Xu Chu and Dian Wei, were sent to guard the Guandu granaries and are bored half to death. They say: beat both of us at once, and Dian Wei goes with you.'],
    goal: ['在官渡同時擊敗許褚與典韋。', 'Beat Xu Chu and Dian Wei together at Guandu.'],
    thanks: ['真打贏了？典韋那傢伙說話算話。許褚也服氣，叫我把這面護心鏡交給你。', 'You actually won? Dian Wei keeps his word. Xu Chu took it well too; he told me to give you his heart mirror.'],
    reward: { gen: ['dianwei', 56], tr: ['huchijing'], gold: 8000 },
    steps: [{
      at: 'guandu', npc: { gen: 'dianwei' },
      before: ['哈！來兩個一起打！（兩人都會護主，互相擋刀；典韋兵力越少越兇（背水）。他們擺鋒矢陣，鶴翼陣克制）', 'Ha! Two at once! (Both are Loyal Guards and cover each other; Dian Wei hits harder the fewer troops he has (Last Stand). They use the Arrowhead; the Crane Wing beats it.)'],
      fights: [{ foes: [{ id: 'xuchu', lv: 78, boss: true, tr: 10 }, { id: 'dianwei', lv: 78, boss: true, tr: 10 }, { id: '#cao:3:sage', lv: 76, tr: 9 }, { id: '#cao:0:unit=arc', lv: 76, tr: 9 }],
        terrain: 'grass', foeForm: 'fengshi', intro: ['許褚與典韋赤膊上陣！', 'Xu Chu and Dian Wei charge in, stripped to the waist!'] }],
      win: ['dianwei', '好！典韋說話算話，從今天起，這雙戟替你開路！', 'Good! Dian Wei keeps his word. From today these twin halberds clear your road!'],
    }],
  },
  abyss: {
    ch: 9, rec: 60, name: ['九嶷深淵', 'The Abyss under Jiuyi'],
    giver: { place: 'lingling', who: ['九嶷山的隱者', 'Hermit of Mount Jiuyi'], kind: 'monk' },
    ask: ['你們在九嶷山打倒的只是看門的。祭壇下面還有一層深淵，黑蓮教最古老的長老「玄冥」在那裡沉睡了百年。他醒了。', 'What you beat on Mount Jiuyi only kept the door. Beneath the altar lies an abyss where Xuanming, the oldest elder of the Black Lotus, has slept a hundred years. He is awake.'],
    goal: ['從九嶷山第三層的祭壇走下深淵（第四層），擊敗玄冥。', 'Go down from the altar on the third floor of Mount Jiuyi into the abyss (the fourth floor) and defeat Xuanming.'],
    thanks: ['玄冥……終於消散了。這把劍是百年前斬傷他的那把，這卷書記著當年引動天雷的法門。', 'Xuanming... is gone at last. This sword wounded him a century ago, and this scroll holds the rite that once called down the thunder.'],
    reward: { tr: ['tianwen'], item: 'bk_leiting', gold: 15000 },
    flag: 'sq_abyss',
    steps: [{
      at: 'jiuyi/f4', goal: true,
      before: ['深淵底部，玄冥睜開了眼睛。「百年了……正好餓了。」（黑蓮最古老的術士與他的弟子：策略多、狀態多。帶不受狀態的武將、清心丹，封住他們的軍師）', 'At the bottom of the abyss, Xuanming opens his eyes. "A hundred years... and I am hungry." (The Black Lotus\'s oldest sorcerer and his disciples: many ploys, many statuses. Bring generals who resist them, Clear-Mind Pills, and seal their strategists.)'],
      fights: [{ foes: [{ id: '#sect:0:sage', lv: 87, boss: true, tr: 10 }, { id: '#sect:41', lv: 84, tr: 10 }, { id: '#sect:42', lv: 84, tr: 10 }, { id: '#sect:1:sage', lv: 84, tr: 10 }],
        terrain: 'sect', foeForm: 'bagua', music: 'sectboss', canRun: false, intro: ['黑蓮古老「玄冥」{0}從深淵中升起！', 'Xuanming, eldest of the Black Lotus, {0}, rises from the abyss!'] }],
    }],
  },
  wolf: {
    ch: 10, rec: 62, name: ['冢虎之局', 'The Crouching Tiger\'s Game'],
    giver: { place: 'changan', who: ['長安的棋士', 'Go Master of Chang\'an'], kind: 'elder' },
    ask: ['城西有位司馬先生，與老夫下了十年棋，從沒輸過。他說：天下大局他看膩了，只想見一見能在十四回合內破他布局的人。', 'West of the city lives a Master Sima who has played Go with me ten years and never lost. He says he is tired of the great game of the realm and wants only to meet someone who can break his design within fourteen rounds.'],
    goal: ['在長安城西，十四回合內擊敗司馬懿。', 'West of Chang\'an, defeat Sima Yi within fourteen rounds.'],
    thanks: ['司馬先生……竟然輸了？他說這件袍子送你，還說「後會有期」。', 'Master Sima... lost? He says this robe is yours, and "we shall meet again."'],
    reward: { gen: ['simayi', 60], tr: ['zhonghu'], gold: 12000 },
    steps: [{
      at: 'changan', npc: { gen: 'simayi' },
      before: ['請。十四手之內，讓我看看你的棋。（狼顧：他的策略不會被反彈，敵計對他也難奏效；三位謀士陪他。他擺八卦陣，偃月陣克制；他看得穿陣形）', 'Please. Within fourteen moves, show me your game. (Wolf\'s Glance: his ploys never bounce and ours struggle against him; three advisers stand with him. He holds the Eight Trigrams; the Crescent beats it, and he reads formations.)'],
      fights: [{ foes: [{ id: 'simayi', lv: 83, boss: true, tr: 10 }, { id: '#cao:0:sage', lv: 80, tr: 10 }, { id: '#cao:1:sage', lv: 80, tr: 10 }, { id: '#cao:4:huzhu', lv: 80, tr: 10 }],
        terrain: 'castle', foeForm: 'bagua', maxRounds: 14, timeout: ['司馬懿收起棋子：「時候到了。」', 'Sima Yi gathers his stones: "Time."'], intro: ['司馬懿輕搖羽扇，布下天羅地網。', 'Sima Yi waves his feather fan and spreads his net.'] }],
      win: ['simayi', '……輸了。有趣。懿就陪閣下走一段，看看這局棋怎麼收官。', '...I lose. How interesting. Yi will walk a while with you, to see how this game ends.'],
    }],
  },
};
export const SQ_IDS = Object.keys(SQ);
const st = (id) => (S.sq && S.sq[id]) || 0;
const who = (Q) => L(Q.giver.who[0], Q.giver.who[1]);
const N = (zh, en) => say(null, L(zh, en));
const fmt = (s, a) => s.replace('{0}', a);

// ---------- the armies ----------
// '#side:n' is the n-th ordinary officer of that side who is not in your army
function resolve(id, used = new Set()) {
  if (id[0] !== '#') return id;
  const [fac, n, flt] = id.slice(1).split(':');
  let pool = GEN_LIST.filter((g) => !g.famous && g.faction === fac && !S.roster[g.id]);
  if (!pool.length) pool = GEN_LIST.filter((g) => !g.famous && g.faction === 'free' && !S.roster[g.id]);
  let pick = pool;
  if (flt === 'sage') pick = pool.filter((g) => g.int >= 72).sort((a, b) => b.int - a.int);
  else if (flt && flt.startsWith('unit=')) pick = pool.filter((g) => g.unit === flt.slice(5));
  else if (flt) pick = pool.filter((g) => (g.traits || []).includes(flt));
  if (!pick.length) pick = pool;
  // never the same officer twice in one army
  for (let k = 0; k < pick.length; k++) { const g = pick[(+n + k) % pick.length]; if (!used.has(g.id)) return g.id; }
  return pool.find((g) => !used.has(g.id)).id;
}
export function cfgOf(f, tag) {
  // tests may raise a trial's levels while tuning it (G.sqTune = { lv })
  const tn = (window.G && window.G.sqTune) || null;
  const used = new Set(f.foes.filter((x) => x.id[0] !== '#').map((x) => x.id));
  const foes = f.foes.map((x) => { const id = resolve(x.id, used); used.add(id); return { ...x, id, ...(tn ? { lv: x.lv + (tn.lv || 0) } : {}) }; });
  const boss = foes.find((x) => x.boss) || foes[0];
  return {
    foes, boss: true, terrain: f.terrain || 'grass', naval: !!f.naval, foeForm: f.foeForm, capture: false, canRun: f.canRun !== false, mayLose: true,
    music: f.music || 'boss', onlyFront: f.onlyFront, maxRounds: f.maxRounds, timeout: f.timeout, tag,
    intro: f.intro ? fmt(L(f.intro[0], f.intro[1]), genName(boss.id)) : undefined,
  };
}
// the battles of one step, one after another; no healing between them. Returns 'win' or 'lose'.
export async function runStep(id, k) {
  const Q = SQ[id], step = Q.steps[k];
  for (let i = 0; i < step.fights.length; i++) {
    const tag = step.fights.length > 1 ? L(`${Q.name[0]}　第${i + 1}/${step.fights.length}陣`, `${Q.name[1]}: bout ${i + 1}/${step.fights.length}`) : L(`試煉：${Q.name[0]}`, `Trial: ${Q.name[1]}`);
    const cfg = cfgOf(step.fights[i], tag);
    for (const f of cfg.foes) S.met[f.id] = Math.max(S.met[f.id] || 0, 1);
    sfx('encounter');
    const r = await window.G.battle(cfg);
    if (r !== 'win') return 'lose';
    if (i + 1 < step.fights.length && !(window.G && window.G.autoBattle)) await N(`第${i + 1}陣勝利！下一陣緊接著開始……（兵力不會恢復）`, `Bout ${i + 1} won! The next begins at once... (troops do not recover)`);
  }
  return 'win';
}

// ---------- talking ----------
const avgFront = () => { const ms = S.front.map((x) => S.roster[x]).filter(Boolean); return ms.length ? Math.round(ms.reduce((t, m) => t + m.lv, 0) / ms.length) : 1; };
export function rewardText(Q) {
  const r = Q.reward, out = [];
  if (r.gen) out.push(L(`${GENERALS[r.gen[0]].zh}加入`, `${GENERALS[r.gen[0]].en} joins`));
  for (const t of r.tr || []) out.push(L(`【傳說】${ITEMS[t].zh}`, `[Legendary] ${ITEMS[t].en}`));
  if (r.form) out.push(L(`陣形「${FORMS[r.form].zh}」`, `the ${FORMS[r.form].en} formation`));
  if (r.item) out.push(L(`秘傳「${ITEMS[r.item].zh}」`, `the secret ${ITEMS[r.item].en}`));
  if (r.gold) out.push(L(`${r.gold}金`, `${r.gold} gold`));
  return out.join(L('、', ', '));
}
async function giver(id) {
  const Q = SQ[id], s = st(id), w = who(Q);
  if (s === DONE) return say(w, L('多謝將軍。這一帶總算太平了。', 'Thank you, general. This country is at peace at last.'));
  if (!s) {
    await say(w, L(Q.ask[0], Q.ask[1]));
    await N(`【試煉】${Q.name[0]}　建議等級 ${Q.rec}（目前前列平均 ${avgFront()}）\n報酬：${rewardText(Q)}`, `[Trial] ${Q.name[1]}  Recommended Lv ${Q.rec} (your front line: ${avgFront()})\nReward: ${rewardText(Q)}`);
    const c = await ask(w, L('您願意接下嗎？（極為困難，可以之後再來）', 'Will you take it on? (Very hard; you may come back later.)'), [L('接下', 'Accept'), L('再說吧', 'Not now')], { back: 1 });
    if (c !== 0) return;
    S.sq[id] = 1; if (Q.flag) S.flags[Q.flag] = 1; sfx('ok');
    return N(`接下了試煉「${Q.name[0]}」。（選單「任務」可以查看）\n${Q.goal[0]}`, `Trial accepted: ${Q.name[1]}. (See Quests in the menu.)\n${Q.goal[1]}`);
  }
  // finished every step: the reward
  if (s > Q.steps.length) return payOut(id);
  return say(w, L(`拜託了。${Q.goal[0]}`, `Please. ${Q.goal[1]}`));
}
async function payOut(id) {
  const Q = SQ[id], r = Q.reward;
  await say(who(Q), L(Q.thanks[0], Q.thanks[1]));
  S.sq[id] = DONE;
  if (r.gold) { S.gold += r.gold; sfx('chest'); await N(`得到了${r.gold}金。`, `Received ${r.gold} gold.`); }
  for (const t of r.tr || []) if (!owned(t)) await gainTreasure(t, ['得到了', 'Received']);
  if (r.item) { give(r.item); sfx('chest'); await N(`得到了秘傳「${ITEMS[r.item].zh}」！`, `Received the secret ${ITEMS[r.item].en}!`); }
  if (r.form && !S.forms.includes(r.form)) { S.forms.push(r.form); sfx('level'); await N(`習得了陣形「${FORMS[r.form].zh}」！`, `Learned the ${FORMS[r.form].en} formation!`); }
}
// the challenge itself: someone standing where the step happens
async function challenge(id) {
  const Q = SQ[id], k = st(id) - 1, step = Q.steps[k];
  if (!step) return;
  const sp = step.npc && step.npc.gen ? step.npc.gen : step.npc ? L(step.npc.who[0], step.npc.who[1]) : null;
  await say(sp && GENERALS[sp] ? genName(sp) : sp, L(step.before[0], step.before[1]), { face: step.npc && step.npc.gen ? step.npc.gen : null });
  const c = await ask(null, L(`開始試煉？建議等級 ${Q.rec}，前列平均 ${avgFront()}。`, `Begin the trial? Recommended Lv ${Q.rec}; your front line ${avgFront()}.`), [L('開戰', 'Fight'), L('先準備', 'Prepare first')], { back: 1 });
  if (c !== 0) return;
  const r = await runStep(id, k);
  if (r !== 'win') { await N('試煉失敗了……整頓兵馬，隨時可以再來。', 'The trial is lost... rest and regroup, and come back any time.'); return; }
  if (step.win) { const [g, zh, en] = step.win; if (g) await say(genName(g), L(zh, en), { face: g }); else await N(zh, en); }
  S.sq[id] = k + 2;
  if (Q.reward.gen && k + 1 === Q.steps.length) {
    const [gid, lv] = Q.reward.gen;
    if (!S.roster[gid]) { recruit(gid, lv, { reserve: S.front.length >= 5 }); S.flags['gone_' + gid] = 1; sfx('level'); await N(`${GENERALS[gid].zh}加入了！`, `${GENERALS[gid].en} joins the army!`); }
  }
  if (k + 1 === Q.steps.length) await N(`試煉「${Q.name[0]}」完成！回去找${Q.giver.who[0]}（${placeName(Q.giver.place)}）領取謝禮。`, `Trial complete: ${Q.name[1]}! Go back to the ${Q.giver.who[1].toLowerCase()} in ${placeName(Q.giver.place)} for your reward.`);
}
export async function sqTalk(t) {
  const [, kind, id] = t.split(':');
  if (!SQ[id]) return;
  if (kind === 'give') return giver(id);
  if (kind === 'go') return challenge(id);
}
// the abyss's last room: the step's challenge, as a cave goal
export async function sqGoal(e) { if (st(e.sq) >= 1 && st(e.sq) <= SQ[e.sq].steps.length) return challenge(e.sq); return N('深淵底部一片寂靜。', 'The bottom of the abyss is silent.'); }

// ---------- people in the towns ----------
export function populate(mapId, ents) {
  if (!F.map || !S.sq) return;
  const [place, sub] = mapId.split('/');
  const m = F.map, cx = Math.floor(m.w / 2);
  for (const id of SQ_IDS) {
    const Q = SQ[id], s = st(id);
    if (S.chapter < Q.ch) continue;
    // the one who asks, with a mark until the trial is taken (and again when the reward waits)
    if (!sub && Q.giver.place === place) ents.push({ type: 'npc', id: 'sqg_' + id, look: folkLook(id.length * 53 + Q.ch * 7, Q.giver.kind), x: cx + 4, y: m.h - 8, dir: 'd', talk: 'sq:give:' + id, mark: !s || (s > Q.steps.length && s !== DONE) });
    // whoever waits at the place of the current step
    const step = s >= 1 && s <= Q.steps.length ? Q.steps[s - 1] : null;
    if (!step || step.goal || step.at !== mapId) continue;
    const g = step.npc.gen ? GENERALS[step.npc.gen] : null;
    ents.push(g ? { type: 'npc', id: 'sqc_' + id, look: g.look, equip: g.gear || gearFor(g, 50), opts: { shield: g.shield, quiver: g.quiver }, x: cx - 5, y: m.h - 7, dir: 'd', talk: 'sq:go:' + id, mark: true }
      : { type: 'npc', id: 'sqc_' + id, look: folkLook(id.length * 71 + s, step.npc.kind), x: cx - 5, y: m.h - 7, dir: 'd', talk: 'sq:go:' + id, mark: true });
  }
}

// ---------- the quest log ----------
const STATUS_TXT = { 0: ['未接', 'Not taken'], 1: ['進行中', 'In progress'], done: ['已完成', 'Done'], ready: ['領取謝禮', 'Reward waiting'] };
function entries() {
  const out = [];
  for (const id of SQ_IDS) {
    const Q = SQ[id]; if (S.chapter < Q.ch) continue;
    const s = st(id);
    const status = s === DONE ? 'done' : s > Q.steps.length ? 'ready' : s ? 1 : 0;
    const where = s >= 1 && s <= Q.steps.length ? Q.steps[s - 1].at : Q.giver.place;
    out.push({ trial: true, id, Q, status, name: L(Q.name[0], Q.name[1]), where });
  }
  for (const [q, Q] of Object.entries(QUESTS)) {
    if (S.chapter < Q.ch) continue;
    const s = S.quests[q] || 0;
    const nm = { deliver: ['送東西', 'A delivery'], find: ['尋物', 'A lost thing'], defeat: ['討伐', 'A bandit hunt'] }[Q.type];
    out.push({ trial: false, id: q, Q, status: s === 2 ? 'done' : s === 3 ? 'ready' : s ? 1 : 0, name: L(`${nm[0]}：${Q.who[0]}`, `${nm[1]}: ${Q.who[1]}`), where: Q.place });
  }
  return out;
}
function detail(e) {
  const Q = e.Q, lines = [];
  const stt = STATUS_TXT[e.status];
  if (e.trial) {
    lines.push(L(`【試煉】${Q.name[0]}`, `[Trial] ${Q.name[1]}`));
    lines.push(L(`委託：${Q.giver.who[0]}（${placeName(Q.giver.place)}）`, `From: ${Q.giver.who[1]} (${placeName(Q.giver.place)})`));
    const s = st(e.id), step = s >= 1 && s <= Q.steps.length ? Q.steps[s - 1] : null;
    lines.push(L(`地點：${step ? (step.at.includes('/') ? `${placeName(step.at.split('/')[0])}深處` : placeName(step.at)) : placeName(Q.giver.place)}`, `Where: ${step ? (step.at.includes('/') ? `deep in ${placeName(step.at.split('/')[0])}` : placeName(step.at)) : placeName(Q.giver.place)}`));
    lines.push(L(`目標：${Q.goal[0]}`, `Goal: ${Q.goal[1]}`));
    if (Q.steps.length > 1) lines.push(L(`進度：${Math.min(Q.steps.length, Math.max(0, s - 1))}/${Q.steps.length}`, `Progress: ${Math.min(Q.steps.length, Math.max(0, s - 1))}/${Q.steps.length}`));
    lines.push(L(`建議等級：${Q.rec}（前列平均 ${avgFront()}）`, `Recommended Lv ${Q.rec} (front line ${avgFront()})`));
    lines.push(L(`狀態：${stt[0]}`, `Status: ${stt[1]}`));
    lines.push(L(`報酬：${rewardText(Q)}`, `Reward: ${rewardText(Q)}`));
  } else {
    lines.push(e.name);
    lines.push(L(`委託：${Q.who[0]}（${placeName(Q.place)}）`, `From: ${Q.who[1]} (${placeName(Q.place)})`));
    lines.push(L(Q.ask[0], Q.ask[1]));
    lines.push(L(`狀態：${stt[0]}`, `Status: ${stt[1]}`));
    const reward = TREASURES.find((id) => SRC[id] && SRC[id].t === 'quest' && SRC[id].q === e.id);
    lines.push(L(`報酬：${reward ? `寶物「${owned(reward) || e.status === 'done' ? ITEMS[reward].zh : '？？？'}」` : '1000金'}`, `Reward: ${reward ? `a treasure (${owned(reward) || e.status === 'done' ? ITEMS[reward].en : '???'})` : '1000 gold'}`));
  }
  return lines;
}
export async function questLog() {
  const list = entries();
  if (!list.length) { await N('目前沒有委託。在各地與頭上有「！」的人交談。', 'No requests yet. Talk to people with a "!" over their heads.'); return; }
  let cur = 0;
  const col = { 0: '#c8c8c8', 1: '#ffe080', done: '#78d878', ready: '#ff9a60' };
  const draw = () => {
    const x = 196, y = 4, w = W - x - 4, h = H - 8;
    windowBox(x, y, w, h);
    let yy = y + 8;
    for (const ln of detail(list[cur])) for (const l of wrap(ln, w - 16)) { if (yy > y + h - 18) break; text(l, x + 8, yy, yy === y + 8 ? '#f8e070' : '#f0f0f0'); yy += 15; }
  };
  for (;;) {
    const c = await menu(list.map((e) => ({ label: e.name, color: col[e.status], right: e.trial ? `Lv${e.Q.rec}` : '' })), { x: 4, y: 4, w: 190, maxRows: 15, title: L('任務', 'Quests'), start: cur, onMove: (i) => { cur = i; }, drawExtra: draw });
    if (c < 0 || typeof c === 'object') break;
    cur = c;
  }
}
// for tests: run a trial's battles straight away (no talk), step by step, healing between steps
export async function simTrial(id) {
  const Q = SQ[id];
  for (let k = 0; k < Q.steps.length; k++) { if (k) healAll(1); const r = await runStep(id, k); if (r !== 'win') return { res: 'lose', step: k }; }
  return { res: 'win' };
}
void have; void panel; void descBox; void ctx; void textW; void RARITY; void REGIONS; void PLACES; void H;
