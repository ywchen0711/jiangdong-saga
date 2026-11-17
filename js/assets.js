// Pictures loaded before the game starts: Ninja Adventure tilesets (CC0) for towns and rooms, the world-map
// sprites drawn for this game, battle effects, the LPC horses. Paper-doll layers load later (doll.js).
const TILESETS = ['floor', 'nature', 'house', 'water', 'element', 'desert', 'interior', 'interiorfloor', 'wallsimple', 'towers', 'floordetail', 'field', 'relief', 'dungeon', 'villageabandoned', 'wobj', 'camp'];
export const FX = {
  explosion: [40, 9], flame: [25, 8], ice: [32, 10], thunder: [20, 8], pillar: [30, 9], spike: [54, 10], leaf: [30, 8], spirit: [32, 5],
  boost: [53, 8], spark: [27, 10], smoke: [32, 6], cutx: [32, 4], shield: [24, 6], rock: [30, 14], circle: [32, 4],
};
export const HORSES = ['brown', 'black', 'gray', 'white', 'golden'];
const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => { console.warn('missing picture', src); res(null); }; im.src = src; });
const pairs = [
  ...TILESETS.map((n) => ['t:' + n, 'assets/tiles/' + n + '.png?v=1']),
  ...Object.keys(FX).map((n) => ['x:' + n, 'assets/fx/' + n + '.png']),
  ...HORSES.map((n) => ['h:' + n, 'assets/horse/horse-' + n + '.png']),
];
const got = await Promise.all(pairs.map(([, src]) => load(src)));
export const IMG = Object.fromEntries(pairs.map(([k], i) => [k, got[i]]));
export const tileset = (n) => IMG['t:' + n];
let WOBJ = {};
try { WOBJ = await (await fetch('assets/tiles/wobj.json?v=1')).json(); } catch (e) { WOBJ = {}; }
export { WOBJ };
// draw a world-map sprite with its bottom centre at (x, y)
export function wsprite(g, name, x, y) {
  const r = WOBJ[name]; if (!r) return;
  g.drawImage(IMG['t:wobj'], r[0], r[1], r[2], r[3], Math.round(x - r[2] / 2), Math.round(y - r[3]), r[2], r[3]);
}
