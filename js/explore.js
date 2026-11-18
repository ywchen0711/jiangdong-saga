// 秘境 (places to explore): caves of limestone, sea rock, an old copper mine, ice and black basalt; island and
// mountain villages, farming hamlets and ferry crossings; peaks climbed by switchback paths to a summit view;
// waterfalls with a cave hidden behind the water; a bamboo sea, the Yunmeng marsh and a gorge; old ruins with a
// crypt below; bandit camps; a lighthouse, a beacon tower on the Wall, a hot spring and a hermit's hut on Penglai.
// Every one is a small map made here from a few building blocks and the place's own numbers, so it always looks
// the same: its people, a little story or secret, a guardian to beat and something to find. Ferries carry you to
// the islands before you have a ship of your own. (Each place's entry in world.js gives its kind and scene.)
import { hash, ctx, W, H, text, windowBox } from './gfx.js?v=10';
import { tileset } from './assets.js?v=10';
import { TILES } from './tiles.js?v=10';
import { PLACES, REGIONS, WW, WH, sceneOf } from './world.js?v=10';
import { L } from './i18n.js?v=10';
import { canvasMap, finish, obj, thing, npc, folkLook, buildRoom, SCENE, placeName, taken } from './maps.js?v=10';
import { say, ask, pushRaw, removeRaw } from './ui.js?v=10';
import { input } from './input.js?v=10';
import { sfx, playMusic } from './audio.js?v=10';
import { S, give, have, take, healAll } from './state.js?v=10';
import { ITEMS } from './data.js?v=10';
import { GEN_LIST, GENERALS, genName } from './generals.js?v=10';
import { F, toMap } from './field.js?v=10';
import { gainTreasure } from './treasure_world.js?v=10';
import { overviewMap } from './worldgfx.js?v=10';

const G = () => window.G;
const N = (zh, en) => say(null, L(zh, en));
const seedOf = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

// ---------- tiles ----------
const R = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const isOpen = (n, dx, dy) => { const k = n(dx, dy); return !!k && !(TILES[k] && TILES[k].solid); };
// a floor of one colour with a scatter of specks and pebbles
const floorT = (base, specks, extra) => ({ draw(g, X, Y) { R(g, base, 0, 0, 16, 16); for (let i = 0; i < 5; i++) if (hash(X * 3 + i, Y * 5, 41) < 0.45) R(g, specks[i % specks.length], Math.floor(hash(X, Y, 50 + i) * 14), Math.floor(hash(X, Y, 60 + i) * 14), 1 + (i % 2), 1); if (extra) extra(g, X, Y); } });
// a wall of rock: black inside, a lit face where floor lies below it, a dark rim beside floor
const wallT = (face, light, line, cols) => ({ solid: true, draw(g, X, Y, n) {
  R(g, '#0e0c0c', 0, 0, 16, 16);
  if (isOpen(n, 0, 1)) { R(g, face, 0, 4, 16, 12); R(g, light, 0, 4, 16, 2); R(g, line, 0, 15, 16, 1); for (let x = (X * 5) % (cols || 6); x < 16; x += cols || 6) R(g, line, x, 7, 1, 7); }
  else if (isOpen(n, 0, -1) || isOpen(n, 1, 0) || isOpen(n, -1, 0)) R(g, '#241e1a', 0, 0, 16, 16);
} });
TILES.limefloor = floorT('#b4aa90', ['#a0967e', '#cac2aa', '#8e846e']);
TILES.limewall = wallT('#c8bea4', '#e4dcc4', '#9a907a');
TILES.seafloor = floorT('#7e806c', ['#6a7470', '#9a9a84', '#e8e4d8'], (g, X, Y) => { if (hash(X, Y, 71) < 0.08) { R(g, '#e8d0c0', 6, 7, 3, 2); R(g, '#c89a88', 7, 8, 1, 1); } });
TILES.seawall = wallT('#4a6068', '#6a8890', '#2c3c44');
TILES.minefloor = floorT('#5a4634', ['#4a3828', '#6e5640', '#3a2c20']);
// a mine's wall: brown rock, with a timber prop every few steps
TILES.minewall = (() => { const base = wallT('#6a4a30', '#86603e', '#4a321e'); return { solid: true, draw(g, X, Y, n) { base.draw(g, X, Y, n); if (isOpen(n, 0, 1) && X % 4 === 0) { R(g, '#3a2410', 6, 4, 4, 12); R(g, '#9a6a3a', 7, 4, 2, 12); R(g, '#3a2410', 0, 4, 16, 2); R(g, '#9a6a3a', 0, 5, 16, 1); } } }; })();
TILES.rail = { draw(g, X, Y, n) {
  TILES.minefloor.draw(g, X, Y, n);
  const h = n(-1, 0) === 'rail' || n(1, 0) === 'rail';
  if (h) { for (let x = 1; x < 16; x += 4) R(g, '#6a4424', x, 4, 2, 9); R(g, '#a8a8b0', 0, 5, 16, 1); R(g, '#a8a8b0', 0, 11, 16, 1); }
  else { for (let y = 1; y < 16; y += 4) R(g, '#6a4424', 4, y, 9, 2); R(g, '#a8a8b0', 5, 0, 1, 16); R(g, '#a8a8b0', 11, 0, 1, 16); }
} };
TILES.icefloor = floorT('#d4e8f6', ['#b8d4ea', '#f4fbff', '#a8c4dc'], (g, X, Y) => { if (hash(X, Y, 73) < 0.2) R(g, '#b0cce0', 2, Math.floor(hash(X, Y, 74) * 14), 11, 1); });
TILES.icewall = wallT('#bcd8ec', '#ffffff', '#86a8c4', 5);
TILES.basfloor = floorT('#4a4a52', ['#3a3a42', '#5a5a64', '#2e2e34']);
TILES.baswall = wallT('#3a3a44', '#565662', '#1e1e24', 4);
// a cave's standing stones: a stalagmite, an ice spike, a basalt column (each on its own floor)
const standT = (under, draw) => ({ solid: true, draw(g, X, Y, n, f) { TILES[under].draw(g, X, Y, n, f); draw(g, X, Y); } });
TILES.stalag = standT('limefloor', (g) => { R(g, '#3a3428', 4, 3, 8, 13); R(g, '#d8d0b8', 5, 4, 6, 12); R(g, '#f0e8d4', 6, 4, 2, 11); R(g, '#a89e86', 9, 8, 2, 8); R(g, '#d8d0b8', 7, 1, 2, 3); });
TILES.seastone = standT('seafloor', (g) => { R(g, '#1c2a30', 2, 6, 12, 10); R(g, '#5a7480', 3, 7, 10, 8); R(g, '#7a98a2', 3, 7, 10, 2); R(g, '#e8f0f0', 4, 14, 8, 1); });
TILES.icespike = standT('icefloor', (g) => { R(g, '#5a7a98', 5, 1, 6, 15); R(g, '#e0f4ff', 6, 2, 4, 14); R(g, '#ffffff', 7, 2, 1, 12); R(g, '#a8d0f0', 9, 6, 1, 9); });
TILES.bascol = standT('basfloor', (g) => { R(g, '#121216', 3, 1, 10, 15); R(g, '#3e3e48', 4, 2, 8, 14); R(g, '#5a5a66', 4, 2, 8, 2); R(g, '#24242a', 8, 4, 1, 12); });
TILES.minecart = standT('rail', (g) => { R(g, '#1a1a1e', 2, 6, 12, 7); R(g, '#4a4a54', 3, 7, 10, 5); R(g, '#c87830', 3, 4, 10, 3); R(g, '#e8a050', 5, 4, 4, 1); R(g, '#101010', 3, 13, 3, 3); R(g, '#101010', 10, 13, 3, 3); });
// outdoors: a cliff (rock top, a lit face where open ground lies below), a waterfall, steps cut in stone
// the mountain's rock: a rugged top with cracks and tufts of green, and a tall lit face of layered stone where
// open ground lies below it
TILES.cliff = { solid: true, draw(g, X, Y, n) {
  R(g, '#5e5a50', 0, 0, 16, 16);
  for (let i = 0; i < 6; i++) if (hash(X + i, Y * 3, 81) < 0.55) R(g, ['#6e6a5e', '#4e4a42', '#7a7668', '#46423a'][i % 4], Math.floor(hash(X, Y, 82 + i) * 13), Math.floor(hash(X, Y, 86 + i) * 13), 2 + (i % 3), 1);
  if (hash(X, Y, 88) < 0.3) { R(g, '#3e6a34', 3 + Math.floor(hash(X, Y, 89) * 8), 2 + Math.floor(hash(X, Y, 90) * 8), 4, 2); R(g, '#5a8a40', 4 + Math.floor(hash(X, Y, 89) * 8), 2 + Math.floor(hash(X, Y, 90) * 8), 2, 1); }
  if (isOpen(n, 0, 1)) { R(g, '#2a2620', 0, 2, 16, 1); R(g, '#a89a84', 0, 3, 16, 13); R(g, '#c8bca4', 0, 3, 16, 2); for (const yy of [7, 11]) R(g, '#8a7c68', 0, yy, 16, 1); for (let x = (X * 3) % 5; x < 16; x += 5) R(g, '#7a6c58', x, 5, 1, 10); R(g, '#3a322a', 0, 15, 16, 1); }
  else if (isOpen(n, 0, -1)) R(g, '#8a8474', 0, 0, 16, 1);
  if (isOpen(n, -1, 0)) R(g, '#2a2620', 0, 0, 1, 16); if (isOpen(n, 1, 0)) R(g, '#2a2620', 15, 0, 1, 16);
} };
const fallsDraw = (g, X, Y) => { R(g, '#2a6aa8', 0, 0, 16, 16); R(g, '#78b8ec', 1, 0, 14, 16); for (let i = 0; i < 4; i++) R(g, '#ffffff', 2 + Math.floor(hash(X, i, 91) * 12), 0, 1, 16); R(g, '#c8e8ff', 3 + (Y % 3) * 3, 0, 2, 16); };
TILES.falls = { solid: true, draw: fallsDraw };
TILES.fallsgap = { draw: fallsDraw };
// a flat stone standing in shallow water: water all round it, the stone dry on top (walkable)
TILES.stepstone = { draw(g, X, Y, n) { TILES.water.draw(g, X, Y, n); g.fillStyle = 'rgba(40,90,140,0.45)'; g.beginPath(); g.ellipse(8, 10, 6.5, 4, 0, 0, 7); g.fill(); g.fillStyle = '#5e5e66'; g.beginPath(); g.ellipse(8, 9, 6, 4, 0, 0, 7); g.fill(); g.fillStyle = '#9a9aa2'; g.beginPath(); g.ellipse(7.5, 8, 5, 3, 0, 0, 7); g.fill(); g.fillStyle = '#c4c4cc'; g.fillRect(5, 6, 4, 1); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(1, 12, 3, 1); g.fillRect(12, 13, 3, 1); } };
TILES.foam = { solid: true, draw(g, X, Y, n, f) { TILES.water.draw(g, X, Y, n, f); g.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 4; i++) g.fillRect(Math.floor(hash(X, Y, 93 + i) * 13), Math.floor(hash(X, Y, 97 + i) * 13), 3, 1); } };
TILES.steps = { draw(g, X, Y) { R(g, '#9a9284', 0, 0, 16, 16); for (let y = 0; y < 16; y += 4) { R(g, '#b8b0a0', 0, y, 16, 2); R(g, '#6a6458', 0, y + 3, 16, 1); } } };
TILES.reeds = { solid: true, draw(g, X, Y, n) { TILES.mire.draw(g, X, Y, n); for (let i = 0; i < 5; i++) { const x = 1 + Math.floor(hash(X, Y, 101 + i) * 13), h = 6 + Math.floor(hash(X, Y, 106 + i) * 7); R(g, '#3a6a2a', x, 16 - h, 1, h); R(g, '#a88a4a', x, 16 - h, 1, 2); } } };
TILES.palisade = { solid: true, draw(g, X, Y, n) { TILES.dpath.draw(g, X, Y, n); for (let x = 0; x < 16; x += 4) { R(g, '#2a1808', x, 1, 4, 15); R(g, '#8a5a30', x + 1, 3, 2, 13); R(g, '#b07a44', x + 1, 1, 2, 2); } R(g, '#3a2410', 0, 9, 16, 2); } };
TILES.paddy = { solid: true, draw(g, X, Y) { R(g, '#3a7a8a', 0, 0, 16, 16); R(g, '#5a9aa8', 0, 0, 16, 1); for (let y = 2; y < 16; y += 5) for (let x = 1 + (y % 2) * 2; x < 16; x += 4) { R(g, '#5aa83a', x, y, 1, 3); R(g, '#8ad050', x + 1, y, 1, 2); } } };
TILES.bamboot = { solid: true, draw(g, X, Y, n) { TILES.dgrass.draw(g, X, Y, n); for (let i = 0; i < 3; i++) { const x = 1 + Math.floor(hash(X, Y, 111 + i) * 12); R(g, '#1e4a1c', x, 0, 3, 16); R(g, i % 2 ? '#5aa040' : '#78b848', x + 1, 0, 1, 16); R(g, '#2e6a2a', x, (X * 7 + i * 5) % 12, 3, 1); R(g, '#4a9a3a', x - 2, (Y * 3 + i * 4) % 14, 3, 1); } } };
TILES.boardwalk = { draw(g, X, Y, n) { R(g, '#3a2410', 0, 0, 16, 16); for (let i = 0; i < 16; i += 4) { R(g, '#9a6a3a', i, 1, 3, 14); R(g, '#b88850', i, 1, 3, 1); } } };
TILES.bridge = { draw(g, X, Y, n) { R(g, '#0c0a10', 0, 0, 16, 16); R(g, '#3a2410', 0, 2, 16, 12); for (let i = 0; i < 16; i += 3) R(g, '#a87a48', i, 3, 2, 10); R(g, '#d8c090', 0, 2, 16, 1); R(g, '#d8c090', 0, 13, 16, 1); } };
TILES.chasm = { solid: true, draw(g, X, Y, n) { R(g, '#0c0a10', 0, 0, 16, 16); if (!n(0, -1) || n(0, -1) !== 'chasm') { R(g, '#3a322a', 0, 0, 16, 3); } for (let i = 0; i < 2; i++) R(g, '#1c1820', Math.floor(hash(X, Y, 121 + i) * 14), 6 + i * 4, 2, 1); } };
TILES.snowg = floorT('#eef4fa', ['#d8e4f0', '#ffffff', '#c8d8e8']);
TILES.rubble = { solid: true, draw(g, X, Y, n, f) { TILES.grass.draw(g, X, Y, n, f); R(g, '#2a2420', 2, 7, 12, 9); R(g, '#9a9080', 3, 8, 10, 7); R(g, '#b8ae9a', 3, 8, 10, 2); R(g, '#7a7060', 8, 11, 4, 4); } };

// murky marsh water: dark green-brown, ripples and duckweed
TILES.mire = { solid: true, draw(g, X, Y, n) { R(g, '#3a5a44', 0, 0, 16, 16); for (let i = 0; i < 4; i++) if (hash(X + i, Y, 131) < 0.5) R(g, i % 2 ? '#4e7a52' : '#2e4a3a', Math.floor(hash(X, Y, 132 + i) * 12), Math.floor(hash(X, Y, 136 + i) * 14), 4, 1); if (hash(X, Y, 140) < 0.25) { R(g, '#6a9a3a', 4, 6, 3, 2); R(g, '#8ab84a', 5, 6, 1, 1); } const land = (dx, dy) => { const k = n(dx, dy); return k && k !== 'mire' && k !== 'reeds' && k !== 'boardwalk'; }; if (land(0, -1)) R(g, '#2a3a20', 0, 0, 16, 2); if (land(-1, 0)) R(g, '#2a3a20', 0, 0, 2, 16); if (land(1, 0)) R(g, '#2a3a20', 14, 0, 2, 16); } };
// ---------- props drawn here (g, left, top of the tile, frame) ----------
const PR = {
  stele: (g, X, Y) => { R(g, '#1a1410', X + 2, Y - 14, 12, 30); R(g, '#8a8478', X + 3, Y - 13, 10, 28); R(g, '#a8a296', X + 3, Y - 13, 10, 2); for (let i = 0; i < 5; i++) R(g, '#4a463e', X + 5, Y - 9 + i * 4, 6, 1); R(g, '#5a544a', X + 1, Y + 12, 14, 4); },
  altar: (g, X, Y, f) => { R(g, '#1a1410', X, Y + 4, 16, 12); R(g, '#9a8a70', X + 1, Y + 5, 14, 10); R(g, '#c8b890', X + 1, Y + 5, 14, 2); const k = (f >> 3) % 2; R(g, k ? '#f8a030' : '#f8d050', X + 6, Y, 4, 5); R(g, '#ffe890', X + 7, Y + 1, 2, 3); },
  shell: (g, X, Y, f) => { R(g, '#3a2a30', X + 1, Y + 3, 14, 13); R(g, '#f0d8c8', X + 2, Y + 4, 12, 11); R(g, '#e0a890', X + 4, Y + 6, 8, 2); R(g, '#e0a890', X + 5, Y + 9, 6, 2); R(g, '#c87868', X + 7, Y + 12, 3, 2); if ((f >> 4) % 3 === 0) R(g, '#ffffff', X + 12, Y + 1, 1, 3); },
  crystal: (g, X, Y) => { R(g, '#1a2a4a', X + 4, Y - 2, 8, 18); R(g, '#7ac8f8', X + 5, Y - 1, 6, 16); R(g, '#e0f8ff', X + 6, Y, 2, 13); R(g, '#3a7ac0', X + 9, Y + 4, 2, 11); },
  scarecrow: (g, X, Y) => { R(g, '#4a2c18', X + 7, Y - 6, 2, 22); R(g, '#4a2c18', X + 1, Y - 2, 14, 2); R(g, '#c8a058', X + 4, Y - 12, 8, 7); R(g, '#a83020', X + 5, Y - 1, 6, 7); R(g, '#c8a058', X + 3, Y - 13, 10, 2); },
  pavilion: (g, X, Y) => { R(g, '#3a1408', X - 8, Y - 14, 32, 5); R(g, '#c83020', X - 7, Y - 13, 30, 3); R(g, '#e0b858', X - 9, Y - 15, 34, 1); for (const px of [-5, 18]) { R(g, '#2a1008', px + X, Y - 9, 3, 25); R(g, '#a82418', px + X + 1, Y - 9, 1, 25); } R(g, '#8a7a60', X - 7, Y + 12, 30, 4); },
  lamp: (g, X, Y, f) => { const k = (f >> 4) % 2; R(g, '#3a2a20', X + 2, Y + 6, 12, 10); R(g, '#a89060', X + 3, Y + 7, 10, 8); R(g, k ? '#fff4a0' : '#ffe060', X + 4, Y - 4, 8, 10); g.fillStyle = 'rgba(255,240,150,0.25)'; g.beginPath(); g.arc(X + 8, Y + 1, 14, 0, 7); g.fill(); },
  deadlamp: (g, X, Y) => { R(g, '#3a2a20', X + 2, Y + 6, 12, 10); R(g, '#a89060', X + 3, Y + 7, 10, 8); R(g, '#5a5048', X + 4, Y - 4, 8, 10); },
  beacon: (g, X, Y, f) => { R(g, '#2a2420', X + 1, Y + 4, 14, 12); R(g, '#7a7060', X + 2, Y + 5, 12, 10); if (S.flags.ex_fenghuo_lit) { const k = (f >> 3) % 2; R(g, k ? '#f07818' : '#ffb030', X + 3, Y - 4, 10, 9); R(g, '#ffe080', X + 5, Y - 1, 6, 5); } else R(g, '#3a2a20', X + 4, Y + 2, 8, 3); },
  boat: (g, X, Y) => { R(g, '#2a1808', X - 8, Y + 4, 32, 9); R(g, '#8a5a30', X - 7, Y + 5, 30, 6); R(g, '#b07a44', X - 7, Y + 5, 30, 1); R(g, '#3a2410', X + 7, Y - 16, 2, 21); R(g, '#e8dcc0', X + 9, Y - 14, 10, 14); },
  net: (g, X, Y) => { R(g, '#3a2410', X + 1, Y - 6, 2, 22); R(g, '#3a2410', X + 13, Y - 6, 2, 22); g.fillStyle = '#a8a088'; for (let i = 0; i < 6; i++) { g.fillRect(X + 3, Y - 4 + i * 3, 10, 1); g.fillRect(X + 3 + i * 2, Y - 4, 1, 16); } },
  view: (g, X, Y, f) => { const k = (f >> 4) % 2; R(g, '#3a2410', X + 7, Y - 2, 2, 18); R(g, '#c8a058', X + 2, Y - 6, 12, 6); R(g, '#3a2410', X + 3, Y - 4, 10, 1); R(g, '#3a2410', X + 3, Y - 2, 8, 1); if (k) R(g, '#ffe070', X + 6, Y - 12, 4, 4); },
  bones: (g, X, Y) => { R(g, '#e8e0d0', X + 3, Y + 9, 10, 2); R(g, '#e8e0d0', X + 5, Y + 6, 2, 6); R(g, '#d8d0c0', X + 9, Y + 5, 4, 4); R(g, '#2a2420', X + 10, Y + 6, 1, 1); },
  // a stone pillar snapped off, its top lying beside it
  brokenpillar: (g, X, Y) => { R(g, '#2a2420', X + 3, Y - 10, 10, 26); R(g, '#a89c8a', X + 4, Y - 9, 8, 25); R(g, '#c8bca8', X + 4, Y - 9, 2, 25); R(g, '#8a7e6c', X + 10, Y - 9, 2, 25); R(g, '#2a2420', X + 4, Y - 12, 4, 3); R(g, '#a89c8a', X + 8, Y - 11, 4, 2); R(g, '#5a7a3a', X + 3, Y + 10, 4, 3); },
  crane: (g, X, Y, f) => { const k = (f >> 5) % 2; R(g, '#2a2a2a', X + 7, Y + 6, 1, 10); R(g, '#2a2a2a', X + 9, Y + 6, 1, 10); R(g, '#f8f8f8', X + 4, Y - 2, 9, 9); R(g, '#202020', X + 10, Y + 2, 3, 5); R(g, '#f8f8f8', X + 3 + k, Y - 10, 2, 9); R(g, '#e02020', X + 3 + k, Y - 11, 2, 2); R(g, '#e8b040', X + 1 + k, Y - 9, 2, 1); },
};
const prop = (m, x, y, name, o = {}) => thing(m, x, y, PR[name], o);

// ---------- building blocks ----------
function start(w, h, fill) { const b = canvasMap(w, h, fill); return { b, m: { ents: [] } }; }
const R2 = (id, k) => hash(seedOf(id) % 9973, k, 13);
const exit = (m, x, y) => m.ents.push({ type: 'exit', x, y });
const stairs = (m, x, y, to, up, extra = {}) => m.ents.push({ type: 'stairs', x, y, to, up, ...extra });
const chest = (m, x, y, id, item) => m.ents.push({ type: 'chest', x, y, id, item });
const person = (m, x, y, look, talk, extra = {}) => m.ents.push(npc(extra.id || `ex_${talk}_${x}_${y}`, look, talk, { x, y, dir: extra.dir || 'd', wander: !!extra.wander, mark: extra.mark, cond: extra.cond, equip: extra.equip, opts: extra.opts }));
function done(id, sub, b, m, meta) {
  const sc = sceneOf(id), P = PLACES[id];
  return finish(b, { id: sub ? `${id}/${sub}` : id, name: placeName(id), music: 'village', safe: !meta.enc, ents: m.ents, kind: 'scene', place: id, scene: sc, trSpots: m.trSpots, ...meta, P });
}
// a free tile for a prop or a chest: open ground, nothing on it
const freeAt = (b, m, x, y) => { const k = b.get(x, y); return k && !(TILES[k] && TILES[k].solid) && !taken(m, x, y) && !m.ents.some((e) => e.x === x && e.y === y); };
// rooms carved out of rock and joined by tunnels (the caves)
function carve(b, id, floor, W2, H2, n, fl) {
  const seed = seedOf(id) + floor * 101, rooms = [];
  for (let i = 0; i < n; i++) {
    const rw = 4 + Math.floor(hash(seed, i, 1) * 5), rh = 3 + Math.floor(hash(seed, i, 2) * 4);
    const x = 2 + Math.floor(hash(seed, i, 3) * (W2 - rw - 4)), y = 3 + Math.floor(hash(seed, i, 4) * (H2 - rh - 5));
    rooms.push([x, y, rw, rh]); b.rect(x, y, rw, rh, fl);
  }
  rooms.sort((p, q) => p[0] - q[0]);
  for (let i = 0; i + 1 < rooms.length; i++) { const [ax, ay, aw, ah] = rooms[i], [bx, by, bw, bh] = rooms[i + 1]; b.road([[ax + (aw >> 1), ay + (ah >> 1)], [bx + (bw >> 1), by + (bh >> 1)]], fl); }
  return rooms;
}
const CAVE_TILES = { lime: ['limefloor', 'limewall', 'stalag'], sea: ['seafloor', 'seawall', 'seastone'], mine: ['minefloor', 'minewall', 'minecart'], ice: ['icefloor', 'icewall', 'icespike'], basalt: ['basfloor', 'baswall', 'bascol'], rock: ['cavefloor', 'cavewall', 'crock'] };
const CAVE_MUSIC = { lime: 'cave', sea: 'harbor', mine: 'cave', ice: 'sad', basalt: 'dark', rock: 'cave' };
const CAVE_GROUND = { lime: 'cave', sea: 'cave', mine: 'cave', ice: 'snow', basalt: 'cave', rock: 'cave' };

// ---------- the builders ----------
function buildCaveScene(id, floor, theme, floors, opts = {}) {
  const [fl, wl, st] = CAVE_TILES[theme] || CAVE_TILES.rock;
  const W2 = 34, H2 = 26, { b, m } = start(W2, H2, wl);
  const rooms = carve(b, id, floor, W2, H2, 8, fl);
  const first = rooms[0], last = rooms[rooms.length - 1];
  // the way out (daylight on the first floor) in a notch in the first room's north wall
  const upX = first[0] + 1, upY = first[1] - 1;
  b.set(upX, upY, fl);
  if (floor === 1 && !opts.hidden) m.ents.push({ type: 'exit', x: upX, y: upY, up: true });
  else stairs(m, upX, upY, floor === 1 ? opts.backTo : (floor === 2 ? id : `${id}/f${floor - 1}`), true, opts.backAt && floor === 1 ? { tx: opts.backAt[0], ty: opts.backAt[1], dir: 'd' } : {});
  // a mine's rails run along its tunnels; sea caves have tide pools; every cave its standing stones
  const seed = seedOf(id) + floor * 7;
  for (let y = 1; y < H2 - 1; y++) for (let x = 1; x < W2 - 1; x++) {
    if (b.get(x, y) !== fl || (Math.abs(x - upX) < 3 && Math.abs(y - upY) < 3)) continue;
    const h = hash(seed + x, y, 3);
    const nearWall = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => b.get(x + dx, y + dy) === wl).length;
    if (theme === 'mine' && nearWall === 2 && h < 0.5 && ((b.get(x - 1, y) === wl && b.get(x + 1, y) === wl) || (b.get(x, y - 1) === wl && b.get(x, y + 1) === wl))) b.set(x, y, 'rail');
    else if (nearWall === 1 && h < 0.07 && (() => { let f = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (b.get(x + i, y + j) === fl) f++; return f >= 6; })()) b.set(x, y, st);
    else if (theme === 'sea' && nearWall === 0 && h > 0.965) b.set(x, y, 'water');
  }
  // if the stones or pools cut any floor off from the way in, take them away again
  {
    const seen = new Set([upX + ',' + (upY + 1)]), q = [[upX, upY + 1]], open = (x, y) => { const k = b.get(x, y); return k === fl || k === 'rail'; };
    while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy, k = X + ',' + Y; if (!seen.has(k) && open(X, Y)) { seen.add(k); q.push([X, Y]); } } }
    let cut = false; for (let y = 1; y < H2 - 1 && !cut; y++) for (let x = 1; x < W2 - 1; x++) if (open(x, y) && !seen.has(x + ',' + y)) { cut = true; break; }
    if (cut) for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) if (b.get(x, y) === st || (theme === 'sea' && b.get(x, y) === 'water')) b.set(x, y, fl);
  }
  if (floor < floors) stairs(m, last[0] + last[2] - 2, last[1] + last[3] - 2, `${id}/f${floor + 1}`, false);
  // chests in the middle rooms; spots for treasures, far from the way in
  for (let i = 1; i < rooms.length - 1; i += 2) { const r = rooms[i]; chest(m, r[0] + r[2] - 1, r[1], `${id}_f${floor}_${i}`, null); }
  m.trSpots = rooms.slice(2, -1).map((r) => [r[0] + 1, r[1] + r[3] - 1]);
  // the deepest floor: the guardian waits in the last room with what he guards
  if (floor === floors && opts.guard) {
    const gx = last[0] + (last[2] >> 1), gy = last[1] + (last[3] >> 1);
    opts.guard(m, b, gx, gy, last);
  }
  const nm = L(`${PLACES[id][0]}　B${floor}`, `${PLACES[id][1]} B${floor}`);
  return finish(b, { id: floor === 1 && !opts.sub ? id : `${id}/${opts.sub || 'f' + floor}`, name: opts.name || nm, music: CAVE_MUSIC[theme] || 'cave', safe: false, enc: true, ents: m.ents, entry: [upX, upY + 1, 'd'], kind: 'cave', place: id, dark: theme !== 'ice', floor, terrain: CAVE_GROUND[theme], trSpots: m.trSpots });
}
// an island village: the sea all round, a beach, huts, a pier where the ferry ties up, a path inland
function buildIsle(id, sc) {
  const lake = !!sc.lake, W2 = 34, H2 = 24, water = lake ? 'water' : 'sea', { b, m } = start(W2, H2, water);
  const cx = 17, cy = 11;
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
    const d = ((x - cx) / 14.5) ** 2 + ((y - cy) / 10) ** 2 + (R2(id, x * 31 + y) - 0.5) * 0.12;
    if (d < 0.72) b.set(x, y, 'grass'); else if (d < 1) b.set(x, y, lake ? 'grass' : 'sand');
  }
  // the path in from the island's heart (the north edge) and down to the pier in the south
  b.road([[cx, 0], [cx, H2 - 5]]); b.road([[cx - 1, 0], [cx - 1, 2]]);
  for (let y = 0; y < 3; y++) { b.set(cx, y, 'path'); b.set(cx - 1, y, 'path'); }
  b.rect(cx + 1, H2 - 5, 2, 5, 'plank'); b.rect(cx - 1, H2 - 5, 2, 1, 'path');
  exit(m, cx, 0); exit(m, cx - 1, 0);
  b.road([[4, 11], [W2 - 5, 11]]);
  const doors = {};
  const lots = [[6, 5, 'inn'], [24, 5, 'item'], [5, 13, 'house0'], [24, 13, 'house1']];
  for (const [x, y, role] of lots) {
    const nm = role === 'inn' ? 'inn' : role === 'item' ? 'shop' : R2(id, x) < 0.5 ? 'straw' : 'hut';
    const d = obj(m, nm, x, y); if (d) { doors[role] = d; b.road([[d[0], d[1] + 1], [d[0], 11]]); }
  }
  for (const [role, d] of Object.entries(doors)) m.ents.push({ type: 'warp', to: `${id}/${role}`, tx: 0, ty: 0, dir: 'u', inside: true, x: d[0], y: d[1] });
  // nets drying, boats on the shore, palms and rocks
  prop(m, 12, 15, 'net'); prop(m, 21, 15, 'net');
  for (let i = 0; i < 9; i++) { const x = 2 + Math.floor(R2(id, 300 + i) * (W2 - 4)), y = 2 + Math.floor(R2(id, 310 + i) * (H2 - 4)); if (b.get(x, y) === 'grass' && b.get(x + 1, y) === 'grass' && b.get(x, y - 1) === 'grass' && freeAt(b, m, x, y) && freeAt(b, m, x + 1, y) && !taken(m, x, y - 1)) obj(m, R2(id, 320 + i) < 0.5 ? 'tree2' : 'tree', x, y - 1); }
  m.trSpots = [[8, 17], [26, 17], [9, 9], [27, 9]];
  return { b, m, entry: [cx, 1, 'd'], pier: [cx + 2, H2 - 2], cx };
}
// a hamlet: a mountain village of terraces and stone steps, a farming village among paddies, or a ferry
// crossing on a river bank; an inn, a shop and a couple of homes
function buildHamlet(id, theme) {
  const W2 = 34, H2 = 24, { b, m } = start(W2, H2, 'grass');
  const cx = 17;
  if (theme === 'mountain') {
    // cliffs along the top and sides, terraces stepping down
    for (let x = 0; x < W2; x++) { for (let y = 0; y < 3; y++) b.set(x, y, 'cliff'); }
    for (let y = 0; y < H2; y++) { b.set(0, y, 'cliff'); b.set(W2 - 1, y, 'cliff'); }
    for (const ty of [8, 15]) for (let x = 1; x < W2 - 1; x++) if (Math.abs(x - cx) > 1) b.set(x, ty, 'cliff');
    for (const ty of [8, 15]) { b.set(cx, ty, 'steps'); b.set(cx - 1, ty, 'steps'); }
    for (const [x0, y0] of [[3, 4], [22, 4], [3, 18]]) b.rect(x0, y0, 7, 2, 'paddy');
  } else if (theme === 'farm') {
    for (const [x0, y0, w, h] of [[2, 2, 9, 4], [23, 2, 9, 4], [2, 16, 6, 5], [26, 16, 6, 5]]) { b.rect(x0, y0, w, h, 'paddy'); for (let x = x0; x < x0 + w; x += 4) for (let y = y0; y < y0 + h; y++) b.set(x, y, 'path'); }
  } else if (theme === 'ferry') {
    // the river along the top with a pier, and a raft
    b.rect(0, 0, W2, 5, 'water'); b.rect(cx - 1, 0, 2, 6, 'plank'); b.rect(cx + 1, 2, 5, 1, 'plank');
  }
  // the road through (bottom to the right edge), lots for buildings
  b.road([[cx, H2 - 1], [cx, 6]]); b.road([[cx - 1, H2 - 1], [cx - 1, 6]]); b.road([[2, 11], [W2 - 3, 11]]);
  if (theme !== 'mountain') { b.road([[W2 - 3, 11], [W2 - 1, 11]]); exit(m, W2 - 1, 11); }
  exit(m, cx, H2 - 1); exit(m, cx - 1, H2 - 1);
  const doors = {};
  const lots = theme === 'mountain' ? [[4, 9, 'inn'], [24, 9, 'item'], [11, 3, 'house0'], [20, 16, 'house1']] : [[4, 7, 'inn'], [24, 7, 'item'], [9, 13, 'house0'], [21, 13, 'house1']];
  for (const [x, y, role] of lots) {
    const nm = role === 'inn' ? 'inn' : role === 'item' ? 'shop' : theme === 'farm' ? 'farmhouse' : theme === 'mountain' ? 'lodge' : 'cottage';
    const d = obj(m, nm, x, y); if (d) { doors[role] = d; if (b.get(d[0], d[1] + 1) !== 'cliff') b.set(d[0], d[1] + 1, 'path'); }
  }
  for (const [role, d] of Object.entries(doors)) m.ents.push({ type: 'warp', to: `${id}/${role}`, tx: 0, ty: 0, dir: 'u', inside: true, x: d[0], y: d[1] });
  if (theme === 'farm') { prop(m, 6, 17, 'scarecrow'); prop(m, 28, 3, 'scarecrow'); }
  if (theme === 'ferry') prop(m, cx + 4, 4, 'boat');
  obj(m, 'well', cx + 3, 12);
  for (let i = 0; i < 8; i++) { const x = 2 + Math.floor(R2(id, 400 + i) * (W2 - 4)), y = 3 + Math.floor(R2(id, 410 + i) * (H2 - 5)); if (freeAt(b, m, x, y) && freeAt(b, m, x + 1, y) && freeAt(b, m, x, y - 1) && freeAt(b, m, x + 1, y - 1) && b.get(x, y) === 'grass') obj(m, theme === 'mountain' ? 'pine' : R2(id, 420 + i) < 0.5 ? 'tree' : 'blossom', x, y - 1); }
  m.trSpots = [[3, 13], [30, 13], [12, 20], [26, 20]];
  return { b, m, entry: [cx, H2 - 2, 'u'], cx };
}
// a peak: a long climb by switchbacks between cliffs, a rest pavilion half way, the summit with its view
function buildPeak(id) {
  const W2 = 26, H2 = 56, { b, m } = start(W2, H2, 'cliff');
  // the zig-zag: ledges across the face joined by short climbs of steps
  let x = 13, y = H2 - 1, dir = R2(id, 1) < 0.5 ? -1 : 1;
  const pts = [[x, y]];
  b.rect(x - 1, y - 2, 3, 3, 'path');
  y -= 3; pts.push([x, y]);
  while (y > 9) {
    const nx = dir < 0 ? 3 + Math.floor(R2(id, y) * 3) : W2 - 4 - Math.floor(R2(id, y) * 3);
    for (let xx = Math.min(x, nx); xx <= Math.max(x, nx); xx++) { b.set(xx, y, 'path'); b.set(xx, y + 1, 'path'); if (b.get(xx, y + 2) === 'cliff' && R2(id, xx * 7 + y) < 0.3) b.set(xx, y + 2, 'grass'); }
    x = nx; const ny = y - 5 - Math.floor(R2(id, y + 50) * 2);
    for (let yy = ny; yy <= y; yy++) { b.set(x, yy, 'steps'); b.set(x + (dir < 0 ? 1 : -1), yy, 'steps'); }
    y = ny; dir = -dir; pts.push([x, y]);
  }
  // the summit
  b.rect(5, 1, 16, 8, 'grass'); b.rect(6, 2, 14, 6, 'snowg');
  for (let xx = Math.min(x, 13); xx <= Math.max(x, 13); xx++) { b.set(xx, 9, 'steps'); b.set(xx, 8, 'steps'); }
  // a pavilion half way, where a monk keeps tea for climbers
  const mid = pts[Math.floor(pts.length / 2)];
  b.rect(Math.max(1, mid[0] - 3), mid[1] - 1, 7, 3, 'grass');
  exit(m, 13, H2 - 1); exit(m, 12, H2 - 1); exit(m, 14, H2 - 1);
  // pines clinging to the rock above the ledges, bushes at their edges
  for (let i = 0; i < 60; i++) {
    const px = 1 + Math.floor(R2(id, 500 + i) * (W2 - 3)), py = 11 + Math.floor(R2(id, 530 + i) * (H2 - 14));
    const rock = (x2, y2) => b.get(x2, y2) === 'cliff';
    if (rock(px, py) && rock(px + 1, py) && rock(px, py - 1) && rock(px + 1, py - 1) && !taken(m, px, py) && !taken(m, px + 1, py) && !taken(m, px, py - 1) && !taken(m, px + 1, py - 1)) obj(m, 'pine', px, py - 1);
  }
  for (let i = 0; i < 26; i++) { const px = 1 + Math.floor(R2(id, 600 + i) * (W2 - 2)), py = 10 + Math.floor(R2(id, 630 + i) * (H2 - 12)); if (b.get(px, py) === 'path' && b.get(px, py - 1) === 'cliff' && R2(id, 660 + i) < 0.4) b.set(px, py, 'dbush'); }
  m.trSpots = [[7, 3], [18, 3]];
  return { b, m, entry: [13, H2 - 2, 'u'], mid, summit: [13, 4] };
}
// a waterfall: cliffs across the top, the fall into a pool, stepping stones along the edge to the water's foot
function buildFalls(id) {
  const W2 = 34, H2 = 26, { b, m } = start(W2, H2, 'grass');
  b.rect(0, 0, W2, 8, 'cliff');
  for (let y = 0; y < 8; y++) for (let x = 14; x < 20; x++) b.set(x, y, 'falls');
  // the pool
  b.rect(8, 8, 18, 6, 'water');
  for (let x = 13; x < 21; x++) b.set(x, 8, 'foam');
  // the hidden way: a dirt path along the pool's west bank, then stepping stones across the shallows to the
  // foot of the fall, where a gap in the falling water leads behind it
  b.road([[16, 15], [6, 15], [6, 9]]); b.road([[17, 16], [7, 16], [7, 9]]);
  for (let x = 8; x <= 13; x++) b.set(x, 9, 'stepstone');
  b.set(14, 9, 'stepstone'); b.set(14, 8, 'stepstone'); b.set(14, 7, 'fallsgap');
  m.ents.push({ type: 'warp', to: `${id}/f1`, tx: null, ty: null, dir: 'u', x: 14, y: 7, secret: true });
  b.road([[17, H2 - 1], [17, 15]]); b.road([[16, H2 - 1], [16, 15]]);
  exit(m, 17, H2 - 1); exit(m, 16, H2 - 1);
  for (let i = 0; i < 18; i++) { const x = 1 + Math.floor(R2(id, 600 + i) * (W2 - 3)), y = 9 + Math.floor(R2(id, 620 + i) * (H2 - 11)); if (freeAt(b, m, x, y) && freeAt(b, m, x + 1, y) && freeAt(b, m, x, y - 1) && freeAt(b, m, x + 1, y - 1) && b.get(x, y) === 'grass' && b.get(x, y - 1) === 'grass') obj(m, R2(id, 640 + i) < 0.4 ? 'pine' : 'tree2', x, y - 1); }
  for (const [x, y] of [[6, 9], [27, 9], [26, 13], [5, 14]]) if (b.get(x, y) === 'grass') b.set(x, y, 'rock');
  m.trSpots = [[3, 20], [30, 20]];
  return { b, m, entry: [17, H2 - 2, 'u'] };
}
// a grove of bamboo, the Yunmeng marsh or a gorge
function buildWild(id, theme) {
  if (theme === 'canyon') {
    const W2 = 24, H2 = 50, { b, m } = start(W2, H2, 'cliff');
    let x = 12;
    for (let y = 0; y < H2; y++) { x += Math.round((R2(id, y) - 0.5) * 2); x = Math.max(5, Math.min(W2 - 7, x)); for (let k = -2; k <= 2; k++) b.set(x + k, y, k === 0 ? 'dpath' : 'dgrass'); }
    // a chasm crossed by a rope bridge where the path meets it
    for (let xx = 1; xx < W2 - 1; xx++) for (const yy of [24, 25, 26]) b.set(xx, yy, 'chasm');
    const bx = (() => { for (let xx = 1; xx < W2; xx++) if (b.get(xx, 23) === 'dpath') return xx; return 12; })();
    for (let yy = 24; yy <= 26; yy++) for (let k = -1; k <= 1; k++) b.set(bx + k, yy, 'bridge');
    const bot = (() => { for (let xx = 1; xx < W2; xx++) if (b.get(xx, H2 - 1) === 'dpath') return xx; return 12; })(), top = (() => { for (let xx = 1; xx < W2; xx++) if (b.get(xx, 0) === 'dpath') return xx; return 12; })();
    exit(m, bot, H2 - 1); exit(m, top, 0);
    for (let i = 0; i < 20; i++) { const px = 1 + Math.floor(R2(id, 700 + i) * (W2 - 2)), py = 2 + Math.floor(R2(id, 720 + i) * (H2 - 4)); if (b.get(px, py) === 'dgrass' && R2(id, 740 + i) < 0.6) b.set(px, py, 'rock'); }
    m.trSpots = [[bot, H2 - 6], [top, 5]];
    return { b, m, entry: [bot, H2 - 2, 'u'], mid: [bx, 22] };
  }
  const W2 = 36, H2 = 28, marsh = theme === 'marsh', { b, m } = start(W2, H2, marsh ? 'mire' : 'bamboot');
  // a winding way through: a random walk that leaves open ground (or a boardwalk on the marsh)
  const path = marsh ? 'boardwalk' : 'dpath', side = marsh ? 'dgrass' : 'dgrass';
  let x = 18, y = H2 - 1;
  const walk = [];
  for (let s = 0; s < 420; s++) {
    walk.push([x, y]); b.set(x, y, path);
    if (!marsh) { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (R2(id, s * 4 + dx + dy * 2) < 0.35 && x + dx > 0 && x + dx < W2 - 1 && y + dy > 0 && y + dy < H2 - 1 && b.get(x + dx, y + dy) !== path) b.set(x + dx, y + dy, side); }
    const r = R2(id, 800 + s);
    if (r < 0.35 && y > 3) y--; else if (r < 0.6 && x > 3) x--; else if (r < 0.85 && x < W2 - 4) x++; else if (y < H2 - 2) y++;
  }
  // clearings: islands of dry ground in the marsh, glades in the bamboo
  const glades = [[8, 6], [27, 6], [6, 18], [29, 19], [18, 12]];
  for (const [gx, gy] of glades) { for (let j = -2; j <= 2; j++) for (let i = -3; i <= 3; i++) if (gx + i > 0 && gy + j > 0 && gx + i < W2 - 1 && gy + j < H2 - 1 && Math.abs(i) + Math.abs(j) < 5) b.set(gx + i, gy + j, side); b.road([[gx, gy], [18, 12]], path); }
  b.road([[18, H2 - 1], [18, 12]], path);
  if (marsh) for (let i = 0; i < 60; i++) { const px = 1 + Math.floor(R2(id, 900 + i) * (W2 - 2)), py = 1 + Math.floor(R2(id, 960 + i) * (H2 - 2)); if (b.get(px, py) === 'mire') b.set(px, py, 'reeds'); }
  exit(m, 18, H2 - 1);
  m.trSpots = [[glades[0][0] + 2, glades[0][1]], [glades[1][0] - 2, glades[1][1]]];
  return { b, m, entry: [18, H2 - 2, 'u'], glades };
}
// old ruins: broken walls, fallen pillars, a stele, and a stair to the crypt once it is found
function buildRuins(id) {
  const W2 = 34, H2 = 26, { b, m } = start(W2, H2, 'grass');
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) if (R2(id, x * 37 + y) < 0.12) b.set(x, y, ['weed', 'clover', 'flower2'][Math.floor(R2(id, x + y * 50) * 3)]);
  // the old wall's outline, broken in many places
  for (let x = 4; x < W2 - 4; x++) { if (R2(id, x) < 0.7) b.set(x, 4, 'rampart'); if (R2(id, x + 40) < 0.6 && Math.abs(x - 17) > 2) b.set(x, H2 - 5, 'rampart'); }
  for (let y = 4; y < H2 - 4; y++) { if (R2(id, y + 80) < 0.6) b.set(4, y, 'rampart'); if (R2(id, y + 120) < 0.6) b.set(W2 - 5, y, 'rampart'); }
  for (let i = 0; i < 14; i++) { const x = 5 + Math.floor(R2(id, 200 + i) * (W2 - 10)), y = 5 + Math.floor(R2(id, 220 + i) * (H2 - 10)); if (b.get(x, y) !== 'rampart') b.set(x, y, 'rubble'); }
  b.road([[17, H2 - 1], [17, 8]], 'dpath'); b.road([[16, H2 - 1], [16, 8]], 'dpath'); b.rect(12, 7, 10, 6, 'stone');
  exit(m, 17, H2 - 1); exit(m, 16, H2 - 1);
  obj(m, 'statue', 12, 5); obj(m, 'statue', 20, 5);
  // the old city's pillars, snapped off, and patches of dark grass where the halls stood
  for (const [x, y] of [[8, 11], [26, 11], [10, 19], [24, 19], [13, 14], [21, 14]]) if (freeAt(b, m, x, y)) prop(m, x, y, 'brokenpillar');
  for (let i = 0; i < 40; i++) { const x = 5 + Math.floor(R2(id, 260 + i) * (W2 - 10)), y = 5 + Math.floor(R2(id, 300 + i) * (H2 - 10)); if (b.get(x, y) === 'grass') b.set(x, y, R2(id, 340 + i) < 0.2 ? 'bush' : 'dgrass'); }
  for (const [x, y] of [[8, 8], [26, 9], [9, 17], [25, 17]]) if (freeAt(b, m, x, y) && freeAt(b, m, x + 1, y) && freeAt(b, m, x, y - 1) && freeAt(b, m, x + 1, y - 1)) obj(m, R2(id, x) < 0.5 ? 'deadtree' : 'oak', x, y - 1);
  m.trSpots = [[6, 6], [27, 20]];
  return { b, m, entry: [17, H2 - 2, 'u'] };
}
// a bandit camp: a palisade, a gate, tents round a fire, the chief's tent at the back
function buildCamp(id) {
  const W2 = 32, H2 = 24, { b, m } = start(W2, H2, 'dgrass');
  for (let x = 3; x < W2 - 3; x++) { b.set(x, 3, 'palisade'); b.set(x, H2 - 4, 'palisade'); }
  for (let y = 3; y < H2 - 3; y++) { b.set(3, y, 'palisade'); b.set(W2 - 4, y, 'palisade'); }
  b.set(16, H2 - 4, 'dpath'); b.set(15, H2 - 4, 'dpath');
  b.road([[16, H2 - 1], [16, 6]], 'dpath'); b.road([[15, H2 - 1], [15, 6]], 'dpath'); b.rect(6, 10, 20, 3, 'dpath');
  exit(m, 16, H2 - 1); exit(m, 15, H2 - 1);
  obj(m, 'tent2', 14, 4);
  for (const [x, y] of [[5, 5], [22, 5], [5, 14], [22, 14]]) obj(m, R2(id, x + y) < 0.5 ? 'tent' : 'tent2', x, y);
  obj(m, 'campfire', 11, 12); obj(m, 'firepit', 19, 12);
  for (const [x, y] of [[9, 6], [26, 17], [8, 17]]) obj(m, R2(id, x) < 0.5 ? 'barrel' : 'crate', x, y);
  obj(m, 'rack', 24, 10);
  for (let x = 0; x < W2; x += 2) { if (Math.abs(x - 15) > 3) obj(m, R2(id, x) < 0.5 ? 'tree' : 'pine', x, 0); }
  m.trSpots = [[7, 8], [25, 8]];
  return { b, m, entry: [16, H2 - 2, 'u'] };
}
// the lighthouse on its rocks, the beacon tower on the Wall, the hot spring, the hermit's hut on Penglai
function buildCoast(id, kind) {
  const W2 = 32, H2 = 24, { b, m } = start(W2, H2, 'grass');
  if (kind === 'lighthouse') {
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) { const d = x / W2 + (1 - y / H2) * 0.5 + (R2(id, x * 9 + y) - 0.5) * 0.08; if (d > 0.95) b.set(x, y, 'sea'); else if (d > 0.8) b.set(x, y, 'sand'); }
    for (let i = 0; i < 12; i++) { const x = 18 + Math.floor(R2(id, 50 + i) * 12), y = 2 + Math.floor(R2(id, 70 + i) * 18); if (b.get(x, y) === 'sand') b.set(x, y, 'srock'); }
    b.road([[8, H2 - 1], [8, 12], [16, 12], [16, 8]]);
    const d = obj(m, 'tower', 15, 4); if (d) m.ents.push({ type: 'warp', to: `${id}/top`, tx: 0, ty: 0, dir: 'u', inside: true, x: d[0], y: d[1] });
    exit(m, 8, H2 - 1);
    obj(m, 'cottage', 3, 3);
    m.trSpots = [[4, 18], [12, 18]];
    return { b, m, entry: [8, H2 - 2, 'u'] };
  }
  if (kind === 'tower') {
    for (let x = 0; x < W2; x++) { b.set(x, 3, 'rampart'); b.set(x, 4, 'rampart'); }
    b.rect(0, 0, W2, 3, 'sand');
    b.road([[16, H2 - 1], [16, 6]]); b.road([[15, H2 - 1], [15, 6]]);
    const d = obj(m, 'tower', 14, 5); if (d) m.ents.push({ type: 'warp', to: `${id}/top`, tx: 0, ty: 0, dir: 'u', inside: true, x: d[0], y: d[1] });
    for (const [x, y] of [[6, 10], [22, 10]]) obj(m, 'tent', x, y);
    obj(m, 'rack', 10, 14); obj(m, 'campfire', 21, 15);
    exit(m, 16, H2 - 1); exit(m, 15, H2 - 1);
    m.trSpots = [[4, 18], [27, 18]];
    return { b, m, entry: [16, H2 - 2, 'u'] };
  }
  if (kind === 'spring') {
    b.rect(5, 5, 8, 6, 'onsen'); b.rect(20, 6, 7, 5, 'onsen'); b.rect(11, 14, 9, 4, 'onsen');
    for (const [x, y] of [[4, 4], [13, 6], [19, 5], [27, 10], [10, 17], [20, 18]]) b.set(x, y, 'rock');
    b.road([[16, H2 - 1], [16, 12]]); b.road([[16, 12], [16, 4]], 'path');
    const d = obj(m, 'lodge', 14, 1); if (d) m.ents.push({ type: 'warp', to: `${id}/inn`, tx: 0, ty: 0, dir: 'u', inside: true, x: d[0], y: d[1] });
    exit(m, 16, H2 - 1);
    for (const [x, y] of [[2, 12], [28, 14], [3, 19], [27, 20]]) obj(m, 'blossom', x, y);
    m.trSpots = [[8, 20], [24, 20]];
    return { b, m, entry: [16, H2 - 2, 'u'] };
  }
  // the hermit's island: sea round three sides, a pier, a garden, the hut under the pines
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) { const d = ((x - 16) / 15) ** 2 + ((y - 10) / 11) ** 2; if (d > 1) b.set(x, y, 'sea'); else if (d > 0.82) b.set(x, y, 'sand'); }
  b.rect(16, H2 - 5, 2, 5, 'plank'); b.road([[16, H2 - 5], [16, 9]]);
  // a path over the rocks to the island's north shore, where a ship of your own may lie
  b.road([[21, 10], [27, 10], [27, 0]]); exit(m, 27, 0);
  obj(m, 'hut', 15, 4); b.rect(8, 9, 5, 3, 'flower3'); b.rect(20, 9, 5, 3, 'flower');
  for (const [x, y] of [[6, 4], [24, 4], [5, 13], [25, 13]]) obj(m, 'pine', x, y);
  m.trSpots = [[9, 16], [22, 16]];
  return { b, m, entry: [16, H2 - 3, 'u'], pier: [17, H2 - 2] };
}
// the room at the top of a lighthouse or a beacon tower
function buildTop(id, kind) {
  const W2 = 13, H2 = 10, { b, m } = start(W2, H2, 'iwall');
  b.room(0, 0, W2, H2, 'owall', kind === 'lighthouse' ? 'tanfloor' : 'brickfloor');
  b.set(6, H2 - 1, 'doormat');
  m.ents.push({ type: 'warp', to: id, tx: 0, ty: 0, dir: 'd', out: true, x: 6, y: H2 - 1 });
  return { b, m, entry: [6, H2 - 2, 'u'] };
}

// ---------- the people and stories of each place ----------
// guard: who waits in the place's deepest spot. fac: their side; lead: a name for the chief; n: how many;
// terrain: the battlefield; form: their formation; lines: what the chief says; win: what happens after.
// reward: what is given the first time (items, gold). folk: what people say (shown in turn).
const RW = (gold, ...items) => ({ gold, items });
export const SCENES = {
  luozhou: { music: 'harbor', story: 'conch',
    folk: [['螺洲的海螺號角，是我們的守護神。號角一響，風浪就退。', 'Conch Isle\'s great shell horn is our guardian. When it sounds, the waves fall back.'], ['上個月有一夥私鹽販子佔了潮音洞，把號角也搶走了。', 'Last month a gang of salt smugglers took the Tide-Voice Grotto, and the horn with them.'], ['退潮的時候，洞裡會唱歌。老人說那是龍王在嘆氣。', 'At low tide the grotto sings. The old folk say it\'s the Dragon King sighing.']],
    elder: [['老村長', 'Old Headman'], '把海螺號角拿回來吧，年輕人。沒有它，漁船都不敢出海了。', 'Bring back the conch horn, young ones. Without it no boat dares put to sea.'] },
  chaoyindong: { theme: 'sea', guard: { fac: 'shanyue', n: 4, lead: ['私鹽頭子「鹹魚張」', 'Salt-Fish Zhang, the smuggler chief'], terrain: 'cave', form: 'yulin', reward: RW(400, 'jinchuang', 'jinchuang'), key: 'conch', after: ['把海螺號角帶回螺洲村吧。', 'Take the conch horn back to Conch Isle.'] } },
  shanjuan: { theme: 'lime', guard: { fac: 'shanyue', n: 3, lead: ['山越的石匠頭目', 'the Shanyue stonecutters\' chief'], terrain: 'cave', form: 'fangyuan', reward: RW(500, 'tpdan', 'salve', 'salve') },
    tale: ['石壁上刻著一行字：「善卷不受天子之位，隱於此洞。」', 'Words are cut into the rock: "Shanjuan refused the throne of the Son of Heaven, and hid in this cave."'] },
  yuewang: { music: 'sad', crypt: true, guard: { fac: 'shanyue', n: 4, lead: ['盜墓的山越頭目', 'the Shanyue grave-robber chief'], terrain: 'cave', form: 'yulin', reward: RW(600, 'oldbook', 'smoke') },
    stele: ['殘碑上的字跡模糊：「……臥薪……嘗膽……勾踐……」碑腳的石板有一塊鬆動了。', 'The broken stele is worn: "...slept on brushwood... tasted gall... Goujian..." A flagstone at its foot is loose.'],
    folk: [['這裡是越王勾踐的故城。他睡柴草、嘗苦膽，最後滅了吳國。', 'This was the city of Goujian, King of Yue. He slept on brushwood and tasted gall, and in the end he destroyed Wu.'], ['夜裡有人在廢墟裡挖東西，還有燈火。', 'At night someone digs in the ruins. We see lamps.']] },
  tiantai: { music: 'temple', guard: { fac: 'free', n: 3, lead: ['天台山的劍客', 'the swordsman of Tiantai'], terrain: 'mountain', form: 'heyi', reward: RW(500, 'wine', 'wine', 'qingxin'), lines: ['到了山頂，便與我比一場。', 'You reached the summit; now cross blades with me.'] },
    monk: ['山道險，喝杯茶再走。（全軍恢復了一些。）', 'The path is steep. Have some tea before you go on. (The army recovers a little.)'],
    view: ['天台山頂。東邊是茫茫大海，北邊的會稽城像一粒米。', 'The summit of Tiantai. To the east the endless sea; to the north Kuaiji is a grain of rice.'] },
  yunqi: { music: 'village', folk: [['雲棲村在雲上。早上推開門，雲就在腳下。', 'Cloudrest sits above the clouds. Open your door at dawn and they lie at your feet.'], ['山下的竹海有個隱居的老書生，脾氣古怪。', 'An old scholar lives alone in the Bamboo Sea below. A strange temper, that one.'], ['孫家的人來了？那你們該去黃山拜一拜。', 'The Sun family? Then you should pay your respects at Huangshan.']],
    elder: [['採茶的婆婆', 'Old Tea-Picker'], '這是今年的頭茶。拿去，路上提神。', 'This is the first tea of the year. Take it; it will keep you awake on the road.'], gift: 'qingxin' },
  zhuhai: { music: 'temple', guard: { fac: 'sun_hao', n: 3, lead: ['孫暠的探子頭目', 'Sun Hao\'s chief scout'], terrain: 'forest', form: 'changshe', reward: RW(700, 'smoke', 'smoke', 'incense') },
    hermit: [['竹林的老書生', 'Scholar of the Bamboo'], '竹子空心，所以能彎不能折。年輕的主公，你也該學竹子。', 'Bamboo is hollow, so it bends and never breaks. Young lord, be like the bamboo.'], gift: 'bk_wind' },
  copper: { theme: 'mine', guard: { fac: 'liu_xun', n: 4, lead: ['劉勳的礦監', 'Liu Xun\'s mine overseer'], terrain: 'cave', form: 'fangyuan', reward: RW(900, 'gunpowder', 'gunpowder') },
    folk: [['劉勳把礦工都抓去挖銅，說要給黑蓮教鑄錢。', 'Liu Xun took every miner to dig copper; he says it is to mint coin for the Black Lotus.']] },
  fengqiao: { music: 'harbor', folk: [['楓葉紅的時候，這個渡口最美。', 'When the maples turn red, this ferry is the loveliest place on the river.'], ['過江往北就是居巢，往南是牛渚。', 'Across the river to the north is Juchao; to the south, Niuzhu.'], ['江上有水賊，夜裡別過江。', 'There are river pirates. Don\'t cross at night.']],
    guard: { fac: 'liu_xun', n: 3, lead: ['江上水賊的頭目', 'the river pirates\' captain'], terrain: 'ford', form: 'yulin', reward: RW(600, 'rations', 'rations'), lines: ['這渡口歸我們管，過江的都得交錢！', 'This ferry is ours. Anyone crossing pays!'] } },
  chimei: { music: 'tension', guard: { fac: 'shanyue', n: 4, lead: ['赤眉寨的寨主', 'the chief of Red-Brow Camp'], terrain: 'forest', form: 'fengshi', reward: RW(1200, 'jinchuang', 'jinchuang', 'wine') },
    captive: ['被抓的商人', 'A Captive Merchant'], freed: ['多謝將軍！寨主搶的貨，請隨意拿去。', 'Thank you, general! Take whatever the chief stole; it is yours.'] },
  jingbei: { music: 'harbor', folk: [['島的形狀像一條鯨魚的背，所以叫鯨背島。', 'The island is shaped like a whale\'s back, so we call it Whaleback.'], ['燈塔的老楊好幾天沒點燈了。好幾條船撞上了礁石。', 'Old Yang hasn\'t lit the lighthouse for days. Several boats have struck the reef.'], ['海盜就喜歡沒有燈的夜晚。', 'Pirates love a night without a light.']] },
  wanghai: { music: 'harbor', guard: { fac: 'pirate', n: 4, lead: ['佔了燈塔的海盜頭目', 'the pirate who seized the lighthouse'], terrain: 'river', form: 'yulin', reward: RW(1000, 'tpdan', 'jinchuang') },
    keeper: [['燈塔守老楊', 'Old Yang, the Keeper'], '海盜把我趕下來，自己佔了塔頂，故意熄燈讓船觸礁，好搶貨！', 'Pirates threw me out and took the top. They keep the lamp dark so ships hit the reef, and then they loot them!'], thanks: ['燈亮了！海上的人都會記得你們。', 'The lamp is lit! Every sailor on this sea will remember you.'] },
  xianglu: { music: 'temple', guard: { fac: 'huang_zu', n: 4, lead: ['藏在瀑布後的黃祖斥候', 'Huang Zu\'s scouts hidden behind the falls'], terrain: 'cave', form: 'yulin', reward: RW(1200, 'jinchuang', 'tpdan') },
    folk: [['飛流直下三千尺……瀑布後面好像有風吹出來。', 'It falls three thousand feet... and a breeze seems to blow from behind the water.'], ['小孩子說看見有人從瀑布裡走出來，渾身沒濕。', 'The children say they saw a man walk out of the waterfall, and he wasn\'t even wet.']] },
  daoxiang: { music: 'village', folk: [['今年稻子長得好，可是蔡家的兵說要收「軍糧」。', 'The rice grew well this year, but Cai\'s soldiers say they will take it as "army grain".'], ['長沙的黃老將軍常來村裡射野鴨。', 'Old General Huang of Changsha often comes here to shoot wild duck.']],
    elder: [['老農', 'Old Farmer'], '吃飽了才有力氣打仗。帶上這些。', 'You fight better on a full belly. Take these.'], gift: 'rations' },
  yunmeng: { music: 'dark', guard: { fac: 'cai_mao', n: 4, lead: ['蔡瑁的水寨頭目', 'Cai Mao\'s marsh captain'], terrain: 'marsh', form: 'changshe', reward: RW(1500, 'qingxin', 'jinchuang') },
    herbalist: [['採藥人', 'Herb-Gatherer'], '雲夢澤的藥草最靈。我迷路三天了……這些給你，帶我出去就好。', 'The herbs of Yunmeng are the best there are. I\'ve been lost three days... take these, just lead me out.'], gift: 'jinchuang' },
  junshan: { music: 'temple', lake: true, folk: [['君山上住著湘妃的魂。竹子上的斑點，是她的眼淚。', 'The spirits of the Xiang consorts live on Junshan. The spots on the bamboo are their tears.'], ['洞庭湖的魚又肥又鮮。', 'The fish of Dongting are fat and sweet.']],
    elder: [['廟祝', 'Shrine Keeper'], '湘妃竹做的笛子，吹起來能讓人心靜。送給你們。', 'A flute of Xiang bamboo. Its sound stills the heart. Take it.'], gift: 'qingxin' },
  zhuya: { music: 'harbor', folk: [['珠崖的人靠採珠過日子。', 'On Pearl Cliff we live by diving for pearls.'], ['南邊的珊瑚洞裡住著一群海盜，搶我們的珠子。', 'Pirates hole up in the Coral Grotto to the south and steal our pearls.']] },
  coral: { theme: 'sea', guard: { fac: 'pirate', n: 4, lead: ['珊瑚洞的海盜', 'the pirates of the Coral Grotto'], terrain: 'cave', form: 'yulin', reward: RW(1500, 'pearl') } },
  yunbao: { theme: 'lime', guard: { fac: 'pirate', n: 4, lead: ['海盜的軍師', 'the pirates\' strategist'], terrain: 'cave', form: 'heyi', reward: RW(2200, 'tpbig') } },
  sangtian: { music: 'village', folk: [['滄海桑田。這裡以前是淮水的河床。', 'Seas turn to mulberry fields. This was the bed of the Huai once.'], ['袁術稱帝以後，糧稅加了三倍。', 'Since Yuan Shu called himself emperor, the grain tax has tripled.']],
    elder: [['養蠶的姑娘', 'Silkworm Girl'], '這是我們村織的絹。送給將軍。', 'Silk woven in our village. For you, general.'], gift: 'silk' },
  taishan: { music: 'hymn', guard: { fac: 'yuan', n: 4, lead: ['袁家的封禪使', 'the Yuan family\'s envoy to the altar'], terrain: 'mountain', form: 'yanyue', reward: RW(3000, 'tpbig', 'jinchuang'), lines: ['袁公將在泰山封禪，閒人退下！', 'Lord Yuan will offer the great sacrifice on Mount Tai. Begone!'] },
    monk: ['十八盤，一步一步走。歇一歇吧。（全軍恢復了一些。）', 'Eighteen bends: one step at a time. Rest a while. (The army recovers a little.)'],
    view: ['泰山之巔。會當凌絕頂，一覽眾山小。', 'The top of Mount Tai. From the highest peak, every other mountain looks small.'] },
  penglai: { music: 'temple', hermit: [['蓬萊的隱士', 'Hermit of Penglai'], '能到這裡的人不多。我問你一句：天下什麼最重？', 'Few find their way here. I will ask you one thing: what is heaviest under heaven?'] },
  yinxu: { music: 'sad', crypt: true, guard: { fac: 'yuan', n: 4, lead: ['挖古物的袁軍校尉', 'a Yuan captain digging for relics'], terrain: 'cave', form: 'fangyuan', reward: RW(2600, 'oldbook', 'jade') },
    stele: ['龜甲上刻著古老的文字：「貞：王其田，亡災。」地上有一個被挖開又填回去的洞。', 'Ancient signs are cut into a tortoise shell: "Divined: the king hunts; no harm." Nearby a hole has been dug and filled in again.'],
    folk: [['這裡是商朝的舊都。農夫犁田，常常犁出刻字的骨頭。', 'This was the old capital of Shang. Farmers ploughing often turn up bones with writing on them.']] },
  huangtian: { music: 'tension', guard: { fac: 'yuan', n: 5, lead: ['黃巾餘黨的渠帥', 'the Yellow Turban remnants\' commander'], terrain: 'forest', form: 'fengshi', reward: RW(2800, 'jinchuang', 'jinchuang', 'tpdan') },
    captive: ['被擄的村民', 'A Captured Villager'], freed: ['蒼天已死，黃天當立……那都是騙人的。謝謝你們。', '"The blue sky is dead, the yellow sky shall rise"... it was all lies. Thank you.'] },
  mengjin: { music: 'harbor', folk: [['周武王在這裡會合八百諸侯，渡河伐紂。', 'King Wu of Zhou met eight hundred lords here and crossed the river to strike down Zhou Xin.'], ['黃河的水急，船夫要有本事。', 'The Yellow River runs fast; a ferryman needs skill.']],
    guard: { fac: 'dong', n: 4, lead: ['董卓的巡河校尉', 'Dong Zhuo\'s river patrol captain'], terrain: 'ford', form: 'tuzhen', reward: RW(3000, 'rations', 'jinchuang'), lines: ['奉相國之命，封鎖渡口！', 'By the Chancellor\'s order, this ferry is closed!'] } },
  hukou: { music: 'temple', guard: { fac: 'dong', n: 4, lead: ['藏在瀑布後的西涼兵', 'Xiliang soldiers hidden behind the falls'], terrain: 'cave', form: 'fengshi', reward: RW(3200, 'tpbig') },
    folk: [['黃河到這裡收進一個壺口，所以叫壺口瀑布。', 'Here the Yellow River pours into a mouth like a jar\'s, so we call it Hukou.'], ['水聲太大，瀑布後面藏了一支軍隊也聽不見。', 'The roar is so loud an army could hide behind the falls and no one would hear.']] },
  lishan: { music: 'temple', bath: ['泡在溫泉裡，傷痛都消了。（全軍兵力完全恢復！）', 'In the hot spring every ache melts away. (The whole army is fully restored!)'],
    hermit: [['泡湯的老人', 'Old Man in the Bath'], '周幽王在這裡點烽火戲諸侯，丟了天下。年輕人，別學他。', 'King You of Zhou lit the beacons here to make a joke of the lords, and lost the realm. Young man, don\'t be like him.'], gift: 'bk_revive' },
  fenghuo: { music: 'tension', guard: { fac: 'qiang', n: 4, lead: ['越過長城的羌騎頭目', 'a Qiang rider chief come over the Wall'], terrain: 'steppe', form: 'tuzhen', reward: RW(3500, 'jinchuang', 'tpdan') },
    captain: [['守臺的老兵', 'Old Beacon Guard'], '羌騎每晚都來偷襲，烽火都點不起來。若能打退他們，我們就能點燃烽火，向晉陽報信。', 'Qiang riders raid every night and we can\'t light the beacon. Drive them off and we can light it and warn Jinyang.'], thanks: ['烽火點起來了！看，下一座烽火臺也亮了！', 'The beacon is lit! Look, the next tower has lit too!'] },
  bingfeng: { theme: 'ice', guard: { fac: 'qiang', n: 4, lead: ['冰風洞的羌族巫師', 'the Qiang shaman of Icewind Cave'], terrain: 'snow', form: 'heyi', reward: RW(4000, 'tpbig', 'qingxin') } },
  ziwu: { music: 'tension', guard: { fac: 'sect', n: 4, lead: ['埋伏在谷中的黑蓮伏兵', 'a Black Lotus ambush in the gorge'], terrain: 'pass', form: 'changshe', reward: RW(4200, 'jinchuang', 'jinchuang'), lines: ['子午谷是黑蓮教的路，誰也別想過！', 'Ziwu Gorge is the Lotus road. No one passes!'] },
    folk: [['子午谷又窄又長，從長安直通漢中。', 'Ziwu Gorge is long and narrow; it runs straight from Chang\'an to Hanzhong.']] },
  emei: { music: 'hymn', guard: { fac: 'liu_zhang', n: 4, lead: ['峨眉山的武僧', 'the fighting monks of Emei'], terrain: 'mountain', form: 'bagua', reward: RW(4800, 'tpbig', 'jinchuang'), lines: ['想見金頂的佛光，先過我們這一關。', 'Would you see the Buddha\'s light on the Golden Summit? Get past us first.'] },
    monk: ['金頂上的雲海，一生要看一次。（全軍恢復了一些。）', 'The sea of clouds from the Golden Summit: see it once in your life. (The army recovers a little.)'],
    view: ['峨眉金頂。腳下是雲海，雲上有一圈七彩的光。', 'The Golden Summit of Emei. A sea of clouds below, and on the clouds a ring of seven-coloured light.'] },
  baishui: { music: 'temple', guard: { fac: 'nanman', n: 4, lead: ['瀑布後的南蠻猛士', 'the Nanman warriors behind the falls'], terrain: 'cave', form: 'yulin', reward: RW(5000, 'tpbig') },
    folk: [['白水像一匹布從天上掛下來。', 'The white water hangs from the sky like a bolt of cloth.'], ['孟獲的人說，瀑布後面是他們祖先的洞。', 'Meng Huo\'s people say the cave behind the falls belonged to their ancestors.']] },
  xuanwu: { theme: 'basalt', guard: { fac: 'nanman', n: 4, lead: ['玄武岩窟的蠻王', 'the Nanman king of the Basalt Grotto'], terrain: 'cave', form: 'fangyuan', reward: RW(5200, 'tpbig', 'jinchuang') } },
};
// ferries before (and after) you have a ship: [from, price, chapter it starts]
export const FERRIES = { luozhou: ['haiyan', 30, 1], jingbei: ['dongye', 80, 3], junshan: ['changsha', 120, 5], zhuya: ['hepu', 150, 5], penglai: ['linzi', 300, 7], yizhouisle: ['dongye', 300, 6] };
const KEY_ITEMS = { conch: ['海螺號角', 'Conch Horn'] };
for (const [k, [zh, en]] of Object.entries(KEY_ITEMS)) if (!ITEMS[k]) ITEMS[k] = { id: k, zh, en, kind: 'key', price: 0, desc: [`螺洲村的守護神號角。`, 'The guardian horn of Conch Isle.'] };

// ---------- putting each place together ----------
const ROOMS = new Set(['inn', 'item', 'house0', 'house1']);
const flag = (k) => !!S.flags[k];
// the guardian's army: the chief (two levels above the land's strongest) and his men, always the same people
export function guardFoes(id) {
  const gd = SCENES[id].guard, P = PLACES[id], Rg = REGIONS[P[5]], ch = Rg[4], hi = Rg[6];
  let pool = GEN_LIST.filter((g) => g.faction === gd.fac && !g.famous && !S.roster[g.id]);
  if (pool.length < 5) pool = GEN_LIST.filter((g) => !g.famous && g.faction === 'free' && !S.roster[g.id]);
  const s = seedOf(id), foes = [], used = new Set();
  const take1 = (k, f) => { const list = f ? pool.filter(f) : pool; for (let i = 0; i < list.length; i++) { const g = list[(s + k * 7 + i) % list.length]; if (!used.has(g.id)) { used.add(g.id); return g; } } return null; };
  const chief = take1(0, (g) => g.str >= 70) || take1(0);
  foes.push({ id: chief.id, lv: hi + 2, mul: 1.5 + 0.04 * ch, atkMul: 1.12 + 0.015 * ch });
  const n = gd.n || 4;
  for (let k = 1; k < n; k++) { const sage = k === n - 1 && ch >= 2; const g = take1(k, sage ? (x) => x.int >= 70 : null) || take1(k); if (g) foes.push({ id: g.id, lv: hi, mul: 1.5 + 0.04 * ch, atkMul: 1.12 + 0.015 * ch }); }
  return foes;
}
function guardNpc(m, id, x, y, dir = 'd') {
  const f = guardFoes(id)[0], g = GENERALS[f.id];
  m.ents.push({ type: 'npc', id: 'exg_' + id, look: g.look, equip: g.gear || {}, opts: { shield: g.shield, quiver: g.quiver }, x, y, dir, talk: `ex:${id}:guard`, mark: true, cond: (fl) => !fl['ex_' + id] });
}
const folkAt = (m, id, x, y, i, kind = 'folk') => person(m, x, y, folkLook(seedOf(id) + i * 13, kind), `ex:${id}:folk:${i}`, { wander: true, id: `exf_${id}_${i}` });
SCENE.build = (id, sub) => {
  const sc = sceneOf(id), D = SCENES[id] || {};
  if (!sc) return null;
  if (sub && ROOMS.has(sub)) return buildRoom(id, sub);
  const nFolk = (D.folk || []).length;
  switch (sc.t) {
    case 'cave': {
      const floor = sub ? +sub.slice(1) : 1;
      return buildCaveScene(id, floor, sc.theme, sc.floors || 2, { guard: (m, b, gx, gy) => guardNpc(m, id, gx, gy) });
    }
    case 'isle': {
      const { b, m, entry, pier } = buildIsle(id, sc);
      for (let i = 0; i < nFolk; i++) folkAt(m, id, 9 + i * 7, 9 + (i % 2) * 6, i, i === 0 ? 'sailor' : 'folk');
      if (D.elder) person(m, 17, 7, folkLook(seedOf(id) + 99, 'elder'), `ex:${id}:elder`, { mark: D.story === 'conch' ? !flag('ex_conch_done') : !flag('ex_gift_' + id) });
      person(m, pier[0], pier[1] - 1, folkLook(seedOf(id) + 7, 'sailor'), `ex:${id}:boat`, { dir: 'u' });
      return done(id, sub, b, m, { music: D.music || 'harbor', entry });
    }
    case 'hamlet': {
      const { b, m, entry, cx } = buildHamlet(id, sc.theme);
      for (let i = 0; i < nFolk; i++) folkAt(m, id, 6 + i * 9, 18 - (i % 2) * 5, i, sc.theme === 'ferry' && i === 0 ? 'sailor' : 'folk');
      if (D.elder) person(m, cx + 3, 9, folkLook(seedOf(id) + 99, 'elder'), `ex:${id}:elder`, { mark: !flag('ex_gift_' + id) });
      if (D.guard) guardNpc(m, id, cx + 2, 5, 'd');
      return done(id, sub, b, m, { music: D.music || 'village', entry });
    }
    case 'peak': {
      const { b, m, entry, mid, summit } = buildPeak(id);
      person(m, mid[0], mid[1] - 1, folkLook(seedOf(id) + 5, 'monk'), `ex:${id}:monk`);
      prop(m, summit[0] + 3, summit[1] - 1, 'pavilion');
      prop(m, summit[0] - 4, summit[1] - 2, 'view', { talk: `ex:${id}:view` });
      if (D.guard) guardNpc(m, id, summit[0], summit[1] + 2, 'd');
      return done(id, sub, b, m, { music: D.music || 'temple', entry, enc: true, terrain: 'mountain' });
    }
    case 'falls': {
      if (sub === 'f1') return buildCaveScene(id, 1, 'rock', 1, { hidden: true, backTo: id, backAt: [13, 9], sub: 'f1', name: L(`${PLACES[id][0]}・水簾洞`, `${PLACES[id][1]}: Cave Behind the Water`), guard: (m, b, gx, gy) => guardNpc(m, id, gx, gy) });
      const { b, m, entry } = buildFalls(id);
      for (let i = 0; i < nFolk; i++) folkAt(m, id, 6 + i * 20, 18, i);
      return done(id, sub, b, m, { music: D.music || 'temple', entry });
    }
    case 'wild': {
      const r = buildWild(id, sc.theme), { b, m, entry } = r;
      for (let i = 0; i < nFolk; i++) folkAt(m, id, entry[0] + 2, entry[1] - 3 - i * 2, i);
      if (r.glades) {
        const g0 = r.glades[4];
        if (D.guard) guardNpc(m, id, g0[0], g0[1] - 1);
        const who = D.hermit || D.herbalist;
        if (who) person(m, r.glades[2][0], r.glades[2][1], folkLook(seedOf(id) + 77, D.hermit ? 'elder' : 'folk'), `ex:${id}:${D.hermit ? 'hermit' : 'herbalist'}`, { mark: !flag('ex_gift_' + id) });
      } else if (D.guard) guardNpc(m, id, r.mid[0], r.mid[1]);
      return done(id, sub, b, m, { music: D.music || 'temple', entry, enc: true, terrain: { bamboo: 'forest', marsh: 'marsh', canyon: 'pass' }[sc.theme] });
    }
    case 'ruins': {
      if (sub === 'f1') return buildCaveScene(id, 1, 'rock', 1, { hidden: true, backTo: id, backAt: [17, 11], sub: 'f1', name: L(`${PLACES[id][0]}・地宮`, `${PLACES[id][1]}: the Crypt`), guard: (m, b, gx, gy) => guardNpc(m, id, gx, gy) });
      const { b, m, entry } = buildRuins(id);
      prop(m, 17, 8, 'stele', { talk: `ex:${id}:stele` });
      m.ents.push({ type: 'stairs', x: 17, y: 10, to: `${id}/f1`, up: false, cond: (fl) => !!fl['ex_stele_' + id] });
      for (let i = 0; i < nFolk; i++) folkAt(m, id, 10 + i * 12, 16, i);
      return done(id, sub, b, m, { music: D.music || 'sad', entry });
    }
    case 'camp': {
      const { b, m, entry } = buildCamp(id);
      guardNpc(m, id, 15, 8);
      for (let i = 0; i < 3; i++) m.ents.push(npc(`exb_${id}_${i}`, folkLook(seedOf(id) + i * 31, 'guard'), `ex:${id}:bandit`, { x: [9, 22, 16][i], y: [9, 9, 15][i], dir: 'd', cond: (fl) => !fl['ex_' + id] }));
      if (D.captive) person(m, 20, 17, folkLook(seedOf(id) + 3, 'merchant'), `ex:${id}:captive`, { cond: (fl) => !!fl['ex_' + id] && !fl['ex_freed_' + id], mark: true });
      return done(id, sub, b, m, { music: D.music || 'tension', entry });
    }
    case 'lighthouse': case 'tower': {
      if (sub === 'top') {
        const { b, m, entry } = buildTop(id, sc.t);
        if (sc.t === 'lighthouse') { prop(m, 6, 2, 'lamp', { cond: (fl) => !!fl['ex_' + id] }); prop(m, 6, 2, 'deadlamp', { cond: (fl) => !fl['ex_' + id] }); }
        else prop(m, 6, 2, 'beacon');
        guardNpc(m, id, 6, 5);
        return done(id, sub, b, m, { music: 'tension', entry, name: L(`${PLACES[id][0]}・頂層`, `${PLACES[id][1]}: the Top`) });
      }
      const { b, m, entry } = buildCoast(id, sc.t);
      person(m, entry[0] + 2, entry[1] - 4, folkLook(seedOf(id) + 1, sc.t === 'tower' ? 'guard' : 'elder'), `ex:${id}:keeper`, { mark: !flag('ex_' + id) });
      return done(id, sub, b, m, { music: D.music || 'harbor', entry });
    }
    case 'spring': {
      const { b, m, entry } = buildCoast(id, 'spring');
      prop(m, 13, 11, 'altar', { talk: `ex:${id}:bath` });
      person(m, 21, 12, folkLook(seedOf(id) + 4, 'elder'), `ex:${id}:hermit`, { mark: !flag('ex_gift_' + id) });
      return done(id, sub, b, m, { music: D.music || 'temple', entry });
    }
    case 'hut': {
      const { b, m, entry, pier } = buildCoast(id, 'hut');
      person(m, 16, 7, 'b=m s=light hd=old h=long hc=white bd=b_winter t=robe tc=white l=wide lc=white f=sandals fc=brown', `ex:${id}:hermit`, { mark: !flag('ex_gift_' + id) });
      prop(m, 10, 13, 'crane'); prop(m, 22, 7, 'crane');
      person(m, pier[0], pier[1] - 1, folkLook(seedOf(id) + 7, 'sailor'), `ex:${id}:boat`, { dir: 'u' });
      return done(id, sub, b, m, { music: D.music || 'temple', entry });
    }
  }
  return null;
};

// ---------- what people say and do ----------
async function line(who, zh, en, face) { return say(who ? L(who[0], who[1]) : null, L(zh, en), face ? { face } : undefined); }
async function giveAll(rw, how = ['得到了', 'Received']) {
  if (!rw) return;
  if (rw.gold) { S.gold += rw.gold; sfx('chest'); await N(`${how[0]}${rw.gold}金。`, `${how[1]} ${rw.gold} gold.`); }
  const counts = {}; for (const it of rw.items || []) counts[it] = (counts[it] || 0) + 1;
  for (const [it, n] of Object.entries(counts)) { if (!ITEMS[it]) continue; if (ITEMS[it].tr) { await gainTreasure(it, how); continue; } give(it, n); sfx('chest'); await N(`${how[0]}「${ITEMS[it].zh}」${n > 1 ? '×' + n : ''}！`, `${how[1]} ${ITEMS[it].en}${n > 1 ? ' x' + n : ''}!`); }
}
export async function exploreTalk(e) {
  const [, id, key, arg] = (e.talk || '').split(':');
  const D = SCENES[id] || {}, P = PLACES[id];
  if (key === 'ferry') return ferryFrom(id);
  if (key === 'folk') { const ln = (D.folk || [])[+arg] || ['……', '...']; return say(L('百姓', 'Local'), L(ln[0], ln[1])); }
  if (key === 'bandit') return say(L('嘍囉', 'Bandit'), L('寨主就在裡面。想活命就快滾！', 'The chief is inside. Get lost if you want to live!'));
  if (key === 'guard') return guardian(id, e);
  if (key === 'boat') return ferryBack(id);
  if (key === 'view') return summitView(id);
  if (key === 'monk') { await line(['山中的僧人', 'Mountain Monk'], ...D.monk); healAll(0.3); sfx('heal'); return; }
  if (key === 'bath') { await N(...D.bath); healAll(1); sfx('heal'); return; }
  if (key === 'stele') {
    await N(...D.stele);
    if (!flag('ex_stele_' + id)) { S.flags['ex_stele_' + id] = 1; sfx('stairs'); await N('撬開鬆動的石板，下面露出了一道石階！', 'You prise up the loose flagstone: stone steps lead down into the dark!'); F.ents.push({ type: 'stairs', x: 17, y: 10, to: `${id}/f1`, up: false }); }
    return;
  }
  if (key === 'elder') {
    const [who, zh, en] = D.elder;
    if (D.story === 'conch') {
      if (flag('ex_conch_done')) return line(who, '號角又響了，漁船都出海了。謝謝你們。', 'The horn sounds again and the boats are out. Thank you.');
      if (have('conch')) {
        take('conch'); S.flags.ex_conch_done = 1; e.mark = false;
        await line(who, '這……這是我們的海螺號角！', 'This... this is our conch horn!');
        sfx('toll'); await N('嗚——號角聲傳遍了海面，浪頭一個接一個地退了下去。', 'Hoooo— the horn rolls over the sea, and the waves fall back one after another.');
        await line(who, '螺洲的人不會忘記你們。這些是村裡最好的東西。', 'Conch Isle will never forget you. Here is the best the village has.');
        return giveAll(RW(600, 'pearl', 'goodwine', 'jinchuang'));
      }
      return line(who, zh, en);
    }
    await line(who, zh, en);
    if (D.gift && !flag('ex_gift_' + id)) { S.flags['ex_gift_' + id] = 1; e.mark = false; await giveAll(RW(0, D.gift)); }
    return;
  }
  if (key === 'hermit' || key === 'herbalist') {
    if (id === 'penglai') return penglaiRiddle(e);
    const [who, zh, en] = D.hermit || D.herbalist;
    await line(who, zh, en);
    if (D.gift && !flag('ex_gift_' + id)) { S.flags['ex_gift_' + id] = 1; e.mark = false; await giveAll(RW(0, D.gift)); }
    return;
  }
  if (key === 'keeper') {
    const w = D.keeper || D.captain;
    if (flag('ex_' + id)) return line(w[0], D.thanks[0], D.thanks[1]);
    await line(w[0], w[1], w[2]);
    return N('（塔頂上傳來人聲。）', '(Voices drift down from the top of the tower.)');
  }
  if (key === 'captive') {
    S.flags['ex_freed_' + id] = 1; F.ents = F.ents.filter((x) => x !== e);
    await line(D.captive, D.freed[0], D.freed[1]);
    return giveAll(RW(Math.round(200 * REGIONS[P[5]][4]), 'salve', 'salve'));
  }
}
// the guardian's fight; the first win pays out (and lights the lamp, frees the captives, gives up the horn)
async function guardian(id, e) {
  const D = SCENES[id], gd = D.guard, P = PLACES[id];
  const foes = guardFoes(id), chief = foes[0];
  const nm = gd.lead ? L(gd.lead[0], gd.lead[1]) : genName(chief.id);
  await say(genName(chief.id), gd.lines ? L(gd.lines[0], gd.lines[1]) : L('闖進來的傢伙，一個也別想走！', 'Whoever comes in here does not leave!'), { face: chief.id });
  const c = await ask(null, L(`${nm}擋在前面。（Lv${chief.lv}，${foes.length}支部隊）要開戰嗎？`, `${nm} bars the way. (Lv${chief.lv}, ${foes.length} units) Fight?`), [L('開戰', 'Fight'), L('先準備', 'Not yet')], { back: 1 });
  if (c !== 0) return;
  for (const f of foes) S.met[f.id] = Math.max(S.met[f.id] || 0, 1);
  sfx('encounter');
  const r = await G().battle({ foes, terrain: gd.terrain || 'grass', canRun: true, capture: false, foeForm: gd.form, music: 'battle2', mayLose: true, region: P[5], intro: L(`${nm}率眾殺來！`, `${nm} charges with his men!`) });
  if (r !== 'win') { if (r === 'lose') { healAll(0.5); await N('敗退了……整頓兵馬再來吧。', 'Beaten back... regroup and try again.'); } return; }
  S.flags['ex_' + id] = 1;
  F.ents = F.ents.filter((x) => x !== e && !(x.id || '').startsWith('exb_' + id));
  await N(`擊敗了${nm}！`, `${nm} is beaten!`);
  await giveAll(gd.reward, ['戰利品：', 'Spoils:']);
  if (gd.key && !have(gd.key)) { give(gd.key); sfx('chest'); await N(`找到了「${ITEMS[gd.key].zh}」！`, `Found the ${ITEMS[gd.key].en}!`); }
  if (gd.after) await N(...gd.after);
  if (D.thanks && (P[4] === 'lighthouse' || P[4] === 'tower')) {
    if (P[4] === 'tower') S.flags.ex_fenghuo_lit = 1;
    sfx('toll'); await N(P[4] === 'tower' ? '烽火熊熊燃起，火光一座接一座傳向遠方。' : '燈塔重新點亮了，光芒照遍了海面。', P[4] === 'tower' ? 'The beacon blazes up, and the fire passes from tower to tower into the distance.' : 'The lighthouse burns again, its light sweeping the sea.');
    const [x, y, d] = [Math.round(F.px / 16), Math.round(F.py / 16), F.dir]; toMap(F.mapId, x, y, d);
  }
  if (D.captive) F.ents.push(npc(`exc_${id}`, folkLook(seedOf(id) + 3, 'merchant'), `ex:${id}:captive`, { x: 20, y: 17, px: 320, py: 272, hx: 20, hy: 17, dir: 'd', mark: true }));
}
async function penglaiRiddle(e) {
  const id = 'penglai', D = SCENES[id], [who, zh, en] = D.hermit;
  if (flag('ex_gift_' + id)) return line(who, '去吧。天下等著你。', 'Go. The realm is waiting for you.');
  await line(who, zh, en);
  const c = await ask(L(who[0], who[1]), L('天下什麼最重？', 'What is heaviest under heaven?'), [L('泰山', 'Mount Tai'), L('玉璽', 'The Imperial Seal'), L('百姓的心', 'The hearts of the people')]);
  if (c !== 2) return line(who, '再想想吧。等你想明白了再來。', 'Think again, and come back when you understand.');
  S.flags['ex_gift_' + id] = 1; e.mark = false;
  await line(who, '說得好。泰山會崩，玉璽會碎，只有人心載得動天下。這兩卷書，你帶去吧。', 'Well said. Mountains fall and seals break; only the hearts of the people can carry the realm. Take these scrolls.');
  return giveAll(RW(0, 'bk_stun', 'tpbig', 'tpbig'));
}

// ---------- ferries ----------
// from a harbour town a boatman offers the crossings that start there; on an island, the way back
const ferriesFrom = (place) => Object.entries(FERRIES).filter(([, f]) => f[0] === place && S.chapter >= f[2]);
export function populate(mapId, ents) {
  const [place, sub] = mapId.split('/');
  if (sub || !F.map) return;
  const m = F.map;
  if (!sceneOf(place) && ferriesFrom(place).length) ents.push({ type: 'npc', id: 'ferry_' + place, look: folkLook(seedOf(place) + 17, 'sailor'), x: Math.floor(m.w / 2) + 6, y: m.h - 5, dir: 'd', talk: `ex:${place}:ferry`, mark: false });
  if (place === 'yizhouisle') ents.push({ type: 'npc', id: 'ferryback_' + place, look: folkLook(91, 'sailor'), x: Math.floor(m.w / 2) - 6, y: m.h - 5, dir: 'd', talk: 'ex:yizhouisle:boat' });
}
export async function ferryFrom(place) {
  const list = ferriesFrom(place);
  if (!list.length) return say(L('船夫', 'Boatman'), L('今天不開船。', 'No boats today.'));
  const c = await ask(L('船夫', 'Boatman'), L('要搭船嗎？海上風浪大，船錢照收。', 'Need a boat? The sea is rough; the fare is the fare.'), [...list.map(([to, f]) => L(`往${PLACES[to][0]}（${f[1]}金）`, `To ${PLACES[to][1]} (${f[1]}g)`)), L('不用了', 'No thanks')], { back: list.length });
  if (c < 0 || c >= list.length) return;
  const [to, f] = list[c];
  if (S.gold < f[1]) return say(L('船夫', 'Boatman'), L('錢不夠啊。', 'You haven\'t the fare.'));
  S.gold -= f[1]; sfx('door');
  await N(`船帆張起，向${PLACES[to][0]}駛去……`, `The sail fills and the boat heads for ${PLACES[to][1]}...`);
  S.visited[to] = 1;
  await G().fade(() => { toMap(to); const pier = F.ents.find((x) => (x.talk || '').endsWith(':boat')); if (pier) { F.px = pier.x * 16; F.py = (pier.y - 1) * 16; F.dir = 'u'; } });
  playMusic(F.map.music || 'harbor');
}
async function ferryBack(id) {
  const f = FERRIES[id];
  if (!f) return;
  const from = f[0];
  const c = await ask(L('船夫', 'Boatman'), L(`要回${PLACES[from][0]}嗎？（回程順路，不收錢。）`, `Back to ${PLACES[from][1]}? (No charge; I'm going that way.)`), [L('回去', 'Go back'), L('不用', 'Not yet')], { back: 1 });
  if (c !== 0) return;
  sfx('door');
  await G().fade(() => { toMap(from); const e = F.ents.find((x) => x.id === 'ferry_' + from); if (e) { F.px = e.x * 16; F.py = (e.y - 1) * 16; } });
  playMusic(F.map.music || 'harbor');
}

// ---------- the view from a summit ----------
const pressed = (k) => input.pressed(k);
export function summitView(id) {
  const P = PLACES[id], D = SCENES[id];
  sfx('toll');
  return new Promise((res) => {
    let t = 0;
    const ov = overviewMap(1);
    const w = {
      update() { t++; const tap = input.takeTap(); if (t > 20 && (pressed('a') || pressed('b') || tap)) { sfx('cancel'); removeRaw(w); res(); } },
      draw() {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        // the land round the peak at three pixels a tile, slowly panning, with the peak in the middle
        const s = 3, vw = Math.ceil(W / s), vh = Math.ceil(H / s), pan = Math.sin(t / 120) * 10;
        const sx = Math.max(0, Math.min(WW - vw, P[2] - vw / 2 + pan)), sy = Math.max(0, Math.min(WH - vh, P[3] - vh / 2));
        ctx.imageSmoothingEnabled = false; ctx.drawImage(ov, sx, sy, vw, vh, 0, 0, vw * s, vh * s);
        // haze over the distance and clouds drifting by
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(220,235,255,0.55)'); g.addColorStop(0.5, 'rgba(220,235,255,0.1)'); g.addColorStop(1, 'rgba(220,235,255,0.35)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 9; i++) { const x = ((i * 97 + t * (0.3 + (i % 3) * 0.15)) % (W + 120)) - 60, y = 30 + (i * 53) % 200; ctx.fillRect(x, y, 50 + (i % 4) * 14, 6); ctx.fillRect(x + 10, y - 4, 30, 4); }
        for (const [pid, p] of Object.entries(PLACES)) { const X = (p[2] - sx) * s, Y = (p[3] - sy) * s; if (X < 0 || Y < 0 || X > W || Y > H || !(S.visited[pid] || pid === id)) continue; ctx.fillStyle = pid === id ? '#ffffff' : '#ffe070'; ctx.fillRect(X - 1, Y - 1, 3, 3); text(L(p[0], p[1]), X + 4, Y - 6, '#fff0c0'); }
        windowBox(8, H - 46, W - 16, 40); text(L(D.view[0], D.view[1]), 18, H - 38, '#ffffff'); text(L('（A／B 返回）', '(A / B to go back)'), W - 18, H - 22, '#a8b0c8', { align: 'right' });
      },
    };
    pushRaw(w);
  });
}
// for the test bot: the places to explore
export const SCENE_IDS = Object.keys(SCENES);
