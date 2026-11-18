// The 311 treasures (寶物): the first 300, and eleven legendary rewards of the trials (sidequests.js). Each line below is one treasure: id | 中文 | English | rarity 0-4 | chapter | codes.
// Its numbers come from its kind, chapter and rarity (a little above what the shops of that chapter sell, never
// far above), its look on the paper doll from the codes, and where it is found is worked out at the end of this
// file from the chapter (chests in halls, caves, shrines and streets, Jasper's hidden spots, leaders' rewards,
// rare drops, side quests, shops and the treasure merchant).
//
// codes: c= weapon kind, w= weapon layer, m= metal, wd= wood, glow= outline colour, a= armour type, ac= its cloth,
// h= helmet layer, p= plume layer, pc= plume colour, hc= cloth of a headband, cp= cape layer, cc= cape colour,
// sh= shield layer, hs= horse colour, n= neck layer, bl= belt layer, bc= belt colour, br bracers, cu cuffs, sc scarf,
// ic= icon, fx= effects (comma list), set= set, st= extra stats, src= fixed source, gen= carried by a general
import { PLACES, REGIONS } from './world.js?v=10';
export const RARITY = [['普通', 'Common', '#c8c8c8'], ['精良', 'Fine', '#78d878'], ['稀有', 'Rare', '#68a8ff'], ['名品', 'Famed', '#d080ff'], ['傳說', 'Legendary', '#ffb838']];
const RMUL = [1, 1.04, 1.08, 1.12, 1.18];
const W_ATK = [0, 9, 11, 16, 20, 25, 27, 30, 34, 37, 38];
const A_DEF = [0, 6, 9, 12, 16, 20, 24, 26, 30, 34, 36];
const H_DEF = [0, 3, 4, 6, 8, 11, 13, 15, 18, 20, 22];

const WEAPONS = `
qingshuang|青霜劍|Frost-Blue Sword|1|1|c=sword w=w_sword m=steel fx=crit:4
tiehua|鐵花刀|Iron Blossom Sabre|0|1|c=sword w=w_saber m=iron
longquan|龍泉劍|Longquan Sword|2|2|c=sword w=w_longsword m=steel fx=vs:inf:10
yuchang|魚腸劍|Fish-Gut Dagger|3|2|c=sword w=w_dagger m=silver fx=crit:8,steal:10 st=spd:4
chunjun|純鈞劍|Chunjun Sword|2|3|c=sword w=w_longsword_alt m=steel fx=ctr:12
hanguang|寒光刀|Cold-Light Sabre|1|3|c=sword w=w_saber m=silver
taia|太阿劍|Tai'a Sword|3|3|c=sword w=w_longsword m=silver fx=mor:6,vs:cav:10
zhanlu|湛盧劍|Zhanlu Sword|3|4|c=sword w=w_longsword_alt m=ceramic glow=#80c8ff fx=res:confuse:50,ctr:10
jujue|巨闕劍|Juque Greatsword|2|4|c=sword w=w_longsword m=iron st=atk:3
youying|幽影刀|Shade Sabre|1|5|c=sword w=w_katana m=steel fx=first:10
baihong|白虹劍|White Rainbow Sword|2|6|c=sword w=w_rapier m=silver fx=eva:5
qingming|青冥劍|Azure Abyss Sword|2|7|c=sword w=w_katana m=ceramic fx=crit:6
chengying|承影劍|Shadow-Bearer Sword|3|7|c=sword w=w_glowsword_b glow=#a0d8ff fx=eva:6,first:12
zidian|紫電劍|Purple Lightning Sword|3|8|c=sword w=w_scimitar m=silver glow=#d090ff fx=el:thunder:15,crit:5
mangwang|蠻王刀|Barbarian King's Blade|2|9|c=sword w=w_scimitar m=bronze set=nanman
chixiao|赤霄劍|Chixiao, the Red Empyrean|4|9|c=sword w=w_glowsword glow=#ff7050 set=han fx=mor:8,vs:inf:12
fengleng|風冷雙刀|Wind-Chill Twin Sabres|1|3|c=twin w=w_saber m=steel fx=crit:4
yuanyang|鴛鴦刀|Mandarin-Duck Blades|2|4|c=twin w=w_katana m=silver fx=ctr:10
shuanggu|雙股劍|Twin-Strand Swords|3|5|c=twin w=w_sword m=gold fx=mor:6,ctr:10
zhuque|朱雀雙刀|Vermilion Bird Blades|3|8|c=twin w=w_scimitar m=copper glow=#ff9040 fx=el:fire:12,first:10
ganmo|干將莫邪|Ganjiang and Moye|4|10|c=twin w=w_longsword m=ceramic glow=#c0f0ff fx=crit:8,ctr:15
tianwen|天問劍|Sword of Heaven's Question|4|10|c=sword w=w_glowsword_b glow=#b0a0ff fx=crit:8,el:thunder:15,ctr:10 src=sq:abyss
baila|白蠟槍|Waxwood Spear|0|1|c=spear w=w_spear m=iron wd=maple
huntie|渾鐵槍|Solid Iron Spear|1|2|c=spear w=w_spear m=iron wd=walnut fx=vs:cav:8
dianjin|點金槍|Gold-Tipped Spear|2|3|c=spear w=w_longspear m=gold fx=crit:5
hantiemao|寒鐵矛|Cold-Iron Pike|1|3|c=spear w=w_longspear m=iron
lihua|梨花槍|Pear-Blossom Spear|2|4|c=spear w=w_longspear m=silver wd=maple fx=el:fire:10,first:8
goulian|鉤鐮槍|Hook Spear|1|5|c=spear w=w_trident m=iron fx=vs:cav:15
wulong|烏龍槍|Black Dragon Spear|2|6|c=spear w=w_longspear m=iron wd=ebony fx=nav:10
shemao|丈八蛇矛|Eighteen-Span Serpent Spear|4|7|c=spear w=w_trident m=steel glow=#90ff90 fx=mor:10,vs:inf:12
yinyue|銀月槍|Silver Moon Spear|3|7|c=spear w=w_dragonspear m=silver fx=ctr:12
pozhen|破陣槍|Line-Breaker Spear|2|8|c=spear w=w_longspear m=steel fx=form:fengshi:10
yajiao|涯角槍|Yajiao Spear|4|8|c=spear w=w_dragonspear m=ceramic glow=#c0e8ff set=changban fx=first:15,crit:6
bawangqiang|霸王槍|Overlord's Spear|3|9|c=spear w=w_dragonspear m=bronze set=bawang
hongying|紅纓戟|Red-Tassel Halberd|0|1|c=halberd w=w_halberd m=bronze
jiuhuan|九環刀|Nine-Ring Glaive|1|2|c=halberd w=w_scythe m=iron fx=mor:4
huagan|畫桿戟|Painted Halberd|1|3|c=halberd w=w_halberd m=steel wd=mahogany
jinfanji|錦帆戟|Brocade-Sail Halberd|2|4|c=halberd w=w_halberd m=brass set=jinfan
zhanma|斬馬刀|Horse-Cutter Glaive|2|4|c=halberd w=w_scythe m=steel fx=vs:cav:15
yueya|月牙戟|Crescent-Moon Halberd|2|5|c=halberd w=w_halberd m=silver fx=crit:5
fengzui|鳳嘴刀|Phoenix-Beak Glaive|3|6|c=halberd w=w_scythe m=gold fx=vs:inf:12,mor:5
lengyan|冷艷鋸|Cold Beauty Saw|3|7|c=halberd w=w_scythe m=silver wd=ebony fx=ctr:12
sanjian|三尖兩刃刀|Three-Point Twin-Edge Blade|3|8|c=halberd w=w_trident m=steel wd=mahogany fx=crit:6,vs:cav:10
longya|龍牙戟|Dragon-Fang Halberd|2|9|c=halberd w=w_halberd m=steel
tianji|天戟|Heaven's Halberd|4|10|c=halberd w=w_halberd m=gold glow=#ffe070 fx=vs:all:10,first:12
baihudao|白虎吞天刀|White Tiger Sky-Eater|4|5|c=halberd w=w_scythe m=silver wd=ebony glow=#f0f0ff fx=crit:8,vs:inf:12 src=sq:tiger
qingtongyue|青銅鉞|Bronze Yue Axe|0|1|c=axe w=w_waraxe m=bronze
gangbian|鋼鞭|Steel Whip-Mace|1|3|c=mace w=w_mace m=steel fx=ctr:8
shutongchui|熟銅錘|Bronze Hammer|1|4|c=mace w=w_mace m=bronze fx=vs:inf:8
jinzhan|金蘸斧|Gold-Dipped Axe|2|5|c=axe w=w_waraxe m=gold fx=crit:5
langya|狼牙棒|Wolf-Fang Club|2|5|c=mace w=w_mace m=iron fx=vs:inf:10
tiejili|鐵蒺藜骨朵|Iron Thorn Mace|1|6|c=mace w=w_mace m=iron
pocheng|破城斧|Siege-Breaker Axe|2|7|c=axe w=w_waraxe m=steel fx=form:yulin:10
liuxing|流星錘|Meteor Hammer|2|8|c=mace w=w_flail m=steel fx=first:10
leiting|雷霆斧|Thunder Axe|3|9|c=axe w=w_waraxe m=silver glow=#ffff80 fx=el:thunder:12,crit:6
dashen|打神鞭|God-Striking Whip|4|10|c=mace w=w_mace m=gold glow=#ffe070 set=taigong fx=refl:10,vs:all:8
shanyuegong|山越竹弓|Shanyue Bamboo Bow|0|1|c=bow w=w_bow wd=maple
quehua|鵲畫弓|Magpie-Painted Bow|1|2|c=bow w=w_recurve wd=walnut fx=crit:4
baodiao|寶雕弓|Carved Treasure Bow|2|3|c=bow w=w_recurve wd=mahogany fx=vs:cav:12
jiaogong|角弓|Horn Bow|1|4|c=bow w=w_recurve wd=oak
chuanyun|穿雲弓|Cloud-Piercer Bow|2|6|c=bow w=w_greatbow wd=ebony fx=first:10
luoyan|落雁弓|Goose-Felling Bow|3|7|c=bow w=w_greatbow wd=maple fx=crit:8
hujin|虎筋弓|Tiger-Sinew Bow|3|8|c=bow w=w_greatbow wd=mahogany fx=vs:cav:12,mor:5
sheri|射日弓|Sun-Shooter Bow|4|9|c=bow w=w_greatbow wd=gold glow=#ffd040 fx=crit:8,el:fire:12
wuhao|烏號弓|Wuhao, the Crow-Cry Bow|4|10|c=bow w=w_greatbow wd=ebony glow=#c0a0ff fx=first:15,vs:all:8
juezhang|蹶張弩|Foot-Drawn Crossbow|1|3|c=xbow w=w_crossbow m=iron
yaoyin|腰引弩|Waist-Draw Crossbow|1|4|c=xbow w=w_crossbow m=steel fx=crit:4
funu|伏弩|Ambush Crossbow|2|6|c=xbow w=w_crossbow m=iron wd=ebony fx=first:12
yuanrong|元戎弩|Yuanrong Crossbow|2|7|c=xbow w=w_crossbow m=brass fx=vs:cav:12
shenbi|神臂弩|Divine-Arm Crossbow|3|8|c=xbow w=w_crossbow m=silver wd=mahogany fx=crit:6,vs:cav:10
qinnu|秦弩|Qin Crossbow|3|9|c=xbow w=w_crossbow m=bronze fx=form:yanxing:12
emao|鵝毛扇|Goose-Down Fan|1|3|c=staff w=w_fan fx=tac:5
bajiao|芭蕉扇|Plantain-Leaf Fan|2|4|c=staff w=w_fan fx=el:fire:12
baiyushan|白羽扇|White Feather Fan|3|5|c=staff w=w_cranefan set=wolong fx=tac:8
kongque|孔雀扇|Peacock Fan|2|7|c=staff w=w_fan fx=cost:10
xingdou|星斗扇|Star-Dipper Fan|3|9|c=staff w=w_cranefan set=qixing fx=el:thunder:12
huoyu|火羽扇|Fire-Plume Fan|4|10|c=staff w=w_cranefan glow=#ff8040 fx=el:fire:18,tac:8
taomu|桃木杖|Peachwood Staff|0|2|c=staff w=w_staff wd=maple fx=res:curse:40
xizhang|錫杖|Monk's Tin Staff|1|4|c=staff w=w_staff wd=oak set=healer fx=heal:10
jiujie|九節杖|Nine-Node Staff|2|5|c=staff w=w_gnarled wd=walnut fx=heal:10,res:poison:50
taiping|太平杖|Staff of Great Peace|3|7|c=staff w=w_gnarled wd=gold fx=el:thunder:12,tac:6
heilianzhang|黑蓮杖|Black Lotus Staff|3|9|c=staff w=w_diamond set=lotus glow=#c060ff fx=tac:8
longtou|龍頭杖|Dragon-Head Staff|4|10|c=staff w=w_crystal glow=#80e0ff fx=tac:10,cost:12
`;
const ARMOUR = `
mabu|麻布戰衣|Hemp War Coat|0|1|a=leather ac=tan m=iron st=spd:2
pizha|皮札甲|Leather Lamellar|0|1|a=lamellar m=bronze
xipi|犀皮甲|Rhino-Hide Armour|1|2|a=leather ac=charcoal m=iron fx=resel:rock:15
huwen|虎紋札甲|Tiger-Stripe Lamellar|2|2|a=lamellar m=brass set=jdtiger
tongjia|銅甲|Bronze Plates|0|2|a=lamellar m=bronze
lian|練甲|Lacquered Silk Armour|1|3|a=leather ac=maroon m=brass fx=eva:4
rupao|儒袍|Scholar's Gown|1|3|a=robe st=int:4 fx=tac:4
tongxiu|筒袖鎧|Tube-Sleeve Armour|1|4|a=chain m=steel
tielin|鐵鱗甲|Iron-Scale Armour|1|4|a=scale m=iron
shuixi|水犀甲|Water-Rhino Armour|2|4|a=water ac=navy m=brass set=jinfan
liangdang|兩當鎧|Front-and-Back Armour|2|5|a=lamellar m=steel fx=resel:fire:15
hewen|鶴紋道袍|Crane-Pattern Robe|2|5|a=robe st=int:6 set=healer
xiangpi|象皮甲|Elephant-Hide Armour|1|5|a=leather ac=gray m=iron fx=resel:water:15
huansuo|環鎖鎧|Linked-Ring Mail|2|6|a=chain m=silver fx=resel:fire:15
hanbing|寒冰甲|Rime Armour|2|6|a=scale m=ceramic fx=resel:water:20
ganglin|鋼鱗甲|Steel-Scale Armour|2|6|a=scale m=steel
shapi|鯊皮甲|Shark-Skin Armour|1|6|a=water ac=bluegray m=steel fx=nav:8
xilin|細鱗甲|Fine-Scale Armour|2|7|a=scale m=silver fx=eva:4
xuanjia|玄甲|Black Armour|3|7|a=lamellar m=iron ac=black fx=mor:6,resel:rock:20
zishou|紫綬袍|Purple-Ribbon Robe|2|7|a=robe st=int:7 fx=cost:8
shanwen|山文甲|Mountain-Pattern Armour|3|8|a=scale m=gold fx=resel:rock:25
baiyin|白銀甲|White Silver Armour|3|8|a=plate m=silver set=changban
chiyan|赤焰甲|Crimson Flame Armour|3|8|a=plate m=copper fx=resel:fire:30
guimian|鬼面鎧|Demon-Mask Armour|3|8|a=plate m=iron fx=mor:6,res:fear:60
xiliangjia|西涼鐵甲|Xiliang Iron Armour|2|8|a=plate m=iron set=xiliang
jinlin|金鱗甲|Gold-Scale Armour|3|8|a=scale m=gold
tangni|唐猊鎧|Tangni Armour|4|9|a=plate m=bronze set=hulao fx=resel:all:15
bagua|八卦衣|Eight-Trigram Robe|4|9|a=robe set=wolong st=int:10 fx=res:confuse:60
wuge|烏戈藤甲|Wuge Rattan Armour|3|9|a=rattan set=nanman fx=resel:water:30
mingguangyin|明光銀鎧|Silver Bright Plate|3|9|a=plate m=silver fx=refl:8
heilianyi|黑蓮法衣|Black Lotus Vestments|3|10|a=robe set=lotus st=int:8
longlin|龍鱗甲|Dragon-Scale Armour|4|10|a=scale m=gold glow=#ffd060 fx=resel:all:20,regen:2
haiwangjia|海王鱗甲|Sea King's Scale Armour|4|8|a=water m=gold ac=teal glow=#80e0ff fx=nav:15,resel:fire:20 src=sq:sea
`;
const HELMS = `
chize|赤幘|Red Headscarf|1|1|h=hb_tied hc=red set=jdtiger
moe|抹額|Brow Band|0|1|h=hb_thick hc=maroon fx=res:fear:40
tongkui|銅盔|Bronze Helm|0|1|h=hm_kettle m=bronze
huangjin|黃巾|Yellow Turban|0|2|h=hb_bandana2 hc=yellow fx=res:confuse:30
doumou|鐵兜鍪|Iron Doumou|1|2|h=hm_spangen m=iron
gejin|葛巾|Kudzu Kerchief|0|3|h=hb_kerchief hc=tan st=int:2
bintie|鑌鐵盔|Fine-Iron Helm|1|3|h=hm_nasal m=steel
chiying|赤纓盔|Red-Tassel Helm|1|3|h=hm_spangen m=iron p=hx_plume pc=red fx=mor:4
jinfanjin|錦帆頭巾|Brocade-Sail Bandana|2|4|h=hb_bandana hc=red set=jinfan
douli|斗笠|Bamboo Rain Hat|0|2|h=hm_sugarloaf m=bronze fx=resel:water:10
daoguan|道冠|Taoist Crown|2|5|h=hat_celestial hc=white st=int:4 set=healer
wolongjin|臥龍綸巾|Sleeping Dragon's Kerchief|3|5|h=hb_kerchief hc=white set=wolong st=int:6
yingzui|鷹嘴盔|Hawk-Beak Helm|2|5|h=hm_barbuta m=steel fx=crit:4
baiying|白纓盔|White-Tassel Helm|2|5|h=hm_spangen m=silver p=hx_plume pc=white set=changban
fangjin|方巾|Square Cap|1|6|h=hb_kerchief hc=black st=int:3 fx=res:sleep:40
xijiao|犀角盔|Rhino-Horn Helm|2|6|h=hm_viking m=iron fx=mor:5
shuijunli|水軍笠|Marine's Brimmed Helm|1|6|h=hm_morion m=steel fx=nav:8
heguan|鶡冠|Pheasant-Plume Cap|2|7|h=hb_cap hc=brown p=hx_plume_c pc=yellow fx=mor:6
yinkui|銀盔|Silver Helm|2|7|h=hm_armet m=silver p=hx_plume pc=white
jinkui|金盔|Golden Helm|3|7|h=hm_legion m=gold p=hx_crest pc=red fx=mor:6,res:fear:50
hutou_k|虎頭盔|Tiger-Head Helm|3|8|h=hm_maximus m=gold p=hx_plume pc=red fx=vs:inf:8
xiliangkui|西涼鐵盔|Xiliang Iron Helm|2|8|h=hm_bascinet m=iron set=xiliang
langtou|狼頭盔|Wolf-Head Helm|2|8|h=hm_barbarian m=steel fx=first:8
xiongpi|熊皮帽|Bearskin Cap|1|8|h=hm_barbarian m=bronze fx=resel:water:10
qiangjin|羌族頭巾|Qiang Turban|1|8|h=hb_hijab hc=white fx=res:fear:40
tiemian|鐵面盔|Iron-Mask Helm|3|8|h=hm_armet m=iron fx=res:confuse:50,res:fear:50
yecha|夜叉盔|Yaksha Helm|3|9|h=hm_viking m=iron p=hx_horns fx=mor:6
xiangya|象牙盔|Ivory Helm|2|9|h=hm_horned m=ceramic set=nanman
nanmanyu|南蠻羽冠|Nanman Feather Crown|2|9|h=hx_plume_c pc=green fx=first:8
qixingguan|七星冠|Seven-Star Crown|3|9|h=hb_crown m=silver set=qixing st=int:5
longshou|龍首盔|Dragon-Head Helm|4|9|h=hm_maximus m=silver p=hx_crest_c pc=blue glow=#a0d8ff fx=res:confuse:60,mor:8
heilianguan|黑蓮冠|Black Lotus Hood|3|10|h=hb_hood hc=black set=lotus
fenghuang|鳳凰盔|Phoenix Helm|4|10|h=hm_legion m=gold p=hx_wings glow=#ffd060 fx=res:all:40,mor:8
yanyunkui|燕雲虎盔|Yanyun Tiger Helm|4|8|h=hm_horned m=iron glow=#ffb070 fx=mor:8,res:fear:80 src=sq:bridge
`;
const CAPES = `
chise|赤色披風|Red Cloak|0|1|cp=c_solid cc=red
menghu|猛虎戰袍|Tiger War Cloak|2|2|cp=c_trim cc=orange set=jdtiger
suoyi|蓑衣|Straw Rain Cape|0|2|cp=c_tattered cc=tan fx=resel:water:15
zipao|紫袍|Purple Cloak|1|3|cp=c_solid cc=purple
jinpao|錦袍|Brocade Cloak|1|4|cp=c_trim cc=red fx=mor:4
jinfanpao|錦帆|Brocade-Sail Cloak|2|4|cp=c_trim cc=yellow set=jinfan
hechang|鶴氅|Crane-Feather Cloak|3|5|cp=c_solid cc=white set=wolong
baipao|白袍|White War Robe|2|5|cp=c_trim cc=white set=changban
lüpao|綠袍|Green War Robe|1|5|cp=c_solid cc=green fx=vs:cav:6
qingluo|青羅披風|Azure Gauze Cloak|1|6|cp=c_solid cc=sky fx=eva:3
shuishi|水師旗|Fleet Banner Cloak|2|6|cp=c_trim cc=navy fx=nav:10
dongfeng|東風披風|East-Wind Cloak|3|6|cp=c_tattered cc=teal fx=el:fire:12,first:8
xuanchang|玄色大氅|Black Greatcloak|1|7|cp=c_solid cc=black fx=form:fangyuan:8
huangqi|黃旗披風|Yellow Banner Cloak|2|7|cp=c_trim cc=yellow fx=form:heyi:10
jinlü|金縷披風|Gold-Thread Cloak|3|7|cp=c_trim cc=gold fx=mor:8
xiliangpao|西涼戰袍|Xiliang War Cloak|2|8|cp=c_solid cc=white set=xiliang
baihua|百花袍|Hundred-Flower Robe|3|8|cp=c_trim cc=red set=hulao
xuehu|雪狐裘|Snow-Fox Fur|3|8|cp=c_tattered cc=white fx=resel:water:20,res:sleep:40
xiongpidou|熊皮斗篷|Bear Pelt|1|8|cp=c_tattered cc=brown fx=resel:rock:10
shoupi|南蠻獸皮|Nanman Beast Hide|1|9|cp=c_tattered cc=walnut set=nanman
qixingpao|七星袍|Seven-Star Cloak|3|9|cp=c_trim cc=navy set=qixing
bawangpi|霸王披風|Overlord's Cloak|3|9|cp=c_trim cc=black set=bawang
heiliandou|黑蓮斗篷|Black Lotus Mantle|3|10|cp=c_tattered cc=black set=lotus
xinghuang|杏黃旗|Apricot-Yellow Banner|4|10|cp=c_trim cc=yellow glow=#ffe080 set=taigong fx=res:all:30
hanshi|漢室錦袍|Han Imperial Cloak|4|10|cp=c_trim cc=maroon glow=#ffd060 set=han fx=mor:8
cangbo|滄波戰旗|Banner of the Blue Waves|4|7|cp=c_trim cc=navy glow=#80c0ff fx=nav:10,first:10 src=sq:sea
zhonghu|冢虎玄袍|Crouching Tiger's Robe|4|10|cp=c_solid cc=purple glow=#c080ff fx=refl:15,tac:10 src=sq:wolf
`;
const SHIELDS = `
voyager|遠洋圓盾|Voyager's Round Shield|0|1|sh=s_round m=iron wd=oak gen=josh
mudun|木盾|Wooden Shield|0|1|sh=s_round m=iron wd=maple
tengpai|藤牌|Rattan Shield|1|2|sh=s_round m=brass wd=maple fx=resel:rock:10
tongdun|銅盾|Bronze Shield|1|2|sh=s_spartan m=bronze
tiedun|鐵盾|Iron Shield|1|3|sh=s_heater m=iron wd=walnut
xipidun|犀皮盾|Rhino-Hide Shield|1|4|sh=s_round m=bronze wd=walnut fx=ctr:6
hutoudun|虎頭盾|Tiger-Face Shield|2|4|sh=s_spartan m=gold fx=mor:4
yanwei|燕尾盾|Swallowtail Shield|1|5|sh=s_heater m=steel wd=oak
guijia|龜甲盾|Tortoise-Shell Shield|2|5|sh=s_round m=steel wd=ebony fx=resel:water:15
gangdun|鋼盾|Steel Shield|2|6|sh=s_heater_trim m=steel
shuijundun|水軍圓盾|Marine Round Shield|1|6|sh=s_round m=steel wd=walnut fx=nav:6
dalu|大櫓|Great Pavise|2|7|sh=s_scutum m=iron wd=oak fx=guard:20
qiangdun|盾牆巨盾|Wall Shield|3|7|sh=s_scutum_trim m=steel fx=guard:30,ctr:8
yindun|銀盾|Silver Shield|3|8|sh=s_kite m=silver fx=refl:8
shoumian|獸面盾|Beast-Face Shield|3|8|sh=s_scutum_trim m=bronze fx=res:fear:60,ctr:10
xiliangdun|西涼騎盾|Xiliang Rider's Shield|2|8|sh=s_kite m=iron set=xiliang
jindun|金盾|Gold Shield|3|9|sh=s_spartan m=gold fx=resel:fire:20
xiangpidun|象皮盾|Elephant-Hide Shield|2|9|sh=s_round m=bronze wd=ebony fx=resel:rock:15
wugepai|烏戈藤牌|Wuge Rattan Shield|2|9|sh=s_round m=brass wd=maple set=nanman
jiugong|九宮盾|Nine-Palace Shield|3|9|sh=s_kite m=gold fx=refl:10
xuanwu|玄武盾|Black Tortoise Shield|4|10|sh=s_spartan m=ceramic glow=#80ffd0 fx=resel:all:20,guard:25
bamendun|八門金鎖盾|Eight Gates Shield|4|8|sh=s_kite m=gold glow=#ffe070 fx=ctr:12,res:all:25 src=sq:gates
`;
const HORSES = `
shanyuema|山越矮馬|Shanyue Pony|0|1|hs=brown
zaohong|棗紅馬|Jujube Bay|1|2|hs=chestnut fx=first:5
qingcong|青驄馬|Dappled Grey|1|3|hs=dapple
huangbiao|黃驃馬|Yellow Piebald|2|4|hs=golden fx=vs:inf:6
yanzhi|胭脂馬|Rouge Horse|2|5|hs=red fx=first:8
bailong|白龍駒|White Dragon Colt|3|5|hs=white set=changban
ziliu|紫騮|Purple Bay|2|6|hs=purple fx=eva:4
qianliju|千里駒|Thousand-Li Colt|2|6|hs=brown fx=first:10
huainanma|淮南馬|Huainan Horse|1|7|hs=gray
wuhua|五花馬|Five-Flower Horse|2|7|hs=dapple fx=mor:4
qiji|騏驥|Qiji Steed|3|7|hs=chestnut fx=first:10,vs:inf:6
zhuahuang|爪黃飛電|Yellow-Claw Lightning|4|7|hs=white glow=#fff0a0 fx=first:15,eva:5
hequ|河曲馬|Hequ Horse|1|8|hs=gray fx=resel:water:8
saiwai|塞外駿馬|Steppe Steed|2|8|hs=golden fx=as:cav:8
hualiu|驊騮|Hualiu|3|8|hs=red fx=vs:inf:10
hanxue|汗血寶馬|Blood-Sweating Horse|3|8|hs=bloodbay fx=first:12
zhaoye|照夜玉獅子|Night-Shining Jade Lion|4|8|hs=white glow=#e0f0ff set=xiliang
wuyun|烏雲踏雪|Black Cloud on Snow|3|9|hs=black fx=eva:5,first:8
lüer|綠耳|Green Ear|3|9|hs=sage fx=vs:inf:10
wuzhui|烏騅|Wuzhui|4|9|hs=black glow=#c080ff set=bawang
daoli|盜驪|Daoli|3|10|hs=black fx=first:10,crit:4
feihuang|飛黃|Feihuang|4|10|hs=golden glow=#ffe070 fx=first:15,as:cav:10
tayun|踏雲駒|Cloud-Treader|4|7|hs=white glow=#c8f0ff fx=first:18,eva:6 src=sq:rescue
`;
const ACCS = `
zhujian|竹簡|Bamboo Slips|0|1|ic=Scroll st=int:2
hushenfu|護身符|Warding Charm|0|1|ic=Letter2 n=n_amulet fx=res:fear:40
wuzhu|五銖錢串|String of Wuzhu Coins|0|2|ic=Coin fx=steal:10
pinganfu|平安符|Safe-Journey Charm|0|2|ic=Letter3 fx=scout:1
tongjing|青銅鏡|Bronze Mirror|1|2|ic=SilverCup fx=refl:6
shuangyu|雙魚佩|Twin-Fish Pendant|1|3|ic=GemGreen n=n_jade fx=res:sleep:40
taishouyin|太守印|Prefect's Seal|1|3|ic=Stamp st=lead:5
jdhufu|江東虎符|Tiger Tally of Jiangdong|2|3|ic=GoldKey set=jdtiger st=lead:4
tiehubi|鐵護臂|Iron Bracers|1|3|ic=BarIron br st=atk:4
fozhu|佛珠|Prayer Beads|1|4|ic=Nut n=n_beads fx=res:confuse:50
jindaigou|金帶鉤|Gold Belt Hook|1|4|ic=BarGold bl=belt_formal bc=gold st=lead:3,def:3
touzi|骰子|Gambler's Dice|1|4|ic=Dice fx=crit:6
tongling|銅鈴|Gan Ning's Bells|2|4|ic=GoldCoin set=jinfan fx=first:6
yudai|玉帶|Jade Belt|2|5|ic=GemGreen bl=belt_formal bc=green st=lead:4,int:3
jinnang|錦囊|Brocade Pouch|2|5|ic=Bag fx=cost:12
yudi|玉笛|Jade Flute|2|5|ic=PanFlute fx=mor:6
hulu|藥葫蘆|Healer's Gourd|2|5|ic=Gourd set=healer fx=regen:2
huatuozhen|華佗針|Hua Tuo's Needles|3|5|ic=Feather fx=heal:15,res:poison:60
shanhu|珊瑚串|Coral Beads|1|6|ic=GemRed n=n_beads fx=nav:6
zhinanyu|指南魚|South-Pointing Fish|1|6|ic=Fish fx=nav:8,scout:1
qianxingban|牽星板|Star-Sighting Board|2|6|ic=Book fx=nav:12
yemingzhu|夜明珠|Night-Shining Pearl|3|6|ic=SilverCoin n=n_pearl fx=res:sleep:50,crit:4
wuqintu|五禽圖|Five Animals Chart|2|6|ic=ScrollPlant fx=regen:2,st:spd
jiulongbei|九龍玉杯|Nine-Dragon Jade Cup|3|7|ic=GoldCup fx=mor:8
longpei|龍紋玉佩|Dragon Jade Pendant|3|7|ic=GemGreen n=n_jade fx=res:all:25
mengde|孟德新書|Mengde's New Book|3|7|ic=Book st=int:6 fx=tac:8
xiangyahu|象牙笏|Ivory Tablet|2|7|ic=Bone st=int:5,lead:2
jinbihuan|金臂環|Gold Armlet|2|7|ic=BarGold cu st=atk:5
hongbaoshi|紅寶石|Ruby Pendant|2|7|ic=GemRed n=n_ruby fx=el:fire:10
fengpei|鳳紋玉佩|Phoenix Jade Pendant|3|8|ic=GemYellow n=n_jade fx=heal:10,res:curse:50
heshibi|和氏璧|He's Jade Disc|4|8|ic=GemGreen n=n_jade glow=#a0ffb0 set=han fx=res:all:30,sp:6
shiman|獅蠻寶帶|Lion-Barbarian Belt|3|8|ic=BarGold bl=belt_double bc=gold set=hulao st=atk:4
liutao|太公六韜|The Six Secret Teachings|3|8|ic=ScrollRock set=taigong st=int:5,lead:3
langyafu|狼牙符|Wolf-Fang Charm|2|8|ic=Bone set=xiliang
jiangjunyin|將軍印|General's Seal|3|8|ic=Stamp st=lead:8
huangshi|黃石天書|Yellow Stone Book|4|9|ic=ScrollThunder st=int:8 fx=tac:10,cost:10
suihou|隋侯珠|Marquis Sui's Pearl|4|9|ic=SilverCoin n=n_pearl glow=#e0f0ff fx=regen:3,res:all:25
qixingdeng|七星燈|Seven-Star Lamp|4|9|ic=Hourglass set=qixing fx=sp:8
leizhuyao|擂主金腰帶|Champion's Golden Belt|4|6|ic=BarGold bl=belt_formal bc=gold glow=#ffe070 st=atk:4,def:4 fx=mor:8,ctr:10 src=sq:arena
huchijing|虎癡護心鏡|Tiger Fool's Heart Mirror|4|9|ic=SilverCoin n=n_amulet glow=#e0e0ff st=def:8 fx=res:all:30,ctr:10 src=sq:tigers
fengyu|鳳凰羽|Phoenix Feather|3|9|ic=Feather fx=eva:6,first:8
heilianzhu|黑蓮珠|Black Lotus Pearl|3|10|ic=GemPurple n=n_pearl set=lotus
zhaoyao|照妖鏡|Demon-Revealing Mirror|3|10|ic=GoldCup fx=refl:12,res:curse:70
`;
// manuals: read to raise a general's numbers for good (boost), or to learn a tactic or formation
const BOOKS = `
wuqinxi|五禽戲|The Five Animals' Play|1|2|ic=Scroll boost=lead:2
jiuzhang|九章算術|Nine Chapters on Reckoning|1|3|ic=ScrollEmpty boost=int:2
wuzi|吳子|Wuzi|2|4|ic=ScrollRock boost=lead:3
simafa|司馬法|The Methods of the Sima|2|5|ic=Scroll boost=lead:2,int:1
shanhaijing|山海經|Classic of Mountains and Seas|2|6|ic=ScrollPlant boost=spd:3
weiliaozi|尉繚子|Wei Liaozi|2|7|ic=ScrollFire boost=str:2,lead:1
sunbin|孫臏兵法|Sun Bin's Art of War|3|7|ic=ScrollFire boost=int:3
mozi|墨子城守|Mozi on Holding Walls|2|8|ic=ScrollRock boost=lead:3
sanlue|三略|The Three Strategies|3|8|ic=ScrollIce boost=int:2,lead:2
huangdi|黃帝內經|The Yellow Emperor's Classic|3|9|ic=ScrollPlant boost=str:2,spd:2
dunjia|遁甲天書|Book of the Hidden Stems|3|9|ic=ScrollIce boost=int:3,spd:2
taipingys|太平要術|Essentials of the Great Peace|4|10|ic=ScrollThunder boost=int:5
chunqiu|春秋左傳|Zuo's Spring and Autumn|4|9|ic=Book boost=lead:5,str:3 src=sq:guanyu
`;
// war relics: used once in each battle from the Item order, never used up
const RELICS = `
zhangu|夔牛戰鼓|Kui-Hide War Drum|2|3|ic=Hammer relic=drum
huoniu|火牛陣圖|Fire-Oxen Chart|2|4|ic=ScrollFire relic=fireox
qingxinling|清心鈴|Clear-Mind Bell|2|5|ic=GoldCoin relic=bell
jinnangmiao|錦囊妙計|Brocade-Pouch Stratagem|3|5|ic=Bag relic=pouch
muniu|木牛流馬|Wooden Ox|3|6|ic=CrateEmpty relic=ox
zhinanche|指南車|South-Pointing Chariot|3|7|ic=Hourglass relic=chariot
pili|霹靂車|Thunderclap Catapult|3|8|ic=Rock relic=catapult
baqian|八陣石|Stone Sentinel Maze|3|9|ic=Rock relic=maze
huanhun|還魂香|Soul-Calling Incense|4|9|ic=LifePot relic=incense
qixingtan|七星壇|Altar of the Seven Stars|4|10|ic=Hourglass relic=altar
`;
export const RELIC_FX = {
  drum: ['全軍士氣+20，攻擊上升三回合。', 'Morale +20 and more attack for three turns.'],
  fireox: ['火牛衝陣：火燒全部敵軍。', 'Burning oxen charge: fire on every enemy.'],
  bell: ['解除全軍的混亂、昏睡、恐懼、封策與詛咒。', 'Lifts confusion, sleep, fear, sealed ploys and curses from the whole army.'],
  pouch: ['恢復策略值20。', 'Restores 20 strategy points.'],
  ox: ['補給送到：全軍兵力恢復15%。', 'Supplies arrive: 15% troops to the whole army.'],
  chariot: ['驅散江霧，天氣轉晴，全軍速度上升。', 'Clears fog, clears the sky and speeds the army.'],
  catapult: ['落石砸向全部敵軍，可破鐵壁。', 'Stones on every enemy; breaks an iron wall.'],
  maze: ['全軍防禦上升三回合。', 'More defence for the whole army for three turns.'],
  incense: ['讓一名敗走的武將以三成兵力歸隊。', 'A routed general returns with 30% troops.'],
  altar: ['祭起東風，火計與弓箭增強，打斷敵人的火船。', 'Calls the east wind: fire and arrows grow, fire ships turn back.'],
};
// sets: pieces worn by one general; bonuses at 2, 3 and 4 pieces
export const SETS = {
  jdtiger: { zh: '江東猛虎', en: 'Tiger of Jiangdong', b: { 2: 'mor:6', 3: 'vs:inf:10', 4: 'first:20' } },
  jinfan: { zh: '錦帆', en: 'Brocade Sails', b: { 2: 'nav:10', 3: 'first:12', 4: 'crit:6' } },
  wolong: { zh: '臥龍', en: 'Sleeping Dragon', b: { 2: 'tac:8', 3: 'cost:15', 4: 'res:all:30' } },
  changban: { zh: '長坂單騎', en: 'Rider of Changban', b: { 2: 'ctr:12', 3: 'eva:6', 4: 'regen:3' } },
  hulao: { zh: '虎牢飛將', en: 'Flying General of Hulao', b: { 2: 'crit:5', 3: 'mor:8', 4: 'first:25' } },
  xiliang: { zh: '西涼鐵騎', en: 'Xiliang Iron Horse', b: { 2: 'as:cav:8', 3: 'vs:inf:10', 4: 'first:20' } },
  lotus: { zh: '黑蓮', en: 'Black Lotus', b: { 2: 'res:curse:60', 3: 'regen:3', 4: 'tac:12' } },
  qixing: { zh: '七星', en: 'Seven Stars', b: { 2: 'el:thunder:15', 3: 'res:all:25', 4: 'sp:8' } },
  nanman: { zh: '南蠻王', en: 'Nanman King', b: { 2: 'regen:2', 3: 'resel:water:25', 4: 'ctr:15' } },
  healer: { zh: '神醫', en: 'Divine Healer', b: { 2: 'heal:10', 3: 'regen:2', 4: 'heal:15' } },
  bawang: { zh: '西楚霸王', en: 'Overlord of Chu', b: { 2: 'crit:6', 3: 'first:20' } },
  taigong: { zh: '太公', en: 'Grand Duke Jiang', b: { 2: 'tac:8', 3: 'refl:12' } },
  han: { zh: '漢室', en: 'House of Han', b: { 2: 'mor:8', 3: 'sp:6' } },
};
// the famous pieces that were already in the game (kept with their numbers and places)
const OLD = {
  yitian: [4, 2, { src: { t: 'chest', map: 'tianzhu/f2', chest: 'tianzhu_f2_1' } }], qinggang: [4, 10, { src: { t: 'chest', map: 'wuxia/f2', chest: 'wuxia_f2_1' }, set: 'changban' }],
  longdan: [4, 5, { src: { t: 'chest', map: 'jiuyi/f3', chest: 'jiuyi_f3_3' } }], hutou: [4, 8, {}], qinglong: [4, 7, {}], fangtian: [4, 8, { set: 'hulao' }], yangyouji: [4, 8, { src: { t: 'secret', x: 144, y: 140 } }],
  liannu: [4, 5, { src: { t: 'story', zh: '隆中的諸葛亮所贈', en: 'a gift from Zhuge Liang at Longzhong' } }], starstaff: [3, 9, {}], goldarmour: [4, 10, { src: { t: 'secret', x: 192, y: 224 } }], beastarmour: [4, 10, {}],
  zijinguan: [4, 8, { src: { t: 'secret', x: 280, y: 120 }, set: 'hulao' }], dilu: [4, 5, {}], jueying: [4, 8, { src: { t: 'secret', x: 300, y: 60 } }], chitu: [4, 8, { src: { t: 'secret', x: 124, y: 80 }, set: 'hulao' }],
  sunzi: [4, 8, { src: { t: 'secret', x: 236, y: 148 } }], qingnang: [3, 9, { src: { t: 'secret', x: 120, y: 240 }, set: 'healer' }], compass: [3, 1, { src: { t: 'chest', map: 'shanyue/f2', chest: 'shanyue_f2_3' } }],
  sextant: [3, 6, { src: { t: 'story', zh: '夷洲的島民所贈', en: 'a gift from the islanders of Yizhou' } }], dragoncape: [4, 10, { src: { t: 'chest', map: 'wuxia/f3', chest: 'wuxia_f3_3' } }],
  bk_stun: [3, 2, { src: { t: 'chest', map: 'tianzhu/f1', chest: 'tianzhu_f1_3' } }], bk_bagua: [4, 9, {}], bk_inferno: [4, 10, { src: { t: 'chest', map: 'wuxia/f1', chest: 'wuxia_f1_3' } }],
};

// ---------- reading the table ----------
const SECTIONS = [['weapon', WEAPONS], ['armour', ARMOUR], ['helm', HELMS], ['cape', CAPES], ['shield', SHIELDS], ['horse', HORSES], ['treasure', ACCS], ['book', BOOKS], ['relic', RELICS]];
export const TREASURE_KIND = { weapon: ['兵器', 'Weapons'], armour: ['鎧甲', 'Armour'], helm: ['頭盔', 'Helms'], cape: ['披風', 'Capes'], shield: ['盾牌', 'Shields'], horse: ['名馬', 'Horses'], treasure: ['飾品', 'Accessories'], book: ['兵書', 'Manuals'], relic: ['戰具', 'War relics'] };
export function parseFx(s) {
  const fx = {};
  if (!s) return fx;
  for (const part of s.split(',')) {
    const a = part.split(':');
    const k = a[0];
    if (k === 'vs' || k === 'el' || k === 'res' || k === 'resel' || k === 'form' || k === 'as') { const o = fx[k] || (fx[k] = {}); o[a[1]] = (o[a[1]] || 0) + (+a[2]) / 100; }
    else if (k === 'scout') fx.scout = (fx.scout || 0) + 1;
    else if (k === 'mor' || k === 'sp' || k === 'kill') fx[k] = (fx[k] || 0) + (+a[1]);
    else if (k === 'st') { /* a stat hint only */ }
    else fx[k] = (fx[k] || 0) + (+a[1]) / 100;
  }
  return fx;
}
function codes(s) {
  const o = {};
  for (const kv of s.trim().split(/\s+/)) { if (!kv) continue; const i = kv.indexOf('='); if (i < 0) o[kv] = true; else o[kv.slice(0, i)] = kv.slice(i + 1); }
  return o;
}
const ARMOUR_LOOK = {
  robe: () => ({ robe: true }), leather: (m, c) => ({ armour: 'a_leather', ametal: m, acloth: c || 'walnut' }), chain: (m) => ({ armour: 'a_chain', ametal: m, arms: 'gloves' }),
  lamellar: (m, c) => ({ armour: 'a_legion', ametal: m, legs2: 'l_legion', acloth: c }), scale: (m) => ({ armour: 'a_legion', ametal: m, shoulders: 'sh_legion', legs2: 'l_legion', arms: 'bracers' }),
  plate: (m) => ({ armour: 'a_plate', ametal: m, shoulders: 'sh_pauldrons', arms: 'arm_armour', feet: 'f_armour' }), rattan: () => ({ armour: 'a_leather', acloth: 'tan', ametal: 'brass', shoulders: 'sh_mantal', mantal: 'tan' }),
  water: (m, c) => ({ armour: 'a_leather', ametal: m, acloth: c || 'navy', shoulders: 'sh_mantal', mantal: c || 'navy' }),
};
const STAT = (s) => { const o = {}; if (!s) return o; for (const kv of s.split(',')) { const [k, v] = kv.split(':'); o[k] = +v; } return o; };
export const TREASURES = [];
export function addTreasures(item, I) {
  for (const [kind, block] of SECTIONS) {
    for (const line of block.trim().split('\n')) {
      const [id, zh, en, r, ch, rest] = line.split('|');
      const rar = +r, c = +ch, k = RMUL[rar], o = codes(rest || '');
      const it = { rar, ch: c, tr: true, rare: rar >= 3, price: 0, fx: parseFx(o.fx), set: o.set || null, icon: o.ic || null, look: {} };
      const st = STAT(o.st);
      if (kind === 'weapon') {
        it.cat = o.c;
        const staff = o.c === 'staff';
        it.atk = Math.round(W_ATK[c] * k * (staff ? 0.55 : o.c === 'twin' ? 0.95 : 1));
        if (staff) it.int = Math.round((3 + c * 1.6) * k);
        it.look = { weapon: o.w, wmetal: o.m, wwood: o.wd, twin: o.c === 'twin' || undefined, glow: o.glow };
      } else if (kind === 'armour') {
        it.def = Math.round(A_DEF[c] * k * (o.a === 'robe' ? 0.5 : o.a === 'rattan' ? 1.15 : 1));
        if (o.a === 'robe') it.int = (it.int || 0) + Math.round(2 + c * 0.6);
        if (o.a === 'rattan') it.weakFire = true;
        if (o.a === 'water') it.naval = true;
        it.look = { ...ARMOUR_LOOK[o.a](o.m, o.ac), glow: o.glow, atype: o.a };
      } else if (kind === 'helm') {
        it.def = Math.round(H_DEF[c] * k * (/^h[bx]_|^hat/.test(o.h) ? 0.5 : 1));
        it.look = { helm: o.h, hmetal: o.m, hcloth: o.hc || o.pc, plume: o.p, pcol: o.pc, glow: o.glow };
      } else if (kind === 'cape') {
        it.def = Math.round((1 + c * 0.7) * k); it.lead = Math.round((1 + c * 0.45) * k);
        it.look = { cape: o.cp, capeCol: o.cc, glow: o.glow };
      } else if (kind === 'shield') {
        it.def = Math.round((2 + c * 1.3) * k);
        it.look = { shield: o.sh, smetal: o.m, swood: o.wd, glow: o.glow };
      } else if (kind === 'horse') {
        const sp = [0, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14][c];
        it.spd = Math.round(sp * k); it.atk = Math.round(sp * 0.75 * k); it.horse = o.hs; it.look = { glow: o.glow };
      } else if (kind === 'treasure') {
        const base = Math.round((1.5 + c * 0.5) * k);
        if (!o.st) { it[['lead', 'int', 'def', 'spd', 'atk'][(id.length + c) % 5]] = base; }
        it.look = { neck: o.n, belt: o.bl, bcol: o.bc, bracers: !!o.br, cuffs: !!o.cu, glow: o.glow };
      } else if (kind === 'book') {
        it.boost = STAT(o.boost);
      } else if (kind === 'relic') {
        it.relic = o.relic;
      }
      for (const [s, v] of Object.entries(st)) it[s] = (it[s] || 0) + v;
      if (o.gen) it.gen = o.gen;
      // a fixed source written in the line: src=sq:<trial> is the reward of that trial (sidequests.js)
      if (o.src && o.src.startsWith('sq:')) it.fixedSrc = { t: 'sq', q: o.src.slice(3) };
      item(id, zh, en, kind, 0, it);
    }
  }
  // the famous pieces already in the game join the list
  for (const [id, [rar, ch, extra]] of Object.entries(OLD)) {
    const it = I[id]; if (!it) continue;
    Object.assign(it, { tr: true, rar, ch, rare: rar >= 3, fx: it.fx || {}, set: extra.set || null, fixedSrc: extra.src || null });
  }
  // famous extras on the old pieces
  const ex = { yitian: 'crit:6,vs:cav:10', qinggang: 'crit:8,ctr:10', longdan: 'ctr:12,first:10', hutou: 'vs:inf:12,first:10', qinglong: 'mor:10,vs:all:10', fangtian: 'vs:all:12,crit:5', yangyouji: 'crit:10,vs:cav:10', liannu: 'first:8', starstaff: 'tac:10,el:thunder:10',
    goldarmour: 'resel:all:15', beastarmour: 'mor:8,res:fear:70', zijinguan: 'mor:6', dilu: 'eva:8,first:10', jueying: 'first:15,eva:5', chitu: 'first:20,vs:inf:10', sunzi: 'tac:10,cost:10', qingnang: 'heal:15', compass: 'scout:1', sextant: 'nav:12', dragoncape: 'mor:8,res:all:20' };
  for (const [id, s] of Object.entries(ex)) if (I[id]) I[id].fx = parseFx(s);
  for (const it of Object.values(I)) if (it.tr) TREASURES.push(it.id);
  assignSources(I);
}
let item = null;
export function bindItem(f) { item = f; }

// ---------- where each treasure is found ----------
// leaders who give a treasure when first beaten, by chapter
export const BOSS_BY_CH = { 1: ['yanbaihu', 'zulang'], 2: ['liuxun', 'tianzhu'], 3: ['qua', 'moling', 'sunhao'], 4: ['xisai', 'huangzu'], 5: ['changsha', 'caimao', 'jiuyi'], 6: ['fleet1', 'fleet2', 'pirates'],
  7: ['yuanshu', 'guandu', 'yuanshao'], 8: ['hulao', 'tongguan', 'dongzhuo'], 9: ['jianye2', 'jiyuan', 'zhangren', 'yanwu'], 10: ['lotus1', 'lotus2', 'yuji1'] };
export const CAVE_FLOORS_T = { shanyue: 2, tianzhu: 2, jiuyi: 3, wuxia: 4 };
// side quests: deliver (bring things), find (a lost thing in a chest somewhere), defeat (a named bandit general who
// waits in a region after you accept)
export const QUESTS = {
  q_fisher: { ch: 1, place: 'haiyan', type: 'deliver', need: { salve: 3 }, who: ['老漁夫', 'Old Fisherman'], ask: ['我老伴摔傷了腿……能給我三帖傷藥嗎？', 'My wife hurt her leg... could you spare three salves?'], thanks: ['好人有好報！這是我年輕時在海裡撈到的東西。', 'Kindness comes back! Here is something I pulled from the sea when I was young.'] },
  q_wine: { ch: 2, place: 'juchao', type: 'deliver', need: { goodwine: 1 }, who: ['老秀才', 'Old Scholar'], ask: ['臨死前只想再喝一口杜康酒……', 'Before I die I would taste Dukang wine once more...'], thanks: ['好酒！好酒！這個送你，我留著也沒用了。', 'Fine wine! Take this; it is no use to an old man.'] },
  q_heirloom: { ch: 3, place: 'qua', type: 'find', item: 'q_heirloom', at: 'dongye', who: ['寡婦', 'Widow'], ask: ['亡夫的傳家玉珮被海盜搶去，藏在東冶港……', 'My late husband\'s jade heirloom was stolen by pirates and hidden in Dongye harbour...'], thanks: ['真的找回來了！請收下這個，聊表謝意。', 'You found it! Please, take this as my thanks.'] },
  q_bandit1: { ch: 4, place: 'poyang', type: 'defeat', region: 'yuzhang', foe: 'g210', who: ['里長', 'Village Head'], ask: ['有個叫「黑風」的山賊頭目在豫章一帶燒殺擄掠，求您除掉他！', 'A bandit chief called Black Wind burns and loots around Yuzhang. Please, put an end to him!'], thanks: ['黑風死了！這是從他賊窩裡搜出來的寶物。', 'Black Wind is dead! This was found in his den.'] },
  q_silk: { ch: 5, place: 'jiangling', type: 'deliver', need: { silk: 1 }, who: ['繡娘', 'Embroiderer'], ask: ['我要為新娘繡嫁衣，缺一匹蜀錦……', 'I am sewing a wedding gown and need one bolt of Shu brocade...'], thanks: ['太美了！這件東西是我祖母傳下來的，送給你。', 'Beautiful! This came down from my grandmother; it is yours.'] },
  q_pearl: { ch: 6, place: 'yizhouisle', type: 'deliver', need: { pearl: 1 }, who: ['島上的巫祝', 'Island Shaman'], ask: ['海神要一顆南海明珠，否則風浪不止。', 'The sea god wants a South Sea pearl, or the storms will not end.'], thanks: ['風浪平息了。海神還你一件寶物。', 'The sea is calm. The sea god gives you a treasure in return.'] },
  q_seal: { ch: 7, place: 'pengcheng', type: 'find', item: 'q_seal', at: 'linzi', who: ['老吏', 'Old Clerk'], ask: ['彭城的官印被盜，聽說被帶到臨淄去了。', 'Pengcheng\'s seal of office was stolen; they say it was taken to Linzi.'], thanks: ['官印回來了！這是彭城的謝禮。', 'The seal is back! Pengcheng thanks you with this.'] },
  q_bandit2: { ch: 8, place: 'tianshui', type: 'defeat', region: 'liangzhou', foe: 'g240', who: ['商隊頭領', 'Caravan Master'], ask: ['涼州的馬賊「沙狼」截了我們三次商隊！', 'The horse thief Sand Wolf has robbed our caravans three times in Liang!'], thanks: ['沙狼伏誅！這是商隊湊出來的謝禮。', 'Sand Wolf is dead! The caravan put this together for you.'] },
  q_bandit3: { ch: 9, place: 'jiangzhou', type: 'defeat', region: 'yizhou', foe: 'g260', who: ['獵戶', 'Hunter'], ask: ['益州山裡有個黑蓮教的逃將，殺了我的兄弟……', 'A Black Lotus deserter hides in the hills of Yi; he killed my brother...'], thanks: ['大仇得報。請收下這個。', 'My brother is avenged. Please take this.'] },
};
export const BANDIT_NAME = { q_bandit1: ['黑風', 'Black Wind'], q_bandit2: ['沙狼', 'Sand Wolf'], q_bandit3: ['逃將', 'the Deserter'] };
// the treasure merchant: where he sets up his stall, and from which chapter
export const MERCHANTS = { wu: 2, chaisang: 4, xiangyang: 5, xuchang: 7, changan: 8, chengdu: 9, baidi: 10 };
const h3 = (a, b, c) => { let x = (a * 374761393 + b * 668265263 + c * 1442695041) | 0; x = Math.imul(x ^ (x >>> 13), 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
export const SRC = {};
export function assignSources(I) {
  const byCh = {};
  for (const id of TREASURES) { const it = I[id]; if (it.fixedSrc) { SRC[id] = it.fixedSrc; continue; } if (it.gen) { SRC[id] = { t: 'gen', id: it.gen }; continue; } (byCh[it.ch] || (byCh[it.ch] = [])).push(it); }
  for (let c = 1; c <= 10; c++) {
    const regs = Object.keys(REGIONS).filter((k) => REGIONS[k][4] === c);
    const places = Object.keys(PLACES).filter((p) => regs.includes(PLACES[p][5]) && !PLACES[p][6]);
    const boss = (BOSS_BY_CH[c] || []).map((b) => ({ t: 'boss', id: b }));
    const caves = []; for (const p of places) if (CAVE_FLOORS_T[p]) for (let f = 1; f <= CAVE_FLOORS_T[p]; f++) caves.push({ t: 'chest', map: `${p}/f${f}` });
    const halls = places.filter((p) => ['capital', 'castle', 'fort'].includes(PLACES[p][4])).map((p) => ({ t: 'chest', map: p + '/hall' }));
    const shrines = places.filter((p) => PLACES[p][4] === 'temple' && p !== 'wuxia').map((p) => ({ t: 'chest', map: p + '/shrine' }));
    const towns = places.filter((p) => PLACES[p][4] !== 'cave' && p !== 'wuxia').map((p) => ({ t: 'chest', map: p }));
    const secret = (k) => places.filter((p) => PLACES[p][4] !== 'cave').map((p, i) => {
      const P = PLACES[p], R = REGIONS[P[5]];
      const a = h3(i, k, c) * Math.PI * 2, d = 8 + h3(k, i, c + 3) * 8;
      return { t: 'secret', x: Math.round(P[2] + (R[2] - P[2]) * 0.4 + Math.cos(a) * d), y: Math.round(P[3] + (R[3] - P[3]) * 0.4 + Math.sin(a) * d) };
    });
    const drops = regs.map((r) => ({ t: 'drop', region: r }));
    const quests = Object.entries(QUESTS).filter(([, q]) => q.ch === c).map(([q]) => ({ t: 'quest', q }));
    const merch = Object.values(MERCHANTS).some((ch) => ch <= c) ? [{ t: 'merchant' }, { t: 'merchant' }] : [];
    const shop = [{ t: 'shop' }, { t: 'shop' }];
    const order = [...boss, ...caves, ...secret(0).slice(0, Math.ceil(places.length / 2)), ...halls, ...shrines, ...quests, ...merch, ...drops, ...towns, ...shop,
      ...secret(1), ...caves, ...drops, ...halls, ...towns, ...secret(2), ...drops, ...towns, ...secret(3), ...secret(4)].map((s) => ({ ...s }));
    const used = new Array(order.length).fill(false);
    const list = (byCh[c] || []).slice().sort((a, b) => b.rar - a.rar || (a.id < b.id ? -1 : 1));
    // horses are not kept in chests
    const take = (ok) => { const i = order.findIndex((s, k) => !used[k] && ok(s)); if (i < 0) return null; used[i] = true; return order[i]; };
    for (const it of list.filter((x) => x.kind === 'horse')) SRC[it.id] = ['drop', 'merchant', 'shop', 'quest', 'boss', 'secret'].reduce((got, t) => got || take((s) => s.t === t), null) || { t: 'merchant' };
    for (const it of list.filter((x) => x.kind !== 'horse')) SRC[it.id] = take(() => true) || { t: 'merchant' };
  }
  // each place to explore keeps one treasure of its chapter: taken from a street chest in a town of the same
  // chapter (deepest floor for caves, behind the waterfall, in the crypt, at the top of a tower)
  const DEEP_MAP = { cave: (id, sc) => `${id}/f${sc.floors || 2}`, falls: (id) => `${id}/f1`, ruins: (id) => `${id}/f1`, lighthouse: (id) => `${id}/top`, tower: (id) => `${id}/top` };
  for (const [id, P] of Object.entries(PLACES)) {
    const sc = P[6]; if (!sc) continue;
    const ch = REGIONS[P[5]][4];
    const cand = TREASURES.filter((t) => I[t].ch === ch && SRC[t] && SRC[t].t === 'chest' && !SRC[t].map.includes('/') && !(PLACES[SRC[t].map] && PLACES[SRC[t].map][6]) && I[t].kind !== 'horse');
    if (!cand.length) continue;
    const t = cand[Math.floor(h3(id.length, id.charCodeAt(0), ch) * cand.length)];
    const f = DEEP_MAP[sc.t] || DEEP_MAP[P[4]];
    SRC[t] = { t: 'chest', map: f ? f(id, sc) : id };
  }
  // number the chests that share a map
  const n = {};
  for (const id of TREASURES) { const s = SRC[id]; if (s.t === 'chest' && !s.chest) { s.k = n[s.map] = (n[s.map] || 0) + 1; s.chest = 'tr_' + id; } }
}
export const srcOf = (id) => SRC[id];

