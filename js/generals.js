// The 500 generals: about a hundred and thirty famous people of the age (stats in their historical spirit,
// looks and skills of their own), four travellers from beyond the western sea, the sect's own commanders,
// and the rest made by a seeded name generator from historical surnames and given-name characters.
// The same seed always gives the same 500.
import { L } from './i18n.js?v=10';
import { assignTraits } from './traits.js?v=10';

// ---------- looks ----------
// a look is a short string: "b=m s=light hd=m h=topknot hc=black bd=beard t=kimono tc=red l=wide lc=navy f=boots fc=black c=solid cc=red hat=tied hatc=red g=patch belt=sash bc=gold"
const PFX = { h: 'h_', bd: '', t: 't_', l: 'l_', f: 'f_', c: 'c_', hat: '', g: 'g_', belt: 'belt_', hd: 'head_', brow: 'brow_', n: 'n_', x: '' };
export function parseLook(s) {
  const o = { b: 'male', s: 'light', hd: 'head_m', hc: 'black' };
  for (const kv of s.split(/\s+/)) {
    if (!kv) continue;
    const [k, v] = kv.split('=');
    if (k === 'b') o.b = { m: 'male', u: 'muscular', f: 'female' }[v] || v;
    else if (PFX[k] !== undefined) o[k] = v === 'none' ? null : (k === 'bd' ? (v.startsWith('m_') || v.startsWith('b_') ? v : 'b_' + v) : k === 'hat' ? v : PFX[k] + v);
    else o[k] = v;
  }
  if (o.b === 'female' && o.hd === 'head_m') o.hd = 'head_f';
  return o;
}

// ---------- the famous ----------
// [id, 中文, English, STR, INT, LEAD, SPD, unit, faction, look, gear (weapon armour helm horse treasure), skills, extra]
// factions: sun (the player), sun_hao (the usurper), shanyue, liu_xun, huang_zu, cai_mao, liu (Liu Bei), cao, yuan, dong, liu_zhang, nanman, qiang, gongsun, shi (Jiao), sect, free
const F = [
  ['sunquan', '孫權', 'Sun Quan', 68, 82, 92, 72, 'cav', 'sun', 'b=m s=light h=topknot_s hc=lpcr:brown bd=b_trimmed brow=thick t=kimono tc=red l=wide lc=maroon f=boots fc=black c=trim cc=red belt=sash bc=gold', 'ironsword leather ironhelm warhorse', 'jili haoling', { tac: ['guwu'] }],
  ['sunjian', '孫堅', 'Sun Jian', 88, 72, 90, 80, 'cav', 'sun', 'b=u s=amber h=topknot hc=lpcr:charcoal bd=b_medium t=kimono tc=red l=wide lc=maroon f=boots c=solid cc=red', 'guding zhajia plumehelm warhorse', 'yongmeng tuji', { guest: true }],
  ['sunce', '孫策', 'Sun Ce', 92, 70, 92, 88, 'cav', 'sun', 'b=u s=light h=high_pony hc=lpcr:charcoal bd=b_stubble t=kimono tc=red l=wide lc=maroon f=boots c=trim cc=red', 'shuangji yulin plumehelm xiliang', 'yongmeng tuji lianji', { guest: true }],
  ['shangxiang', '孫尚香', 'Sun Shangxiang', 78, 64, 70, 90, 'arc', 'sun', 'b=f s=light hd=f h=high_pony hc=lpcr:black t=kimono tc=red l=pants lc=maroon f=boots fc=brown belt=sash bc=gold', 'shortbow leather headband none scarf', 'shenshe jisu', {}],
  ['zhouyu', '周瑜', 'Zhou Yu', 76, 96, 96, 78, 'nav', 'sun', 'b=m s=light h=long_tied hc=black t=kimono tc=white l=wide lc=red f=boots c=trim cc=red', 'guding waterarmour plumehelm', 'shuizhan guimou', { tac: ['huoji', 'dahuo', 'liehuo', 'hufeng'] }],
  ['lusu', '魯肅', 'Lu Su', 56, 92, 86, 62, 'inf', 'sun', 'b=m s=amber hd=plump h=topknot hc=black bd=b_trimmed t=robe tc=teal l=wide lc=charcoal f=shoes', 'fan daopao lunjin', 'shensuan fanji', { tac: ['jianshou', 'zhiliao'] }],
  ['lumeng', '呂蒙', 'Lü Meng', 82, 88, 88, 76, 'nav', 'sun', 'b=u s=amber h=topknot_s hc=black bd=b_beard brow=thick t=kimono tc=maroon l=wide lc=black f=boots', 'longspear zhajia ironhelm', 'shuizhan yexi', {}],
  ['luxun', '陸遜', 'Lu Xun', 70, 95, 92, 76, 'inf', 'sun', 'b=m s=light h=parted hc=black t=kimono tc=sky l=wide lc=navy f=boots c=solid cc=white', 'guding chain lunjin', 'guimou gongjiang', { tac: ['huoji', 'dahuo', 'liehuo'] }],
  ['ganning', '甘寧', 'Gan Ning', 94, 62, 84, 92, 'nav', 'sun', 'b=u s=bronze h=spiked hc=black bd=b_stubble t=sleeveless tc=orange l=pants lc=black f=sandals belt=sash bc=red', 'shuangji leather headband', 'yexi lianji shuizhan', {}],
  ['taishici', '太史慈', 'Taishi Ci', 93, 64, 82, 86, 'arc', 'sun', 'b=m s=amber h=topknot hc=black bd=b_beard t=kimono tc=forest l=wide lc=black f=boots c=solid cc=green', 'irontaibow zhajia kettlehelm warhorse', 'shenshe lianji', {}],
  ['zhoutai', '周泰', 'Zhou Tai', 90, 48, 76, 70, 'inf', 'sun', 'b=u s=bronze h=buzz hc=black bd=b_stubble t=sleeveless tc=brown l=wide lc=charcoal f=boots belt=leather', 'ironsword leather', 'buqu huwei', {}],
  ['chengpu', '程普', 'Cheng Pu', 82, 70, 86, 68, 'cav', 'sun', 'b=m s=light hd=old h=topknot hc=gray bd=b_winter t=kimono tc=red l=wide lc=maroon f=boots', 'ironji zhajia ironhelm warhorse', 'tiebi weifeng', {}],
  ['huanggai', '黃蓋', 'Huang Gai', 84, 66, 82, 66, 'nav', 'sun', 'b=u s=amber hd=old h=balding hc=white bd=b_beard t=sleeveless tc=red l=wide lc=black f=boots', 'mace zhajia', 'buqu shuizhan', { tac: ['huoji'] }],
  ['handang', '韓當', 'Han Dang', 82, 56, 78, 72, 'cav', 'sun', 'b=m s=amber hd=gaunt h=topknot hc=gray bd=m_walrus t=kimono tc=maroon l=wide lc=black f=boots', 'longbow zhajia ironhelm warhorse', 'tiebi', {}],
  ['jiangqin', '蔣欽', 'Jiang Qin', 80, 58, 76, 74, 'nav', 'sun', 'b=m s=bronze h=messy hc=black bd=b_stubble t=tunic tc=blue l=pants lc=navy f=sandals', 'ironspear leather headband', 'shuizhan', {}],
  ['lingtong', '凌統', 'Ling Tong', 86, 56, 76, 84, 'inf', 'sun', 'b=m s=light h=ponytail hc=black t=kimono tc=red l=wide lc=black f=boots', 'ironji leather headband', 'lianji jisu', {}],
  ['lingcao', '凌操', 'Ling Cao', 80, 48, 70, 76, 'nav', 'sun', 'b=m s=amber h=topknot hc=black bd=b_medium t=tunic tc=red l=wide lc=black f=boots', 'ironsword leather ironhelm', 'shuizhan', {}],
  ['dongxi', '董襲', 'Dong Xi', 82, 46, 70, 72, 'nav', 'sun', 'b=u s=bronze h=buzz hc=black bd=b_beard t=sleeveless tc=teal l=pants lc=black f=boots', 'kaishan leather', 'yongmeng shuizhan', {}],
  ['chenwu', '陳武', 'Chen Wu', 84, 44, 72, 76, 'inf', 'sun', 'b=u s=olive h=messy hc=black bd=b_stubble t=sleeveless tc=yellow l=pants lc=brown f=boots', 'woodaxe leather', 'yongmeng', {}],
  ['xusheng', '徐盛', 'Xu Sheng', 84, 70, 80, 74, 'nav', 'sun', 'b=m s=light h=topknot hc=black bd=b_trimmed t=kimono tc=navy l=wide lc=black f=boots', 'dianggang waterarmour kettlehelm', 'shuizhan', {}],
  ['dingfeng', '丁奉', 'Ding Feng', 82, 66, 78, 80, 'nav', 'sun', 'b=m s=light h=topknot_s hc=black t=tunic tc=red l=pants lc=black f=boots', 'steelsword leather', 'yexi shuizhan', {}],
  ['zhuhuan', '朱桓', 'Zhu Huan', 84, 68, 80, 76, 'inf', 'sun', 'b=u s=amber h=topknot hc=black bd=m_handlebar t=kimono tc=maroon l=wide lc=black f=boots', 'longspear zhajia ironhelm', 'yongmeng', {}],
  ['zhuran', '朱然', 'Zhu Ran', 78, 70, 80, 72, 'inf', 'sun', 'b=m s=light h=parted hc=black t=kimono tc=red l=wide lc=black f=boots', 'longbow chain', 'shenshe', {}],
  ['panzhang', '潘璋', 'Pan Zhang', 80, 52, 70, 76, 'inf', 'sun', 'b=m s=olive h=bedhead hc=black bd=b_stubble t=tunic tc=brown l=pants lc=black f=boots', 'ironsword leather', 'lueduo', {}],
  ['zhangzhao', '張昭', 'Zhang Zhao', 30, 90, 60, 40, 'inf', 'sun', 'b=m s=light hd=old h=topknot hc=white bd=b_winter brow=thin t=robe tc=charcoal l=wide lc=black f=shoes', 'bamboostaff daopao lunjin', 'fanji shensuan', { tac: ['zhiliao', 'jianshou'] }],
  ['guyong', '顧雍', 'Gu Yong', 28, 86, 58, 40, 'inf', 'sun', 'b=m s=light hd=gaunt h=topknot hc=gray bd=m_chevron t=robe tc=navy l=wide lc=black f=shoes', 'bamboostaff daopao lunjin', 'fanji', {}],
  ['zhugejin', '諸葛瑾', 'Zhuge Jin', 40, 86, 70, 50, 'inf', 'sun', 'b=m s=light hd=plump h=topknot hc=black bd=b_beard t=robe tc=blue l=wide lc=black f=shoes', 'fan daopao lunjin', 'shensuan', {}],
  ['yufan', '虞翻', 'Yu Fan', 50, 86, 58, 52, 'inf', 'sun', 'b=m s=light h=messy hc=black bd=b_trimmed t=robe tc=forest l=wide lc=black f=shoes', 'fan daopao', 'fanji', { tac: ['zhiliao'] }],
  ['kanze', '闞澤', 'Kan Ze', 38, 84, 52, 48, 'inf', 'sun', 'b=m s=amber h=topknot hc=black bd=m_mustache t=robe tc=tan l=wide lc=black f=shoes', 'bamboostaff daopao lunjin', 'guimou', {}],
  ['buzhi', '步騭', 'Bu Zhi', 52, 80, 70, 56, 'inf', 'sun', 'b=m s=light h=topknot hc=black bd=b_trimmed t=robe tc=slate l=wide lc=black f=shoes', 'fan chain', 'fanji', {}],
  ['zhuzhi', '朱治', 'Zhu Zhi', 70, 70, 78, 60, 'inf', 'sun', 'b=m s=light hd=old h=topknot hc=gray bd=b_medium t=kimono tc=maroon l=wide lc=black f=boots', 'ironsword zhajia ironhelm', 'tiebi', {}],
  ['lufan', '呂範', 'Lü Fan', 66, 72, 78, 60, 'inf', 'sun', 'b=m s=light h=topknot hc=black bd=b_trimmed t=kimono tc=navy l=wide lc=black f=boots', 'ironsword chain', 'lueduo', {}],
  ['heqi', '賀齊', 'He Qi', 80, 70, 82, 72, 'inf', 'sun', 'b=m s=light h=topknot hc=black bd=m_horseshoe t=kimono tc=purple l=wide lc=black f=boots c=solid cc=purple', 'steelsword zhajia plumehelm', 'weifeng', {}],
  ['daqiao', '大喬', 'Da Qiao', 30, 80, 56, 70, 'inf', 'sun', 'b=f s=light hd=f h=bangs_bun hc=black t=kimono tc=rose l=skirt lc=maroon f=shoes', 'fan cloth', 'yishu', { tac: ['zhiliao', 'huifu'] }],
  ['xiaoqiao', '小喬', 'Xiao Qiao', 32, 82, 56, 74, 'nav', 'sun', 'b=f s=light hd=f h=princess hc=black t=kimono tc=pink l=skirt lc=red f=shoes', 'fan cloth', 'yishu guanxing', { tac: ['zhiliao', 'jifeng'] }],
  // the four from beyond the western sea
  ['jeff', '傑夫', 'Jeff', 48, 92, 70, 60, 'inf', 'sun', 'b=m s=light h=messy hc=chestnut bd=b_stubble t=frock tc=brown l=pants lc=charcoal f=boots fc=black g=round', 'wrench cloth', 'gongjiang guimou', { tac: ['huoji', 'luoshi'], west: true }],
  ['erin', '艾琳', 'Erin', 42, 86, 66, 76, 'nav', 'sun', 'b=f s=light hd=f h=braid hc=ginger t=long2 tc=sky l=pants lc=tan f=boots fc=brown c=trim cc=navy belt=leather bc=brown', 'bamboostaff cloth', 'guanxing yishu', { tac: ['zhiliao', 'shuiji'], west: true }],
  ['josh', '喬許', 'Josh', 90, 50, 78, 62, 'inf', 'sun', 'b=u s=amber h=curly hc=lpcr:charcoal bd=b_beard t=vest tc=leather l=pants lc=navy f=boots fc=black', 'ironspear leather', 'dunqiang tiebi', { shieldItem: 'voyager', west: true }],
  ['jasper', '賈斯珀', 'Jasper', 70, 74, 62, 96, 'arc', 'sun', 'b=m s=light h=cowlick hc=blonde t=laced tc=green l=pants lc=brown f=boots fc=brown n=scarf', 'shortbow cloth', 'miaoshou jisu', { west: true, quiver: true }],
  // the usurper, bandits and the lesser lords of the south
  ['sunhao', '孫暠', 'Sun Hao', 74, 58, 70, 66, 'inf', 'sun_hao', 'b=m s=light h=topknot hc=black bd=m_french t=kimono tc=purple l=wide lc=black f=boots c=solid cc=purple', 'steelsword zhajia plumehelm', 'weifeng', {}],
  ['yanbaihu', '嚴白虎', 'Yan Baihu', 76, 40, 70, 72, 'inf', 'shanyue', 'b=u s=bronze h=long_messy hc=white bd=b_beard t=sleeveless tc=leather l=pants lc=brown f=sandals hat=hb_bandana hatc=white', 'kaishan leather', 'yongmeng lueduo', {}],
  ['zulang', '祖郎', 'Zu Lang', 78, 38, 68, 74, 'inf', 'shanyue', 'b=u s=bronze h=unkempt hc=black bd=b_stubble t=sleeveless tc=green l=pants lc=brown f=sandals', 'woodaxe leather', 'yongmeng', {}],
  ['wanglang', '王朗', 'Wang Lang', 50, 80, 66, 48, 'inf', 'free', 'b=m s=light hd=old h=topknot hc=white bd=b_winter t=robe tc=gray l=wide lc=black f=shoes', 'bamboostaff daopao lunjin', 'fanji', {}],
  ['liuxun', '劉勳', 'Liu Xun', 66, 50, 70, 60, 'inf', 'liu_xun', 'b=m s=light hd=plump h=topknot hc=black bd=b_medium t=kimono tc=yellow l=wide lc=black f=boots', 'ironji zhajia ironhelm', 'lueduo', {}],
  ['huangzu', '黃祖', 'Huang Zu', 72, 56, 76, 62, 'nav', 'huang_zu', 'b=m s=amber hd=old h=balding hc=gray bd=b_beard t=kimono tc=teal l=wide lc=black f=boots', 'steelsword zhajia kettlehelm', 'shuizhan', {}],
  ['sufei', '蘇飛', 'Su Fei', 74, 66, 72, 68, 'nav', 'huang_zu', 'b=m s=light h=topknot hc=black bd=b_trimmed t=kimono tc=teal l=wide lc=black f=boots', 'ironspear chain ironhelm', 'shuizhan huwei', {}],
  ['chenjiu', '陳就', 'Chen Jiu', 72, 40, 66, 70, 'nav', 'huang_zu', 'b=m s=olive h=bedhead hc=black t=tunic tc=teal l=pants lc=black f=boots', 'ironji leather', 'shuizhan', {}],
  ['liubiao', '劉表', 'Liu Biao', 40, 80, 70, 40, 'inf', 'cai_mao', 'b=m s=light hd=old h=topknot hc=white bd=b_winter t=robe tc=teal l=wide lc=black f=shoes', 'bamboostaff daopao lunjin', 'fanji', {}],
  ['caimao', '蔡瑁', 'Cai Mao', 72, 76, 80, 62, 'nav', 'cai_mao', 'b=m s=light h=topknot hc=black bd=m_handlebar t=kimono tc=bluegray l=wide lc=black f=boots c=solid cc=black', 'dianggang yulin plumehelm', 'shuizhan guimou', {}],
  ['zhangyun', '張允', 'Zhang Yun', 66, 62, 72, 60, 'nav', 'cai_mao', 'b=m s=light h=topknot hc=black bd=b_trimmed t=kimono tc=bluegray l=wide lc=black f=boots', 'steelsword chain ironhelm', 'shuizhan', {}],
  ['wenpin', '文聘', 'Wen Pin', 86, 68, 86, 74, 'nav', 'cai_mao', 'b=u s=amber h=topknot hc=black bd=b_medium t=kimono tc=teal l=wide lc=black f=boots', 'longspear yulin kettlehelm', 'tiebi shuizhan', {}],
  ['kuaiyue', '蒯越', 'Kuai Yue', 40, 88, 66, 50, 'inf', 'cai_mao', 'b=m s=light h=topknot hc=black bd=m_mustache t=robe tc=teal l=wide lc=black f=shoes', 'fan daopao lunjin', 'guimou', {}],
  ['liuqi', '劉琦', 'Liu Qi', 40, 64, 60, 50, 'inf', 'liu', 'b=m s=light h=parted hc=black t=robe tc=sky l=wide lc=navy f=shoes', 'ironsword cloth', '', {}],
  ['huangzhong', '黃忠', 'Huang Zhong', 93, 62, 84, 70, 'arc', 'cai_mao', 'b=m s=amber hd=old h=topknot hc=white bd=b_winter t=kimono tc=yellow l=wide lc=black f=boots', 'irontaibow yulin plumehelm warhorse', 'shenshe buqu', {}],
  ['weiyan', '魏延', 'Wei Yan', 92, 64, 84, 80, 'inf', 'cai_mao', 'b=u s=bronze h=unkempt hc=black bd=b_beard brow=thick t=kimono tc=maroon l=wide lc=black f=boots', 'yanyue yulin lionhelm', 'yongmeng', {}],
  // Liu Bei and his people
  ['liubei', '劉備', 'Liu Bei', 74, 76, 90, 70, 'cav', 'liu', 'b=m s=light h=topknot hc=black bd=b_trimmed t=kimono tc=green l=wide lc=forest f=boots c=solid cc=green', 'steelsword zhajia plumehelm dilu', 'jili haoling', {}],
  ['guanyu', '關羽', 'Guan Yu', 98, 76, 96, 80, 'cav', 'liu', 'b=u s=bronze h=topknot hc=black bd=b_winter brow=thick t=kimono tc=forest l=wide lc=black f=boots c=solid cc=green hat=hb_thick hatc=green', 'qinglong yulin none chitu', 'yiqi weifeng', {}],
  ['zhangfei', '張飛', 'Zhang Fei', 98, 34, 86, 82, 'cav', 'liu', 'b=u s=amber h=messy hc=black bd=b_beard brow=thick t=sleeveless tc=black l=wide lc=black f=boots', 'trident zhajia lionhelm xiliang', 'yiqi weifeng', {}],
  ['zhugeliang', '諸葛亮', 'Zhuge Liang', 38, 100, 94, 60, 'inf', 'liu', 'b=m s=light h=topknot hc=black bd=m_chevron t=robe tc=white l=wide lc=black f=shoes', 'craneFan daopao lunjin', 'guimou shensuan fanji', { tac: ['huoji', 'dahuo', 'liehuo', 'hufeng', 'qimen', 'jinsuo', 'tianbian'] }],
  ['zhaoyun', '趙雲', 'Zhao Yun', 96, 76, 90, 94, 'cav', 'liu', 'b=m s=light h=long_tied hc=black t=kimono tc=white l=wide lc=sky f=boots c=solid cc=white', 'longdan mingguang plumehelm dilu', 'danqi lianji', {}],
  ['machao', '馬超', 'Ma Chao', 96, 48, 86, 94, 'cav', 'qiang', 'b=m s=light h=long hc=lpcr:ash_brown t=kimono tc=white l=wide lc=gray f=boots', 'hutou mingguang lionhelm xiliang', 'tuji lianji', {}],
  ['pangtong', '龐統', 'Pang Tong', 36, 96, 86, 56, 'inf', 'free', 'b=m s=olive hd=plump h=unkempt hc=black bd=b_beard t=robe tc=brown l=wide lc=black f=sandals', 'bamboostaff daopao', 'guimou gongjiang', { tac: ['huoji', 'dahuo', 'maifu'] }],
  ['xushu', '徐庶', 'Xu Shu', 66, 92, 80, 70, 'inf', 'liu', 'b=m s=light h=topknot hc=black bd=b_trimmed t=robe tc=gray l=wide lc=black f=boots', 'steelsword daopao lunjin', 'fanji', { tac: ['maifu'] }],
  ['guanping', '關平', 'Guan Ping', 82, 64, 74, 76, 'cav', 'liu', 'b=m s=amber h=topknot hc=black t=kimono tc=forest l=wide lc=black f=boots', 'longspear zhajia ironhelm warhorse', 'huwei', {}],
  ['zhoucang', '周倉', 'Zhou Cang', 84, 40, 62, 74, 'inf', 'liu', 'b=u s=brown h=unkempt hc=black bd=b_beard t=sleeveless tc=black l=pants lc=black f=sandals', 'kaishan leather', 'huwei', {}],
  // Cao Cao and his people
  ['caocao', '曹操', 'Cao Cao', 74, 94, 98, 76, 'cav', 'cao', 'b=m s=light h=topknot hc=black bd=b_trimmed brow=thick t=kimono tc=navy l=wide lc=black f=boots c=trim cc=blue', 'yitian mingguang phoenixhelm jueying', 'weifeng haoling guimou', {}],
  ['xiahoudun', '夏侯惇', 'Xiahou Dun', 92, 62, 88, 78, 'cav', 'cao', 'b=u s=light h=topknot hc=black bd=b_beard g=patch t=kimono tc=navy l=wide lc=black f=boots', 'longspear yulin plumehelm xiliang', 'yongmeng buqu', {}],
  ['xiahouyuan', '夏侯淵', 'Xiahou Yuan', 90, 56, 84, 94, 'arc', 'cao', 'b=m s=light h=topknot hc=black bd=b_medium t=kimono tc=blue l=wide lc=black f=boots', 'irontaibow zhajia kettlehelm xiliang', 'jisu shenshe', {}],
  ['caoren', '曹仁', 'Cao Ren', 86, 66, 90, 70, 'inf', 'cao', 'b=u s=light h=topknot hc=black bd=b_beard t=kimono tc=navy l=wide lc=black f=boots', 'steelsword mingguang lionhelm', 'tiebi', {}],
  ['zhangliao', '張遼', 'Zhang Liao', 94, 80, 94, 88, 'cav', 'cao', 'b=m s=light h=topknot hc=black bd=b_trimmed t=kimono tc=purple l=wide lc=black f=boots c=solid cc=purple', 'yanyue mingguang plumehelm xiliang', 'tuji weifeng yexi', {}],
  ['xuchu', '許褚', 'Xu Chu', 96, 38, 70, 72, 'inf', 'cao', 'b=u s=amber hd=plump h=buzz hc=black bd=b_stubble t=sleeveless tc=brown l=pants lc=black f=boots', 'xuanhua leather', 'huwei yongmeng', {}],
  ['dianwei', '典韋', 'Dian Wei', 98, 32, 70, 76, 'inf', 'cao', 'b=u s=brown h=buzz hc=black bd=b_beard brow=thick t=sleeveless tc=black l=pants lc=black f=boots', 'shuangji leather', 'huwei buqu', {}],
  ['xuhuang', '徐晃', 'Xu Huang', 90, 70, 86, 76, 'inf', 'cao', 'b=u s=light h=topknot hc=black bd=b_trimmed t=kimono tc=blue l=wide lc=black f=boots', 'xuanhua yulin ironhelm', 'tiebi', {}],
  ['zhanghe', '張郃', 'Zhang He', 90, 72, 88, 84, 'cav', 'yuan', 'b=m s=light h=long hc=black t=kimono tc=yellow l=wide lc=black f=boots', 'longspear yulin plumehelm warhorse', 'jisu', {}],
  ['yujin', '于禁', 'Yu Jin', 80, 70, 86, 66, 'nav', 'cao', 'b=m s=light h=topknot hc=black bd=b_medium t=kimono tc=navy l=wide lc=black f=boots', 'steelsword yulin kettlehelm', 'tiebi', {}],
  ['yuejin', '樂進', 'Yue Jin', 84, 52, 76, 80, 'inf', 'cao', 'b=m s=amber h=topknot_s hc=black bd=b_stubble t=kimono tc=blue l=wide lc=black f=boots', 'ironji zhajia ironhelm', 'yongmeng', {}],
  ['guojia', '郭嘉', 'Guo Jia', 30, 98, 80, 60, 'inf', 'cao', 'b=m s=light hd=gaunt h=parted hc=black t=robe tc=sky l=wide lc=navy f=shoes', 'fan daopao lunjin', 'guimou shensuan', { tac: ['qimen'] }],
  ['xunyu', '荀彧', 'Xun Yu', 30, 96, 78, 50, 'inf', 'cao', 'b=m s=light h=topknot hc=black bd=m_chevron t=robe tc=navy l=wide lc=black f=shoes', 'fan daopao lunjin', 'fanji', {}],
  ['jiaxu', '賈詡', 'Jia Xu', 40, 97, 80, 58, 'inf', 'dong', 'b=m s=light hd=old h=topknot hc=gray bd=b_trimmed t=robe tc=black l=wide lc=black f=shoes', 'fan daopao lunjin', 'guimou fanji', { tac: ['duyan', 'hunluan'] }],
  ['simayi', '司馬懿', 'Sima Yi', 66, 98, 96, 64, 'inf', 'cao', 'b=m s=light h=topknot hc=black bd=b_trimmed t=robe tc=purple l=wide lc=black f=boots', 'craneFan chain lunjin', 'guimou fanji', { tac: ['leiji', 'tianlei'] }],
  ['chengyu', '程昱', 'Cheng Yu', 50, 90, 76, 52, 'inf', 'cao', 'b=m s=light hd=old h=topknot hc=gray bd=b_beard t=robe tc=navy l=wide lc=black f=shoes', 'fan daopao', 'guimou', {}],
  ['caohong', '曹洪', 'Cao Hong', 82, 48, 76, 76, 'cav', 'cao', 'b=m s=light h=topknot hc=black bd=b_medium t=kimono tc=blue l=wide lc=black f=boots', 'steelsword zhajia ironhelm warhorse', 'huwei', {}],
  ['pangde', '龐德', 'Pang De', 94, 60, 82, 80, 'cav', 'qiang', 'b=u s=bronze h=topknot hc=black bd=b_beard t=kimono tc=brown l=wide lc=black f=boots', 'kaishan yulin kettlehelm xiliang', 'yongmeng buqu', {}],
  // the Yuan brothers and Hebei
  ['yuanshao', '袁紹', 'Yuan Shao', 70, 72, 86, 62, 'cav', 'yuan', 'b=m s=light h=topknot hc=black bd=b_trimmed t=kimono tc=yellow l=wide lc=black f=boots c=trim cc=yellow', 'qixing goldarmour phoenixhelm dawan', 'haoling', {}],
  ['yanliang', '顏良', 'Yan Liang', 94, 40, 80, 80, 'cav', 'yuan', 'b=u s=amber h=topknot hc=black bd=b_beard t=kimono tc=yellow l=wide lc=black f=boots', 'yanyue yulin lionhelm warhorse', 'yongmeng', {}],
  ['wenchou', '文醜', 'Wen Chou', 94, 34, 78, 82, 'cav', 'yuan', 'b=u s=bronze h=unkempt hc=black bd=b_beard brow=thick t=kimono tc=orange l=wide lc=black f=boots', 'dianggang yulin lionhelm warhorse', 'yongmeng lianji', {}],
  ['shenpei', '審配', 'Shen Pei', 60, 82, 80, 50, 'inf', 'yuan', 'b=m s=light h=topknot hc=black bd=m_walrus t=robe tc=yellow l=wide lc=black f=boots', 'steelsword chain lunjin', 'tiebi', {}],
  ['tianfeng', '田豐', 'Tian Feng', 30, 94, 76, 48, 'inf', 'yuan', 'b=m s=light hd=old h=topknot hc=white bd=b_winter t=robe tc=gray l=wide lc=black f=shoes', 'fan daopao lunjin', 'fanji guimou', {}],
  ['jushou', '沮授', 'Ju Shou', 36, 92, 82, 50, 'inf', 'yuan', 'b=m s=light h=topknot hc=black bd=b_trimmed t=robe tc=tan l=wide lc=black f=shoes', 'fan daopao lunjin', 'fanji', {}],
  ['gaolan', '高覽', 'Gao Lan', 82, 50, 74, 72, 'inf', 'yuan', 'b=m s=amber h=topknot hc=black bd=b_stubble t=kimono tc=yellow l=wide lc=black f=boots', 'ironji zhajia ironhelm', 'yongmeng', {}],
  ['yuanshu', '袁術', 'Yuan Shu', 50, 58, 70, 50, 'inf', 'yuan', 'b=m s=light hd=plump h=topknot hc=black bd=m_bigstache t=kimono tc=yellow l=wide lc=black f=shoes c=trim cc=yellow hat=hb_crown', 'qixing goldarmour', 'lueduo', {}],
  ['jiling', '紀靈', 'Ji Ling', 86, 48, 76, 70, 'inf', 'yuan', 'b=u s=amber h=topknot hc=black bd=b_beard t=kimono tc=orange l=wide lc=black f=boots', 'trident yulin kettlehelm', 'yongmeng', {}],
  // Dong Zhuo's court in the west
  ['dongzhuo', '董卓', 'Dong Zhuo', 88, 68, 86, 60, 'cav', 'dong', 'b=u s=amber hd=plump h=topknot hc=black bd=b_beard brow=thick t=kimono tc=black l=wide lc=black f=boots c=trim cc=black hat=hb_crown', 'qixing beastarmour none dawan', 'weifeng yinjiang', {}],
  ['lubu', '呂布', 'Lü Bu', 100, 30, 90, 98, 'cav', 'dong', 'b=u s=light h=long hc=black brow=thick t=kimono tc=red l=wide lc=black f=boots c=trim cc=red', 'fangtian beastarmour zijinguan chitu', 'guishen tuji', {}],
  ['diaochan', '貂蟬', 'Diaochan', 40, 82, 56, 86, 'inf', 'dong', 'b=f s=light hd=f h=princess hc=black t=kimono tc=lavender l=skirt lc=purple f=shoes', 'fan cloth', 'jisu', { tac: ['hunluan', 'tiaobo'] }],
  ['liru', '李儒', 'Li Ru', 28, 92, 66, 50, 'inf', 'dong', 'b=m s=light hd=gaunt h=topknot hc=black bd=m_chevron t=robe tc=black l=wide lc=black f=shoes', 'fan daopao lunjin', 'guimou', { tac: ['duyan', 'huoji', 'dahuo'] }],
  ['huaxiong', '華雄', 'Hua Xiong', 92, 42, 76, 76, 'cav', 'dong', 'b=u s=bronze h=buzz hc=black bd=b_beard t=sleeveless tc=black l=pants lc=black f=boots', 'kaishan zhajia lionhelm warhorse', 'yongmeng', {}],
  ['lijue', '李傕', 'Li Jue', 80, 40, 76, 72, 'cav', 'dong', 'b=m s=olive h=unkempt hc=black bd=b_medium t=kimono tc=black l=wide lc=black f=boots', 'ironji zhajia ironhelm warhorse', 'lueduo', {}],
  ['guosi', '郭汜', 'Guo Si', 78, 40, 74, 72, 'cav', 'dong', 'b=m s=olive h=bedhead hc=black bd=b_stubble t=kimono tc=charcoal l=wide lc=black f=boots', 'ironspear zhajia ironhelm warhorse', 'lueduo', {}],
  ['zhangxiu', '張繡', 'Zhang Xiu', 84, 60, 80, 80, 'cav', 'dong', 'b=m s=light h=topknot hc=black t=kimono tc=gray l=wide lc=black f=boots', 'longspear zhajia kettlehelm warhorse', 'tuji', {}],
  ['gaoshun', '高順', 'Gao Shun', 88, 66, 88, 70, 'inf', 'dong', 'b=u s=light h=topknot hc=black bd=b_trimmed t=kimono tc=charcoal l=wide lc=black f=boots', 'steelsword mingguang kettlehelm', 'tiebi weifeng', {}],
  ['chengong', '陳宮', 'Chen Gong', 46, 92, 82, 56, 'inf', 'dong', 'b=m s=light h=topknot hc=black bd=b_trimmed t=robe tc=charcoal l=wide lc=black f=shoes', 'fan daopao lunjin', 'guimou', { tac: ['maifu'] }],
  // the west, the south and the north
  ['liuzhang', '劉璋', 'Liu Zhang', 30, 60, 56, 40, 'inf', 'liu_zhang', 'b=m s=light hd=plump h=topknot hc=black bd=m_mustache t=robe tc=orange l=wide lc=black f=shoes hat=hb_crown', 'bamboostaff daopao', '', {}],
  ['zhangren', '張任', 'Zhang Ren', 86, 76, 84, 76, 'arc', 'liu_zhang', 'b=m s=light h=topknot hc=black bd=b_trimmed t=kimono tc=orange l=wide lc=black f=boots', 'irontaibow yulin kettlehelm', 'shenshe tiebi', {}],
  ['yanyan', '嚴顏', 'Yan Yan', 82, 66, 78, 62, 'inf', 'liu_zhang', 'b=u s=amber hd=old h=topknot hc=white bd=b_winter t=kimono tc=orange l=wide lc=black f=boots', 'kaishan zhajia ironhelm', 'buqu', {}],
  ['fazheng', '法正', 'Fa Zheng', 44, 92, 76, 58, 'inf', 'liu_zhang', 'b=m s=light hd=gaunt h=topknot hc=black bd=m_chevron t=robe tc=tan l=wide lc=black f=shoes', 'fan daopao lunjin', 'guimou', { tac: ['maifu', 'hunluan'] }],
  ['jiangwei', '姜維', 'Jiang Wei', 88, 90, 88, 80, 'cav', 'qiang', 'b=m s=light h=ponytail hc=black t=kimono tc=sky l=wide lc=black f=boots', 'longspear zhajia plumehelm warhorse', 'lianji guimou', {}],
  ['mateng', '馬騰', 'Ma Teng', 86, 56, 84, 80, 'cav', 'qiang', 'b=u s=light hd=old h=topknot hc=gray bd=b_winter t=kimono tc=white l=wide lc=black f=boots', 'longspear yulin kettlehelm xiliang', 'tuji', {}],
  ['madai', '馬岱', 'Ma Dai', 82, 56, 74, 80, 'cav', 'qiang', 'b=m s=light h=topknot hc=lpcr:ash_brown bd=b_stubble t=kimono tc=white l=wide lc=gray f=boots', 'longspear zhajia ironhelm xiliang', 'jisu', {}],
  ['hansui', '韓遂', 'Han Sui', 78, 70, 80, 72, 'cav', 'qiang', 'b=m s=bronze hd=old h=topknot hc=gray bd=b_medium t=kimono tc=brown l=wide lc=black f=boots', 'ironji zhajia kettlehelm xiliang', 'tuji', {}],
  ['gongsunzan', '公孫瓚', 'Gongsun Zan', 86, 60, 84, 90, 'cav', 'gongsun', 'b=m s=light h=topknot hc=black bd=b_trimmed t=kimono tc=white l=wide lc=black f=boots c=solid cc=white', 'longspear yulin plumehelm warhorse', 'tuji jisu', {}],
  ['shixie', '士燮', 'Shi Xie', 40, 80, 76, 50, 'inf', 'shi', 'b=m s=amber hd=old h=topknot hc=white bd=b_winter t=robe tc=orange l=wide lc=black f=shoes', 'bamboostaff daopao lunjin', 'tuntian', {}],
  ['menghuo', '孟獲', 'Meng Huo', 92, 40, 82, 72, 'inf', 'nanman', 'b=u s=brown h=long_messy hc=black bd=b_beard t=sleeveless tc=red l=pants lc=brown f=sandals hat=hx_plume hatc=red', 'kaishan rattan', 'yongmeng buqu', {}],
  ['zhurong', '祝融', 'Zhurong', 88, 40, 70, 88, 'inf', 'nanman', 'b=f s=bronze hd=f h=long hc=lpcr:black t=sleeveless tc=red l=skirt lc=brown f=sandals', 'longspear rattan', 'jisu lianji', {}],
  ['wutugu', '兀突骨', 'Wutugu', 94, 20, 70, 60, 'inf', 'nanman', 'b=u s=brown hd=plump h=buzz hc=black bd=b_stubble t=sleeveless tc=yellow l=pants lc=brown f=sandals', 'xuanhua rattan', 'tiebi', {}],
  ['huatuo', '華佗', 'Hua Tuo', 30, 88, 40, 60, 'inf', 'free', 'b=m s=light hd=old h=topknot hc=white bd=b_winter t=robe tc=forest l=wide lc=black f=sandals', 'bamboostaff daopao', 'yishu', { tac: ['zhiliao', 'huifu', 'dahui', 'fuhuo'] }],
  // the Black Lotus: the elder who is its Left Envoy, the four Lotus Envoys, and its hidden master
  ['jiyuan', '季淵', 'Ji Yuan', 40, 94, 70, 50, 'inf', 'sun', 'b=m s=light hd=old h=topknot hc=white bd=b_winter brow=thin t=robe tc=black l=wide lc=black f=shoes', 'fan daopao lunjin', 'guimou fanji', { tac: ['heilian', 'duyan', 'hunluan'] }],
  ['yanwu', '焰無', 'Yan Wu', 84, 78, 80, 78, 'inf', 'sect', 'b=u s=light h=buzz hc=red t=robe tc=black l=wide lc=black f=boots c=tattered cc=red hat=hb_hood hatc=red', 'qixing mingguang', 'yinjiang guimou', { tac: ['huoji', 'dahuo', 'liehuo'], lotus: 'red' }],
  ['chaoyin', '潮音', 'Chao Yin', 70, 88, 82, 80, 'nav', 'sect', 'b=f s=light hd=f h=xlong hc=navy t=robe tc=black l=skirt lc=black f=boots c=tattered cc=blue hat=hb_hood hatc=blue', 'starstaff waterarmour', 'yinjiang shuizhan', { tac: ['shuiji', 'dashui', 'hongshui'], lotus: 'blue' }],
  ['shuangjing', '霜鏡', 'Shuang Jing', 80, 84, 84, 84, 'cav', 'sect', 'b=m s=light h=long hc=white t=robe tc=black l=wide lc=black f=boots c=tattered cc=white hat=hb_hood hatc=white', 'longdan mingguang', 'yinjiang lianji', { tac: ['qimen', 'hunluan'], lotus: 'white' }],
  ['mingzhao', '冥照', 'Ming Zhao', 76, 94, 86, 72, 'inf', 'sect', 'b=m s=light hd=gaunt h=long_messy hc=gray t=robe tc=black l=wide lc=black f=boots c=tattered cc=purple hat=hb_hood hatc=purple', 'starstaff mingguang', 'yinjiang guimou', { tac: ['leiji', 'tianlei', 'duyan'], lotus: 'purple' }],
  ['yuji', '于吉', 'Yu Ji', 60, 100, 94, 70, 'inf', 'sect', 'b=m s=light hd=old h=xlong hc=white bd=b_winter t=robe tc=black l=wide lc=black f=sandals c=tattered cc=black hat=hb_crown', 'starstaff beastarmour', 'yinjiang guimou fanji', { tac: ['heilian', 'tianlei', 'yehuo', 'jinsuo', 'hongshui'] }],
];

// ---------- the name generator ----------
const SURNAMES = ('王:wang 李:li 張:zhang 劉:liu 陳:chen 楊:yang 趙:zhao 黃:huang 周:zhou 吳:wu 徐:xu 孫:sun 胡:hu 朱:zhu 高:gao 林:lin 何:he 郭:guo 馬:ma 羅:luo 梁:liang 宋:song 鄭:zheng 謝:xie '
  + '韓:han 唐:tang 馮:feng 于:yu 董:dong 蕭:xiao 程:cheng 曹:cao 袁:yuan 鄧:deng 許:xu 傅:fu 沈:shen 曾:zeng 彭:peng 呂:lü 蘇:su 盧:lu 蔣:jiang 蔡:cai 賈:jia 丁:ding 魏:wei 薛:xue 葉:ye '
  + '閻:yan 潘:pan 杜:du 戴:dai 夏:xia 鍾:zhong 田:tian 任:ren 姜:jiang 范:fan 方:fang 石:shi 姚:yao 廖:liao 鄒:zou 熊:xiong 陸:lu 孔:kong 白:bai 崔:cui 毛:mao 秦:qin 江:jiang 史:shi 顧:gu '
  + '侯:hou 邵:shao 孟:meng 龍:long 段:duan 雷:lei 錢:qian 尹:yin 黎:li 常:chang 武:wu 喬:qiao 賀:he 龔:gong 文:wen 樊:fan 祖:zu 嚴:yan 費:fei 牛:niu 管:guan 卞:bian 臧:zang 糜:mi 鮑:bao '
  + '應:ying 桓:huan 荀:xun 陶:tao 華:hua 霍:huo 虞:yu 闞:kan 步:bu 嵇:ji 鄂:e 皇甫:huangfu 諸葛:zhuge 司馬:sima 夏侯:xiahou 公孫:gongsun 太史:taishi 歐陽:ouyang 令狐:linghu 淳于:chunyu 上官:shangguan 東方:dongfang 尉遲:yuchi').split(' ').map((s) => s.split(':'));
const GIVEN = ('武:wu 文:wen 德:de 仁:ren 義:yi 忠:zhong 勇:yong 剛:gang 毅:yi 雄:xiong 威:wei 豹:bao 虎:hu 龍:long 彪:biao 猛:meng 烈:lie 昭:zhao 超:chao 達:da 通:tong 遠:yuan 平:ping 安:an 寧:ning '
  + '康:kang 泰:tai 興:xing 盛:sheng 隆:long 昌:chang 彰:zhang 顯:xian 明:ming 光:guang 輝:hui 炎:yan 雲:yun 風:feng 雷:lei 霆:ting 震:zhen 嶽:yue 山:shan 峰:feng 川:chuan 海:hai 江:jiang 河:he '
  + '濤:tao 林:lin 松:song 柏:bo 玉:yu 璋:zhang 琮:cong 瑜:yu 琰:yan 珍:zhen 鋒:feng 騰:teng 翔:xiang 飛:fei 鵬:peng 鷹:ying 鶴:he 麟:lin 孝:xiao 廉:lian 謙:qian 恭:gong 信:xin 誠:cheng 直:zhi '
  + '方:fang 正:zheng 端:duan 嚴:yan 肅:su 敬:jing 慎:shen 敏:min 捷:jie 智:zhi 謀:mou 略:lüe 策:ce 機:ji 巧:qiao 秀:xiu 俊:jun 英:ying 豪:hao 傑:jie 賢:xian 良:liang 才:cai 純:chun 奉:feng 承:cheng '
  + '紹:shao 績:ji 規:gui 範:fan 珪:gui 晏:yan 鑒:jian 據:ju 粲:can 邈:miao 綜:zong 融:rong 泓:hong 舒:shu 適:shi 遜:xun 祐:you 禎:zhen 嵩:song 恢:hui 斌:bin 憲:xian 弼:bi 輔:fu 翊:yi 霸:ba 獲:huo').split(' ').map((s) => s.split(':'));
const GIVEN_F = ('蘭:lan 梅:mei 蓮:lian 菊:ju 霞:xia 雪:xue 月:yue 鳳:feng 鸞:luan 瑤:yao 琳:lin 婉:wan 嫣:yan 柔:rou 貞:zhen 淑:shu 靜:jing 秀:xiu 華:hua 娥:e 姬:ji 嬋:chan 綺:qi 素:su').split(' ').map((s) => s.split(':'));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// random looks: what a general of each faction tends to wear
const FCOL = { sun: ['red', 'maroon'], sun_hao: ['purple', 'lavender'], shanyue: ['forest', 'walnut', 'charcoal'], liu_xun: ['yellow', 'orange'], huang_zu: ['teal', 'bluegray'], cai_mao: ['bluegray', 'teal'],
  liu: ['green', 'forest'], cao: ['navy', 'blue'], yuan: ['yellow', 'orange'], dong: ['black', 'charcoal'], liu_zhang: ['orange', 'tan'], nanman: ['red', 'yellow', 'green'], qiang: ['white', 'gray'],
  gongsun: ['white', 'sky'], shi: ['orange', 'yellow'], pirate: ['navy', 'black', 'red'], sect: ['black', 'purple'], free: ['gray', 'slate', 'walnut', 'forest', 'navy', 'sky', 'white', 'rose'] };
const pick = (r, a) => a[Math.floor(r() * a.length)];
export function randomLook(r, o) {
  const fem = o.female, old = o.age === 'old', warrior = o.arch === 'war', sage = o.arch === 'sage';
  const body = fem ? 'f' : 'm';
  const skin = pick(r, ['light', 'light', 'lpcr:peach', 'lpcr:peach', 'amber', 'lpcr:tan', 'olive', 'taupe', ...(o.faction === 'nanman' ? ['brown', 'brown', 'bronze'] : [])]);
  const hc = old ? pick(r, ['gray', 'white', 'gray', 'lpcr:silver']) : pick(r, ['black', 'black', 'black', 'lpcr:black', 'lpcr:charcoal', 'lpcr:charcoal', 'lpcr:brown', ...(o.faction === 'qiang' ? ['light_brown', 'lpcr:ash_brown'] : [])]);
  const hair = fem ? pick(r, ['high_pony', 'bangs_bun', 'princess', 'long', 'braid', 'halfup', 'ponytail', 'xlong']) : pick(r, ['topknot', 'topknot', 'topknot', 'topknot_s', 'topknot_s', 'topknot_s2', 'long_tied', 'ponytail', 'messy', 'bedhead', 'unkempt', 'buzz', 'parted', 'long', ...(old ? ['balding', 'balding'] : [])]);
  const head = fem ? (old ? 'fold' : 'f') : old ? pick(r, ['old', 'old', 'gaunt']) : pick(r, ['m', 'm', 'm', 'm', 'plump', 'gaunt']);
  const beard = fem ? 'none' : r() < (old ? 0.85 : 0.55) ? pick(r, ['b_beard', 'b_medium', 'b_trimmed', 'b_winter', 'b_stubble', 'b_stubble', 'm_mustache', 'm_walrus', 'm_horseshoe', 'm_chevron', 'm_handlebar', 'm_french']) : 'none';
  const cols = FCOL[o.faction] || FCOL.free, tc = r() < 0.7 ? pick(r, cols) : pick(r, FCOL.free);
  const torso = sage ? 'robe' : fem ? pick(r, ['kimono', 'kimono', 'blouse', 'tunic']) : warrior && r() < 0.35 ? pick(r, ['sleeveless', 'tunic']) : pick(r, ['kimono', 'kimono', 'kimono', 'kimono_split', 'tunic', 'long', 'long2']);
  const legs = fem && r() < 0.5 ? 'skirt' : pick(r, ['wide', 'wide', 'wide', 'pants', 'pantaloons']);
  const feet = sage && r() < 0.6 ? 'shoes' : pick(r, ['boots', 'boots', 'boots_fold', 'shoes', 'sandals']);
  let s = `b=${body} s=${skin} hd=${head} h=${hair} hc=${hc} bd=${beard} t=${torso} tc=${tc} l=${legs} lc=${pick(r, ['black', 'charcoal', 'brown', 'navy', 'gray', 'maroon'])} f=${feet} fc=${pick(r, ['black', 'brown', 'charcoal'])}`;
  if (r() < 0.3) s += ` brow=${pick(r, ['thick', 'thin'])}`;
  if (r() < 0.25) s += ` c=${pick(r, ['solid', 'trim', 'solid'])} cc=${pick(r, cols)}`;
  if (r() < 0.35) s += ` belt=${pick(r, ['sash', 'obi', 'leather'])} bc=${pick(r, [...cols, 'gold', 'black'])}`;
  if (o.faction === 'sect') s += ` hat=hb_hood hatc=${pick(r, ['black', 'purple', 'black'])}`;
  else if (o.faction === 'shanyue' && r() < 0.5) s += ` hat=hb_bandana hatc=${pick(r, ['brown', 'red', 'green'])}`;
  else if (o.faction === 'pirate' && r() < 0.6) s += ` hat=hb_bandana hatc=${pick(r, ['red', 'black', 'navy'])}`;
  else if (r() < 0.12) s += ` hat=hb_tied hatc=${pick(r, cols)}`;
  return s;
}
// gear by kind and strength tier (0-4)
const GEAR = {
  sword: ['bronzesword', 'ironsword', 'steelsword', 'guding', 'qixing'], spear: ['bamboospear', 'ironspear', 'longspear', 'dianggang', 'trident'], halberd: ['ironji', 'ironji', 'shuangji', 'shuangji', 'yanyue'],
  axe: ['woodaxe', 'woodaxe', 'kaishan', 'mace', 'xuanhua'], bow: ['shortbow', 'shortbow', 'longbow', 'irontaibow', 'irontaibow'], xbow: ['crossbow', 'crossbow', 'crossbow', 'crossbow', 'crossbow'],
  staff: ['bamboostaff', 'bamboostaff', 'fan', 'fan', 'craneFan'],
  armour: ['cloth', 'leather', 'chain', 'zhajia', 'yulin'], helm: [null, 'headband', 'leathercap', 'ironhelm', 'kettlehelm'], horse: [null, 'nag', 'nag', 'warhorse', 'xiliang'],
};
export { GEAR };

// how many of the random 500 each faction gets
const SHARE = { shanyue: 26, sun_hao: 24, liu_xun: 18, huang_zu: 24, cai_mao: 28, cao: 34, yuan: 36, dong: 34, liu_zhang: 24, nanman: 20, qiang: 18, gongsun: 8, shi: 8, pirate: 14, sect: 34, liu: 8, free: 0 };
const SKILL_POOL = { war: ['yongmeng', 'lianji', 'tuji', 'buqu', 'tiebi', 'yiqi', 'huwei', 'danqi', 'jisu', 'weifeng'], sage: ['guimou', 'shensuan', 'fanji', 'kanpo', 'yishu', 'tuntian', 'chihou', 'jili'], lead: ['haoling', 'jili', 'tiebi', 'weifeng', 'qixi', 'yexi', 'tuntian', 'lueduo'], bal: ['jisu', 'yexi', 'lueduo', 'kanpo', 'shuizhan', 'shenshe', 'chihou', 'huwei'] };

export const GENERALS = {};
export const GEN_LIST = [];
function add(g) { GENERALS[g.id] = g; GEN_LIST.push(g); }
for (const [id, zh, en, str, int, lead, spd, unit, faction, look, gear, skills, extra] of F) {
  const [w, a, h, hr, tr] = gear.split(' ').map((x) => (x === 'none' ? null : x));
  add({ id, zh, en, str, int, lead, spd, unit, faction, look: parseLook(look), lookStr: look, gear: { weapon: w || null, shield: (extra && extra.shieldItem) || null, armour: a || null, helm: h || null, cape: null, horse: hr || null, treasure: tr || null }, skills: skills ? skills.split(' ') : [], famous: true, female: /b=f/.test(look), ...extra });
}
export const FAMOUS_COUNT = GEN_LIST.length;
// the generated ones
(function makeRandom() {
  const r = rng(20261116);
  const used = new Set(GEN_LIST.map((g) => g.zh)), usedEn = new Set(GEN_LIST.map((g) => g.en));
  const total = 500 - GEN_LIST.length;
  const factions = []; for (const [f, n] of Object.entries(SHARE)) for (let i = 0; i < n; i++) factions.push(f);
  while (factions.length < total) factions.push('free');
  factions.length = total;
  let n = 0;
  for (const faction of factions) {
    let zh, en, fem = r() < (faction === 'nanman' ? 0.2 : 0.08), tries = 0;
    do {
      const [sz, sp] = r() < 0.06 ? pick(r, SURNAMES.filter((s) => s[0].length === 2)) : pick(r, SURNAMES.filter((s) => s[0].length === 1));
      const pool = fem ? GIVEN_F : GIVEN;
      const two = r() < (fem ? 0.5 : 0.22);
      const [g1, p1] = pick(r, pool), [g2, p2] = two ? pick(r, pool) : ['', ''];
      if (g1 === sz || g2 === g1) continue;
      zh = sz + g1 + g2; en = cap(sp) + ' ' + cap(p1 + p2);
    } while ((used.has(zh) || usedEn.has(en) || !zh) && ++tries < 80);
    used.add(zh); usedEn.add(en);
    // a type: warrior, sage, leader or balanced, with stats to match
    const t = r(), arch = t < 0.38 ? 'war' : t < 0.6 ? 'sage' : t < 0.78 ? 'lead' : 'bal';
    const base = () => 34 + Math.floor(r() * 30);
    const hi = () => Math.min(97, 62 + Math.floor(Math.pow(r(), 1.6) * 34));
    let str = base(), int = base(), lead = base(), spd = base();
    if (arch === 'war') { str = hi(); int = 18 + Math.floor(r() * 40); }
    if (arch === 'sage') { int = hi(); str = 16 + Math.floor(r() * 36); }
    if (arch === 'lead') { lead = hi(); str = Math.max(str, 50 + Math.floor(r() * 25)); }
    if (arch === 'bal') { str += 8; int += 8; lead += 8; spd += 6; }
    if (fem) spd = Math.min(95, spd + 8);
    const unit = faction === 'pirate' || (['huang_zu', 'cai_mao', 'sun_hao', 'liu_xun'].includes(faction) && r() < 0.45) ? 'nav'
      : arch === 'sage' ? (r() < 0.8 ? 'inf' : 'nav')
        : ['qiang', 'gongsun', 'dong', 'yuan'].includes(faction) && r() < 0.5 ? 'cav' : pick(r, ['inf', 'inf', 'cav', 'arc', 'arc', 'nav']);
    const age = r() < 0.18 ? 'old' : r() < 0.2 ? 'young' : 'prime';
    const wk = arch === 'sage' ? 'staff' : unit === 'arc' ? (r() < 0.75 ? 'bow' : 'xbow') : pick(r, unit === 'cav' ? ['spear', 'spear', 'halberd', 'sword'] : ['sword', 'sword', 'spear', 'halberd', 'axe']);
    const skills = [];
    if (r() < 0.75) skills.push(pick(r, SKILL_POOL[arch]));
    if (r() < 0.25) { const s2 = pick(r, SKILL_POOL[arch]); if (!skills.includes(s2)) skills.push(s2); }
    if (unit === 'nav' && r() < 0.5 && !skills.includes('shuizhan')) skills.push('shuizhan');
    const id = 'g' + String(n++).padStart(3, '0');
    const lookStr = randomLook(r, { female: fem, age, arch, faction, unit });
    add({ id, zh, en, str, int, lead, spd, unit, faction, arch, age, wk, look: parseLook(lookStr), lookStr, gear: null, skills, famous: false, female: fem });
  }
})();
// the two traits of every general (traits.js); the old skill rolls above still run so the seeded names,
// stats and looks stay the same as before, but each general's passives are now exactly their two traits
assignTraits(GEN_LIST);
export const genName = (g) => (typeof g === 'string' ? (GENERALS[g] ? L(GENERALS[g].zh, GENERALS[g].en) : g) : L(g.zh, g.en));
// the gear a generated general carries at a given level
export function gearFor(g, lv) {
  if (g.gear) return { ...g.gear };
  const tier = Math.max(0, Math.min(4, Math.floor(lv / 11)));
  return { weapon: GEAR[g.wk][tier], armour: GEAR.armour[Math.min(4, tier + (g.arch === 'war' ? 0 : 0))], helm: g.arch === 'sage' ? (tier >= 2 ? 'lunjin' : null) : GEAR.helm[tier], horse: g.unit === 'cav' ? GEAR.horse[Math.max(1, tier)] : null, shield: null, cape: null, treasure: null };
}
