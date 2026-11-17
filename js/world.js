// The world map: an original, stylised map of the Han lands, 256 x 192 tiles of 16 pixels. It is drawn from a
// hand-made outline (coasts, rivers, lakes, mountain ranges, the Great Wall) and filled in with noise, so it is
// the same every time. Places sit on it; roads join them. Pure data: no drawing here (see worldgfx.js).
export const WW = 256, WH = 192;
// tile kinds
export const K = {
  SEA: 0, SHOAL: 1, RIVER: 2, LAKE: 3, GRASS: 4, STEPPE: 5, FOREST: 6, PINE: 7, HILL: 8, MTN: 9, SNOWMTN: 10, DESERT: 11, SNOW: 12, MARSH: 13,
  ROAD: 14, BRIDGE: 15, FARM: 16, BEACH: 17, WALL: 18, PLACE: 19, FERRY: 20, PALM: 21, DUNE: 22,
};
export const WATER = new Set([K.SEA, K.SHOAL, K.RIVER, K.LAKE]);
const BLOCK = new Set([K.SEA, K.SHOAL, K.RIVER, K.LAKE, K.MTN, K.SNOWMTN, K.WALL]);
export const walkable = (k) => !BLOCK.has(k);
export const sailable = (k) => k === K.SEA || k === K.SHOAL || k === K.RIVER || k === K.LAKE || k === K.FERRY || k === K.PLACE;
// how much a step on each kind of ground adds to the chance of meeting an army
export const DANGER = { [K.GRASS]: 1, [K.STEPPE]: 1.1, [K.FOREST]: 1.4, [K.PINE]: 1.4, [K.HILL]: 1.3, [K.DESERT]: 1.2, [K.DUNE]: 1.3, [K.SNOW]: 1.3, [K.MARSH]: 1.5,
  [K.ROAD]: 0.45, [K.BRIDGE]: 0.3, [K.FARM]: 0.5, [K.BEACH]: 0.9, [K.PLACE]: 0, [K.FERRY]: 0, [K.PALM]: 1.2, [K.SEA]: 0.6, [K.SHOAL]: 0.6, [K.RIVER]: 0.7, [K.LAKE]: 0.6 };

// ---------- noise ----------
function hash2(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, s, oct = 4) { let t = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { t += vnoise(x * f, y * f, s + i * 17) * a; n += a; a *= 0.5; f *= 2; } return t / n; }

// ---------- the outline ----------
// the mainland's coast, clockwise from the north-west corner; the map's own edges count as land
const COAST = [[0, 0], [256, 0], [256, 9], [246, 10], [236, 12], [224, 14], [212, 18], [204, 22], [200, 27], [202, 33], [208, 37], [216, 39], [226, 37], [238, 35], [249, 38],
  [251, 41], [244, 45], [234, 48], [225, 54], [219, 60], [216, 66], [221, 72], [229, 79], [236, 85], [243, 90], [244, 94], [237, 98], [230, 101], [237, 103], [244, 104],
  [243, 112], [238, 120], [232, 128], [226, 135], [220, 142], [212, 150], [200, 157], [186, 162], [172, 165], [160, 169], [150, 171], [138, 175], [128, 179], [124, 186],
  [121, 192], [113, 192], [110, 183], [103, 178], [96, 181], [90, 192], [0, 192]];
const ISLANDS = [
  { x: 236, y: 158, rx: 5.5, ry: 12, rot: 0.25 }, // 夷洲
  { x: 249, y: 104, rx: 2.2, ry: 1.6, rot: 0 }, { x: 251, y: 109, rx: 1.4, ry: 1.2, rot: 0 }, // 舟山
  { x: 244, y: 30, rx: 2.5, ry: 1.5, rot: 0.3 }, { x: 247, y: 118, rx: 1.5, ry: 2, rot: 0 }, { x: 228, y: 146, rx: 1.8, ry: 1.3, rot: 0 },
  { x: 131, y: 187, rx: 8, ry: 5, rot: 0.1 }, // 珠崖
];
// rivers: [width in tiles, points from source to mouth]
export const RIVERS = {
  changjiang: [2.3, [[0, 128], [22, 124], [42, 120], [60, 116], [72, 113], [87, 109], [100, 104], [110, 99], [117, 98], [124, 96], [134, 98], [143, 104], [150, 109], [156, 110], [163, 104], [166, 100], [173, 102], [179, 106], [184, 105], [190, 103], [196, 99], [203, 94], [208, 91], [211, 87], [216, 85], [224, 86], [232, 88], [240, 90], [246, 91]]],
  huanghe: [2.0, [[30, 60], [45, 57], [58, 52], [66, 44], [76, 34], [86, 27], [100, 20], [114, 15], [124, 17], [127, 26], [128, 38], [127, 50], [126, 60], [129, 64], [138, 63], [150, 61], [160, 62], [168, 60], [176, 54], [184, 48], [192, 41], [200, 35], [204, 33]]],
  hanshui: [1.2, [[84, 79], [96, 80], [110, 81], [124, 82], [136, 84], [144, 89], [149, 95], [156, 98], [164, 99]]],
  huai: [1.2, [[152, 80], [164, 81], [176, 82], [186, 83], [194, 82], [202, 78], [210, 75], [218, 71], [222, 70]]],
  wei: [1.0, [[70, 66], [84, 65], [98, 66], [110, 65], [120, 64], [128, 63]]],
  xiang: [1.0, [[138, 146], [140, 138], [146, 130], [152, 122], [154, 114], [154, 111]]],
  gan: [1.0, [[172, 145], [176, 136], [180, 126], [182, 118], [186, 112]]],
  qiantang: [0.9, [[205, 118], [212, 112], [219, 106], [226, 102], [230, 101]]],
  zhujiang: [1.2, [[104, 162], [118, 161], [132, 162], [144, 164], [156, 167], [158, 170]]],
  min: [0.9, [[58, 82], [62, 92], [64, 102], [66, 112], [67, 114]]],
};
const LAKES = [
  { x: 153, y: 113, rx: 6, ry: 3.6 }, // 洞庭
  { x: 188, y: 109, rx: 3, ry: 5.5 }, // 鄱陽
  { x: 226, y: 94, rx: 3.6, ry: 3.2 }, // 太湖
  { x: 199, y: 90, rx: 2.2, ry: 1.5 }, // 巢湖
  { x: 210, y: 76, rx: 2.4, ry: 2.2 }, // 洪澤
  { x: 46, y: 140, rx: 2, ry: 3 }, // 滇池
];
// mountain ranges: [radius, snow?, points]
const RANGES = [
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
];
// the Great Wall
const GREATWALL = [[38, 40], [52, 44], [66, 40], [80, 32], [96, 28], [110, 24], [122, 22], [136, 22], [150, 22], [164, 18], [178, 16], [192, 16], [206, 14], [214, 15]];

// ---------- places ----------
// id: [中文, English, x, y, kind, region]
// kinds: capital, castle, town, village, port, fort, gate, cave, temple, camp
export const PLACES = {
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
// regions: [中文, English, centre x, centre y, chapter it opens in, level low, level high, enemy faction]
export const REGIONS = {
  wuhui: ['吳會', 'Wu-Kuaiji', 230, 101, 1, 1, 5, 'shanyue'],
  danyang: ['丹陽', 'Danyang', 210, 101, 2, 5, 9, 'sun_hao'],
  lujiang: ['廬江', 'Lujiang', 190, 94, 2, 7, 12, 'liu_xun'],
  jianye: ['建業', 'Jianye', 214, 84, 3, 11, 16, 'sun_hao'],
  jianan: ['建安', "Jian'an", 210, 136, 3, 14, 19, 'shanyue'],
  yuzhang: ['豫章', 'Yuzhang', 183, 120, 4, 15, 20, 'huang_zu'],
  jiangxia: ['江夏', 'Jiangxia', 168, 100, 4, 18, 23, 'huang_zu'],
  jingnan: ['荊南', 'South Jing', 148, 130, 5, 21, 26, 'cai_mao'],
  jingbei: ['荊北', 'North Jing', 142, 96, 5, 23, 28, 'cai_mao'],
  jiaozhou: ['交州', 'Jiao', 140, 166, 5, 25, 31, 'nanman'],
  isle: ['夷洲', 'Yizhou Isle', 236, 158, 6, 33, 39, 'pirate'],
  huainan: ['淮南', 'Huainan', 194, 80, 7, 32, 37, 'yuan'],
  xuzhou: ['徐州', 'Xu', 204, 62, 7, 33, 38, 'yuan'],
  qingzhou: ['青州', 'Qing', 226, 46, 7, 36, 42, 'yuan'],
  yuzhou: ['豫州', 'Yu', 160, 72, 7, 35, 40, 'yuan'],
  jizhou: ['冀州', 'Ji', 176, 42, 7, 38, 44, 'yuan'],
  youzhou: ['幽州', 'You', 196, 18, 7, 41, 47, 'yuan'],
  sili: ['司隸', 'Sili', 146, 60, 8, 42, 46, 'dong'],
  bingzhou: ['并州', 'Bing', 142, 36, 8, 42, 47, 'dong'],
  guanzhong: ['關中', 'Guanzhong', 112, 62, 8, 44, 50, 'dong'],
  liangzhou: ['涼州', 'Liang', 64, 50, 8, 46, 52, 'qiang'],
  saiwai: ['塞外', 'The Steppe', 140, 8, 8, 48, 55, 'qiang'],
  hanzhong: ['漢中', 'Hanzhong', 92, 84, 9, 50, 55, 'sect'],
  yizhou: ['益州', 'Yi', 66, 104, 9, 52, 57, 'liu_zhang'],
  nanzhong: ['南中', 'Nanzhong', 70, 142, 9, 50, 56, 'nanman'],
  badong: ['巴東', 'Badong', 114, 100, 10, 55, 60, 'sect'],
};
// roads: pairs of places
const ROADS = [
  ['wu', 'haiyan'], ['wu', 'qiantang'], ['qiantang', 'kuaiji'], ['kuaiji', 'shanyue'], ['wu', 'wucheng'], ['wucheng', 'qiantang'], ['wu', 'qua'], ['qua', 'moling'], ['moling', 'jianye'],
  ['jianye', 'niuzhu'], ['niuzhu', 'wanling'], ['wanling', 'qiantang'], ['wanling', 'huangshan'], ['niuzhu', 'juchao'], ['juchao', 'shu'], ['shu', 'wan'], ['wan', 'tianzhu'],
  ['wan', 'chaisang'], ['chaisang', 'lushan'], ['lushan', 'yuzhang'], ['yuzhang', 'poyang'], ['poyang', 'huangshan'], ['yuzhang', 'jianan'], ['jianan', 'dongye'], ['kuaiji', 'jianan'],
  ['chaisang', 'xisai'], ['xisai', 'xiakou'], ['xiakou', 'jiangling'], ['xiakou', 'changsha'], ['changsha', 'wuling'], ['changsha', 'lingling'], ['lingling', 'jiuyi'], ['wuling', 'jiangling'],
  ['jiangling', 'xiangyang'], ['xiangyang', 'longzhong'], ['xiangyang', 'xinye'], ['xinye', 'wancheng'], ['lingling', 'panyu'], ['panyu', 'hepu'], ['yuzhang', 'panyu'],
  ['juchao', 'hefei'], ['hefei', 'shouchun'], ['shouchun', 'pengcheng'], ['pengcheng', 'xiapi'], ['xiapi', 'jianye'], ['pengcheng', 'linzi'], ['shouchun', 'xuchang'],
  ['wancheng', 'xuchang'], ['xuchang', 'guandu'], ['guandu', 'puyang'], ['puyang', 'ye'], ['ye', 'nanpi'], ['nanpi', 'ji'], ['linzi', 'nanpi'], ['xuchang', 'hulao'], ['hulao', 'luoyang'],
  ['luoyang', 'jinyang'], ['ye', 'jinyang'], ['jinyang', 'mashi'], ['ji', 'mashi'], ['luoyang', 'tongguan'], ['tongguan', 'huashan'], ['tongguan', 'changan'], ['changan', 'meiwu'],
  ['meiwu', 'tianshui'], ['tianshui', 'wuwei'], ['changan', 'hanzhong'], ['hanzhong', 'yangping'], ['yangping', 'jiange'], ['jiange', 'chengdu'], ['chengdu', 'jiangzhou'],
  ['jiangzhou', 'baidi'], ['baidi', 'wuxia'], ['baidi', 'jiangling'], ['chengdu', 'jianning'], ['jianning', 'hepu'], ['wancheng', 'luoyang'],
];
// where roads may cross the Changjiang: ferries (everywhere else is open water until you have a ship)
// and the gates in the Great Wall where its road passes

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
  return [Math.hypot(px - qx, py - qy), t];
}
function lineDist(px, py, pts) { let best = 1e9; for (let i = 0; i + 1 < pts.length; i++) best = Math.min(best, segDist(px, py, ...pts[i], ...pts[i + 1])[0]); return best; }
// a river's points with meanders: subdivided and pushed sideways by noise
function meander(pts, seed, amp = 1.3) {
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 2));
    const nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1;
    for (let k = 0; k < n; k++) {
      const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      const d = (fbm(x * 0.15, y * 0.15, seed, 3) - 0.5) * 2 * amp * (i === 0 && k === 0 ? 0 : 1);
      out.push([x + (nx / nl) * d, y + (ny / nl) * d]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function generate() {
  const N = WW * WH, t = new Uint8Array(N), region = new Uint8Array(N), riverId = new Uint8Array(N);
  const I = (x, y) => y * WW + x;
  const rkeys = Object.keys(REGIONS);
  // 1. land and sea
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    const dx = (fbm(x * 0.09, y * 0.09, 11) - 0.5) * 7, dy = (fbm(x * 0.09, y * 0.09, 23) - 0.5) * 7;
    let land = inPoly(x + 0.5 + dx, y + 0.5 + dy, COAST);
    if (!land) for (const is of ISLANDS) {
      const c = Math.cos(is.rot), s = Math.sin(is.rot), ux = x + 0.5 - is.x, uy = y + 0.5 - is.y;
      const qx = (ux * c + uy * s) / is.rx, qy = (-ux * s + uy * c) / is.ry, wob = (fbm(x * 0.3, y * 0.3, 31) - 0.5) * 0.6;
      if (qx * qx + qy * qy < 1 + wob) { land = true; break; }
    }
    t[I(x, y)] = land ? K.GRASS : K.SEA;
  }
  // 2. elevation from the ranges, the western plateau and noise
  const elev = new Float32Array(N), snowy = new Uint8Array(N);
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    const i = I(x, y);
    if (t[i] !== K.GRASS) continue;
    let e = 0, sn = 0;
    for (const [r, snow, pts] of RANGES) {
      const d = lineDist(x + 0.5, y + 0.5, pts);
      if (d < r * 2.4) { const v = 1 - d / (r * 2.4); if (v > e) { e = v; sn = snow ? 1 : 0; } }
    }
    // the plateau in the far west
    const pw = 46 + (fbm(x * 0.05, y * 0.05, 41) - 0.5) * 16 - (y < 60 ? 10 : 0);
    if (x < pw && y > 56) { const v = Math.min(1, 0.6 + (pw - x) / 14); if (v > e) { e = v; sn = x < pw - 8 ? 1 : 0; } }
    e += (fbm(x * 0.12, y * 0.12, 51) - 0.5) * 0.55;
    // the south is hilly all over
    if (y > 120) e += (fbm(x * 0.2, y * 0.2, 53) - 0.45) * 0.4;
    elev[i] = e; snowy[i] = sn;
  }
  // 3. climate: deserts in the north-west, steppe beyond the Wall, snow on the plateau
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    const i = I(x, y);
    if (t[i] !== K.GRASS) continue;
    const e = elev[i], dry = fbm(x * 0.07, y * 0.07, 61);
    const wallY = lineDistY(x);
    if (e > 0.57) { t[i] = snowy[i] || (x < 52 && y > 56) ? K.SNOWMTN : K.MTN; continue; }
    if (e > 0.43) { t[i] = x < 50 && y > 56 ? K.SNOW : K.HILL; continue; }
    if ((x < 78 && y < 62 && dry + (78 - x) / 120 + (62 - y) / 160 > 0.62) || (y < wallY - 1 && x < 120 && dry > 0.48)) { t[i] = dry > 0.66 ? K.DUNE : K.DESERT; continue; }
    if (y < wallY - 1) { t[i] = K.STEPPE; continue; }
    if (x < 48 && y > 56) { t[i] = K.SNOW; continue; }
    // forests: thicker in the south and east
    const f = fbm(x * 0.11, y * 0.11, 71) + (y > 92 ? 0.08 : -0.06) + (y > 140 ? 0.06 : 0);
    if (f > 0.6) t[i] = y < 70 || e > 0.35 ? K.PINE : (y > 150 && hash2(x, y, 5) < 0.35 ? K.PALM : K.FOREST);
    else if (f > 0.56 && hash2(x, y, 3) < 0.5) t[i] = K.FOREST;
    else if (fbm(x * 0.2, y * 0.2, 81) > 0.72 && y > 70) t[i] = K.MARSH;
  }
  // 4. lakes
  for (const L of LAKES) for (let y = Math.floor(L.y - L.ry - 3); y <= L.y + L.ry + 3; y++) for (let x = Math.floor(L.x - L.rx - 3); x <= L.x + L.rx + 3; x++) {
    if (x < 0 || y < 0 || x >= WW || y >= WH) continue;
    const qx = (x + 0.5 - L.x) / L.rx, qy = (y + 0.5 - L.y) / L.ry, wob = (fbm(x * 0.4, y * 0.4, 91) - 0.5) * 0.8;
    if (qx * qx + qy * qy < 1 + wob) t[I(x, y)] = K.LAKE;
    else if (qx * qx + qy * qy < 1.6 + wob && t[I(x, y)] === K.GRASS && hash2(x, y, 9) < 0.4) t[I(x, y)] = K.MARSH;
  }
  // 5. rivers (they cut through hills and mountains)
  let rid = 0;
  for (const [name, [w, pts]] of Object.entries(RIVERS)) {
    rid++;
    const mp = meander(pts, 100 + rid, name === 'changjiang' ? 1.6 : 1.1);
    for (let k = 0; k + 1 < mp.length; k++) {
      const [ax, ay] = mp[k], [bx, by] = mp[k + 1], steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 3);
      for (let s = 0; s <= steps; s++) {
        const cx = ax + ((bx - ax) * s) / steps, cy = ay + ((by - ay) * s) / steps;
        // rivers widen towards the sea
        const ww = w * (0.75 + 0.5 * (k / mp.length));
        const r = ww / 2;
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
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    let best = 0, bd = 1e9;
    const jx = (fbm(x * 0.1, y * 0.1, 201) - 0.5) * 8, jy = (fbm(x * 0.1, y * 0.1, 203) - 0.5) * 8;
    rkeys.forEach((k, ri) => { const r = REGIONS[k], d = (x + jx - r[2]) ** 2 + (y + jy - r[3]) ** 2; if (d < bd) { bd = d; best = ri; } });
    region[I(x, y)] = best;
  }
  // places own their tile's region, whatever the noise says
  // 9. places: clear the ground round them
  const placeAt = {};
  for (const [id, p] of Object.entries(PLACES)) {
    const [, , x, y] = p;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const X = x + i, Y = y + j, ii = I(X, Y);
      if (t[ii] === K.MTN || t[ii] === K.SNOWMTN || t[ii] === K.WALL || (t[ii] === K.SHOAL && (i || j) === 0)) t[ii] = K.GRASS;
    }
    if (WATER.has(t[I(x, y)])) t[I(x, y)] = K.GRASS;
    t[I(x, y)] = K.PLACE;
    placeAt[I(x, y)] = id;
    // a place's tile and the ring round it belong to its own region
    const ri = rkeys.indexOf(p[5]);
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const X = x + i, Y = y + j; if (X >= 0 && Y >= 0 && X < WW && Y < WH) region[I(X, Y)] = ri; }
  }
  // farmland round towns and castles
  for (const p of Object.values(PLACES)) {
    if (!['capital', 'castle', 'town'].includes(p[4])) continue;
    const r = p[4] === 'capital' ? 4 : 3;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const X = p[2] + i, Y = p[3] + j;
      if (X < 0 || Y < 0 || X >= WW || Y >= WH) continue;
      const ii = I(X, Y);
      if ((t[ii] === K.GRASS || t[ii] === K.FOREST || t[ii] === K.MARSH) && i * i + j * j <= r * r && hash2(X, Y, 17) < 0.7) t[ii] = K.FARM;
    }
  }
  // 10. roads, found by the cheapest way over the land; rivers are bridged, the Changjiang is crossed by ferry
  const cost = (k) => ({ [K.GRASS]: 1, [K.FARM]: 1, [K.STEPPE]: 1, [K.BEACH]: 1.2, [K.ROAD]: 0.5, [K.BRIDGE]: 0.6, [K.FERRY]: 0.6, [K.PLACE]: 1, [K.FOREST]: 2.2, [K.PINE]: 2.4, [K.PALM]: 2,
    [K.HILL]: 3, [K.DESERT]: 1.8, [K.DUNE]: 3, [K.SNOW]: 3, [K.MARSH]: 3, [K.MTN]: 14, [K.SNOWMTN]: 20, [K.RIVER]: 9, [K.WALL]: 12, [K.LAKE]: 400, [K.SHOAL]: 400, [K.SEA]: 1e6 }[k] ?? 5);
  const big = riverId; const CJ = 1;
  for (const [a, b] of ROADS) {
    const pa = PLACES[a], pb = PLACES[b];
    const path = astar(t, pa[2], pa[3], pb[2], pb[3], cost);
    if (!path) { console.warn('no road', a, b); continue; }
    for (const i of path) {
      const k = t[i];
      if (k === K.PLACE) continue;
      if (k === K.RIVER) t[i] = big[i] === CJ ? K.FERRY : K.BRIDGE;
      else if (k === K.FERRY || k === K.BRIDGE) continue;
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
function astar(t, sx, sy, tx, ty, cost) {
  const N = WW * WH, g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = []; const push = (f, i) => { heap.push([f, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  const s = sy * WW + sx, e = ty * WW + tx; g[s] = 0; push(0, s);
  while (heap.length) {
    const [, i] = pop();
    if (closed[i]) continue; closed[i] = 1;
    if (i === e) break;
    const x = i % WW, y = (i / WW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= WW || Y >= WH) continue;
      const j = Y * WW + X; if (closed[j]) continue;
      const c = j === e ? 1 : cost(t[j]);
      if (c >= 1e5) continue;
      const ng = g[i] + c;
      if (ng < g[j]) { g[j] = ng; from[j] = i; push(ng + (Math.abs(X - tx) + Math.abs(Y - ty)) * 0.9, j); }
    }
  }
  if (from[e] < 0) return null;
  const path = []; for (let i = e; i >= 0 && i !== s; i = from[i]) path.push(i);
  return path.reverse();
}
