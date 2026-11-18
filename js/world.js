// The world map: an original, stylised map of the Han lands, 512 x 384 tiles of 16 pixels. It is drawn from a
// hand-made outline (coasts, rivers, lakes, mountain ranges, the Great Wall) and filled in with noise, so it is
// the same every time. Places sit on it; roads join them. Pure data: no drawing here (see worldgfx.js).
// The outline was first drawn on a 256 x 192 grid; it is kept in those numbers and doubled (S2) when the map is
// made, so the land keeps its shape while the distances between places grow and travel becomes a journey.
export const WW = 512, WH = 384;
const S2 = (pts) => pts.map(([x, y]) => [x * 2, y * 2]);
// tile kinds
export const K = {
  SEA: 0, SHOAL: 1, RIVER: 2, LAKE: 3, GRASS: 4, STEPPE: 5, FOREST: 6, PINE: 7, HILL: 8, MTN: 9, SNOWMTN: 10, DESERT: 11, SNOW: 12, MARSH: 13,
  ROAD: 14, BRIDGE: 15, FARM: 16, BEACH: 17, WALL: 18, PLACE: 19, FERRY: 20, PALM: 21, DUNE: 22, BAMBOO: 23,
};
export const WATER = new Set([K.SEA, K.SHOAL, K.RIVER, K.LAKE]);
const BLOCK = new Set([K.SEA, K.SHOAL, K.RIVER, K.LAKE, K.MTN, K.SNOWMTN, K.WALL]);
export const walkable = (k) => !BLOCK.has(k);
export const sailable = (k) => k === K.SEA || k === K.SHOAL || k === K.RIVER || k === K.LAKE || k === K.FERRY || k === K.PLACE;
// how much a step on each kind of ground adds to the chance of meeting an army
export const DANGER = { [K.GRASS]: 1, [K.STEPPE]: 1.1, [K.FOREST]: 1.4, [K.PINE]: 1.4, [K.BAMBOO]: 1.4, [K.HILL]: 1.3, [K.DESERT]: 1.2, [K.DUNE]: 1.3, [K.SNOW]: 1.3, [K.MARSH]: 1.5,
  [K.ROAD]: 0.45, [K.BRIDGE]: 0.3, [K.FARM]: 0.5, [K.BEACH]: 0.9, [K.PLACE]: 0, [K.FERRY]: 0, [K.PALM]: 1.2, [K.SEA]: 0.6, [K.SHOAL]: 0.6, [K.RIVER]: 0.7, [K.LAKE]: 0.6 };
// the battlefield each kind of ground gives a random battle (battle.js TERRAIN explains what each one does)
export const GROUND = { [K.FOREST]: 'forest', [K.PINE]: 'forest', [K.PALM]: 'forest', [K.BAMBOO]: 'forest', [K.HILL]: 'hill', [K.DESERT]: 'desert', [K.DUNE]: 'desert', [K.SNOW]: 'snow',
  [K.STEPPE]: 'steppe', [K.MARSH]: 'marsh', [K.BEACH]: 'grass', [K.RIVER]: 'ford', [K.BRIDGE]: 'ford', [K.FERRY]: 'ford', [K.FARM]: 'grass', [K.ROAD]: 'grass' };

// ---------- noise ----------
function hash2(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, s, oct = 4) { let t = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { t += vnoise(x * f, y * f, s + i * 17) * a; n += a; a *= 0.5; f *= 2; } return t / n; }

// ---------- the outline (on the old 256 x 192 grid, doubled below) ----------
// the mainland's coast, clockwise from the north-west corner; the map's own edges count as land
const COAST = S2([[0, 0], [256, 0], [256, 9], [246, 10], [236, 12], [224, 14], [212, 18], [204, 22], [200, 27], [202, 33], [208, 37], [216, 39], [226, 37], [238, 35], [249, 38],
  [251, 41], [244, 45], [234, 48], [225, 54], [219, 60], [216, 66], [221, 72], [229, 79], [236, 85], [243, 90], [244, 94], [237, 98], [230, 101], [237, 103], [244, 104],
  [243, 112], [238, 120], [232, 128], [226, 135], [220, 142], [212, 150], [200, 157], [186, 162], [172, 165], [160, 169], [150, 171], [138, 175], [128, 179], [124, 186],
  [121, 192], [113, 192], [110, 183], [103, 178], [96, 181], [90, 192], [0, 192]]);
// islands, on the new grid: x, y, radii, rotation
const ISLANDS = [
  { x: 472, y: 316, rx: 11, ry: 24, rot: 0.25 }, // 夷洲
  { x: 500, y: 206, rx: 7, ry: 5, rot: 0.2 }, { x: 503, y: 219, rx: 2.6, ry: 2.2, rot: 0 }, // 螺洲 and a rock beside it
  { x: 488, y: 58, rx: 6.5, ry: 4.2, rot: 0.3 }, // 蓬萊
  { x: 494, y: 236, rx: 3, ry: 4, rot: 0 }, // a skerry
  { x: 463, y: 290, rx: 9, ry: 3.4, rot: 0.55 }, // 鯨背島
  { x: 262, y: 372, rx: 17, ry: 10, rot: 0.1 }, // 珠崖
  { x: 506, y: 120, rx: 2.5, ry: 2, rot: 0 }, { x: 452, y: 330, rx: 2.4, ry: 2, rot: 0 },
];
// rivers: [width in tiles, points from source to mouth] (old grid, doubled)
const RIVERS0 = {
  changjiang: [3.4, [[0, 128], [22, 124], [42, 120], [60, 116], [72, 113], [87, 109], [100, 104], [110, 99], [117, 98], [124, 96], [134, 98], [143, 104], [150, 109], [156, 110], [163, 104], [166, 100], [173, 102], [179, 106], [184, 105], [190, 103], [196, 99], [203, 94], [208, 91], [211, 87], [216, 85], [224, 86], [232, 88], [240, 90], [246, 91]]],
  huanghe: [3.0, [[30, 60], [45, 57], [58, 52], [66, 44], [76, 34], [86, 27], [100, 20], [114, 15], [124, 17], [127, 26], [128, 38], [127, 50], [126, 60], [129, 64], [138, 63], [150, 61], [160, 62], [168, 60], [176, 54], [184, 48], [192, 41], [200, 35], [204, 33]]],
  hanshui: [1.8, [[84, 79], [96, 80], [110, 81], [124, 82], [136, 84], [144, 89], [149, 95], [156, 98], [164, 99]]],
  huai: [1.8, [[152, 80], [164, 81], [176, 82], [186, 83], [194, 82], [202, 78], [210, 75], [218, 71], [222, 70]]],
  wei: [1.5, [[70, 66], [84, 65], [98, 66], [110, 65], [120, 64], [128, 63]]],
  xiang: [1.5, [[138, 146], [140, 138], [146, 130], [152, 122], [154, 114], [154, 111]]],
  gan: [1.5, [[172, 145], [176, 136], [180, 126], [182, 118], [186, 112]]],
  qiantang: [1.4, [[205, 118], [212, 112], [219, 106], [226, 102], [230, 101]]],
  zhujiang: [1.8, [[104, 162], [118, 161], [132, 162], [144, 164], [156, 167], [158, 170]]],
  min: [1.4, [[58, 82], [62, 92], [64, 102], [66, 112], [67, 114]]],
};
export const RIVERS = Object.fromEntries(Object.entries(RIVERS0).map(([k, [w, p]]) => [k, [w, S2(p)]]));
const LAKES = [
  { x: 306, y: 226, rx: 12, ry: 7.2 }, // 洞庭
  { x: 376, y: 218, rx: 6, ry: 11 }, // 鄱陽
  { x: 452, y: 188, rx: 7.2, ry: 6.4 }, // 太湖
  { x: 398, y: 180, rx: 4.4, ry: 3 }, // 巢湖
  { x: 420, y: 152, rx: 4.8, ry: 4.4 }, // 洪澤
  { x: 92, y: 280, rx: 4, ry: 6 }, // 滇池
];
// little islands inside lakes (君山 in Dongting)
const LAKE_ISLES = [{ x: 302, y: 224, r: 2.3 }];
// mountain ranges: [radius, snow?, points] (old grid, doubled; the radius is doubled too)
const RANGES0 = [
  [3.2, false, [[70, 72], [84, 73], [100, 72], [116, 72], [130, 73], [140, 75]]], // 秦嶺
  [3.0, false, [[76, 89], [90, 86], [104, 86], [116, 89]]], // 大巴
  [2.6, false, [[114, 92], [120, 95], [126, 100], [124, 106]]], // 巫山
  [2.6, false, [[150, 26], [154, 38], [157, 50], [158, 58]]], // 太行
  [2.0, false, [[132, 30], [134, 42], [136, 52]]], // 呂梁
  [4.2, true, [[50, 96], [54, 110], [56, 124], [58, 138], [60, 150]]], // 橫斷
  [3.0, false, [[126, 150], [140, 151], [154, 149], [170, 151], [186, 152]]], // 南嶺
  [2.6, false, [[192, 124], [198, 132], [204, 142], [210, 148]]], // 武夷
  [1.6, false, [[208, 104], [214, 108], [220, 110]]], // 天目
  [2.0, false, [[170, 89], [178, 91], [186, 92]]], // 大別
  [1.4, false, [[192, 50], [195, 52]]], // 泰山
  [2.2, false, [[166, 14], [178, 11], [192, 12], [206, 10]]], // 燕山
  [3.6, true, [[30, 42], [44, 46], [58, 50], [72, 54]]], // 祁連
  [2.2, false, [[96, 120], [108, 128], [118, 138]]], // 武陵/雪峰
  [1.6, false, [[140, 120], [142, 130]]], // 衡山
  [1.8, false, [[118, 66], [124, 69]]], // 華山
  [2.0, false, [[86, 140], [96, 146], [108, 150]]], // 苗嶺
  [1.0, false, [[232, 116], [235, 120]]], // 天台
  [1.2, false, [[56, 105], [58, 109]]], // 峨眉
];
const RANGES = [...RANGES0.map(([r, sn, p]) => [r * 2, sn, S2(p)]), [2, false, [[358, 228], [364, 230]]]]; // and 廬山, south-west of the temple
// the Great Wall
const GREATWALL = S2([[38, 40], [52, 44], [66, 40], [80, 32], [96, 28], [110, 24], [122, 22], [136, 22], [150, 22], [164, 18], [178, 16], [192, 16], [206, 14], [214, 15]]);
// patches the story wants of a certain ground: [kind, x, y, radius]
const PATCHES = [['marsh', 306, 194, 9], ['bamboo', 404, 206, 6], ['bamboo', 470, 230, 3], ['forest', 310, 160, 5], ['bamboo', 150, 268, 4], ['pine', 282, 52, 3]];

// land that belongs to a region whatever the nearest centre says: [region, x, y, radius]
const REGION_PATCHES = [['jianan', 463, 290, 11], ['guanzhong', 212, 144, 9]];

// ---------- places ----------
// id: [中文, English, x, y, kind, region, scene]
// kinds: capital, castle, town, village, port, fort, gate, cave, temple, camp, and the places to explore:
// peak (a mountain path to a summit), falls (a waterfall with a cave behind it), wild (a forest, bamboo grove,
// marsh or canyon), ruins, spring (a hot spring), tower (a beacon tower), lighthouse, hut (a hermit's hut)
// scene: what an explorable place is like inside (explore.js); places without one use the town templates
const OLD = {
  wu: ['吳郡', 'Wu', 231, 93, 'castle', 'wuhui'],
  kuaiji: ['會稽', 'Kuaiji', 231, 106, 'town', 'wuhui'],
  haiyan: ['海鹽', 'Haiyan', 238, 99, 'village', 'wuhui'],
  qiantang: ['錢唐', 'Qiantang', 225, 103, 'town', 'wuhui'],
  wucheng: ['烏程寨', 'Wucheng Fort', 220, 97, 'fort', 'wuhui'],
  shanyue: ['山越洞', 'Shanyue Caves', 224, 112, 'cave', 'wuhui'],
  jianye: ['建業', 'Jianye', 212, 89, 'capital', 'jianye'],
  qua: ['曲阿', "Qu'a", 221, 88, 'town', 'jianye'],
  moling: ['秣陵關', 'Moling Gate', 216, 91, 'gate', 'jianye'],
  wanling: ['宛陵', 'Wanling', 210, 99, 'town', 'danyang'],
  niuzhu: ['牛渚', 'Niuzhu', 206, 94, 'port', 'danyang'],
  huangshan: ['黃山隱廬', 'Huangshan Hermitage', 214, 106, 'temple', 'danyang'],
  shu: ['舒縣', 'Shu', 192, 92, 'town', 'lujiang'],
  juchao: ['居巢', 'Juchao', 198, 94, 'village', 'lujiang'],
  wan: ['皖城', 'Wan Castle', 188, 98, 'castle', 'lujiang'],
  tianzhu: ['天柱山', 'Mount Tianzhu', 182, 94, 'cave', 'lujiang'],
  chaisang: ['柴桑', 'Chaisang', 183, 108, 'castle', 'yuzhang'],
  poyang: ['鄱陽', 'Poyang', 193, 114, 'town', 'yuzhang'],
  yuzhang: ['豫章', 'Yuzhang', 181, 118, 'castle', 'yuzhang'],
  lushan: ['廬山寺', 'Lushan Temple', 185, 112, 'temple', 'yuzhang'],
  jianan: ['建安', "Jian'an", 207, 131, 'town', 'jianan'],
  dongye: ['東冶', 'Dongye', 218, 139, 'port', 'jianan'],
  xiakou: ['夏口', 'Xiakou', 166, 102, 'castle', 'jiangxia'],
  xisai: ['西塞山', 'Xisai Hill', 174, 104, 'fort', 'jiangxia'],
  jiangling: ['江陵', 'Jiangling', 143, 106, 'castle', 'jingbei'],
  xiangyang: ['襄陽', 'Xiangyang', 144, 90, 'castle', 'jingbei'],
  xinye: ['新野', 'Xinye', 147, 84, 'town', 'jingbei'],
  longzhong: ['隆中', 'Longzhong', 140, 88, 'village', 'jingbei'],
  changsha: ['長沙', 'Changsha', 153, 121, 'castle', 'jingnan'],
  wuling: ['武陵', 'Wuling', 139, 114, 'village', 'jingnan'],
  lingling: ['零陵', 'Lingling', 139, 137, 'town', 'jingnan'],
  jiuyi: ['九嶷山', 'Mount Jiuyi', 146, 145, 'cave', 'jingnan'],
  panyu: ['番禺', 'Panyu', 156, 164, 'castle', 'jiaozhou'],
  hepu: ['合浦', 'Hepu', 124, 172, 'village', 'jiaozhou'],
  yizhouisle: ['夷洲', 'Yizhou Isle', 236, 158, 'village', 'isle'],
  hefei: ['合肥', 'Hefei', 197, 86, 'castle', 'huainan'],
  shouchun: ['壽春', 'Shouchun', 191, 80, 'castle', 'huainan'],
  pengcheng: ['彭城', 'Pengcheng', 196, 66, 'town', 'xuzhou'],
  xiapi: ['下邳', 'Xiapi', 205, 68, 'castle', 'xuzhou'],
  linzi: ['臨淄', 'Linzi', 214, 49, 'town', 'qingzhou'],
  xuchang: ['許昌', 'Xuchang', 161, 72, 'capital', 'yuzhou'],
  wancheng: ['宛城', 'Wancheng', 148, 78, 'castle', 'yuzhou'],
  guandu: ['官渡', 'Guandu', 163, 64, 'fort', 'yuzhou'],
  puyang: ['濮陽', 'Puyang', 174, 56, 'town', 'jizhou'],
  ye: ['鄴城', 'Ye', 167, 49, 'castle', 'jizhou'],
  nanpi: ['南皮', 'Nanpi', 190, 37, 'town', 'jizhou'],
  ji: ['薊城', 'Ji', 188, 20, 'castle', 'youzhou'],
  luoyang: ['洛陽', 'Luoyang', 146, 66, 'capital', 'sili'],
  hulao: ['虎牢關', 'Hulao Gate', 154, 65, 'gate', 'sili'],
  jinyang: ['晉陽', 'Jinyang', 146, 38, 'castle', 'bingzhou'],
  tongguan: ['潼關', 'Tong Gate', 124, 66, 'gate', 'guanzhong'],
  changan: ['長安', "Chang'an", 111, 68, 'capital', 'guanzhong'],
  meiwu: ['郿塢', 'Mei Fortress', 101, 68, 'fort', 'guanzhong'],
  huashan: ['華山', 'Mount Hua', 120, 70, 'temple', 'guanzhong'],
  tianshui: ['天水', 'Tianshui', 79, 64, 'town', 'liangzhou'],
  wuwei: ['武威', 'Wuwei', 48, 37, 'town', 'liangzhou'],
  mashi: ['塞外馬市', 'Steppe Horse Fair', 150, 10, 'village', 'saiwai'],
  hanzhong: ['漢中', 'Hanzhong', 93, 79, 'castle', 'hanzhong'],
  yangping: ['陽平關', 'Yangping Gate', 84, 79, 'gate', 'hanzhong'],
  jiange: ['劍閣', 'Jiange Pass', 77, 86, 'gate', 'yizhou'],
  chengdu: ['成都', 'Chengdu', 62, 99, 'capital', 'yizhou'],
  jiangzhou: ['江州', 'Jiangzhou', 88, 107, 'town', 'yizhou'],
  jianning: ['建寧', 'Jianning', 60, 140, 'town', 'nanzhong'],
  baidi: ['白帝城', 'Baidi', 113, 97, 'castle', 'badong'],
  wuxia: ['巫峽黑蓮宮', 'Black Lotus Palace', 121, 93, 'temple', 'badong'],
};
// the places to explore, on the new grid. scene: { t: type, ... } (explore.js builds each one)
const NEW = {
  luozhou: ['螺洲村', 'Conch Isle', 497, 204, 'village', 'wuhui', { t: 'isle', ferry: 'haiyan' }],
  chaoyindong: ['潮音洞', 'Tide-Voice Grotto', 504, 209, 'cave', 'wuhui', { t: 'cave', theme: 'sea', floors: 2 }],
  shanjuan: ['善卷洞', 'Shanjuan Grotto', 446, 200, 'cave', 'wuhui', { t: 'cave', theme: 'lime', floors: 2 }],
  yuewang: ['越王城遺址', 'Ruins of the Yue King', 471, 221, 'ruins', 'wuhui', { t: 'ruins' }],
  tiantai: ['天台山', 'Mount Tiantai', 468, 240, 'peak', 'wuhui', { t: 'peak' }],
  yunqi: ['雲棲村', 'Cloudrest Village', 410, 216, 'village', 'danyang', { t: 'hamlet', theme: 'mountain' }],
  zhuhai: ['竹海', 'The Bamboo Sea', 403, 206, 'wild', 'danyang', { t: 'wild', theme: 'bamboo' }],
  copper: ['銅官山礦', 'Copper Hill Mine', 394, 203, 'cave', 'lujiang', { t: 'cave', theme: 'mine', floors: 2 }],
  fengqiao: ['楓橋渡', 'Maple Ferry', 404, 191, 'village', 'lujiang', { t: 'hamlet', theme: 'ferry' }],
  chimei: ['赤眉寨', 'Red-Brow Camp', 400, 252, 'camp', 'jianan', { t: 'camp' }],
  jingbei: ['鯨背島', 'Whaleback Isle', 458, 288, 'village', 'jianan', { t: 'isle', ferry: 'dongye' }],
  wanghai: ['望海燈塔', 'Seawatch Light', 469, 292, 'lighthouse', 'jianan', { t: 'lighthouse' }],
  xianglu: ['香爐峰瀑布', 'Censer Peak Falls', 368, 231, 'falls', 'yuzhang', { t: 'falls' }],
  daoxiang: ['稻香村', 'Rice-Scent Village', 318, 252, 'village', 'jingnan', { t: 'hamlet', theme: 'farm' }],
  yunmeng: ['雲夢澤', 'Yunmeng Marsh', 305, 195, 'wild', 'jingbei', { t: 'wild', theme: 'marsh' }],
  junshan: ['君山島', 'Junshan Isle', 302, 224, 'village', 'jingnan', { t: 'isle', ferry: 'changsha', lake: true }],
  zhuya: ['珠崖港', 'Pearl Cliff Harbour', 256, 367, 'village', 'jiaozhou', { t: 'isle', ferry: 'hepu' }],
  coral: ['珊瑚洞', 'Coral Grotto', 272, 373, 'cave', 'jiaozhou', { t: 'cave', theme: 'sea', floors: 2 }],
  yunbao: ['雲豹洞', 'Clouded-Leopard Cave', 470, 302, 'cave', 'isle', { t: 'cave', theme: 'lime', floors: 2 }],
  sangtian: ['桑田里', 'Mulberry Hamlet', 404, 158, 'village', 'huainan', { t: 'hamlet', theme: 'farm' }],
  taishan: ['泰山', 'Mount Tai', 388, 108, 'peak', 'xuzhou', { t: 'peak' }],
  penglai: ['蓬萊島', 'Penglai Isle', 488, 58, 'hut', 'qingzhou', { t: 'hut', ferry: 'linzi' }],
  yinxu: ['殷墟', 'The Yin Ruins', 344, 106, 'ruins', 'jizhou', { t: 'ruins' }],
  huangtian: ['黃天寨', 'Yellow Sky Camp', 309, 158, 'camp', 'yuzhou', { t: 'camp' }],
  mengjin: ['孟津渡', 'Mengjin Ferry', 290, 118, 'village', 'sili', { t: 'hamlet', theme: 'ferry' }],
  hukou: ['壺口瀑布', 'Hukou Falls', 251, 66, 'falls', 'bingzhou', { t: 'falls' }],
  lishan: ['驪山溫泉', 'Lishan Hot Springs', 231, 130, 'spring', 'guanzhong', { t: 'spring' }],
  fenghuo: ['烽火臺', 'Beacon Tower', 282, 48, 'tower', 'bingzhou', { t: 'tower' }],
  bingfeng: ['冰風洞', 'Icewind Cave', 110, 94, 'cave', 'liangzhou', { t: 'cave', theme: 'ice', floors: 2 }],
  ziwu: ['子午谷', 'Ziwu Gorge', 212, 137, 'wild', 'guanzhong', { t: 'wild', theme: 'canyon' }],
  emei: ['峨眉山', 'Mount Emei', 112, 216, 'peak', 'yizhou', { t: 'peak' }],
  baishui: ['白水瀑布', 'Whitewater Falls', 150, 264, 'falls', 'nanzhong', { t: 'falls' }],
  xuanwu: ['玄武岩窟', 'Basalt Grotto', 104, 268, 'cave', 'nanzhong', { t: 'cave', theme: 'basalt', floors: 2 }],
};
export const PLACES = {};
for (const [id, p] of Object.entries(OLD)) PLACES[id] = [p[0], p[1], p[2] * 2, p[3] * 2, p[4], p[5]];
for (const [id, p] of Object.entries(NEW)) PLACES[id] = p;
// a few places sit a little off their doubled spot so they keep their shore, their pass or their clearing
const NUDGE = { haiyan: [-10, -4] };
for (const [id, [dx, dy]] of Object.entries(NUDGE)) { PLACES[id][2] += dx; PLACES[id][3] += dy; }
export const sceneOf = (id) => (PLACES[id] && PLACES[id][6]) || null;
// regions: [中文, English, centre x, centre y, chapter it opens in, level low, level high, enemy faction]
// (centres on the new grid; levels rise along the road the story takes, see README "natural levelling")
export const REGIONS = {
  wuhui: ['吳會', 'Wu-Kuaiji', 460, 202, 1, 1, 6, 'shanyue'],
  danyang: ['丹陽', 'Danyang', 420, 202, 2, 7, 11, 'sun_hao'],
  lujiang: ['廬江', 'Lujiang', 380, 188, 2, 10, 14, 'liu_xun'],
  jianye: ['建業', 'Jianye', 428, 168, 3, 15, 19, 'sun_hao'],
  jianan: ['建安', "Jian'an", 420, 272, 3, 17, 21, 'shanyue'],
  yuzhang: ['豫章', 'Yuzhang', 366, 240, 4, 20, 24, 'huang_zu'],
  jiangxia: ['江夏', 'Jiangxia', 336, 200, 4, 22, 26, 'huang_zu'],
  jingnan: ['荊南', 'South Jing', 296, 260, 5, 28, 32, 'cai_mao'],
  jingbei: ['荊北', 'North Jing', 284, 192, 5, 29, 33, 'cai_mao'],
  jiaozhou: ['交州', 'Jiao', 280, 332, 5, 31, 35, 'nanman'],
  isle: ['夷洲', 'Yizhou Isle', 472, 316, 6, 36, 40, 'pirate'],
  huainan: ['淮南', 'Huainan', 388, 160, 7, 40, 44, 'yuan'],
  xuzhou: ['徐州', 'Xu', 408, 124, 7, 41, 45, 'yuan'],
  qingzhou: ['青州', 'Qing', 452, 92, 7, 43, 47, 'yuan'],
  yuzhou: ['豫州', 'Yu', 320, 144, 7, 42, 46, 'yuan'],
  jizhou: ['冀州', 'Ji', 352, 84, 7, 44, 48, 'yuan'],
  youzhou: ['幽州', 'You', 392, 36, 7, 46, 50, 'yuan'],
  sili: ['司隸', 'Sili', 292, 120, 8, 50, 54, 'dong'],
  bingzhou: ['并州', 'Bing', 284, 72, 8, 51, 55, 'dong'],
  guanzhong: ['關中', 'Guanzhong', 224, 124, 8, 52, 56, 'dong'],
  liangzhou: ['涼州', 'Liang', 128, 100, 8, 53, 57, 'qiang'],
  saiwai: ['塞外', 'The Steppe', 280, 16, 8, 54, 58, 'qiang'],
  hanzhong: ['漢中', 'Hanzhong', 184, 168, 9, 58, 62, 'sect'],
  yizhou: ['益州', 'Yi', 132, 208, 9, 59, 63, 'liu_zhang'],
  nanzhong: ['南中', 'Nanzhong', 140, 284, 9, 58, 62, 'nanman'],
  badong: ['巴東', 'Badong', 228, 200, 10, 64, 68, 'sect'],
};
// roads: pairs of places
const ROADS = [
  ['wu', 'haiyan'], ['wu', 'qiantang'], ['qiantang', 'kuaiji'], ['kuaiji', 'shanyue'], ['wu', 'wucheng'], ['wucheng', 'qiantang'], ['wu', 'qua'], ['qua', 'moling'], ['moling', 'jianye'],
  ['jianye', 'niuzhu'], ['niuzhu', 'wanling'], ['wanling', 'qiantang'], ['wanling', 'huangshan'], ['niuzhu', 'fengqiao'], ['fengqiao', 'juchao'], ['juchao', 'shu'], ['shu', 'wan'], ['wan', 'tianzhu'],
  ['wan', 'chaisang'], ['chaisang', 'lushan'], ['lushan', 'yuzhang'], ['yuzhang', 'poyang'], ['poyang', 'huangshan'], ['yuzhang', 'jianan'], ['jianan', 'dongye'], ['kuaiji', 'jianan'],
  ['chaisang', 'xisai'], ['xisai', 'xiakou'], ['xiakou', 'jiangling'], ['xiakou', 'changsha'], ['changsha', 'wuling'], ['changsha', 'lingling'], ['lingling', 'jiuyi'], ['wuling', 'jiangling'],
  ['jiangling', 'xiangyang'], ['xiangyang', 'longzhong'], ['xiangyang', 'xinye'], ['xinye', 'wancheng'], ['lingling', 'panyu'], ['panyu', 'hepu'], ['yuzhang', 'panyu'],
  ['juchao', 'hefei'], ['hefei', 'shouchun'], ['shouchun', 'pengcheng'], ['pengcheng', 'xiapi'], ['xiapi', 'jianye'], ['pengcheng', 'linzi'], ['shouchun', 'xuchang'],
  ['wancheng', 'xuchang'], ['xuchang', 'guandu'], ['guandu', 'puyang'], ['puyang', 'ye'], ['ye', 'nanpi'], ['nanpi', 'ji'], ['linzi', 'nanpi'], ['xuchang', 'hulao'], ['hulao', 'luoyang'],
  ['luoyang', 'mengjin'], ['mengjin', 'jinyang'], ['ye', 'jinyang'], ['jinyang', 'mashi'], ['ji', 'mashi'], ['luoyang', 'tongguan'], ['tongguan', 'huashan'], ['tongguan', 'changan'], ['changan', 'meiwu'],
  ['meiwu', 'tianshui'], ['tianshui', 'wuwei'], ['changan', 'hanzhong'], ['hanzhong', 'yangping'], ['yangping', 'jiange'], ['jiange', 'chengdu'], ['chengdu', 'jiangzhou'],
  ['jiangzhou', 'baidi'], ['baidi', 'wuxia'], ['baidi', 'jiangling'], ['chengdu', 'jianning'], ['jianning', 'hepu'], ['wancheng', 'luoyang'],
  // paths to the places off the main roads
  ['qiantang', 'shanjuan'], ['kuaiji', 'yuewang'], ['yuewang', 'tiantai'], ['huangshan', 'yunqi'], ['wanling', 'zhuhai'], ['niuzhu', 'copper'], ['jianan', 'chimei'],
  ['lushan', 'xianglu'], ['changsha', 'daoxiang'], ['jiangling', 'yunmeng'], ['hefei', 'sangtian'], ['xiapi', 'taishan'], ['ye', 'yinxu'], ['xuchang', 'huangtian'],
  ['jinyang', 'hukou'], ['changan', 'lishan'], ['jinyang', 'fenghuo'], ['wuwei', 'bingfeng'], ['changan', 'ziwu'], ['chengdu', 'emei'], ['jianning', 'baishui'], ['jianning', 'xuanwu'],
  ['luozhou', 'chaoyindong'], ['jingbei', 'wanghai'], ['zhuya', 'coral'], ['yizhouisle', 'yunbao'],
];

// ---------- generation ----------
function inPoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = Math.max(0, Math.min(1, t));
  const qx = ax + dx * t, qy = ay + dy * t;
  return Math.hypot(px - qx, py - qy);
}
function lineDist(px, py, pts) { let best = 1e9; for (let i = 0; i + 1 < pts.length; i++) best = Math.min(best, segDist(px, py, ...pts[i], ...pts[i + 1])); return best; }
// a river's points with meanders: subdivided and pushed sideways by noise
function meander(pts, seed, amp) {
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 3));
    const nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1;
    for (let k = 0; k < n; k++) {
      const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      const d = (fbm(x * 0.075, y * 0.075, seed, 3) - 0.5) * 2 * amp * (i === 0 && k === 0 ? 0 : 1);
      out.push([x + (nx / nl) * d, y + (ny / nl) * d]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
// bounding boxes, so each range or river only looks at the tiles near it
const bbox = (pts, pad) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [Math.max(0, Math.floor(x0 - pad)), Math.max(0, Math.floor(y0 - pad)), Math.min(WW - 1, Math.ceil(x1 + pad)), Math.min(WH - 1, Math.ceil(y1 + pad))]; };

export function generate() {
  const N = WW * WH, t = new Uint8Array(N), region = new Uint8Array(N), riverId = new Uint8Array(N);
  const I = (x, y) => y * WW + x;
  const rkeys = Object.keys(REGIONS);
  // 1. land and sea
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    const dx = (fbm(x * 0.045, y * 0.045, 11) - 0.5) * 13 + (fbm(x * 0.16, y * 0.16, 13, 2) - 0.5) * 3;
    const dy = (fbm(x * 0.045, y * 0.045, 23) - 0.5) * 13 + (fbm(x * 0.16, y * 0.16, 29, 2) - 0.5) * 3;
    let land = inPoly(x + 0.5 + dx, y + 0.5 + dy, COAST);
    if (!land) for (const is of ISLANDS) {
      if (Math.abs(x - is.x) > is.rx + is.ry + 4 || Math.abs(y - is.y) > is.rx + is.ry + 4) continue;
      const c = Math.cos(is.rot), s = Math.sin(is.rot), ux = x + 0.5 - is.x, uy = y + 0.5 - is.y;
      const qx = (ux * c + uy * s) / is.rx, qy = (-ux * s + uy * c) / is.ry, wob = (fbm(x * 0.2, y * 0.2, 31) - 0.5) * 0.7;
      if (qx * qx + qy * qy < 1 + wob) { land = true; break; }
    }
    t[I(x, y)] = land ? K.GRASS : K.SEA;
  }
  // 2. elevation from the ranges, the western plateau and noise
  const elev = new Float32Array(N), snowy = new Uint8Array(N);
  for (const [r, snow, pts] of RANGES) {
    const [x0, y0, x1, y1] = bbox(pts, r * 2.4 + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = I(x, y); if (t[i] !== K.GRASS) continue;
      const d = lineDist(x + 0.5, y + 0.5, pts);
      // peaks and saddles along the range, so it is never one smooth ridge
      if (d < r * 2.4) { const v = (1 - d / (r * 2.4)) * (0.42 + 0.95 * fbm(x * 0.11, y * 0.11, 47, 3)); if (v > elev[i]) { elev[i] = v; snowy[i] = snow ? 1 : 0; } }
    }
  }
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    const i = I(x, y);
    if (t[i] !== K.GRASS) continue;
    let e = elev[i], sn = snowy[i];
    // the plateau in the far west
    const pw = 92 + (fbm(x * 0.025, y * 0.025, 41) - 0.5) * 32 + (fbm(x * 0.09, y * 0.09, 45) - 0.5) * 22 - (y < 120 ? 20 : 0), py0 = 112 + (fbm(x * 0.04, y * 0.04, 43) - 0.5) * 30;
    if (x < pw && y > py0) { const v = Math.min(1, 0.6 + (pw - x) / 28); if (v > e) { e = v; sn = x < pw - 16 ? 1 : 0; } }
    e += (fbm(x * 0.06, y * 0.06, 51) - 0.5) * 0.55 + (fbm(x * 0.21, y * 0.21, 57, 2) - 0.5) * 0.12;
    // the south is hilly all over
    if (y > 240) e += (fbm(x * 0.1, y * 0.1, 53) - 0.45) * 0.4;
    elev[i] = e; snowy[i] = sn;
  }
  // 3. climate: deserts in the north-west, steppe beyond the Wall, snow on the plateau
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    const i = I(x, y);
    if (t[i] !== K.GRASS) continue;
    const e = elev[i], dry = fbm(x * 0.035, y * 0.035, 61);
    const wallY = lineDistY(x);
    // the edges of the cold west and the dry north-west wander, so no straight line shows
    const wx = 98 + (fbm(x * 0.05, y * 0.05, 63) - 0.5) * 26, wy = 112 + (fbm(x * 0.05, y * 0.05, 65) - 0.5) * 28, cold = x < wx && y > wy;
    if (e > 0.57) { t[i] = snowy[i] || cold ? K.SNOWMTN : K.MTN; continue; }
    if (e > 0.43) { t[i] = cold ? K.SNOW : K.HILL; continue; }
    const dx2 = 156 + (fbm(x * 0.04, y * 0.04, 67) - 0.5) * 30, dy2 = 124 + (fbm(x * 0.04, y * 0.04, 69) - 0.5) * 30;
    if ((x < dx2 && y < dy2 && dry + (dx2 - x) / 240 + (dy2 - y) / 320 > 0.62) || (y < wallY - 2 && x < 240 && dry > 0.48)) { t[i] = dry > 0.66 ? K.DUNE : K.DESERT; continue; }
    if (y < wallY - 2) { t[i] = K.STEPPE; continue; }
    if (x < wx - 4 && y > wy + 4) { t[i] = K.SNOW; continue; }
    // forests: thicker in the south and east; bamboo in the wet south-east hills
    const f = fbm(x * 0.055, y * 0.055, 71) + (y > 184 ? 0.08 : -0.06) + (y > 280 ? 0.06 : 0);
    if (f > 0.6) t[i] = y < 140 || e > 0.35 ? K.PINE : (y > 300 && hash2(x, y, 5) < 0.35 ? K.PALM : (y > 190 && x > 330 && fbm(x * 0.09, y * 0.09, 73) > 0.6 ? K.BAMBOO : K.FOREST));
    else if (f > 0.56 && hash2(x, y, 3) < 0.5) t[i] = K.FOREST;
    else if (fbm(x * 0.1, y * 0.1, 81) > 0.72 && y > 140) t[i] = K.MARSH;
  }
  // 4. lakes
  for (const Lk of LAKES) for (let y = Math.floor(Lk.y - Lk.ry - 4); y <= Lk.y + Lk.ry + 4; y++) for (let x = Math.floor(Lk.x - Lk.rx - 4); x <= Lk.x + Lk.rx + 4; x++) {
    if (x < 0 || y < 0 || x >= WW || y >= WH) continue;
    const qx = (x + 0.5 - Lk.x) / Lk.rx, qy = (y + 0.5 - Lk.y) / Lk.ry, wob = (fbm(x * 0.2, y * 0.2, 91) - 0.5) * 0.8;
    if (qx * qx + qy * qy < 1 + wob) t[I(x, y)] = K.LAKE;
    else if (qx * qx + qy * qy < 1.6 + wob && t[I(x, y)] === K.GRASS && hash2(x, y, 9) < 0.4) t[I(x, y)] = K.MARSH;
  }
  for (const is of LAKE_ISLES) for (let y = Math.floor(is.y - is.r - 1); y <= is.y + is.r + 1; y++) for (let x = Math.floor(is.x - is.r - 1); x <= is.x + is.r + 1; x++) if (Math.hypot(x + 0.5 - is.x, y + 0.5 - is.y) <= is.r) t[I(x, y)] = K.FOREST;
  // 5. rivers (they cut through hills and mountains)
  let rid = 0;
  for (const [name, [w, pts]] of Object.entries(RIVERS)) {
    rid++;
    const mp = meander(pts, 100 + rid, name === 'changjiang' ? 3 : 2.2);
    for (let k = 0; k + 1 < mp.length; k++) {
      const [ax, ay] = mp[k], [bx, by] = mp[k + 1], steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 3);
      // rivers widen towards the sea
      const r = (w * (0.75 + 0.5 * (k / mp.length))) / 2;
      for (let s = 0; s <= steps; s++) {
        const cx = ax + ((bx - ax) * s) / steps, cy = ay + ((by - ay) * s) / steps;
        for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
          if (x < 0 || y < 0 || x >= WW || y >= WH) continue;
          if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r + 0.1) {
            const i = I(x, y);
            if (t[i] === K.SEA || t[i] === K.LAKE) continue;
            t[i] = K.RIVER; riverId[i] = rid;
          }
        }
      }
    }
  }
  // 5b. patches of ground the story wants (the Yunmeng marsh, the Bamboo Sea...)
  const KIND_OF = { marsh: K.MARSH, bamboo: K.BAMBOO, forest: K.FOREST, pine: K.PINE };
  for (const [kd, px, py, r] of PATCHES) for (let y = py - r - 2; y <= py + r + 2; y++) for (let x = px - r - 2; x <= px + r + 2; x++) {
    if (x < 0 || y < 0 || x >= WW || y >= WH) continue;
    const i = I(x, y), d = Math.hypot(x - px, y - py) / r + (fbm(x * 0.3, y * 0.3, 97) - 0.5) * 0.6;
    if (d < 1 && [K.GRASS, K.FOREST, K.PINE, K.HILL, K.MARSH, K.PALM].includes(t[i])) t[i] = KIND_OF[kd];
  }
  // 6. shallows along every coast, beaches where the land meets the sea
  const near = (x, y, f, r = 1) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const X = x + i, Y = y + j; if (X >= 0 && Y >= 0 && X < WW && Y < WH && f(t[I(X, Y)])) return true; } return false; };
  const land = (k) => !WATER.has(k);
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    const i = I(x, y);
    if (t[i] === K.SEA && near(x, y, land, 2)) t[i] = K.SHOAL;
  }
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    const i = I(x, y);
    if ((t[i] === K.GRASS || t[i] === K.FOREST || t[i] === K.PALM) && near(x, y, (k) => k === K.SHOAL) && hash2(x, y, 13) < 0.75) t[i] = K.BEACH;
  }
  // 7. the Great Wall
  for (let k = 0; k + 1 < GREATWALL.length; k++) {
    const [ax, ay] = GREATWALL[k], [bx, by] = GREATWALL[k + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
    let px = -1, py = -1;
    for (let s = 0; s <= n; s++) {
      const x = Math.round(ax + ((bx - ax) * s) / n), y = Math.round(ay + ((by - ay) * s) / n);
      if (x === px && y === py) continue;
      // keep it four-connected so nobody slips through a diagonal
      if (px >= 0 && x !== px && y !== py) { const ii = I(x, py); if (!WATER.has(t[ii])) t[ii] = K.WALL; }
      const i = I(x, y);
      if (!WATER.has(t[i])) t[i] = K.WALL;
      px = x; py = y;
    }
  }
  // 8. regions: nearest centre, a little wobbly
  const rc = rkeys.map((k) => [REGIONS[k][2], REGIONS[k][3]]);
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    let best = 0, bd = 1e9;
    const jx = (fbm(x * 0.05, y * 0.05, 201) - 0.5) * 16, jy = (fbm(x * 0.05, y * 0.05, 203) - 0.5) * 16;
    for (let ri = 0; ri < rc.length; ri++) { const d = (x + jx - rc[ri][0]) ** 2 + (y + jy - rc[ri][1]) ** 2; if (d < bd) { bd = d; best = ri; } }
    region[I(x, y)] = best;
  }
  // 8b. a few patches of land belong to a region whatever the nearest centre says (an island, a gorge's mouth)
  for (const [rkk, px, py, r] of REGION_PATCHES) { const ri = rkeys.indexOf(rkk); for (let y = py - r; y <= py + r; y++) for (let x = px - r; x <= px + r; x++) if (x >= 0 && y >= 0 && x < WW && y < WH && Math.hypot(x - px, y - py) <= r) region[I(x, y)] = ri; }
  // 9. places: clear the ground round them
  const placeAt = {};
  for (const [id, p] of Object.entries(PLACES)) {
    const [, , x, y] = p;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const X = x + i, Y = y + j, ii = I(X, Y);
      if (t[ii] === K.MTN || t[ii] === K.SNOWMTN || t[ii] === K.WALL || (t[ii] === K.SHOAL && (i || j) === 0)) t[ii] = K.GRASS;
    }
    if (WATER.has(t[I(x, y)])) t[I(x, y)] = K.GRASS;
    // a cave mouth, a waterfall or the sect's gate stands in a clearing, so nothing hides it
    if (p[4] === 'cave' || p[4] === 'falls' || p[4] === 'peak' || id === 'wuxia') for (let j = -1; j <= 1; j++) for (let i = -2; i <= 2; i++) { const ii = I(x + i, y + j); if ([K.FOREST, K.PINE, K.PALM, K.BAMBOO, K.HILL, K.MARSH, K.SNOWMTN].includes(t[ii])) t[ii] = K.GRASS; }
    t[I(x, y)] = K.PLACE;
    placeAt[I(x, y)] = id;
    // a place's tile and the ring round it belong to its own region
    const ri = rkeys.indexOf(p[5]);
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const X = x + i, Y = y + j; if (X >= 0 && Y >= 0 && X < WW && Y < WH) region[I(X, Y)] = ri; }
  }
  // farmland round towns and castles
  for (const p of Object.values(PLACES)) {
    if (!['capital', 'castle', 'town'].includes(p[4]) && !(p[6] && p[6].theme === 'farm')) continue;
    const r = p[4] === 'capital' ? 6 : 4;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const X = p[2] + i, Y = p[3] + j;
      if (X < 0 || Y < 0 || X >= WW || Y >= WH) continue;
      const ii = I(X, Y);
      if ((t[ii] === K.GRASS || t[ii] === K.FOREST || t[ii] === K.MARSH) && i * i + j * j <= r * r && hash2(X, Y, 17) < 0.7) t[ii] = K.FARM;
    }
  }
  // 10. roads, found by the cheapest way over the land; rivers are bridged, the Changjiang is crossed by ferry
  const COST = new Float32Array(32).fill(5);
  for (const [k, c] of Object.entries({ [K.GRASS]: 1, [K.FARM]: 1, [K.STEPPE]: 1, [K.BEACH]: 1.2, [K.ROAD]: 0.5, [K.BRIDGE]: 0.6, [K.FERRY]: 0.6, [K.PLACE]: 1, [K.FOREST]: 2.2, [K.PINE]: 2.4, [K.PALM]: 2, [K.BAMBOO]: 2.4,
    [K.HILL]: 3, [K.DESERT]: 1.8, [K.DUNE]: 3, [K.SNOW]: 3, [K.MARSH]: 3, [K.MTN]: 14, [K.SNOWMTN]: 20, [K.RIVER]: 9, [K.WALL]: 12, [K.LAKE]: 400, [K.SHOAL]: 400, [K.SEA]: 1e6 })) COST[k] = c;
  const AS = astarBuffers();
  const CJ = 1;
  for (const [a, b] of ROADS) {
    const pa = PLACES[a], pb = PLACES[b];
    const path = astar(AS, t, pa[2], pa[3], pb[2], pb[3], COST);
    if (!path) { console.warn('no road', a, b); continue; }
    for (const i of path) {
      const k = t[i];
      if (k === K.PLACE) continue;
      if (k === K.RIVER) t[i] = riverId[i] === CJ ? K.FERRY : K.BRIDGE;
      else if (k === K.FERRY || k === K.BRIDGE) continue;
      else if (WATER.has(k)) continue;
      else t[i] = K.ROAD;
    }
  }
  return { t, region, rkeys, placeAt, riverId, elev };
}
// the Great Wall's y at a given x (for "beyond the Wall")
function lineDistY(x) {
  for (let k = 0; k + 1 < GREATWALL.length; k++) { const [ax, ay] = GREATWALL[k], [bx, by] = GREATWALL[k + 1]; if (x >= ax && x <= bx) return ay + ((by - ay) * (x - ax)) / (bx - ax); }
  return x < GREATWALL[0][0] ? GREATWALL[0][1] : 0;
}
// A* over the tiles with a binary heap in typed arrays; the buffers are made once and reused for every road
function astarBuffers() { const N = WW * WH; return { g: new Float32Array(N), from: new Int32Array(N), mark: new Uint32Array(N), closed: new Uint32Array(N), hk: new Float32Array(N * 4), hv: new Int32Array(N * 4), gen: 0 }; }
function astar(A, t, sx, sy, tx, ty, COST) {
  const { g, from, mark, closed, hk, hv } = A; const gen = ++A.gen;
  let n = 0;
  const push = (f, i) => { let c = n++; hk[c] = f; hv[c] = i; while (c > 0) { const p = (c - 1) >> 1; if (hk[p] <= hk[c]) break; const tk = hk[p], tv = hv[p]; hk[p] = hk[c]; hv[p] = hv[c]; hk[c] = tk; hv[c] = tv; c = p; } };
  const pop = () => { const top = hv[0]; n--; if (n > 0) { hk[0] = hk[n]; hv[0] = hv[n]; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < n && hk[l] < hk[m]) m = l; if (r < n && hk[r] < hk[m]) m = r; if (m === c) break; const tk = hk[m], tv = hv[m]; hk[m] = hk[c]; hv[m] = hv[c]; hk[c] = tk; hv[c] = tv; c = m; } } return top; };
  const s = sy * WW + sx, e = ty * WW + tx;
  mark[s] = gen; g[s] = 0; from[s] = -1; push(0, s);
  while (n) {
    const i = pop();
    if (closed[i] === gen) continue; closed[i] = gen;
    if (i === e) break;
    const x = i % WW, y = (i / WW) | 0;
    for (let d = 0; d < 4; d++) {
      const X = x + (d === 0 ? 1 : d === 1 ? -1 : 0), Y = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (X < 0 || Y < 0 || X >= WW || Y >= WH) continue;
      const j = Y * WW + X; if (closed[j] === gen) continue;
      const c = j === e ? 1 : COST[t[j]];
      if (c >= 1e5) continue;
      const ng = g[i] + c;
      if (mark[j] !== gen || ng < g[j]) { mark[j] = gen; g[j] = ng; from[j] = i; push(ng + (Math.abs(X - tx) + Math.abs(Y - ty)) * 0.9, j); }
    }
  }
  if (mark[e] !== gen || closed[e] !== gen) return null;
  const path = []; for (let i = e; i >= 0 && i !== s; i = from[i]) path.push(i);
  return path.reverse();
}
